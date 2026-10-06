import { Injectable } from '@nestjs/common';
import type { CreateRoom, ReorderRooms, UpdateRoom } from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import type { Actor } from '../auth/actor.js';
import { notFound, unprocessable } from '../common/problem.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
    const items = await this.prisma.room.findMany({
      where: { propertyId, ...(showArchived ? {} : { archivedAt: null }) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return { items, nextCursor: null };
  }

  async create(actor: Actor, propertyId: string, input: CreateRoom) {
    this.access.assert(actor, 'room:write', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    const last = await this.prisma.room.aggregate({ where: { propertyId }, _max: { sortOrder: true } });
    return this.prisma.room.create({
      data: { propertyId, ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
  }

  async update(actor: Actor, id: string, input: UpdateRoom) {
    await this.findWritable(actor, id);
    return this.prisma.room.update({ where: { id }, data: input });
  }

  async archive(actor: Actor, id: string) {
    const room = await this.findWritable(actor, id);
    if (room.archivedAt) return room;
    return this.prisma.room.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  /** `roomIds` must be exactly the property's active rooms, in the new order. */
  async reorder(actor: Actor, propertyId: string, input: ReorderRooms) {
    this.access.assert(actor, 'room:write', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    return this.prisma.$transaction(async (tx) => {
      const active = await tx.room.findMany({ where: { propertyId, archivedAt: null }, select: { id: true } });
      const expected = new Set(active.map((r) => r.id));
      const given = new Set(input.roomIds);
      if (
        given.size !== input.roomIds.length ||
        given.size !== expected.size ||
        [...given].some((id) => !expected.has(id))
      ) {
        throw unprocessable('ROOM_SET_MISMATCH', "roomIds must list each of the property's active rooms exactly once");
      }
      for (const [index, id] of input.roomIds.entries()) {
        await tx.room.update({ where: { id }, data: { sortOrder: index } });
      }
      const items = await tx.room.findMany({ where: { propertyId, archivedAt: null }, orderBy: { sortOrder: 'asc' } });
      return { items, nextCursor: null };
    });
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
