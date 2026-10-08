/**
 * Monthly figures for one property (docs/spec.md §4). Pure functions over records: no I/O, exact integer cents.
 * Everything a dashboard or statement shows is computed here; nothing is stored or entered as a total.
 */
import { ownerGrossCents, type BookingMoney } from './booking-money.js';

export interface MonthBooking extends BookingMoney {
  status: 'CONFIRMED' | 'CANCELLED';
  /** Property-local calendar dates, "YYYY-MM-DD". checkOut is exclusive. */
  checkIn: string;
  checkOut: string;
}

export interface MonthExpense {
  amountCents: number;
  bearer: 'OWNER' | 'TRUHOST';
  voided: boolean;
  /** "YYYY-MM-DD" (purchase date). */
  incurredOn: string;
  hasReceipt: boolean;
}

export interface MonthFigures {
  month: string;
  daysInMonth: number;
  /** Nights in the month covered by confirmed guest stays. */
  nightsBooked: number;
  ownerStayNights: number;
  blockNights: number;
  /** Days in the month minus owner-stay and block nights: the nights that could have been sold. */
  availableNights: number;
  /** nightsBooked / availableNights in basis points (5500 = 55%), half-up; null when nothing was available. */
  occupancyBps: number | null;
  /** Confirmed guest stays with at least one night in the month. */
  stays: number;
  /** Owner gross allocated to the month (confirmed stays per night, plus cancelled stays that still paid out). */
  grossCents: number;
  managementFeeBps: number | null;
  /** grossCents × rate, rounded once on the month total, half up. 0 when no plan is in force. */
  managementFeeCents: number;
  /** Non-voided owner-borne expenses purchased in the month. */
  ownerExpensesCents: number;
  /** gross − fee − owner expenses. Can be negative (owner owes: see spec "Later"). */
  netCents: number;
  /**
   * Owner gross from complete confirmed stays in the month ÷ their nights in the month, to the nearest cent.
   * Labelled "Avg. nightly earnings" (decision N2). Null when there are no such nights.
   */
  avgNightlyEarningsCents: number | null;
  /** The parts of avg. nightly earnings, so several properties can be combined exactly. */
  completeNights: number;
  completeGrossCents: number;
  /** Guest cleaning fees of stays checking out in the month: TruHost revenue, not owner revenue. */
  cleaningFeesCents: number;
  /** Confirmed guest stays in the month still missing payout or cleaning fee; their gross is not counted yet. */
  incompleteBookings: number;
  /** Owner-borne, non-voided expenses in the month with no receipt. */
  expensesMissingReceipt: number;
  /**
   * What makes up grossCents, one entry per booking that contributed, in check-in order: complete confirmed stays
   * (their share of the month) and cancelled stays that still paid out. The entries sum exactly to grossCents.
   */
  grossByStay: { checkIn: string; grossCents: number }[];
  /** One entry per day of the month: 1 if a confirmed guest stay covers that night, else 0. */
  bookedByDay: number[];
  /** One entry per day of the month: 1 if an owner stay or block covers that night (not sellable), else 0. */
  unavailableByDay: number[];
  /**
   * Lowest and highest nightly earnings among complete confirmed stays in the month: each stay's gross in the month
   * ÷ its nights in the month, half up (the same rule as avgNightlyEarningsCents). Null when there are none.
   */
  nightlyLowCents: number | null;
  nightlyHighCents: number | null;
}

const DAY = 86_400_000;
const toDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY;

export function monthBounds(month: string): { first: string; next: string; days: number } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const first = `${month}-01`;
  const nextDate = new Date(Date.UTC(y, m, 1));
  const next = nextDate.toISOString().slice(0, 10);
  return { first, next, days: toDay(next) - toDay(first) };
}

/**
 * Splits `totalCents` across `nights` nights: each gets the floor, and the remainder goes one cent at a time to
 * the earliest nights. The parts always sum exactly to the total.
 */
