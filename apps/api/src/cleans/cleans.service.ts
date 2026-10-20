import { Inject, Injectable } from '@nestjs/common';
import {
  MAX_CLEAN_PHOTOS_PER_ROOM_PHASE,
  roomDisplayNames,
  type AddCleanPhoto,
  type CleanQuery,
  type MissingCleanPhotos,
  type PhotoPhase,
} from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import type { Actor } from '../auth/actor.js';
import { CLOCK, localDate, type Clock } from '../common/clock.js';
import { fromIsoDate, toIsoDate } from '../common/dates.js';
import { conflict, notFound, unprocessable } from '../common/problem.js';
import { FilesService } from '../files/files.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

const PERSON = { select: { id: true, firstName: true, lastName: true } } as const;
const FILE = { select: { objectKey: true, contentType: true } } as const;
const SUMMARY = {
  property: {
    select: { id: true, name: true, city: true, timeZone: true, checkInTime: true, checkOutTime: true },
  },
  booking: { select: { kind: true, checkInDate: true, checkOutDate: true, checkOutTimeOverride: true } },
  assignedCleaner: PERSON,
} satisfies Prisma.CleanInclude;
const DETAIL = {
  ...SUMMARY,
  photos: { orderBy: { createdAt: 'asc' }, include: { file: FILE, thumbFile: FILE, uploadedBy: PERSON } },
} satisfies Prisma.CleanInclude;

type SummaryRow = Prisma.CleanGetPayload<{ include: typeof SUMMARY }>;
type DetailRow = Prisma.CleanGetPayload<{ include: typeof DETAIL }>;
type Workable = { propertyId: string; assignedCleanerId: string | null };

/** The most cleans one list returns (a cleaner's fortnight is a handful). */
const LIST_LIMIT = 500;

/**
 * Cleans (docs/spec.md, Phase 3). A turnover is created from its stay (see turnover.ts). Its assigned cleaner starts it
 * on its scheduled day (admins any day), photographs every active room before and after, and completes it, which needs
 * every one of those photos. Moves are conditional updates (`WHERE status = …`), and the database backs every rule
 * (clean_guard, clean_photo_guard). Owners see a property's cleans and photos without pay; a cleaner sees pay only on
 * their own cleans.
 */
