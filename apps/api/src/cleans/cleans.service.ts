import { Inject, Injectable } from '@nestjs/common';
import {
  CLEAN_STEP_LABELS,
  MAX_CLEAN_PHOTOS_PER_ROOM_PHASE,
  roomDisplayNames,
  type AddCleanPhoto,
  type CleanChecklist,
  type CleanDamageCheck,
  type CleanQuery,
  type CleanStep,
  type MissingCleanPhotos,
  type PhotoPhase,
  type RecordSupplyLevels,
} from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import type { Actor } from '../auth/actor.js';
import { CLOCK, localDate, type Clock } from '../common/clock.js';
import { fromIsoDate, toIsoDate } from '../common/dates.js';
import { conflict, notFound, unprocessable } from '../common/problem.js';
import { FilesService } from '../files/files.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationsService, type PendingEmail } from '../notifications/notifications.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { supplyState } from '../supplies/alerts.js';
import { SuppliesService } from '../supplies/supplies.service.js';

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
type Db = PrismaService | Tx;
/** The checklist's steps before finishing, in order. */
const STEPS = ['BEFORE_PHOTOS', 'DAMAGE', 'STOCK_COUNT', 'AFTER_PHOTOS'] as const;

/** Where a clean's checklist stands (CleanChecklist, plus what the checks need). */
interface Progress {
  roomCount: number;
  missing: MissingCleanPhotos;
  done: Record<(typeof STEPS)[number], boolean>;
  checklist: CleanChecklist;
}

/** The most cleans one list returns (a cleaner's fortnight is a handful). */
const LIST_LIMIT = 500;

/**
 * Cleans (docs/spec.md, Phase 3). A turnover is created from its stay (see turnover.ts). Its assigned cleaner starts it
 * on its scheduled day (admins any day) and works its checklist in order: a before photo of every active room, the
 * damage question (yes needs a damage report sent from the clean), a count of every supply, an after photo of every
 * room, then "Clean finished", which tells the admins and the property's owners it's ready. Each step opens once the
 * ones before it are done. Moves are conditional updates (`WHERE status = …`), and the database backs every rule
 * (clean_guard, clean_photo_guard, supply_status_clean_guard). Owners see a property's cleans and photos without pay;
 * a cleaner sees pay only on their own cleans.
 */
