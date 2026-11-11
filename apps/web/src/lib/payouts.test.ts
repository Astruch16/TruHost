import { describe, expect, it } from 'vitest';
import { payoutRange } from './payouts';

describe('the range of stays waiting on payout', () => {
  it('runs from the earliest check-in through today (the end is exclusive)', () => {
    expect(payoutRange('2026-10-02', '2026-11-10')).toEqual({ from: '2026-10-02', to: '2026-11-11' });
  });

  it('stays within the bookings API’s 400-day limit', () => {
    const { from, to } = payoutRange('2024-01-01', '2026-11-10');
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    expect(days).toBeLessThanOrEqual(400);
    expect(to).toBe('2026-11-11');
  });
});
