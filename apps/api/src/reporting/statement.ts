/**
 * An owner statement for one property and month (docs/spec.md §4): the one calculation behind the draft the admin
 * reviews, the copy stored at finalize, the PDF and every figure the web app shows. Pure: no I/O, exact integer
 * cents. Built on computeMonth, so a statement always agrees with the dashboard for the same month.
 *
 *   net = gross − TruPlan fee − owner expenses − owner-stay cleaning + adjustments
 *
 * Adjustments are flat, signed amounts outside the fee base: an admin enters exactly what the owner should gain or
 * lose (decision 2026-10-15).
 */
import type { ExpenseCategory } from '../generated/prisma/enums.js';
import { computeMonth, type MonthBooking, type MonthExpense } from './monthly.js';

/** Bumped whenever this function's output for the same records could change; stored on each finalized statement. */
export const STATEMENT_CALC_VERSION = 1;

export type Channel = 'AIRBNB' | 'VRBO' | 'BOOKING_COM' | 'DIRECT' | 'OTHER';

export interface StatementBooking extends MonthBooking {
  id: string;
  channel: Channel;
}

export interface StatementExpense extends MonthExpense {
  id: string;
  category: ExpenseCategory;
  description: string;
  vendor: string | null;
}

export interface StatementAdjustmentInput {
  id: string;
  /** Signed, from the owner's point of view. */
  amountCents: number;
  reason: string;
  /** "YYYY-MM-DD" (property-local day it was added). */
  addedOn: string;
  /** "YYYY-MM" of the statement it corrects, if any. */
  correctsMonth: string | null;
}

export type StatementLineKind = 'STAY' | 'EXPENSE' | 'OWNER_STAY_CLEANING' | 'ADJUSTMENT';

export interface StatementLine {
  kind: StatementLineKind;
  bookingId: string | null;
  expenseId: string | null;
  adjustmentId: string | null;
  /** Stays and owner-stay cleaning: check-in. Expense: purchase date. Adjustment: the day it was added. */
  date: string;
  /** Stays and owner-stay cleaning: check-out (the cleaning is charged in the check-out month). */
  endDate: string | null;
  channel: Channel | null;
  category: ExpenseCategory | null;
  description: string;
  detail: string | null;
  /** Stays: nights in this month, and in the whole stay. */
  nights: number | null;
  totalNights: number | null;
  /** Stays: owner gross of the whole stay (null while its payout isn't entered). */
  stayGrossCents: number | null;
  cancelled: boolean;
  payoutPending: boolean;
  /** Signed, from the owner's point of view. */
  amountCents: number;
}

export interface StatementTotals {
  nightsBooked: number;
  grossCents: number;
  managementFeeBps: number | null;
  managementFeeCents: number;
  /** Owner-borne expenses purchased in the month (without owner-stay cleaning). */
  expensesCents: number;
  ownerStayCleaningCents: number;
  /** Signed. */
  adjustmentsCents: number;
  /** Signed. */
  netCents: number;
}

export interface ComputedStatement {
  totals: StatementTotals;
  lines: StatementLine[];
  /** Guest stays counted at $0 because their payout (or cleaning fee) isn't entered yet: finalize asks first. */
  pendingPayoutBookingIds: string[];
  /** Owner-borne expenses with no receipt: they block finalizing. */
  expensesMissingReceiptIds: string[];
}

