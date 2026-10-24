import { Inject, Injectable } from '@nestjs/common';
import {
  MAX_TIME_OFF_DAYS,
  TIME_OFF_REASON_LABELS,
  type createTimeOff,
  type DecideTimeOff,
  type TimeOffQuery,
  type TimeOffStatus,
} from '@truhost/shared';
import type { z } from 'zod';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../auth/actor.js';
import { CLOCK, localDate, type Clock } from '../common/clock.js';
import { fromIsoDate, toIsoDate } from '../common/dates.js';
import { PG, pgErrorCode } from '../common/pg-errors.js';
import { conflict, notFound, unprocessable } from '../common/problem.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationsService, type PendingEmail } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** TruHost's day (BC): time off can't start before it. */
const TIME_ZONE = 'America/Vancouver';
const PERSON = { select: { id: true, firstName: true, lastName: true } } as const;
const INCLUDE = { cleaner: PERSON, decidedBy: PERSON } satisfies Prisma.TimeOffRequestInclude;
type Row = Prisma.TimeOffRequestGetPayload<{ include: typeof INCLUDE }>;
type CreateInput = z.output<typeof createTimeOff>;

const DAY_MS = 86_400_000;
const daysBetween = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / DAY_MS + 1;

/** "Mon, Dec 22 – Fri, Jan 2", or one day. */
export function dateRange(start: string, end: string): string {
  const f = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-CA', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  return start === end ? f(start) : `${f(start)} – ${f(end)}`;
}

/**
 * Cleaner time off (docs/spec.md): a cleaner asks for days to be kept free (a holiday, time off, other work); the
 * admins are told (never owners) and approve or decline it. A cleaner sees and cancels only their own. Each request
 * lists the cleaner's cleans in those dates, to reassign. Moves are conditional updates; the database keeps a
 * cleaner's pending and approved requests from overlapping and fixes what was asked for (time_off_guard).
 */