export function allocatePerNight(totalCents: number, nights: number): number[] {
  if (nights <= 0) return [];
  const base = Math.floor(totalCents / nights);
  const remainder = totalCents - base * nights;
  return Array.from({ length: nights }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Nights of [checkIn, checkOut) that fall in [first, next): returns their indexes within the stay. */
function nightsInMonth(
  checkIn: string,
  checkOut: string,
  first: string,
  next: string,
): { from: number; count: number } {
  const start = Math.max(toDay(checkIn), toDay(first));
  const end = Math.min(toDay(checkOut), toDay(next));
  return { from: start - toDay(checkIn), count: Math.max(0, end - start) };
}

/** round(a / b) with halves rounded up, for non-negative integers. */
export function divideHalfUp(a: number, b: number): number {
  return Math.floor((2 * a + b) / (2 * b));
}

/** Management fee on a month's gross, rounded once, half up (assumption A11). */
export function managementFee(grossCents: number, bps: number | null): number {
  if (bps === null || grossCents <= 0) return 0;
  return divideHalfUp(grossCents * bps, 10_000);
}

export function computeMonth(input: {
  month: string;
  feeBps: number | null;
  bookings: MonthBooking[];
  expenses: MonthExpense[];
}): MonthFigures {
  const { first, next, days } = monthBounds(input.month);
  const inMonth = (iso: string) => iso >= first && iso < next;

  let nightsBooked = 0;
  let ownerStayNights = 0;
  let blockNights = 0;
  let stays = 0;
  let grossCents = 0;
  let completeGross = 0;
  let completeNights = 0;
  let cleaningFeesCents = 0;
  let incompleteBookings = 0;
  const grossByStay: { checkIn: string; grossCents: number }[] = [];
  const bookedByDay = Array.from({ length: days }, () => 0);
  const unavailableByDay = Array.from({ length: days }, () => 0);
  const nightly: number[] = [];
  /** Marks `count` nights starting `from` nights into a stay that checks in on `checkIn`. */
  const mark = (byDay: number[], checkIn: string, from: number, count: number) => {
    const start = toDay(checkIn) + from - toDay(first);
    for (let d = start; d < start + count; d++) byDay[d] = 1;
  };

  for (const b of input.bookings) {
    if (b.kind === 'GUEST' && b.guestCleaningFeeCents !== null && inMonth(b.checkOut)) {
      cleaningFeesCents += b.guestCleaningFeeCents;
    }

    if (b.status === 'CANCELLED') {
      // Decision N3: a cancelled stay that still paid out counts in its check-in month, with zero nights.
      const gross = ownerGrossCents(b);
      if (gross !== null && inMonth(b.checkIn)) {
        grossCents += gross;
        if (gross > 0) grossByStay.push({ checkIn: b.checkIn, grossCents: gross });
      }
      continue;
    }

    const { from, count } = nightsInMonth(b.checkIn, b.checkOut, first, next);
    if (count === 0) continue;
    if (b.kind === 'OWNER_STAY') {
      ownerStayNights += count;
      mark(unavailableByDay, b.checkIn, from, count);
      continue;
    }
    if (b.kind === 'BLOCK') {
      blockNights += count;
      mark(unavailableByDay, b.checkIn, from, count);
      continue;
    }

    stays += 1;
    nightsBooked += count;
    mark(bookedByDay, b.checkIn, from, count);
    const gross = ownerGrossCents(b);
    if (gross === null) {
      incompleteBookings += 1;
      continue;
    }
    const totalNights = toDay(b.checkOut) - toDay(b.checkIn);
    const share = allocatePerNight(gross, totalNights)
      .slice(from, from + count)
      .reduce((sum, c) => sum + c, 0);
    grossCents += share;
    completeGross += share;
    completeNights += count;
    if (share > 0) grossByStay.push({ checkIn: b.checkIn, grossCents: share });
    nightly.push(divideHalfUp(share, count));
  }
  grossByStay.sort((a, b) => (a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : 0));

  let ownerExpensesCents = 0;
  let expensesMissingReceipt = 0;
  for (const e of input.expenses) {
    if (e.voided || e.bearer !== 'OWNER' || !inMonth(e.incurredOn)) continue;
    ownerExpensesCents += e.amountCents;
    if (!e.hasReceipt) expensesMissingReceipt += 1;
  }

  const availableNights = days - ownerStayNights - blockNights;
  const managementFeeCents = managementFee(grossCents, input.feeBps);

  return {
    month: input.month,
    daysInMonth: days,
    nightsBooked,
    ownerStayNights,
    blockNights,
    availableNights,
    occupancyBps: availableNights > 0 ? divideHalfUp(nightsBooked * 10_000, availableNights) : null,
    stays,
    grossCents,
    managementFeeBps: input.feeBps,
    managementFeeCents,
    ownerExpensesCents,
    netCents: grossCents - managementFeeCents - ownerExpensesCents,
    avgNightlyEarningsCents: completeNights > 0 ? divideHalfUp(completeGross, completeNights) : null,
    completeNights,
    completeGrossCents: completeGross,
    cleaningFeesCents,
    incompleteBookings,
    expensesMissingReceipt,
    grossByStay,
    bookedByDay,
    unavailableByDay,
    nightlyLowCents: nightly.length > 0 ? Math.min(...nightly) : null,
    nightlyHighCents: nightly.length > 0 ? Math.max(...nightly) : null,
  };
}