@Injectable()
export class CleansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly files: FilesService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(actor: Actor, q: CleanQuery) {
    if (q.propertyId) this.access.assert(actor, 'clean:read', q.propertyId, 'Property');
    const rows = await this.prisma.clean.findMany({
      where: {
        ...this.access.propertyScope(actor, 'clean:read'),
        ...(q.propertyId ? { propertyId: q.propertyId } : {}),
        ...(q.from || q.to
          ? {
              scheduledDate: {
                ...(q.from ? { gte: fromIsoDate(q.from) } : {}),
                ...(q.to ? { lte: fromIsoDate(q.to) } : {}),
              },
            }
          : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.assignee === 'me' ? { assignedCleanerId: actor.userId } : {}),
      },
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
      take: LIST_LIMIT,
      include: SUMMARY,
    });
    return { items: await this.summaries(actor, rows) };
  }

  async get(actor: Actor, id: string) {
    const row = await this.prisma.clean.findUnique({ where: { id }, include: DETAIL });
    if (!row || !this.access.can(actor, 'clean:read', row.propertyId)) throw notFound('Clean');
    return this.detail(actor, row);
  }

  async photos(actor: Actor, id: string) {
    const detail = await this.get(actor, id);
    return { items: detail.rooms.flatMap((r) => [...r.before, ...r.after]) };
  }

  /**
   * SCHEDULED → IN_PROGRESS. The assigned cleaner may start only on the scheduled day in the property's time zone;
   * admins may start any day. Someone must be assigned.
   */
  async start(actor: Actor, id: string) {
    const clean = await this.findWorkable(actor, id);
    if (clean.status !== 'SCHEDULED') throw this.wrongState(clean.status, 'start');
    if (!clean.assignedCleanerId) {
      throw unprocessable('CLEAN_UNASSIGNED', 'No cleaner is assigned to this clean yet. Ask TruHost to assign one.');
    }
    const today = localDate(clean.property.timeZone, this.clock.now());
    const scheduled = toIsoDate(clean.scheduledDate);
    if (!this.access.can(actor, 'clean:manage', clean.propertyId) && today !== scheduled) {
      throw unprocessable('CLEAN_NOT_TODAY', 'This clean can only be started on its scheduled day.', {
        scheduledDate: scheduled,
        today,
      });
    }
    const { count } = await this.prisma.clean.updateMany({
      where: { id, status: 'SCHEDULED' },
      data: {
        status: 'IN_PROGRESS',
        startedAt: this.clock.now(),
        startedById: actor.userId,
        version: { increment: 1 },
      },
    });
    if (count !== 1) throw this.wrongState('IN_PROGRESS', 'start');
    return this.get(actor, id);
  }

  /** A room's BEFORE or AFTER photo (both renditions), while the clean is under way. Photos are never removed. */
  async addPhoto(actor: Actor, id: string, input: AddCleanPhoto) {
    const clean = await this.findWorkable(actor, id);
    if (clean.status !== 'IN_PROGRESS') throw this.wrongState(clean.status, 'photograph');
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const current = await tx.clean.findUniqueOrThrow({ where: { id }, select: { status: true } });
      if (current.status !== 'IN_PROGRESS') throw this.wrongState(current.status, 'photograph');
      const room = await tx.room.findFirst({
        where: { id: input.roomId, propertyId: clean.propertyId, archivedAt: null },
      });
      if (!room) throw unprocessable('UNKNOWN_ROOM', 'That room isn’t on this property’s checklist.');
      const taken = await tx.cleanPhoto.count({ where: { cleanId: id, roomId: input.roomId, phase: input.phase } });
      if (taken >= MAX_CLEAN_PHOTOS_PER_ROOM_PHASE) {
        throw unprocessable(
          'TOO_MANY_CLEAN_PHOTOS',
          `A room can hold at most ${MAX_CLEAN_PHOTOS_PER_ROOM_PHASE} ${input.phase === 'BEFORE' ? 'before' : 'after'} photos.`,
        );
      }
      const expect = { propertyId: clean.propertyId, purpose: 'CLEAN_PHOTO' as const };
      await this.files.verifyForAttach(tx, actor, input.fileId, expect);
      await this.files.verifyForAttach(tx, actor, input.thumbFileId, expect);
      await tx.cleanPhoto.create({
        data: {
          cleanId: id,
          propertyId: clean.propertyId,
          roomId: input.roomId,
          phase: input.phase,
          fileId: input.fileId,
          thumbFileId: input.thumbFileId,
          uploadedById: actor.userId,
        },
      });
    });
    return this.get(actor, id);
  }

  /** IN_PROGRESS → COMPLETE, once every active room has a BEFORE and an AFTER photo (422 lists what's missing). */
  async complete(actor: Actor, id: string) {
    const clean = await this.findWorkable(actor, id);
    if (clean.status !== 'IN_PROGRESS') throw this.wrongState(clean.status, 'complete');
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const rooms = await tx.room.findMany({
        where: { propertyId: clean.propertyId, archivedAt: null },
        orderBy: { position: 'asc' },
      });
      if (rooms.length === 0) {
        throw unprocessable(
          'CLEAN_NO_ROOMS',
          'This property has no rooms set up yet, so there’s nothing to photograph. Ask TruHost to add them.',
        );
      }
      const taken = await tx.cleanPhoto.findMany({ where: { cleanId: id }, select: { roomId: true, phase: true } });
      const has = new Set(taken.map((p) => `${p.roomId}:${p.phase}`));
      const names = roomDisplayNames(rooms);
      const missing: MissingCleanPhotos = rooms.flatMap((r) => {
        const phases = (['BEFORE', 'AFTER'] as const).filter((ph) => !has.has(`${r.id}:${ph}`));
        return phases.length ? [{ roomId: r.id, displayName: names.get(r.id) ?? '', phases: [...phases] }] : [];
      });
      if (missing.length) {
        throw unprocessable('CLEAN_MISSING_PHOTOS', 'Every room needs a before and an after photo.', { missing });
      }
      const { count } = await tx.clean.updateMany({
        where: { id, status: 'IN_PROGRESS' },
        data: {
          status: 'COMPLETE',
          completedAt: this.clock.now(),
          completedById: actor.userId,
          version: { increment: 1 },
        },
      });
      if (count !== 1) throw this.wrongState('COMPLETE', 'complete');
    });
    return this.get(actor, id);
  }

  // ── helpers ──

  /** Admins act on any clean; a cleaner only on cleans assigned to them, at a property they clean. */
  private canWork(actor: Actor, c: Workable): boolean {
    if (this.access.can(actor, 'clean:manage', c.propertyId)) return true;
    return c.assignedCleanerId === actor.userId && this.access.can(actor, 'clean:work', c.propertyId);
  }

  /** A clean the caller may act on; anything else (or someone else's clean) is not found. */
  private async findWorkable(actor: Actor, id: string) {
    const clean = await this.prisma.clean.findUnique({
      where: { id },
      include: { property: { select: { timeZone: true } } },
    });
    if (!clean || !this.canWork(actor, clean)) throw notFound('Clean');
    return clean;
  }

  private async lock(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT 1 FROM "Clean" WHERE id = ${id}::uuid FOR UPDATE`;
  }

  private wrongState(status: string, verb: 'start' | 'photograph' | 'complete') {
    const what =
      verb === 'start'
        ? 'This clean has already been started, or it isn’t scheduled.'
        : verb === 'photograph'
          ? 'Photos can only be added while the clean is in progress.'
          : 'Only a clean in progress can be completed.';
    return conflict(`CLEAN_${status}`, what);
  }

  /** Pay is for admins, and for the clean's own cleaner. */
  private seesPay(actor: Actor, c: Workable): boolean {
    return this.access.can(actor, 'clean:manage', c.propertyId) || c.assignedCleanerId === actor.userId;
  }

  /**
   * Each clean's window (check-out to the next arrival's check-in) and progress (rooms with both photos), worked out
   * for a whole list at once.
   */
  private async summaries(actor: Actor, rows: SummaryRow[]) {
    if (rows.length === 0) return [];
    const propertyIds = [...new Set(rows.map((r) => r.propertyId))];
    const earliest = rows.reduce((d, r) => (r.scheduledDate < d ? r.scheduledDate : d), rows[0]!.scheduledDate);
    const [arrivals, rooms, photos] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          propertyId: { in: propertyIds },
          status: 'CONFIRMED',
          kind: { in: ['GUEST', 'OWNER_STAY'] },
          checkInDate: { gte: earliest },
        },
        orderBy: { checkInDate: 'asc' },
        select: { id: true, propertyId: true, checkInDate: true, checkInTimeOverride: true },
      }),
      this.prisma.room.findMany({
        where: { propertyId: { in: propertyIds }, archivedAt: null },
        select: { id: true, propertyId: true },
      }),
      this.prisma.cleanPhoto.findMany({
        where: { cleanId: { in: rows.map((r) => r.id) } },
        select: { cleanId: true, roomId: true, phase: true },
        distinct: ['cleanId', 'roomId', 'phase'],
      }),
    ]);
    return rows.map((r) => {
      const next = arrivals.find(
        (b) => b.propertyId === r.propertyId && b.checkInDate >= r.scheduledDate && b.id !== r.bookingId,
      );
      const active = rooms.filter((room) => room.propertyId === r.propertyId);
      const taken = photos.filter((p) => p.cleanId === r.id);
      const done = active.filter((room) =>
        (['BEFORE', 'AFTER'] as PhotoPhase[]).every((ph) => taken.some((p) => p.roomId === room.id && p.phase === ph)),
      ).length;
      return this.shape(actor, r, next ?? null, { rooms: active.length, done });
    });
  }

  private shape(
    actor: Actor,
    r: SummaryRow,
    next: { checkInDate: Date; checkInTimeOverride: string | null } | null,
    progress: { rooms: number; done: number },
  ) {
    return {
      id: r.id,
      property: { id: r.property.id, name: r.property.name, city: r.property.city },
      kind: r.kind,
      status: r.status,
      scheduledDate: toIsoDate(r.scheduledDate),
      stay: r.booking
        ? {
            kind: r.booking.kind,
            checkInDate: toIsoDate(r.booking.checkInDate),
            checkOutDate: toIsoDate(r.booking.checkOutDate),
          }
        : null,
      window: {
        from: {
          date: toIsoDate(r.scheduledDate),
          time: r.booking ? (r.booking.checkOutTimeOverride ?? r.property.checkOutTime) : null,
        },
        until: next
          ? { date: toIsoDate(next.checkInDate), time: next.checkInTimeOverride ?? r.property.checkInTime }
          : null,
      },
      assignedCleaner: r.assignedCleaner,
      cleanerPayCents: this.seesPay(actor, r) ? r.cleanerPayCents : null,
      notes: r.notes,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      cancelledAt: r.cancelledAt,
      cancelReason: r.cancelReason,
      progress,
    };
  }

  private async detail(actor: Actor, row: DetailRow) {
    const [summary] = await this.summaries(actor, [row]);
    const rooms = await this.prisma.room.findMany({
      where: { propertyId: row.propertyId, archivedAt: null },
      orderBy: { position: 'asc' },
    });
    const names = roomDisplayNames(rooms);
    const photos = await Promise.all(
      row.photos.map(async (p) => ({
        ...(await this.files.photoLinks(p)),
        roomId: p.roomId,
        phase: p.phase,
        uploadedBy: p.uploadedBy,
        createdAt: p.createdAt,
      })),
    );
    const today = localDate(row.property.timeZone, this.clock.now());
    const work = this.canWork(actor, row);
    const manage = this.access.can(actor, 'clean:manage', row.propertyId);
    return {
      ...summary!,
      rooms: rooms.map((room) => ({
        id: room.id,
        displayName: names.get(room.id) ?? '',
        before: photos.filter((p) => p.roomId === room.id && p.phase === 'BEFORE'),
        after: photos.filter((p) => p.roomId === room.id && p.phase === 'AFTER'),
      })),
      today,
      can: {
        start:
          work &&
          row.status === 'SCHEDULED' &&
          row.assignedCleanerId !== null &&
          (manage || today === toIsoDate(row.scheduledDate)),
        addPhotos: work && row.status === 'IN_PROGRESS',
        complete: work && row.status === 'IN_PROGRESS',
      },
    };
  }
}