@Injectable()
export class TimeOffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Admins: everyone's; a cleaner: their own. By status, and ending on or after `from`. */
  async list(actor: Actor, q: TimeOffQuery) {
    const admin = this.access.can(actor, 'timeOff:manage');
    if (!admin && !this.access.canAnywhere(actor, 'timeOff:request')) throw notFound('Resource');
    const rows = await this.prisma.timeOffRequest.findMany({
      where: {
        ...(admin ? {} : { cleanerId: actor.userId }),
        ...(q.status ? { status: q.status } : {}),
        ...(q.from ? { endDate: { gte: fromIsoDate(q.from) } } : {}),
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
      take: 500,
      include: INCLUDE,
    });
    return { items: await this.shape(actor, rows) };
  }

  /** A cleaner asks for days off: from today on, at most 90 days, not overlapping their own. Tells the admins. */
  async create(actor: Actor, input: CreateInput) {
    if (!this.access.canAnywhere(actor, 'timeOff:request')) throw notFound('Resource');
    const today = this.today();
    if (input.startDate < today) {
      throw unprocessable('TIME_OFF_IN_PAST', 'Time off can start today at the earliest.', { today });
    }
    const days = daysBetween(input.startDate, input.endDate);
    if (days > MAX_TIME_OFF_DAYS) {
      throw unprocessable('TIME_OFF_TOO_LONG', `Ask for at most ${MAX_TIME_OFF_DAYS} days at a time.`);
    }
    const overlap = () =>
      unprocessable('TIME_OFF_OVERLAPS', 'You’ve already asked for some of these days. Cancel that request first.');
    let emails: PendingEmail[] = [];
    let id: string;
    try {
      id = await this.prisma.$transaction(async (tx) => {
        const clash = await tx.timeOffRequest.findFirst({
          where: {
            cleanerId: actor.userId,
            status: { in: ['PENDING', 'APPROVED'] },
            startDate: { lte: fromIsoDate(input.endDate) },
            endDate: { gte: fromIsoDate(input.startDate) },
          },
        });
        if (clash) throw overlap();
        const row = await tx.timeOffRequest.create({
          data: {
            cleanerId: actor.userId,
            startDate: fromIsoDate(input.startDate),
            endDate: fromIsoDate(input.endDate),
            reason: input.reason,
            note: input.note,
          },
          include: INCLUDE,
        });
        emails = await this.notifications.timeOffRequested(tx, {
          request: {
            id: row.id,
            startDate: input.startDate,
            endDate: input.endDate,
            days,
            reason: TIME_OFF_REASON_LABELS[input.reason],
            note: input.note,
          },
          cleaner: row.cleaner,
          dates: dateRange(input.startDate, input.endDate),
        });
        return row.id;
      });
    } catch (e) {
      // Two requests at once: the exclusion constraint keeps the second out.
      if (pgErrorCode(e) === PG.exclusionViolation) throw overlap();
      throw e;
    }
    await this.notifications.sendAfterCommit(emails);
    return this.get(actor, id);
  }

  /** Its cleaner withdraws it: while pending, or once approved until its last day has passed. */
  async cancel(actor: Actor, id: string) {
    const row = await this.prisma.timeOffRequest.findUnique({ where: { id } });
    if (!row || row.cleanerId !== actor.userId) throw notFound('Time off request');
    if (row.status !== 'PENDING' && row.status !== 'APPROVED') throw this.wrongState(row.status);
    if (row.status === 'APPROVED' && toIsoDate(row.endDate) < this.today()) {
      throw unprocessable('TIME_OFF_OVER', 'This time off is over.');
    }
    const { count } = await this.prisma.timeOffRequest.updateMany({
      where: { id, status: row.status },
      data: { status: 'CANCELLED', cancelledAt: this.clock.now() },
    });
    if (count !== 1) throw this.wrongState('CHANGED');
    return this.get(actor, id);
  }

  /** Admins approve or decline a pending request, with an optional note for the cleaner. Audited. */
  async decide(actor: Actor, id: string, input: DecideTimeOff) {
    this.access.assert(actor, 'timeOff:manage', undefined, 'Time off request');
    const row = await this.prisma.timeOffRequest.findUnique({ where: { id } });
    if (!row) throw notFound('Time off request');
    if (row.status !== 'PENDING') throw this.wrongState(row.status);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.timeOffRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: input.status,
          decidedById: actor.userId,
          decidedAt: this.clock.now(),
          decisionNote: input.note ?? null,
        },
      });
      if (count !== 1) throw this.wrongState('CHANGED');
      await this.audit.record(tx, actor, {
        action: 'timeOff.decide',
        entityType: 'TimeOffRequest',
        entityId: id,
        before: { status: 'PENDING' },
        after: { status: input.status, note: input.note ?? null },
      });
    });
    return this.get(actor, id);
  }

  // ── helpers ──

  private async get(actor: Actor, id: string) {
    const row = await this.prisma.timeOffRequest.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    return (await this.shape(actor, [row]))[0]!;
  }

  private today() {
    return localDate(TIME_ZONE, this.clock.now());
  }

  private wrongState(status: TimeOffStatus | 'CHANGED') {
    return conflict(
      `TIME_OFF_${status}`,
      status === 'CHANGED' ? 'This request changed. Refresh and try again.' : 'This request has already been settled.',
    );
  }

  /** Each request with the cleaner's cleans still to do in its dates, and what the caller may do with it. */
  private async shape(actor: Actor, rows: Row[]) {
    if (rows.length === 0) return [];
    const admin = this.access.can(actor, 'timeOff:manage');
    const today = this.today();
    const from = rows.reduce((d, r) => (r.startDate < d ? r.startDate : d), rows[0]!.startDate);
    const to = rows.reduce((d, r) => (r.endDate > d ? r.endDate : d), rows[0]!.endDate);
    const cleans = await this.prisma.clean.findMany({
      where: {
        assignedCleanerId: { in: [...new Set(rows.map((r) => r.cleanerId))] },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        scheduledDate: { gte: from, lte: to },
      },
      orderBy: { scheduledDate: 'asc' },
      select: {
        id: true,
        assignedCleanerId: true,
        scheduledDate: true,
        property: { select: { id: true, name: true } },
      },
    });
    return rows.map((r) => {
      const start = toIsoDate(r.startDate);
      const end = toIsoDate(r.endDate);
      const open = r.status === 'PENDING' || (r.status === 'APPROVED' && end >= today);
      return {
        id: r.id,
        cleaner: r.cleaner,
        startDate: start,
        endDate: end,
        days: daysBetween(start, end),
        reason: r.reason,
        note: r.note,
        status: r.status,
        decidedBy: r.decidedBy,
        decidedAt: r.decidedAt,
        decisionNote: r.decisionNote,
        cancelledAt: r.cancelledAt,
        createdAt: r.createdAt,
        conflicts:
          r.status === 'PENDING' || r.status === 'APPROVED'
            ? cleans
                .filter(
                  (c) =>
                    c.assignedCleanerId === r.cleanerId &&
                    c.scheduledDate >= r.startDate &&
                    c.scheduledDate <= r.endDate,
                )
                .map((c) => ({ cleanId: c.id, date: toIsoDate(c.scheduledDate), property: c.property }))
            : [],
        can: { cancel: r.cleanerId === actor.userId && open, decide: admin && r.status === 'PENDING' },
      };
    });
  }
}
