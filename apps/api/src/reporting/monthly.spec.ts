import {
  allocatePerNight,
  computeMonth,
  divideHalfUp,
  managementFee,
  monthBounds,
  type MonthBooking,
  type MonthExpense,
} from './monthly.js';

const guest = (
  checkIn: string,
  checkOut: string,
  payoutCents: number | null,
  fee: number | null = 0,
  over: Partial<MonthBooking> = {},
): MonthBooking => ({
  kind: 'GUEST',
  status: 'CONFIRMED',
  checkIn,
  checkOut,
  payoutCents,
  guestCleaningFeeCents: fee,
  ...over,
});
const expense = (amountCents: number, over: Partial<MonthExpense> = {}): MonthExpense => ({
  amountCents,
  bearer: 'OWNER',
  voided: false,
  incurredOn: '2026-10-15',
  hasReceipt: true,
  ...over,
});
const october = (bookings: MonthBooking[], expenses: MonthExpense[] = [], feeBps: number | null = 2200) =>
  computeMonth({ month: '2026-10', feeBps, bookings, expenses });

describe('allocatePerNight', () => {
  it.each([
    [1000, 4, [250, 250, 250, 250]],
    [1001, 4, [251, 250, 250, 250]],
    [1003, 4, [251, 251, 251, 250]],
    [2, 3, [1, 1, 0]],
    [0, 2, [0, 0]],
  ])('%i cents over %i nights → %j', (total, nights, expected) => {
    expect(allocatePerNight(total, nights)).toEqual(expected);
    expect(allocatePerNight(total, nights).reduce((a, b) => a + b, 0)).toBe(total);
  });
});

describe('rounding', () => {
  it.each([
    [5, 2, 3], // 2.5 → 3
    [4, 2, 2],
    [7, 2, 4], // 3.5 → 4
    [1, 3, 0], // 0.33 → 0
    [2, 3, 1], // 0.67 → 1
  ])('divideHalfUp(%i, %i) = %i', (a, b, expected) => expect(divideHalfUp(a, b)).toBe(expected));

  it.each([
    [285_600, 2200, 62_832], // exact
    [100_005, 2200, 22_001], // 22001.1 → 22001
    [100_025, 2200, 22_006], // 22005.5 → 22006 (half up)
    [0, 2200, 0],
    [123_456, null, 0], // no plan in force
  ])('managementFee(%i, %s) = %i', (gross, bps, expected) => expect(managementFee(gross, bps)).toBe(expected));
});

describe('monthBounds', () => {
  it('knows month lengths, including leap years', () => {
    expect(monthBounds('2026-10')).toEqual({ first: '2026-10-01', next: '2026-11-01', days: 31 });
    expect(monthBounds('2028-02').days).toBe(29);
    expect(monthBounds('2026-12').next).toBe('2027-01-01');
  });
});

