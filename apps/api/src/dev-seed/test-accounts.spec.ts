import { describe, expect, it } from 'vitest';
import { assertSafeToSeed, plannedBookings, seedMonths } from './test-accounts.js';

describe('dev seed', () => {
  const ok = { NODE_ENV: 'development', CLERK_SECRET_KEY: 'sk_test_abc', DATABASE_URL: 'postgresql://x' };

  it('runs only against a Clerk dev instance, never in production', () => {
    expect(() => assertSafeToSeed(ok)).not.toThrow();
    expect(() => assertSafeToSeed({ ...ok, CLERK_SECRET_KEY: 'sk_live_abc' })).toThrow(/live key/);
    expect(() => assertSafeToSeed({ ...ok, CLERK_SECRET_KEY: undefined })).toThrow(/sk_test_/);
    expect(() => assertSafeToSeed({ ...ok, NODE_ENV: 'production' })).toThrow(/production/);
    expect(() => assertSafeToSeed({ ...ok, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it('covers three months back to one ahead, across a year end', () => {
    expect(seedMonths(new Date('2026-10-09T18:00:00Z'))).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    expect(seedMonths(new Date('2027-01-15T18:00:00Z'))).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    // 1 a.m. UTC on Nov 1 is still October in Vancouver.
    expect(seedMonths(new Date('2026-11-01T01:00:00Z'), 0, 0)).toEqual(['2026-10']);
  });

  it('plans the same stays each month: paid out up to now, pending after, owner stays without money', () => {
    const paid = plannedBookings('cedar', '2026-10', true);
    expect(paid[0]).toMatchObject({
      externalId: 'seed-cedar-2026-10-1',
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-04',
      payoutCents: 3 * 32_000 + 15_000,
      guestCleaningFeeCents: 15_000,
    });
    expect(paid[1]).toMatchObject({
      kind: 'OWNER_STAY',
      payoutCents: null,
      guestCleaningFeeCents: null,
      guestCount: null,
    });
    expect(plannedBookings('cedar', '2026-11', false).every((b) => b.payoutCents === null)).toBe(true);
    // No two stays in a month overlap (the database refuses overlapping confirmed stays).
    for (const key of ['seaside', 'cedar'] as const) {
      const stays = plannedBookings(key, '2026-02', true);
      stays.slice(1).forEach((b, i) => expect(b.checkInDate >= stays[i]!.checkOutDate).toBe(true));
    }
  });
});
