import { describe, expect, it } from 'vitest';
import { bookingRangeQuery, createBooking, updateBooking } from './bookings.js';

const base = { channel: 'AIRBNB', checkInDate: '2026-11-01', checkOutDate: '2026-11-04' } as const;

describe('createBooking', () => {
  it('defaults to a guest stay with money not yet entered', () => {
    expect(createBooking.parse(base)).toMatchObject({ kind: 'GUEST', payoutCents: null, guestCleaningFeeCents: null });
  });

  it.each([
    [{ checkOutDate: '2026-11-01' }, 'checkOutDate'],
    [{ checkOutDate: '2027-12-01' }, 'checkOutDate'],
    [{ kind: 'OWNER_STAY', payoutCents: 100 }, 'payoutCents'],
    [{ payoutCents: 10000, guestCleaningFeeCents: 10001 }, 'guestCleaningFeeCents'],
    [{ payoutCents: 100.5 }, 'payoutCents'],
  ])('rejects %j', (patch, path) => {
    const r = createBooking.safeParse({ ...base, ...patch });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.join('.'))).toContain(path);
  });
});

describe('updateBooking', () => {
  it('carries only what was sent', () => {
    expect(updateBooking.parse({ version: 2, payoutCents: 5000 })).toEqual({ version: 2, payoutCents: 5000 });
  });
});

describe('bookingRangeQuery', () => {
  it('bounds ranges', () => {
    expect(bookingRangeQuery.safeParse({ from: '2026-01-01', to: '2026-02-01' }).success).toBe(true);
    expect(bookingRangeQuery.safeParse({ from: '2026-02-01', to: '2026-02-01' }).success).toBe(false);
    expect(bookingRangeQuery.safeParse({ from: '2026-01-01', to: '2028-01-01' }).success).toBe(false);
  });
});
