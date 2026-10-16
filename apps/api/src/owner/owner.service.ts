import { Inject, Injectable } from '@nestjs/common';
import type { OwnerCalendar, OwnerHome, OwnerStatement } from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import type { Actor } from '../auth/actor.js';
import { CLOCK, type Clock } from '../common/clock.js';
import { addIsoDays, fromIsoDate, toIsoDate, todayIn } from '../common/dates.js';
import { notFound } from '../common/problem.js';
import { FilesService } from '../files/files.service.js';
import { FILE_STORAGE, type FileStorage } from '../files/storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ownerGrossCents } from '../reporting/booking-money.js';
import { categoryName } from '../reporting/format.js';
import { computeMonth, divideHalfUp, monthBounds } from '../reporting/monthly.js';
import { ReportsService } from '../reporting/reports.service.js';
import { monthName } from '../reporting/statement.js';

const FILE = { select: { objectKey: true, contentType: true } } as const;
const DAY = 86_400_000;
const monthOf = (d: Date) => toIsoDate(d).slice(0, 7);
const addMonths = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};
/** How far back "Good to know" looks. */
const GOOD_TO_KNOW_DAYS = 60;

/**
 * The owner portal's API. Every read is scoped to the properties the caller owns (policy 'owner:portal': OWNER
 * memberships only, admins included only for properties they own) and returns only what an owner may see: released
 * statements (their stored copies), owner gross rather than payouts and cleaning fees, no guest details, notes,
 * cleaner pay or audit data. Figures come from released statement copies or the reporting functions.
 */
