import {
  computeStatement,
  monthName,
  type StatementAdjustmentInput,
  type StatementBooking,
  type StatementExpense,
} from './statement.js';

let seq = 0;
const stay = (
  checkIn: string,
  checkOut: string,
  payoutCents: number | null,
  cleaningFeeCents: number | null,
  over: Partial<StatementBooking> = {},
): StatementBooking => ({
  id: `b${++seq}`,
  kind: 'GUEST',
  status: 'CONFIRMED',
  channel: 'AIRBNB',
  checkIn,
  checkOut,
  payoutCents,
  guestCleaningFeeCents: cleaningFeeCents,
  ...over,
});
const ownerStay = (checkIn: string, checkOut: string, over: Partial<StatementBooking> = {}) =>
  stay(checkIn, checkOut, null, null, { kind: 'OWNER_STAY', ...over });
const expense = (incurredOn: string, amountCents: number, over: Partial<StatementExpense> = {}): StatementExpense => ({
  id: `e${++seq}`,
  amountCents,
  bearer: 'OWNER',
  voided: false,
  incurredOn,
  hasReceipt: true,
  category: 'SUPPLIES',
  description: 'Restock',
  vendor: 'Costco',
  ...over,
});
const adjustment = (amountCents: number, over: Partial<StatementAdjustmentInput> = {}): StatementAdjustmentInput => ({
  id: `a${++seq}`,
  amountCents,
  reason: 'Correction',
  addedOn: '2026-10-05',
  correctsMonth: null,
  ...over,
});

const september = (
  input: {
    bookings?: StatementBooking[];
    expenses?: StatementExpense[];
    adjustments?: StatementAdjustmentInput[];
    feeBps?: number | null;
    cleaningFee?: number;
  } = {},
) =>
  computeStatement({
    month: '2026-09',
    feeBps: input.feeBps === undefined ? 2200 : input.feeBps,
    ownerStayCleaningFeeCents: input.cleaningFee ?? 0,
    bookings: input.bookings ?? [],
    expenses: input.expenses ?? [],
    adjustments: input.adjustments ?? [],
  });

describe('statement totals (exact cents)', () => {
  // Each row: one stay entirely in September, so the month's gross is the stay's payout minus its cleaning fee.
  it.each([
    // payout, cleaning fee, gross, TruPlan 22% (rounded once, half up), net
    { payout: 100_000, cleaning: 10_000, gross: 90_000, fee: 19_800, net: 70_200 },
    { payout: 61_000, cleaning: 9_000, gross: 52_000, fee: 11_440, net: 40_560 },
    // 22% of 12_345 = 2_715.9 → 2_716
    { payout: 21_345, cleaning: 9_000, gross: 12_345, fee: 2_716, net: 9_629 },
    // 22% of 12_343 = 2_715.46 → 2_715
    { payout: 21_343, cleaning: 9_000, gross: 12_343, fee: 2_715, net: 9_628 },
    // 22% of 25 = 5.5 → 6 (a half rounds up)
    { payout: 9_025, cleaning: 9_000, gross: 25, fee: 6, net: 19 },
    // Cleaning fee equal to the payout: nothing for the owner, no fee.
    { payout: 9_000, cleaning: 9_000, gross: 0, fee: 0, net: 0 },
  ])('payout $payout − cleaning $cleaning → gross $gross, fee $fee, net $net', (row) => {
    const s = september({ bookings: [stay('2026-09-10', '2026-09-13', row.payout, row.cleaning)] });
    expect(s.totals).toMatchObject({ grossCents: row.gross, managementFeeCents: row.fee, netCents: row.net });
  });

  it('never counts the guest cleaning fee as owner revenue', () => {
    const s = september({ bookings: [stay('2026-09-01', '2026-09-04', 75_000, 15_000)] });
    expect(s.totals.grossCents).toBe(60_000);
    expect(s.lines).toEqual([expect.objectContaining({ kind: 'STAY', amountCents: 60_000, stayGrossCents: 60_000 })]);
  });

  it('rounds the fee once on the month total, not per stay', () => {
    // Two stays of 12_345 gross each: per stay 2_715.9 → 2_716 twice = 5_432; on the total 24_690 × 22% = 5_431.8 → 5_432.
    // Three of 1_001: per stay 220.22 → 220 × 3 = 660; on the total 3_003 × 22% = 660.66 → 661.
    const s = september({
      bookings: [
        stay('2026-09-01', '2026-09-02', 1_001, 0),
        stay('2026-09-03', '2026-09-04', 1_001, 0),
        stay('2026-09-05', '2026-09-06', 1_001, 0),
      ],
    });
    expect(s.totals).toMatchObject({ grossCents: 3_003, managementFeeCents: 661, netCents: 2_342 });
  });

  it.each([
    { bps: 2200, fee: 22_000 },
    { bps: 1800, fee: 18_000 },
    { bps: 0, fee: 0 }, // "Own property" plan
  ])("uses the property's plan rate ($bps bps)", ({ bps, fee }) => {
    const s = september({ feeBps: bps, bookings: [stay('2026-09-01', '2026-09-05', 110_000, 10_000)] });
    expect(s.totals).toMatchObject({ grossCents: 100_000, managementFeeBps: bps, managementFeeCents: fee });
    expect(s.totals.netCents).toBe(100_000 - fee);
  });
});

