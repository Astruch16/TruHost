import { Inject, Injectable } from '@nestjs/common';
import type { Dashboard, DashboardQuery } from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import type { Actor } from '../auth/actor.js';
import { addDays, addMonths, CLOCK, localDate, type Clock } from '../common/clock.js';
import { fromIsoDate, toIsoDate } from '../common/dates.js';
import { notFound } from '../common/problem.js';
import { FilesService } from '../files/files.service.js';
import { withCoverPhoto } from '../properties/properties.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { nightsBetween } from '../reporting/booking-money.js';
import { divideHalfUp } from '../reporting/monthly.js';
import { ReportsService } from '../reporting/reports.service.js';
import { comparisonBlocker, periodOf, pointChangeBps, relativeChangeBps } from './comparison.js';

const DEFAULT_TZ = 'America/Vancouver';
const UPCOMING_DAYS = 14;
const UPCOMING_LIMIT = 8;
const ATTENTION_LIMIT = 10;
const INVITE_STALE_DAYS = 7;

const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const monthName = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * The admin dashboard in one response. Every figure comes from ReportsService (the reporting module); this
 * service only scopes, sums, compares and lists.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly reports: ReportsService,
    private readonly files: FilesService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(actor: Actor, q: DashboardQuery): Promise<Dashboard> {
    this.access.assert(actor, 'dashboard:read');
    const properties = await this.prisma.property.findMany({
      where: q.propertyId ? { id: q.propertyId } : { archivedAt: null },
      select: {
        id: true,
        name: true,
        city: true,
        province: true,
        timeZone: true,
        archivedAt: true,
        coverPhoto: { select: withCoverPhoto.coverPhoto.select },
      },
      orderBy: { name: 'asc' },
    });
    if (q.propertyId && properties.length === 0) throw notFound('Property');
    const ids = properties.map((p) => p.id);
    const now = this.clock.now();
    const today = localDate(properties[0]?.timeZone ?? DEFAULT_TZ, now);
    const period = periodOf(q.month, today);

    const figures = await this.reports.compute(ids, q.month);
    const sum = (
      key:
        | 'grossCents'
        | 'managementFeeCents'
        | 'ownerExpensesCents'
        | 'netCents'
        | 'cleaningFeesCents'
        | 'stays'
        | 'incompleteBookings'
        | 'nightsBooked'
        | 'availableNights'
        | 'completeNights'
        | 'completeGrossCents',
      list = figures,
    ) => list.reduce((acc, f) => acc + f[key], 0);
    const occupancy = (list = figures) => {
      const available = sum('availableNights', list);
      return available > 0 ? divideHalfUp(sum('nightsBooked', list) * 10_000, available) : null;
    };
    const avgNightly = (list = figures) => {
      const nights = sum('completeNights', list);
      return nights > 0 ? divideHalfUp(sum('completeGrossCents', list), nights) : null;
    };

    // "vs. previous month"
    const previousMonth = addMonths(q.month, -1);
    let previous: typeof figures = [];
    if (ids.length > 0 && period === 'COMPLETE') previous = await this.reports.compute(ids, previousMonth);
    const blocker = comparisonBlocker({
      propertyCount: ids.length,
      period,
      previousMonthAllPlanned: previous.length > 0 && previous.every((f) => f.plan !== null),
      previousMonthIncomplete: sum('incompleteBookings', previous),
    });
    const relative = (key: Parameters<typeof sum>[0]) => {
      const prev = sum(key, previous);
      return { previous: prev, changeBps: relativeChangeBps(sum(key), prev) };
    };

    return {
      month: q.month,
      today,
      period,
      scope: { propertyId: q.propertyId ?? null, propertyCount: ids.length },
      kpis: {
        grossCents: sum('grossCents'),
        stays: sum('stays'),
        incompleteBookings: sum('incompleteBookings'),
        managementFeeCents: sum('managementFeeCents'),
        feeRatesBps: [...new Set(figures.map((f) => f.managementFeeBps).filter((r): r is number => r !== null))].sort(),
        nightsBooked: sum('nightsBooked'),
        availableNights: sum('availableNights'),
        occupancyBps: occupancy(),
        avgNightlyEarningsCents: avgNightly(),
        completeNights: sum('completeNights'),
        grossByStayCents: figures
          .flatMap((f) => f.grossByStay)
          .sort((a, b) => (a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : 0))
          .map((s) => s.grossCents),
        feeShareBps: sum('grossCents') > 0 ? divideHalfUp(sum('managementFeeCents') * 10_000, sum('grossCents')) : null,
        nightsByDay: nightsByDay(figures),
        nightlyLowCents: extreme(
          figures.map((f) => f.nightlyLowCents),
          Math.min,
        ),
        nightlyHighCents: extreme(
          figures.map((f) => f.nightlyHighCents),
          Math.max,
        ),
      },
      comparison: blocker
        ? null
        : {
            month: previousMonth,
            grossCents: relative('grossCents'),
            managementFeeCents: relative('managementFeeCents'),
            nightsBooked: relative('nightsBooked'),
            occupancyBps: {
              previous: occupancy(previous),
              changeBps: pointChangeBps(occupancy(), occupancy(previous)),
            },
            avgNightlyEarningsCents: {
              previous: avgNightly(previous),
              changeBps: relativeChangeBps(avgNightly(), avgNightly(previous)),
            },
          },
      noComparisonReason: blocker,
      breakdown: {
        grossCents: sum('grossCents'),
        managementFeeCents: sum('managementFeeCents'),
        ownerExpensesCents: sum('ownerExpensesCents'),
        netToOwnersCents: sum('netCents'),
        cleaningFeesCents: sum('cleaningFeesCents'),
      },
      properties: await Promise.all(
        properties.map(async (p, i) => ({
          id: p.id,
          name: p.name,
          city: p.city,
          province: p.province,
          archived: p.archivedAt !== null,
          hasPlan: figures[i]!.plan !== null,
          coverPhoto: p.coverPhoto ? await this.files.photoLinks(p.coverPhoto) : null,
          occupancyBps: figures[i]!.occupancyBps,
          nightsBooked: figures[i]!.nightsBooked,
          grossCents: figures[i]!.grossCents,
        })),
      ),
      attention: await this.attention(properties, today, now, q.propertyId),
      upcoming: await this.upcoming(properties, now),
    };
  }

  /** Needs attention (approved list for Phase 2a). "Months ready to finalize" joins in Phase 2b. */
  private async attention(
    properties: { id: string; name: string }[],
    today: string,
    now: Date,
    scopedTo: string | undefined,
  ): Promise<Dashboard['attention']> {
    const ids = properties.map((p) => p.id);
    const nameOf = (id: string) => properties.find((p) => p.id === id)?.name ?? null;
    const currentMonth = today.slice(0, 7);

    const [payouts, receipts, planned, invites] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          propertyId: { in: ids },
          kind: 'GUEST',
          status: 'CONFIRMED',
          checkInDate: { lte: fromIsoDate(today) },
          OR: [{ payoutCents: null }, { guestCleaningFeeCents: null }],
        },
        orderBy: { checkInDate: 'asc' },
        select: { id: true, propertyId: true, checkInDate: true, checkOutDate: true },
      }),
      this.prisma.expense.findMany({
        where: { propertyId: { in: ids }, bearer: 'OWNER', voidedAt: null, receipts: { none: { voidedAt: null } } },
        orderBy: { incurredOn: 'asc' },
        select: { id: true, propertyId: true, incurredOn: true, description: true, amountCents: true },
      }),
      this.prisma.propertyPlan.findMany({
        where: {
          propertyId: { in: ids },
          effectiveFrom: { lte: fromIsoDate(`${currentMonth}-01`) },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: fromIsoDate(`${currentMonth}-01`) } }],
        },
        select: { propertyId: true },
      }),
      this.prisma.invite.findMany({
        where: {
          status: 'PENDING',
          createdAt: { lt: new Date(now.getTime() - INVITE_STALE_DAYS * 86_400_000) },
          ...(scopedTo ? { user: { memberships: { some: { propertyId: scopedTo, revokedAt: null } } } } : {}),
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true, user: { select: { email: true } } },
      }),
    ]);

    const items: Dashboard['attention']['items'] = [
      ...payouts.map((b) => {
        const checkIn = toIsoDate(b.checkInDate);
        const nights = nightsBetween(b.checkInDate, b.checkOutDate);
        return {
          kind: 'PAYOUT_MISSING' as const,
          id: b.id,
          propertyId: b.propertyId,
          propertyName: nameOf(b.propertyId),
          title: 'Payout not entered',
          detail: `Stay from ${shortDate(checkIn)} (${nights} night${nights === 1 ? '' : 's'}) isn’t counted until its payout and cleaning fee are entered.`,
          date: checkIn,
        };
      }),
      ...receipts.map((e) => ({
        kind: 'RECEIPT_MISSING' as const,
        id: e.id,
        propertyId: e.propertyId,
        propertyName: nameOf(e.propertyId),
        title: 'Receipt missing',
        detail: `${e.description}, ${money.format(e.amountCents / 100)}. Owner-borne expenses need a receipt.`,
        date: toIsoDate(e.incurredOn),
      })),
      ...properties
        .filter((p) => !planned.some((pp) => pp.propertyId === p.id))
        .map((p) => ({
          kind: 'NO_PLAN' as const,
          id: p.id,
          propertyId: p.id,
          propertyName: p.name,
          title: 'No plan in force',
          detail: `${p.name} has no management plan for ${monthName(currentMonth)}, so no TruPlan fee is charged.`,
          date: null,
        })),
      ...invites.map((i) => ({
        kind: 'INVITE_PENDING' as const,
        id: i.id,
        propertyId: null,
        propertyName: null,
        title: 'Invite not accepted',
        detail: `${i.user.email} hasn’t accepted an invite sent ${shortDate(toIsoDate(i.createdAt))}.`,
        date: toIsoDate(i.createdAt),
      })),
    ];
    return { total: items.length, items: items.slice(0, ATTENTION_LIMIT) };
  }

  /** Confirmed check-ins and check-outs in the next 14 days, each property judged in its own time zone. */
  private async upcoming(
    properties: { id: string; name: string; timeZone: string }[],
    now: Date,
  ): Promise<Dashboard['upcoming']> {
    if (properties.length === 0) return { total: 0, items: [] };
    const windows = new Map(
      properties.map((p) => {
        const from = localDate(p.timeZone, now);
        return [p.id, { from, to: addDays(from, UPCOMING_DAYS), name: p.name }];
      }),
    );
    const earliest = [...windows.values()].map((w) => w.from).sort()[0]!;
    const latest = [...windows.values()]
      .map((w) => w.to)
      .sort()
      .at(-1)!;
    const bookings = await this.prisma.booking.findMany({
      where: {
        propertyId: { in: properties.map((p) => p.id) },
        status: 'CONFIRMED',
        kind: { in: ['GUEST', 'OWNER_STAY'] },
        OR: [
          { checkInDate: { gte: fromIsoDate(earliest), lt: fromIsoDate(latest) } },
          { checkOutDate: { gte: fromIsoDate(earliest), lt: fromIsoDate(latest) } },
        ],
      },
      select: { id: true, propertyId: true, kind: true, checkInDate: true, checkOutDate: true, guestName: true },
    });

    const events: Dashboard['upcoming']['items'] = [];
    for (const b of bookings) {
      const w = windows.get(b.propertyId)!;
      const base = {
        bookingId: b.id,
        propertyId: b.propertyId,
        propertyName: w.name,
        kind: b.kind,
        nights: nightsBetween(b.checkInDate, b.checkOutDate),
        guestName: b.guestName,
      };
      const checkIn = toIsoDate(b.checkInDate);
      const checkOut = toIsoDate(b.checkOutDate);
      if (checkIn >= w.from && checkIn < w.to) events.push({ ...base, type: 'CHECK_IN', date: checkIn });
      if (checkOut >= w.from && checkOut < w.to) events.push({ ...base, type: 'CHECK_OUT', date: checkOut });
    }
    // By date; on the same day check-outs come first (that's the turnover order).
    events.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.type === b.type ? 0 : a.type === 'CHECK_OUT' ? -1 : 1) ||
        a.propertyName.localeCompare(b.propertyName),
    );
    return { total: events.length, items: events.slice(0, UPCOMING_LIMIT) };
  }
}

/** Per day: properties with the night booked, and properties where it could be sold. */
function nightsByDay(figures: { bookedByDay: number[]; unavailableByDay: number[] }[]) {
  const days = figures[0]?.bookedByDay.length ?? 0;
  return Array.from({ length: days }, (_, d) => ({
    booked: figures.reduce((n, f) => n + f.bookedByDay[d]!, 0),
    available: figures.reduce((n, f) => n + 1 - f.unavailableByDay[d]!, 0),
  }));
}

/** The lowest or highest of the per-property values, ignoring properties that have none. */
function extreme(values: (number | null)[], pick: (...v: number[]) => number): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length > 0 ? pick(...present) : null;
}
