import { toIsoDate } from '../common/dates.js';
import { conflict } from '../common/problem.js';
import type { Tx } from '../prisma/prisma.service.js';
import { monthName } from '../reporting/statement.js';

/**
 * The period lock (docs/spec.md §4): once a month's statement is finalized, nothing that feeds its figures may
 * change. Services call `assertOpen` inside the mutation's transaction; the `booking_period_guard` and
 * `expense_period_guard` triggers are the backstop.
 *
 * Race-free with finalize: this takes a share lock on the property row, and finalize takes an update lock on it
 * before reading anything, so a change either commits before finalize reads or sees the finalized statement.
 */

/** "YYYY-MM-DD" days, inclusive. */
export interface DayRange {
  from: string;
  to: string;
}

/**
 * The days whose months a booking feeds: its nights (check-in to the last night), or through check-out for an owner
 * stay, whose cleaning is charged in the check-out month. A cancelled stay that paid out lands in its check-in month,
 * which this covers too.
 */
export function bookingDays(b: { kind: string; checkInDate: Date; checkOutDate: Date }): DayRange {
  const last = b.kind === 'OWNER_STAY' ? b.checkOutDate : new Date(b.checkOutDate.getTime() - 86_400_000);
  return { from: toIsoDate(b.checkInDate), to: toIsoDate(last) };
}

export function dayRange(day: Date): DayRange {
  return { from: toIsoDate(day), to: toIsoDate(day) };
}

const monthStart = (iso: string) => new Date(`${iso.slice(0, 7)}-01T00:00:00.000Z`);

/**
 * Throws 409 PERIOD_LOCKED if any of `ranges` touches a month whose statement for the property is finalized or
 * released. `what` names the record in the message ("This stay", "This expense").
 */
export async function assertOpen(tx: Tx, propertyId: string, ranges: DayRange[], what: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${propertyId}::uuid FOR SHARE`;
  if (ranges.length === 0) return;
  const locked = await tx.ownerStatement.findFirst({
    where: {
      propertyId,
      status: { not: 'DRAFT' },
      OR: ranges.map((r) => ({ periodMonth: { gte: monthStart(r.from), lte: monthStart(r.to) } })),
    },
    orderBy: { periodMonth: 'asc' },
    select: { id: true, periodMonth: true, status: true },
  });
  if (!locked) return;
  const month = toIsoDate(locked.periodMonth).slice(0, 7);
  throw conflict(
    'PERIOD_LOCKED',
    `${what} is in ${monthName(month)}, whose statement is ${locked.status === 'RELEASED' ? 'released' : 'finalized'}, so it can’t change. Record the correction as an adjustment on the next month’s statement.`,
    { statementId: locked.id, month },
  );
}
