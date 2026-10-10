import { Injectable } from '@nestjs/common';
import {
  duplicateRoomName,
  nextRoomNumber,
  normalizeRoomLabel,
  roomDisplayNames,
  roomTypeNeedsLabel,
  type CreateRoom,
  type ReorderRooms,
  type UpdateRoom,
} from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import type { Actor } from '../auth/actor.js';
import { conflict, notFound, unprocessable } from '../common/problem.js';
import type { Prisma, Room as RoomRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Enough for any short-term rental; also the most a reorder can list. */
const MAX_ACTIVE_ROOMS = 100;
const ORDER = [
  { position: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.RoomOrderByWithRelationInput[];

type Tx = Prisma.TransactionClient;

/**
 * Rooms and their walkthrough order. Names are derived from type, label and the room's own number
 * (roomDisplayNames). Numbers are given at creation (the next free one for the type, deleted rooms included) and never
 * change with the order, so reordering or deleting never renames a room; the only knock-on is that the first of a type
 * shows its number once a second arrives ("Kitchen" becomes "Kitchen 1"). Every change locks the property's row and
 * checks the resulting names, so two active rooms never share one; the database backs this with room_label_unique and
 * a unique (property, type, number).
 */
@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(actor: Actor, propertyId: string, includeArchived: boolean) {
    this.access.assert(actor, 'room:read', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    // Only admins can ask for archived rooms; everyone else sees the live checklist.
    const showArchived = includeArchived && this.access.can(actor, 'room:write', propertyId);
    const rooms = await this.prisma.room.findMany({
      where: { propertyId, ...(showArchived ? {} : { archivedAt: null }) },
      orderBy: ORDER,
    });
    return { items: named(rooms), nextCursor: null };
  }

  async create(actor: Actor, propertyId: string, input: CreateRoom) {
    const { items, created } = await this.createRooms(actor, propertyId, [input]);
    return items.find((r) => r.id === created[0])!;
  }

  /** Quick setup: adds several rooms at the end of the walkthrough, in the order given. Returns all rooms. */
  async createMany(actor: Actor, propertyId: string, rooms: CreateRoom[]) {
    const { items } = await this.createRooms(actor, propertyId, rooms);
    return { items, nextCursor: null };
  }

  async update(actor: Actor, id: string, input: UpdateRoom) {
    const found = await this.findWritable(actor, id);
    return this.prisma.$transaction(async (tx) => {
      const all = await this.lockRooms(tx, found.propertyId);
      const active = all.filter((r) => !r.archivedAt);
      const current = all.find((r) => r.id === id)!;
      const type = input.type ?? current.type;
      const next = {
        type,
        label: input.label !== undefined ? normalizeRoomLabel(input.label) : current.label,
        // A room keeps its number; one that changes type takes the next free number of its new type.
        number:
          type === current.type
            ? current.number
            : nextRoomNumber(
                all.filter((r) => r.id !== id),
                type,
              ),
      };
      if (roomTypeNeedsLabel(next.type) && next.label === null) {
        throw unprocessable('ROOM_LABEL_REQUIRED', 'Give an “Other” room a name.');
      }
      if (!current.archivedAt) assertUniqueNames(active.map((r) => (r.id === id ? { ...r, ...next } : r)));
      const saved = await tx.room.update({ where: { id }, data: next });
      return named(current.archivedAt ? [saved] : active.map((r) => (r.id === id ? saved : r))).find(
        (r) => r.id === id,
      )!;
    });
  }

  async archive(actor: Actor, id: string) {
    const room = await this.findWritable(actor, id);
    const archived = room.archivedAt
      ? room
      : await this.prisma.room.update({ where: { id }, data: { archivedAt: new Date() } });
    return named([archived])[0]!;
  }

  /** `roomIds` must be exactly the property's active rooms, in the new order. */
  async reorder(actor: Actor, propertyId: string, input: ReorderRooms) {
    this.access.assert(actor, 'room:write', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    return this.prisma.$transaction(async (tx) => {
      const active = (await this.lockRooms(tx, propertyId)).filter((r) => !r.archivedAt);
      const expected = new Set(active.map((r) => r.id));
      const given = new Set(input.roomIds);
      if (
        given.size !== input.roomIds.length ||
        given.size !== expected.size ||
        [...given].some((id) => !expected.has(id))
      ) {
        throw unprocessable('ROOM_SET_MISMATCH', "roomIds must list each of the property's active rooms exactly once");
      }
      // Only the order changes: numbers, and so names, stay as they are.
      for (const [index, id] of input.roomIds.entries()) {
        await tx.room.update({ where: { id }, data: { position: index } });
      }
      const rooms = await tx.room.findMany({ where: { propertyId, archivedAt: null }, orderBy: ORDER });
      return { items: named(rooms), nextCursor: null };
    });
  }

  private async createRooms(actor: Actor, propertyId: string, input: CreateRoom[]) {
    this.access.assert(actor, 'room:write', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    return this.prisma.$transaction(async (tx) => {
      const all = await this.lockRooms(tx, propertyId);
      const active = all.filter((r) => !r.archivedAt);
      if (active.length + input.length > MAX_ACTIVE_ROOMS) {
        throw unprocessable('TOO_MANY_ROOMS', `A property can have at most ${MAX_ACTIVE_ROOMS} rooms.`);
      }
      const start = active.reduce((max, r) => Math.max(max, r.position), -1) + 1;
      // Numbers in the order created, each the next free one for its type.
      const held: { type: RoomRow['type']; number: number }[] = [...all];
      const planned = input.map((r, i) => {
        const number = nextRoomNumber(held, r.type);
        held.push({ type: r.type, number });
        return { type: r.type, label: normalizeRoomLabel(r.label), number, position: start + i };
      });
      assertUniqueNames([...active, ...planned.map((r, i) => ({ ...r, id: `new-${i}` }))]);
      const created: string[] = [];
      for (const r of planned) created.push((await tx.room.create({ data: { propertyId, ...r } })).id);
      const rooms = await tx.room.findMany({ where: { propertyId, archivedAt: null }, orderBy: ORDER });
      return { items: named(rooms), created };
    });
  }

  /**
   * Locks the property (so concurrent room changes queue) and returns all its rooms, deleted ones included (they
   * hold their numbers), in walkthrough order.
   */
  private async lockRooms(tx: Tx, propertyId: string) {
    await tx.$queryRaw`SELECT 1 FROM "Property" WHERE id = ${propertyId}::uuid FOR UPDATE`;
    return tx.room.findMany({ where: { propertyId }, orderBy: ORDER });
  }

  private async findWritable(actor: Actor, id: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room || !this.access.can(actor, 'room:write', room.propertyId)) throw notFound('Room');
    return room;
  }

  private async assertPropertyExists(id: string) {
    const exists = await this.prisma.property.count({ where: { id } });
    if (!exists) throw notFound('Property');
  }
}

/**
 * The API's room shape, with display names. Active rooms are named together, in order; an archived room is named
 * on its own (it no longer counts towards anyone's numbering).
 */
function named(rooms: RoomRow[]) {
  const active = rooms.filter((r) => !r.archivedAt);
  const names = roomDisplayNames(active);
  return rooms.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    type: r.type,
    label: r.label,
    number: r.number,
    displayName: names.get(r.id) ?? roomDisplayNames([r]).get(r.id)!,
    position: r.position,
    archivedAt: r.archivedAt,
  }));
}

function assertUniqueNames(rooms: { id: string; type: RoomRow['type']; label: string | null; number: number }[]) {
  const taken = duplicateRoomName(roomDisplayNames(rooms).values());
  if (taken) {
    throw conflict(
      'ROOM_NAME_TAKEN',
      `There’s already a room called “${taken}” at this property. Give this one a different label.`,
      { name: taken },
    );
  }
}