const CHANNEL_NAMES: Record<Channel, string> = {
  AIRBNB: 'Airbnb',
  VRBO: 'Vrbo',
  BOOKING_COM: 'Booking.com',
  DIRECT: 'Direct',
  OTHER: 'Other channel',
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2026-09" → "September 2026". */
export function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function channelName(channel: Channel): string {
  return CHANNEL_NAMES[channel];
}

export function computeStatement(input: {
  month: string;
  feeBps: number | null;
  /** The property's standard cleaning fee, charged for each owner stay checking out in the month. */
  ownerStayCleaningFeeCents: number;
  bookings: StatementBooking[];
  expenses: StatementExpense[];
  /** Unvoided adjustments on this statement. */
  adjustments: StatementAdjustmentInput[];
}): ComputedStatement {
  const figures = computeMonth({
    month: input.month,
    feeBps: input.feeBps,
    bookings: input.bookings,
    expenses: input.expenses,
    ownerStayCleaningFeeCents: input.ownerStayCleaningFeeCents,
  });

  const line = (l: Partial<StatementLine> & Pick<StatementLine, 'kind' | 'date' | 'description' | 'amountCents'>) =>
    ({
      bookingId: null,
      expenseId: null,
      adjustmentId: null,
      endDate: null,
      channel: null,
      category: null,
      detail: null,
      nights: null,
      totalNights: null,
      stayGrossCents: null,
      cancelled: false,
      payoutPending: false,
      ...l,
    }) satisfies StatementLine;

  const stays = figures.detail.stays.map((s) => {
    const b = input.bookings[s.booking]!;
    return line({
      kind: 'STAY',
      bookingId: b.id,
      date: b.checkIn,
      endDate: b.checkOut,
      channel: b.channel,
      description: `${s.cancelled ? 'Cancelled ' : ''}${CHANNEL_NAMES[b.channel]} stay`,
      detail: s.cancelled ? 'Paid out despite the cancellation' : s.pending ? 'Payout not entered yet' : null,
      nights: s.nights,
      totalNights: s.totalNights,
      stayGrossCents: s.stayGrossCents,
      cancelled: s.cancelled,
      payoutPending: s.pending,
      amountCents: s.grossCents,
    });
  });

  const cleanings = figures.detail.ownerStayCleaning.map((c) => {
    const b = input.bookings[c.booking]!;
    return line({
      kind: 'OWNER_STAY_CLEANING',
      bookingId: b.id,
      date: b.checkIn,
      endDate: b.checkOut,
      description: 'Cleaning after owner stay',
      amountCents: -c.amountCents,
    });
  });

  const expenses = figures.detail.ownerExpenses
    .map((i) => input.expenses[i]!)
    .sort((a, b) => (a.incurredOn < b.incurredOn ? -1 : a.incurredOn > b.incurredOn ? 1 : 0))
    .map((e) =>
      line({
        kind: 'EXPENSE',
        expenseId: e.id,
        date: e.incurredOn,
        category: e.category,
        description: e.description,
        detail: e.vendor,
        amountCents: -e.amountCents,
      }),
    );

  const adjustments = [...input.adjustments]
    .sort((a, b) => (a.addedOn < b.addedOn ? -1 : a.addedOn > b.addedOn ? 1 : 0))
    .map((a) =>
      line({
        kind: 'ADJUSTMENT',
        adjustmentId: a.id,
        date: a.addedOn,
        description: a.reason,
        detail: a.correctsMonth ? `Corrects ${monthName(a.correctsMonth)}` : null,
        amountCents: a.amountCents,
      }),
    );

  const adjustmentsCents = adjustments.reduce((sum, a) => sum + a.amountCents, 0);
  const expensesCents = figures.ownerExpensesCents - figures.ownerStayCleaningCents;
  const totals: StatementTotals = {
    nightsBooked: figures.nightsBooked,
    grossCents: figures.grossCents,
    managementFeeBps: figures.managementFeeBps,
    managementFeeCents: figures.managementFeeCents,
    expensesCents,
    ownerStayCleaningCents: figures.ownerStayCleaningCents,
    adjustmentsCents,
    netCents: figures.netCents + adjustmentsCents,
  };
  assertSafe(totals);

  return {
    totals,
    lines: [...stays, ...cleanings, ...expenses, ...adjustments],
    pendingPayoutBookingIds: stays.filter((s) => s.payoutPending).map((s) => s.bookingId!),
    expensesMissingReceiptIds: figures.detail.ownerExpenses
      .map((i) => input.expenses[i]!)
      .filter((e) => !e.hasReceipt)
      .map((e) => e.id),
  };
}

/** Money must stay exact: refuse anything outside the safe-integer range rather than round silently. */
function assertSafe(totals: StatementTotals) {
  for (const [key, value] of Object.entries(totals)) {
    if (value !== null && !Number.isSafeInteger(value)) throw new Error(`Statement ${key} is not a safe integer`);
  }
}