@Injectable()
export class CleansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly files: FilesService,
    private readonly supplies: SuppliesService,
    private readonly notifications: NotificationsService,
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
      const current = await tx.clean.findUniqueOrThrow({ where: { id } });
      if (current.status !== 'IN_PROGRESS') throw this.wrongState(current.status, 'photograph');
      if (input.phase === 'AFTER') this.assertReady(await this.progress(tx, null, current), 'AFTER_PHOTOS');
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

  /**
   * The checklist's damage question. Answering opens once every room has its before photo; "no" can't follow a damage
   * report already sent from this clean (422 CLEAN_DAMAGE_REPORTED). Yes is done once such a report is sent.
   */
  async checkDamage(actor: Actor, id: string, input: CleanDamageCheck) {
    const clean = await this.findWorkable(actor, id);
    if (clean.status !== 'IN_PROGRESS') throw this.wrongState(clean.status, 'check');
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const current = await tx.clean.findUniqueOrThrow({ where: { id } });
      if (current.status !== 'IN_PROGRESS') throw this.wrongState(current.status, 'check');
      this.assertReady(await this.progress(tx, null, current), 'DAMAGE');
      if (!input.found) {
        const sent = await tx.damageReport.count({ where: { cleanId: id, status: { not: 'DRAFT' } } });
        if (sent > 0) {
          throw unprocessable('CLEAN_DAMAGE_REPORTED', 'You’ve already sent a damage report from this clean.');
        }
      }
      const { count } = await tx.clean.updateMany({
        where: { id, status: 'IN_PROGRESS' },
        data: { damageFound: input.found, version: { increment: 1 } },
      });
      if (count !== 1) throw this.wrongState('COMPLETE', 'check');
    });
    return this.get(actor, id);
  }

  /**
   * The checklist's stock count: a level for every active supply, recorded as readings on this clean (alerts as any
   * reading). Opens once the damage question is done; it can be counted again until the clean is finished.
   */
  async countStock(actor: Actor, id: string, input: RecordSupplyLevels) {
    const clean = await this.findWorkable(actor, id);
    if (clean.status !== 'IN_PROGRESS') throw this.wrongState(clean.status, 'check');
    this.access.assert(actor, 'supply:record', clean.propertyId, 'Clean');
    await this.supplies.recordReadings(actor, clean.propertyId, input.readings, {
      cleanId: id,
      before: async (tx) => {
        await this.lock(tx, id);
        const current = await tx.clean.findUniqueOrThrow({ where: { id } });
        if (current.status !== 'IN_PROGRESS') throw this.wrongState(current.status, 'check');
        this.assertReady(await this.progress(tx, null, current), 'STOCK_COUNT');
      },
    });
    return this.get(actor, id);
  }

  /**
   * IN_PROGRESS → COMPLETE ("Clean finished"), once every step is done: 422 CLEAN_MISSING_PHOTOS lists the rooms and
   * phases still without a photo, 422 CLEAN_CHECKLIST_INCOMPLETE names the step waited on. Tells the admins and the
   * property's owners the place is ready.
   */
  async complete(actor: Actor, id: string) {
    const clean = await this.findWorkable(actor, id);
    if (clean.status !== 'IN_PROGRESS') throw this.wrongState(clean.status, 'complete');
    let emails: PendingEmail[] = [];
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const current = await tx.clean.findUniqueOrThrow({ where: { id } });
      const progress = await this.progress(tx, null, current);
      if (progress.roomCount === 0) {
        throw unprocessable(
          'CLEAN_NO_ROOMS',
          'This property has no rooms set up yet, so there’s nothing to photograph. Ask TruHost to add them.',
        );
      }
      this.assertReady(progress, 'FINISH');
      const now = this.clock.now();
      const { count } = await tx.clean.updateMany({
        where: { id, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETE', completedAt: now, completedById: actor.userId, version: { increment: 1 } },
      });
      if (count !== 1) throw this.wrongState('COMPLETE', 'complete');
      const [property, cleaner] = await Promise.all([
        tx.property.findUniqueOrThrow({ where: { id: clean.propertyId }, select: { id: true, name: true } }),
        tx.user.findUniqueOrThrow({
          where: { id: actor.userId },
          select: { id: true, firstName: true, lastName: true },
        }),
      ]);
      emails = await this.notifications.cleanCompleted(tx, {
        property,
        clean: {
          id,
          rooms: progress.roomCount,
          damageReports: progress.checklist.damage.reports.filter((r) => r.status !== 'DRAFT').length,
          restock: progress.checklist.stockCount.restock.length,
        },
        cleaner,
      });
    });
    await this.notifications.sendAfterCommit(emails);
    return this.get(actor, id);
  }

  /**
   * A damage report made from a clean's checklist (DamageService.create, in its transaction): the clean is the
   * caller's to work, at the report's property, in progress, with its before photos done. Answers the damage question
   * yes.
   */
  async reportDamageFrom(tx: Tx, actor: Actor, cleanId: string, propertyId: string) {
    const clean = await tx.clean.findUnique({ where: { id: cleanId } });
    if (!clean || clean.propertyId !== propertyId || !this.canWork(actor, clean)) {
      throw unprocessable('UNKNOWN_CLEAN', 'That clean isn’t one you’re working at this property.');
    }
    await this.lock(tx, cleanId);
    const current = await tx.clean.findUniqueOrThrow({ where: { id: cleanId } });
    if (current.status !== 'IN_PROGRESS') throw this.wrongState(current.status, 'check');
    this.assertReady(await this.progress(tx, null, current), 'DAMAGE');
    if (current.damageFound !== true) {
      await tx.clean.update({ where: { id: cleanId }, data: { damageFound: true, version: { increment: 1 } } });
    }
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

  private wrongState(status: string, verb: 'start' | 'photograph' | 'check' | 'complete') {
    const what = {
      start: 'This clean has already been started, or it isn’t scheduled.',
      photograph: 'Photos can only be added while the clean is in progress.',
      check: 'The checklist can only be worked while the clean is in progress.',
      complete: 'Only a clean in progress can be completed.',
    }[verb];
    return conflict(`CLEAN_${status}`, what);
  }

  /**
   * Where a clean's checklist stands. `actor` decides which of its damage reports show (drafts only to their reporter
   * and admins); null (the checks) counts them all.
   */
  private async progress(
    db: Db,
    actor: Actor | null,
    c: { id: string; propertyId: string; status: string; damageFound: boolean | null },
  ): Promise<Progress> {
    const [rooms, photos, reports, items, counted] = await Promise.all([
      db.room.findMany({ where: { propertyId: c.propertyId, archivedAt: null }, orderBy: { position: 'asc' } }),
      db.cleanPhoto.findMany({
        where: { cleanId: c.id },
        select: { roomId: true, phase: true },
        distinct: ['roomId', 'phase'],
      }),
      db.damageReport.findMany({
        where: { cleanId: c.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, title: true, status: true, reportedById: true, _count: { select: { photos: true } } },
      }),
      db.supplyItem.findMany({
        where: { propertyId: c.propertyId, archivedAt: null },
        select: { id: true, name: true, thresholdPct: true },
      }),
      db.supplyStatus.findMany({
        where: { cleanId: c.id },
        orderBy: [{ reportedAt: 'desc' }, { id: 'desc' }],
        select: { supplyItemId: true, levelPct: true },
      }),
    ]);
    const has = new Set(photos.map((p) => `${p.roomId}:${p.phase}`));
    const names = roomDisplayNames(rooms);
    const missing: MissingCleanPhotos = rooms.flatMap((r) => {
      const phases = (['BEFORE', 'AFTER'] as const).filter((ph) => !has.has(`${r.id}:${ph}`));
      return phases.length ? [{ roomId: r.id, displayName: names.get(r.id) ?? '', phases: [...phases] }] : [];
    });
    // This clean's latest level for each active item.
    const level = new Map<string, number>();
    for (const r of counted) if (!level.has(r.supplyItemId)) level.set(r.supplyItemId, r.levelPct);
    const restock = items
      .flatMap((i) => {
        const pct = level.get(i.id);
        const state = pct === undefined ? null : supplyState(pct, i.thresholdPct);
        return state === 'LOW' || state === 'OUT' ? [{ id: i.id, name: i.name, levelPct: pct!, state }] : [];
      })
      .sort((a, b) => a.levelPct - b.levelPct || a.name.localeCompare(b.name));
    const sent = reports.some((r) => r.status !== 'DRAFT');
    const done = {
      BEFORE_PHOTOS: rooms.length > 0 && rooms.every((r) => has.has(`${r.id}:BEFORE`)),
      DAMAGE: c.damageFound === false || (c.damageFound === true && sent),
      STOCK_COUNT: items.every((i) => level.has(i.id)),
      AFTER_PHOTOS: rooms.length > 0 && rooms.every((r) => has.has(`${r.id}:AFTER`)),
    };
    const seesDrafts = (reporter: string) =>
      actor === null || reporter === actor.userId || this.access.can(actor, 'damage:manage', c.propertyId);
    return {
      roomCount: rooms.length,
      missing,
      done,
      checklist: {
        beforePhotos: { done: done.BEFORE_PHOTOS },
        damage: {
          found: c.damageFound,
          reports: reports
            .filter((r) => r.status !== 'DRAFT' || seesDrafts(r.reportedById))
            .map((r) => ({ id: r.id, title: r.title, status: r.status, photoCount: r._count.photos })),
          done: done.DAMAGE,
        },
        stockCount: {
          items: items.length,
          counted: items.filter((i) => level.has(i.id)).length,
          done: done.STOCK_COUNT,
          restock,
        },
        afterPhotos: { done: done.AFTER_PHOTOS },
        current: c.status === 'IN_PROGRESS' ? (STEPS.find((st) => !done[st]) ?? 'FINISH') : null,
      },
    };
  }

  /** Every step before `step` is done; otherwise the first one waited on (photos list what's missing). */
  private assertReady(p: Progress, step: CleanStep) {
    const before = step === 'FINISH' ? STEPS : STEPS.slice(0, STEPS.indexOf(step));
    const waitingOn = before.find((st) => !p.done[st]);
    if (!waitingOn) return;
    if (step === 'FINISH' && (waitingOn === 'BEFORE_PHOTOS' || waitingOn === 'AFTER_PHOTOS')) {
      throw unprocessable('CLEAN_MISSING_PHOTOS', 'Every room needs a before and an after photo.', {
        missing: p.missing,
      });
    }
    throw unprocessable('CLEAN_CHECKLIST_INCOMPLETE', `Finish “${CLEAN_STEP_LABELS[waitingOn]}” first.`, {
      step,
      waitingOn,
    });
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
    const { done, checklist } = await this.progress(this.prisma, actor, row);
    const working = work && row.status === 'IN_PROGRESS';
    return {
      ...summary!,
      rooms: rooms.map((room) => ({
        id: room.id,
        displayName: names.get(room.id) ?? '',
        before: photos.filter((p) => p.roomId === room.id && p.phase === 'BEFORE'),
        after: photos.filter((p) => p.roomId === room.id && p.phase === 'AFTER'),
      })),
      checklist,
      today,
      can: {
        start:
          work &&
          row.status === 'SCHEDULED' &&
          row.assignedCleanerId !== null &&
          (manage || today === toIsoDate(row.scheduledDate)),
        addPhotos: working,
        checkDamage: working && done.BEFORE_PHOTOS,
        countStock: working && done.BEFORE_PHOTOS && done.DAMAGE,
        addAfterPhotos: working && done.BEFORE_PHOTOS && done.DAMAGE && done.STOCK_COUNT,
        complete: working && STEPS.every((st) => done[st]),
      },
    };
  }
}