describe('stays crossing a month end', () => {
  it('splits gross per night, remainder cents to the earliest nights, and shows the split', () => {
    // 5 nights, Aug 29 → Sep 3: gross 100_003 → 20_001 × 3 + 20_000 × 2. August has 3 nights (29, 30, 31).
    const b = stay('2026-08-29', '2026-09-03', 110_003, 10_000);
    const sep = september({ bookings: [b] });
    const aug = computeStatement({
      month: '2026-08',
      feeBps: 2200,
      ownerStayCleaningFeeCents: 0,
      bookings: [b],
      expenses: [],
      adjustments: [],
    });
    expect(aug.lines[0]).toMatchObject({ nights: 3, totalNights: 5, stayGrossCents: 100_003, amountCents: 60_003 });
    expect(sep.lines[0]).toMatchObject({ nights: 2, totalNights: 5, stayGrossCents: 100_003, amountCents: 40_000 });
    expect(aug.totals.grossCents + sep.totals.grossCents).toBe(100_003);
    expect(sep.totals).toMatchObject({ nightsBooked: 2, grossCents: 40_000, managementFeeCents: 8_800 });
  });

  it('puts a stay checking out on the 1st entirely in the earlier month', () => {
    const s = september({ bookings: [stay('2026-08-28', '2026-09-01', 50_000, 10_000)] });
    expect(s.lines).toEqual([]);
    expect(s.totals.grossCents).toBe(0);
  });

  it('counts a cancelled stay that still paid out in its check-in month, with no nights', () => {
    const cancelled = stay('2026-09-29', '2026-10-04', 30_000, 0, { status: 'CANCELLED' });
    const s = september({ bookings: [cancelled] });
    expect(s.lines[0]).toMatchObject({ cancelled: true, nights: 0, amountCents: 30_000 });
    expect(s.totals).toMatchObject({ nightsBooked: 0, grossCents: 30_000, managementFeeCents: 6_600 });
  });
});

describe('owner stays', () => {
  it("charges the property's standard cleaning fee in the check-out month", () => {
    const s = september({
      cleaningFee: 15_000,
      bookings: [
        stay('2026-09-01', '2026-09-04', 106_000, 15_000), // gross 91_000
        ownerStay('2026-09-09', '2026-09-11'),
        ownerStay('2026-09-28', '2026-10-02'), // checks out in October: charged there
      ],
    });
    expect(s.totals).toMatchObject({
      grossCents: 91_000,
      managementFeeCents: 20_020,
      ownerStayCleaningCents: 15_000,
      netCents: 91_000 - 20_020 - 15_000,
    });
    expect(s.lines.filter((l) => l.kind === 'OWNER_STAY_CLEANING')).toEqual([
      expect.objectContaining({ date: '2026-09-09', endDate: '2026-09-11', amountCents: -15_000 }),
    ]);
  });

  it('charges nothing for a cancelled owner stay, a block, or when the property has no standard fee', () => {
    const bookings = [
      ownerStay('2026-09-09', '2026-09-11', { status: 'CANCELLED' }),
      stay('2026-09-14', '2026-09-16', null, null, { kind: 'BLOCK' }),
    ];
    expect(september({ cleaningFee: 15_000, bookings }).totals.ownerStayCleaningCents).toBe(0);
    expect(september({ bookings: [ownerStay('2026-09-09', '2026-09-11')] }).totals.ownerStayCleaningCents).toBe(0);
  });

  it('has no revenue and no fee of its own', () => {
    const s = september({ cleaningFee: 12_000, bookings: [ownerStay('2026-09-09', '2026-09-11')] });
    expect(s.totals).toMatchObject({ grossCents: 0, managementFeeCents: 0, nightsBooked: 0, netCents: -12_000 });
  });
});

