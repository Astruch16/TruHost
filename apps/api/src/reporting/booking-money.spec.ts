import { isComplete, nightsBetween, ownerGrossCents } from './booking-money.js';

describe('ownerGrossCents', () => {
  it.each([
    [{ kind: 'GUEST', payoutCents: 285_600, guestCleaningFeeCents: 8_500 }, 277_100],
    [{ kind: 'GUEST', payoutCents: 10_000, guestCleaningFeeCents: 0 }, 10_000],
    [{ kind: 'GUEST', payoutCents: 8_500, guestCleaningFeeCents: 8_500 }, 0],
    [{ kind: 'GUEST', payoutCents: null, guestCleaningFeeCents: 8_500 }, null],
    [{ kind: 'GUEST', payoutCents: 10_000, guestCleaningFeeCents: null }, null],
    [{ kind: 'OWNER_STAY', payoutCents: null, guestCleaningFeeCents: null }, null],
  ] as const)('%j → %s', (b, expected) => {
    expect(ownerGrossCents(b)).toBe(expected);
  });
});

describe('isComplete', () => {
  it('needs both amounts on guest stays only', () => {
    expect(isComplete({ kind: 'GUEST', payoutCents: 1, guestCleaningFeeCents: null })).toBe(false);
    expect(isComplete({ kind: 'GUEST', payoutCents: 1, guestCleaningFeeCents: 0 })).toBe(true);
    expect(isComplete({ kind: 'BLOCK', payoutCents: null, guestCleaningFeeCents: null })).toBe(true);
  });
});

describe('nightsBetween', () => {
  it('counts nights across a DST change without drift', () => {
    expect(nightsBetween(new Date('2026-03-07T00:00:00Z'), new Date('2026-03-10T00:00:00Z'))).toBe(3);
  });
});