@Injectable()
export class OwnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly reports: ReportsService,
    private readonly files: FilesService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The caller's owned properties (all, or the one asked for); 404 when there are none or it isn't theirs. */
  private async scope(actor: Actor, propertyId?: string) {
    const owned = this.access.propertyIds(actor, 'owner:portal');
    const ids = owned === 'all' ? [] : owned;
    const wanted = propertyId ? ids.filter((id) => id === propertyId) : ids;
    if (wanted.length === 0) throw notFound(propertyId ? 'Property' : 'Owned property');
    const properties = await this.prisma.property.findMany({
      where: { id: { in: wanted } },
      select: {
        id: true,
        name: true,
        city: true,
        province: true,
        timeZone: true,
        coverPhoto: { select: { id: true, file: FILE, thumbFile: FILE } },
      },
      orderBy: { name: 'asc' },
    });
    if (properties.length === 0) throw notFound('Property');
    return properties;
  }

  private today(properties: { timeZone: string }[]) {
    return todayIn(properties[0]!.timeZone, this.clock.now());
  }

  async properties(actor: Actor) {
    const properties = await this.scope(actor);
    const items = [];
    for (const p of properties) {
      const photo = p.coverPhoto ? await this.files.photoLinks(p.coverPhoto) : null;
      items.push({
        id: p.id,
        name: p.name,
        city: p.city,
        province: p.province,
        photo: photo ? { thumbUrl: photo.thumbUrl, expiresAt: photo.expiresAt } : null,
      });
    }
    return { items };
  }

  async home(actor: Actor, propertyId?: string): Promise<OwnerHome> {
    const properties = await this.scope(actor, propertyId);
    const ids = properties.map((p) => p.id);
    const today = this.today(properties);
    const month = today.slice(0, 7);
    const year = Number(month.slice(0, 4));

    const released = await this.prisma.ownerStatement.findMany({
      where: { propertyId: { in: ids }, status: 'RELEASED' },
      orderBy: [{ periodMonth: 'desc' }, { propertyId: 'asc' }],
    });
    const byMonth = new Map<string, typeof released>();
    for (const st of released) {
      const m = monthOf(st.periodMonth);
      byMonth.set(m, [...(byMonth.get(m) ?? []), st]);
    }
    const sumNet = (rows: typeof released) => rows.reduce((acc, r) => acc + r.netCents!, 0);
    const releasedMonths = [...byMonth.keys()].sort().reverse();

    // The hero: the latest released month, against the one released before it.
    let latest: OwnerHome['latest'] = null;
    if (releasedMonths[0]) {
      const rows = byMonth.get(releasedMonths[0])!;
      const prevMonth = releasedMonths[1];
      const netCents = sumNet(rows);
      latest = {
        month: releasedMonths[0],
        statementIds: rows.map((r) => r.id),
        netCents,
        grossCents: rows.reduce((acc, r) => acc + r.grossCents!, 0),
        nightsBooked: rows.reduce((acc, r) => acc + r.nightsBooked!, 0),
        releasedOn: rows
          .map((r) => toIsoDate(r.releasedOn!))
          .sort()
          .at(-1)!,
        change: prevMonth
          ? {
              month: prevMonth,
              netCents: sumNet(byMonth.get(prevMonth)!),
              changeCents: netCents - sumNet(byMonth.get(prevMonth)!),
            }
          : null,
      };
    }

    // This month so far: the reporting functions over the stays booked (an estimate: no statement yet).
    const current = await this.reports.compute(ids, month);
    const dayOfMonth = Number(today.slice(8, 10));
    const nightsBooked = current.reduce((acc, f) => acc + f.nightsBooked, 0);
    const nightsStayed = current.reduce(
      (acc, f) => acc + f.bookedByDay.slice(0, dayOfMonth - 1).reduce((a, n) => a + n, 0),
      0,
    );
    const estimatedNetCents = current.reduce((acc, f) => acc + f.netCents, 0);
    const thisMonth = {
      month,
      estimatedNetCents,
      grossCents: current.reduce((acc, f) => acc + f.grossCents, 0),
      nightsBooked,
      nightsStayed,
      nightsUpcoming: nightsBooked - nightsStayed,
      daysInMonth: monthBounds(month).days,
      stays: current.reduce((acc, f) => acc + f.stays, 0),
      pendingPayouts: current.reduce((acc, f) => acc + f.incompleteBookings, 0),
      statementExpected: addMonths(month, 1),
    };

    // Year to date: this year's released statements. Occupancy and avg. nightly earnings come from the reporting
    // functions for those same property-months (their records are locked, so they match the statements).
    const thisYear = released.filter((r) => r.periodMonth.getUTCFullYear() === year);
    let available = 0;
    let completeNights = 0;
    let completeGross = 0;
    let nights = 0;
    for (const m of new Set(thisYear.map((r) => monthOf(r.periodMonth)))) {
      const figures = await this.reports.compute(
        thisYear.filter((r) => monthOf(r.periodMonth) === m).map((r) => r.propertyId),
        m,
      );
      for (const f of figures) {
        available += f.availableNights;
        completeNights += f.completeNights;
        completeGross += f.completeGrossCents;
        nights += f.nightsBooked;
      }
    }
    const yearToDate = {
      year,
      months: new Set(thisYear.map((r) => monthOf(r.periodMonth))).size,
      netCents: sumNet(thisYear),
      nightsBooked: thisYear.reduce((acc, r) => acc + r.nightsBooked!, 0),
      occupancyBps: available > 0 ? divideHalfUp(nights * 10_000, available) : null,
      avgNightlyEarningsCents: completeNights > 0 ? divideHalfUp(completeGross, completeNights) : null,
    };

    const netByMonth: OwnerHome['netByMonth'] = [];
    for (let m = `${year}-01`; m <= month; m = addMonths(m, 1)) {
      const rows = byMonth.get(m);
      if (rows) netByMonth.push({ month: m, netCents: sumNet(rows), state: 'RELEASED' });
      else if (m === month) netByMonth.push({ month: m, netCents: estimatedNetCents, state: 'IN_PROGRESS' });
      else netByMonth.push({ month: m, netCents: null, state: 'PENDING' });
    }

    const nameOf = (id: string) => properties.find((p) => p.id === id)!.name;
    const upcoming = await this.prisma.booking.findMany({
      where: {
        propertyId: { in: ids },
        status: 'CONFIRMED',
        kind: { in: ['GUEST', 'OWNER_STAY'] },
        checkInDate: { gte: fromIsoDate(today) },
      },
      orderBy: [{ checkInDate: 'asc' }, { id: 'asc' }],
      take: 4,
    });
    const comingUp = upcoming.map((b) => ({
      bookingId: b.id,
      property: { id: b.propertyId, name: nameOf(b.propertyId) },
      kind: b.kind as 'GUEST' | 'OWNER_STAY',
      channel: b.kind === 'GUEST' ? b.channel : null,
      checkInDate: toIsoDate(b.checkInDate),
      checkOutDate: toIsoDate(b.checkOutDate),
      nights: Math.round((b.checkOutDate.getTime() - b.checkInDate.getTime()) / DAY),
    }));

    return {
      today,
      month,
      properties: properties.length,
      latest,
      thisMonth,
      yearToDate,
      netByMonth,
      comingUp,
      goodToKnow: await this.goodToKnow(ids, nameOf, today),
    };
  }

  /** Recent owner-paid expenses and adjustments on released statements, in plain words. */
  private async goodToKnow(ids: string[], nameOf: (id: string) => string, today: string) {
    const since = fromIsoDate(addIsoDays(today, -GOOD_TO_KNOW_DAYS));
    const [expenses, adjustments] = await Promise.all([
      this.prisma.expense.findMany({
        where: { propertyId: { in: ids }, bearer: 'OWNER', voidedAt: null, incurredOn: { gte: since } },
        include: { receipts: { where: { voidedAt: null }, orderBy: { createdAt: 'asc' }, take: 1 } },
        orderBy: [{ incurredOn: 'desc' }, { id: 'desc' }],
        take: 4,
      }),
      this.prisma.ownerStatementLine.findMany({
        where: {
          kind: 'ADJUSTMENT',
          statement: { propertyId: { in: ids }, status: 'RELEASED', releasedOn: { gte: since } },
        },
        include: { statement: { select: { id: true, propertyId: true, periodMonth: true, releasedOn: true } } },
        take: 4,
      }),
    ]);
    const items = [
      ...expenses.map((e) => ({
        id: e.id,
        kind: 'EXPENSE' as const,
        date: toIsoDate(e.incurredOn),
        property: { id: e.propertyId, name: nameOf(e.propertyId) },
        title: e.description,
        detail: `${categoryName(e.category)}${e.vendor ? ` from ${e.vendor}` : ''}, paid from your earnings`,
        amountCents: -e.amountCents,
        receiptFileId: e.receipts[0]?.fileId ?? null,
        statementId: null,
      })),
      ...adjustments.map((l) => ({
        id: l.id,
        kind: 'ADJUSTMENT' as const,
        date: toIsoDate(l.statement.releasedOn!),
        property: { id: l.statement.propertyId, name: nameOf(l.statement.propertyId) },
        title: l.description,
        detail: `${l.amountCents > 0 ? 'Added to' : 'Taken from'} your ${monthName(monthOf(l.statement.periodMonth))} statement${l.detail ? ` (${l.detail.toLowerCase()})` : ''}`,
        amountCents: l.amountCents,
        receiptFileId: null,
        statementId: l.statement.id,
      })),
    ];
    return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 4);
  }

  async statements(actor: Actor, propertyId?: string) {
    const properties = await this.scope(actor, propertyId);
    const rows = await this.prisma.ownerStatement.findMany({
      where: { propertyId: { in: properties.map((p) => p.id) }, status: 'RELEASED' },
      orderBy: [{ periodMonth: 'desc' }, { propertyId: 'asc' }],
    });
    return {
      items: rows.map((st) => ({
        id: st.id,
        property: { id: st.propertyId, name: properties.find((p) => p.id === st.propertyId)!.name },
        month: monthOf(st.periodMonth),
        netCents: st.netCents!,
        grossCents: st.grossCents!,
        releasedOn: toIsoDate(st.releasedOn!),
      })),
    };
  }

  /** A released statement of a property the caller owns; anything else (theirs unreleased, others') is 404. */
  private async findReleased(actor: Actor, id: string) {
    const st = await this.prisma.ownerStatement.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, name: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        pdfFile: { select: { objectKey: true, contentType: true, originalFilename: true } },
      },
    });
    if (!st || st.status !== 'RELEASED' || !this.access.can(actor, 'owner:portal', st.propertyId)) {
      throw notFound('Statement');
    }
    return st;
  }

  async statement(actor: Actor, id: string): Promise<OwnerStatement> {
    const st = await this.findReleased(actor, id);
    const expenseIds = st.lines.flatMap((l) => (l.expenseId ? [l.expenseId] : []));
    const receipts = await this.prisma.receipt.findMany({
      where: { expenseId: { in: expenseIds }, voidedAt: null },
      include: { file: { select: { originalFilename: true, contentType: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      id: st.id,
      property: st.property,
      month: monthOf(st.periodMonth),
      plan: { name: st.planName!, managementFeeBps: st.managementFeeBps! },
      totals: {
        nightsBooked: st.nightsBooked!,
        grossCents: st.grossCents!,
        managementFeeBps: st.managementFeeBps!,
        managementFeeCents: st.managementFeeCents!,
        expensesCents: st.expensesCents!,
        ownerStayCleaningCents: st.ownerStayCleaningCents!,
        adjustmentsCents: st.adjustmentsCents!,
        netCents: st.netCents!,
      },
      lines: st.lines.map((l) => ({
        kind: l.kind,
        bookingId: l.bookingId,
        expenseId: l.expenseId,
        adjustmentId: l.adjustmentId,
        date: toIsoDate(l.date),
        endDate: l.endDate ? toIsoDate(l.endDate) : null,
        channel: l.channel,
        category: l.category,
        description: l.description,
        detail: l.detail,
        nights: l.nights,
        totalNights: l.totalNights,
        stayGrossCents: l.stayGrossCents,
        cancelled: l.cancelled,
        payoutPending: l.payoutPending,
        amountCents: l.amountCents,
        ...(l.expenseId
          ? {
              receipts: receipts
                .filter((r) => r.expenseId === l.expenseId)
                .map((r) => ({
                  id: r.id,
                  fileId: r.fileId,
                  receiptDate: toIsoDate(r.receiptDate),
                  description: r.description,
                  filename: r.file.originalFilename,
                  contentType: r.file.contentType,
                })),
            }
          : {}),
      })),
      released: { on: toIsoDate(st.releasedOn!), paymentReference: st.paymentReference },
    };
  }

  /** A short-lived link to the PDF stored when the statement was released. */
  async statementPdf(actor: Actor, id: string) {
    const st = await this.findReleased(actor, id);
    const file = st.pdfFile!;
    return this.storage.presignGet(file.objectKey, { contentType: file.contentType, filename: file.originalFilename });
  }

  /** The month's stays at the owned properties, with each guest stay's owner gross and this month's share of it. */
  async calendar(actor: Actor, month: string, propertyId?: string): Promise<OwnerCalendar> {
    const properties = await this.scope(actor, propertyId);
    const { first, next } = monthBounds(month);
    const bookings = await this.prisma.booking.findMany({
      where: {
        propertyId: { in: properties.map((p) => p.id) },
        status: 'CONFIRMED',
        checkInDate: { lt: fromIsoDate(next) },
        checkOutDate: { gt: fromIsoDate(first) },
      },
      orderBy: [{ checkInDate: 'asc' }, { id: 'asc' }],
    });
    const items: OwnerCalendar['items'] = [];
    for (const p of properties) {
      const own = bookings.filter((b) => b.propertyId === p.id);
      const figures = computeMonth({
        month,
        feeBps: null,
        expenses: [],
        bookings: own.map((b) => ({
          kind: b.kind,
          status: b.status,
          checkIn: toIsoDate(b.checkInDate),
          checkOut: toIsoDate(b.checkOutDate),
          payoutCents: b.payoutCents,
          guestCleaningFeeCents: b.guestCleaningFeeCents,
        })),
      });
      for (const [i, b] of own.entries()) {
        const share = figures.detail.stays.find((s) => s.booking === i);
        const checkIn = toIsoDate(b.checkInDate);
        const checkOut = toIsoDate(b.checkOutDate);
        const from = Math.max(b.checkInDate.getTime(), fromIsoDate(first).getTime());
        const to = Math.min(b.checkOutDate.getTime(), fromIsoDate(next).getTime());
        items.push({
          bookingId: b.id,
          property: { id: p.id, name: p.name },
          kind: b.kind,
          channel: b.kind === 'GUEST' ? b.channel : null,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          nights: Math.round((b.checkOutDate.getTime() - b.checkInDate.getTime()) / DAY),
          nightsInMonth: Math.max(0, Math.round((to - from) / DAY)),
          ownerGrossCents: ownerGrossCents(b),
          monthShareCents: share && !share.pending ? share.grossCents : null,
          payoutPending: b.kind === 'GUEST' && ownerGrossCents(b) === null,
        });
      }
    }
    items.sort((a, b) => (a.checkInDate < b.checkInDate ? -1 : a.checkInDate > b.checkInDate ? 1 : 0));
    return { month, items };
  }
}
