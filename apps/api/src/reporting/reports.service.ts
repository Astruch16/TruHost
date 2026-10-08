import { Injectable } from '@nestjs/common';
import type { MonthFigures as MonthFiguresDto } from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import type { Actor } from '../auth/actor.js';
import { fromIsoDate, toIsoDate } from '../common/dates.js';
import { notFound } from '../common/problem.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  computeMonth,
  divideHalfUp,
  monthBounds,
  type MonthBooking,
  type MonthExpense,
  type MonthFigures,
} from './monthly.js';

type PlanInForce = { id: string; name: string; managementFeeBps: number } | null;

/** Loads records for a month and hands them to the pure functions in monthly.ts. */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async propertyMonth(actor: Actor, propertyId: string, month: string) {
    this.access.assert(actor, 'report:property', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    const [figures] = await this.compute([propertyId], month);
    return this.present(actor, figures!);
  }

  async propertyYear(actor: Actor, propertyId: string, year: number) {
    this.access.assert(actor, 'report:property', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const items = [];
    for (const m of months) items.push(this.present(actor, (await this.compute([propertyId], m))[0]!));
    return { items };
  }

  async portfolio(actor: Actor, month: string, includeArchived = false) {
    this.access.assert(actor, 'report:portfolio');
    const properties = await this.prisma.property.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      select: { id: true, name: true, archivedAt: true },
      orderBy: { name: 'asc' },
    });
    const figures = await this.compute(
      properties.map((p) => p.id),
      month,
    );
    const rows = figures.map((f, i) => ({
      ...f,
      name: properties[i]!.name,
      archived: properties[i]!.archivedAt !== null,
    }));

    const sum = (key: keyof (typeof figures)[number]) => figures.reduce((acc, f) => acc + ((f[key] as number) ?? 0), 0);
    const nightsBooked = sum('nightsBooked');
    const availableNights = sum('availableNights');
    const completeNights = sum('completeNights');
    const completeGross = sum('completeGrossCents');
    return {
      month,
      totals: {
        properties: properties.length,
        nightsBooked,
        ownerStayNights: sum('ownerStayNights'),
        blockNights: sum('blockNights'),
        availableNights,
        occupancyBps: availableNights > 0 ? divideHalfUp(nightsBooked * 10_000, availableNights) : null,
        stays: sum('stays'),
        grossCents: sum('grossCents'),
        // Fees are rounded per property-month (as on each statement) and then summed.
        managementFeeCents: sum('managementFeeCents'),
        ownerExpensesCents: sum('ownerExpensesCents'),
        netCents: sum('netCents'),
        avgNightlyEarningsCents: completeNights > 0 ? divideHalfUp(completeGross, completeNights) : null,
        cleaningFeesCents: sum('cleaningFeesCents'),
        incompleteBookings: sum('incompleteBookings'),
        expensesMissingReceipt: sum('expensesMissingReceipt'),
      },
      properties: rows.map((row) => strip(row)),
    };
  }

  /** Figures for each property in `propertyIds`, in the same order. Three queries regardless of property count. */
  async compute(propertyIds: string[], month: string) {
    const { first, next } = monthBounds(month);
    const firstDate = fromIsoDate(first);
    const nextDate = fromIsoDate(next);

    const [bookings, expenses, plans] = await Promise.all([
      // Stays with a night in the month, cancellations checking in during it, and checkouts on or after the 1st
      // (cleaning fees go to the checkout month).
      this.prisma.booking.findMany({
        where: { propertyId: { in: propertyIds }, checkInDate: { lt: nextDate }, checkOutDate: { gte: firstDate } },
        select: {
          propertyId: true,
          kind: true,
          status: true,
          checkInDate: true,
          checkOutDate: true,
          payoutCents: true,
          guestCleaningFeeCents: true,
        },
      }),
      this.prisma.expense.findMany({
        where: { propertyId: { in: propertyIds }, incurredOn: { gte: firstDate, lt: nextDate } },
        select: {
          propertyId: true,
          amountCents: true,
          bearer: true,
          voidedAt: true,
          incurredOn: true,
          _count: { select: { receipts: { where: { voidedAt: null } } } },
        },
      }),
      // The plan in force on the 1st of the month (plans start on the 1st, so one applies to the whole month).
      this.prisma.propertyPlan.findMany({
        where: {
          propertyId: { in: propertyIds },
          effectiveFrom: { lte: firstDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: firstDate } }],
        },
        select: { propertyId: true, plan: { select: { id: true, name: true, managementFeeBps: true } } },
      }),
    ]);

    return propertyIds.map((propertyId) => {
      const plan: PlanInForce = plans.find((p) => p.propertyId === propertyId)?.plan ?? null;
      const monthBookings: MonthBooking[] = bookings
        .filter((b) => b.propertyId === propertyId)
        .map((b) => ({
          kind: b.kind,
          status: b.status,
          checkIn: toIsoDate(b.checkInDate),
          checkOut: toIsoDate(b.checkOutDate),
          payoutCents: b.payoutCents,
          guestCleaningFeeCents: b.guestCleaningFeeCents,
        }));
      const monthExpenses: MonthExpense[] = expenses
        .filter((e) => e.propertyId === propertyId)
        .map((e) => ({
          amountCents: e.amountCents,
          bearer: e.bearer,
          voided: e.voidedAt !== null,
          incurredOn: toIsoDate(e.incurredOn),
          hasReceipt: e._count.receipts > 0,
        }));
      const f = computeMonth({
        month,
        feeBps: plan?.managementFeeBps ?? null,
        bookings: monthBookings,
        expenses: monthExpenses,
      });
      return { propertyId, ...f, plan: plan ? { id: plan.id, name: plan.name } : null };
    });
  }

  private present(actor: Actor, f: Awaited<ReturnType<ReportsService['compute']>>[number]): MonthFiguresDto {
    const { cleaningFeesCents, ...rest } = strip(f);
    return this.access.can(actor, 'report:adminFields', f.propertyId) ? { ...rest, cleaningFeesCents } : rest;
  }

  private async assertPropertyExists(id: string) {
    if (!(await this.prisma.property.count({ where: { id } }))) throw notFound('Property');
  }
}

/** Drops the internal parts (avg. nightly earnings inputs, chart series used by the dashboard) before responding. */
function strip<T extends MonthFigures>(f: T) {
  const {
    completeNights: _n,
    completeGrossCents: _g,
    grossByStay: _s,
    bookedByDay: _b,
    unavailableByDay: _u,
    nightlyLowCents: _l,
    nightlyHighCents: _h,
    ...rest
  } = f;
  return rest;
}