describe('expenses', () => {
  it("deducts owner-borne expenses purchased in the month, not TruHost's own, voided or other months'", () => {
    const s = september({
      bookings: [stay('2026-09-01', '2026-09-03', 50_000, 0)],
      expenses: [
        expense('2026-09-05', 6_420),
        expense('2026-09-20', 14_500, { category: 'REPAIRS_MAINTENANCE' }),
        expense('2026-09-06', 9_999, { bearer: 'TRUHOST' }),
        expense('2026-09-07', 5_000, { voided: true }),
        expense('2026-10-01', 7_000),
      ],
    });
    expect(s.totals).toMatchObject({
      expensesCents: 20_920,
      managementFeeCents: 11_000,
      netCents: 50_000 - 11_000 - 20_920,
    });
    expect(s.lines.filter((l) => l.kind === 'EXPENSE').map((l) => l.amountCents)).toEqual([-6_420, -14_500]);
  });

  it("doesn't reduce the fee: TruPlan is on gross only", () => {
    const s = september({
      bookings: [stay('2026-09-01', '2026-09-03', 100_000, 0)],
      expenses: [expense('2026-09-05', 40_000)],
    });
    expect(s.totals.managementFeeCents).toBe(22_000);
  });

  it('lists owner expenses without a receipt (they block finalizing)', () => {
    const noReceipt = expense('2026-09-05', 1_000, { hasReceipt: false });
    const s = september({ expenses: [expense('2026-09-04', 2_000), noReceipt] });
    expect(s.expensesMissingReceiptIds).toEqual([noReceipt.id]);
  });
});

describe('adjustments', () => {
  it.each([
    { amounts: [5_000], total: 5_000 },
    { amounts: [-2_500], total: -2_500 },
    { amounts: [5_000, -1_234, 1], total: 3_767 },
  ])('add $amounts to net, outside the fee base', ({ amounts, total }) => {
    const base = { bookings: [stay('2026-09-01', '2026-09-03', 100_000, 0)] };
    const s = september({ ...base, adjustments: amounts.map((a) => adjustment(a)) });
    expect(s.totals).toMatchObject({ grossCents: 100_000, managementFeeCents: 22_000, adjustmentsCents: total });
    expect(s.totals.netCents).toBe(78_000 + total);
  });

  it('names the month an adjustment corrects', () => {
    const s = september({
      adjustments: [adjustment(1_500, { reason: 'Payout came in late', correctsMonth: '2026-08' })],
    });
    expect(s.lines[0]).toMatchObject({
      kind: 'ADJUSTMENT',
      description: 'Payout came in late',
      detail: 'Corrects August 2026',
      amountCents: 1_500,
    });
  });
});

describe('pending payouts', () => {
  it('counts a stay without its payout at $0, keeps its nights, and lists it for the finalize warning', () => {
    const pending = stay('2026-09-10', '2026-09-12', null, 9_000);
    const s = september({ bookings: [stay('2026-09-01', '2026-09-03', 50_000, 10_000), pending] });
    expect(s.totals).toMatchObject({ nightsBooked: 4, grossCents: 40_000 });
    expect(s.pendingPayoutBookingIds).toEqual([pending.id]);
    expect(s.lines[1]).toMatchObject({ payoutPending: true, amountCents: 0, nights: 2, stayGrossCents: null });
  });
});

describe('lines', () => {
  it('always add up to the net, in order: stays, owner-stay cleaning, expenses, adjustments', () => {
    const s = september({
      cleaningFee: 15_000,
      bookings: [
        stay('2026-09-23', '2026-09-27', 151_000, 15_000),
        stay('2026-08-30', '2026-09-02', 90_001, 15_000),
        ownerStay('2026-09-09', '2026-09-11'),
      ],
      expenses: [expense('2026-09-20', 14_500), expense('2026-09-05', 8_975)],
      adjustments: [adjustment(-3_000, { addedOn: '2026-10-03' })],
    });
    const sum = s.lines.reduce((acc, l) => acc + l.amountCents, 0);
    expect(sum - s.totals.managementFeeCents).toBe(s.totals.netCents);
    expect(s.lines.map((l) => [l.kind, l.date])).toEqual([
      ['STAY', '2026-08-30'],
      ['STAY', '2026-09-23'],
      ['OWNER_STAY_CLEANING', '2026-09-09'],
      ['EXPENSE', '2026-09-05'],
      ['EXPENSE', '2026-09-20'],
      ['ADJUSTMENT', '2026-10-03'],
    ]);
  });

  it('shows month names in full', () => {
    expect(monthName('2026-09')).toBe('September 2026');
    expect(monthName('2027-01')).toBe('January 2027');
  });
});