describe('computeMonth', () => {
  it('computes the spec example: gross, 22% fee, expenses and net', () => {
    // 3 nights, payout $480.00, cleaning fee $85.00 → owner gross $395.00.
    const f = october([guest('2026-10-02', '2026-10-05', 48_000, 8_500)], [expense(4_199), expense(2_219)]);
    expect(f).toMatchObject({
      nightsBooked: 3,
      stays: 1,
      grossCents: 39_500,
      managementFeeBps: 2200,
      managementFeeCents: 8_690,
      ownerExpensesCents: 6_418,
      netCents: 24_392, // 39500 − 8690 − 6418
      cleaningFeesCents: 8_500,
      avgNightlyEarningsCents: 13_167, // 39500 / 3 = 13166.67 → 13167
      daysInMonth: 31,
      availableNights: 31,
      occupancyBps: 968, // 3/31 = 9.677% → 968 bps
    });
  });

  it('splits a stay crossing the month boundary per night, without losing a cent', () => {
    // Sep 29 → Oct 3: 4 nights, owner gross 1003 → [251, 251, 251, 250]; Sep 29–30 in Sept, Oct 1–2 in Oct.
    const stay = guest('2026-09-29', '2026-10-03', 1003, 0);
    const oct = october([stay]);
    const sep = computeMonth({ month: '2026-09', feeBps: null, bookings: [stay], expenses: [] });
    expect(oct).toMatchObject({ nightsBooked: 2, grossCents: 501 });
    expect(sep).toMatchObject({ nightsBooked: 2, grossCents: 502 });
    expect(oct.grossCents + sep.grossCents).toBe(1003);
    // The cleaning fee belongs to the checkout month.
    expect(october([guest('2026-09-29', '2026-10-03', 10_000, 900)]).cleaningFeesCents).toBe(900);
    expect(
      computeMonth({
        month: '2026-09',
        feeBps: null,
        bookings: [guest('2026-09-29', '2026-10-03', 10_000, 900)],
        expenses: [],
      }).cleaningFeesCents,
    ).toBe(0);
  });

  it('counts a checkout on the 1st only for its cleaning fee', () => {
    const f = october([guest('2026-09-28', '2026-10-01', 30_000, 7_500)]);
    expect(f).toMatchObject({ nightsBooked: 0, grossCents: 0, stays: 0, cleaningFeesCents: 7_500 });
  });

  it('counts a cancelled stay that still paid out in its check-in month with zero nights', () => {
    const cancelled = guest('2026-10-30', '2026-11-02', 20_000, 0, { status: 'CANCELLED' });
    expect(october([cancelled])).toMatchObject({
      grossCents: 20_000,
      nightsBooked: 0,
      stays: 0,
      avgNightlyEarningsCents: null,
    });
    expect(computeMonth({ month: '2026-11', feeBps: 2200, bookings: [cancelled], expenses: [] }).grossCents).toBe(0);
    // A cancelled stay with no payout entered contributes nothing.
    expect(october([guest('2026-10-10', '2026-10-12', null, null, { status: 'CANCELLED' })]).grossCents).toBe(0);
  });

  it('counts nights of incomplete stays but not their money, and reports them', () => {
    const f = october([
      guest('2026-10-01', '2026-10-04', 30_000, 6_000),
      guest('2026-10-10', '2026-10-12', null, 6_000),
    ]);
    expect(f).toMatchObject({
      nightsBooked: 5,
      stays: 2,
      grossCents: 24_000,
      incompleteBookings: 1,
      avgNightlyEarningsCents: 8_000, // 24000 over the 3 complete nights only
    });
  });

  it('takes owner stays and blocks out of the available nights', () => {
    const f = october([
      guest('2026-10-01', '2026-10-11', 100_000, 0),
      {
        kind: 'OWNER_STAY',
        status: 'CONFIRMED',
        checkIn: '2026-10-20',
        checkOut: '2026-10-25',
        payoutCents: null,
        guestCleaningFeeCents: null,
      },
      {
        kind: 'BLOCK',
        status: 'CONFIRMED',
        checkIn: '2026-10-28',
        checkOut: '2026-11-03',
        payoutCents: null,
        guestCleaningFeeCents: null,
      },
    ]);
    expect(f).toMatchObject({
      nightsBooked: 10,
      ownerStayNights: 5,
      blockNights: 4,
      availableNights: 22,
      occupancyBps: 4545,
    });
  });

  it('has no occupancy when the whole month is blocked', () => {
    const block: MonthBooking = {
      kind: 'BLOCK',
      status: 'CONFIRMED',
      checkIn: '2026-10-01',
      checkOut: '2026-11-01',
      payoutCents: null,
      guestCleaningFeeCents: null,
    };
    expect(october([block])).toMatchObject({ availableNights: 0, occupancyBps: null });
  });

  it('deducts only non-voided, owner-borne expenses purchased in the month', () => {
    const f = october(
      [],
      [
        expense(1_000),
        expense(2_000, { bearer: 'TRUHOST' }),
        expense(4_000, { voided: true }),
        expense(8_000, { incurredOn: '2026-11-01' }),
        expense(16_000, { hasReceipt: false }),
      ],
    );
    expect(f).toMatchObject({ ownerExpensesCents: 17_000, expensesMissingReceipt: 1, netCents: -17_000 });
  });

  it('charges no fee without a plan in force', () => {
    expect(october([guest('2026-10-01', '2026-10-02', 10_000, 0)], [], null)).toMatchObject({
      managementFeeBps: null,
      managementFeeCents: 0,
      netCents: 10_000,
    });
  });

  it('rounds the fee once on the month total, not per stay', () => {
    // Two stays of 25 cents at 22%: per stay round(5.5) = 6 each → 12; on the month total round(11.0) = 11.
    const f = october([guest('2026-10-01', '2026-10-02', 25, 0), guest('2026-10-02', '2026-10-03', 25, 0)]);
    expect(f.managementFeeCents).toBe(11);
  });
});
