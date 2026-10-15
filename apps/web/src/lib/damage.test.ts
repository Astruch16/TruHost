import { describe, expect, it } from 'vitest';
import { claimWindow, damageTimeline } from './damage';

describe('claim window', () => {
  const r = (claimDeadline: string | null, status: 'SUBMITTED' | 'CLAIM_FILED' = 'SUBMITTED') => ({
    claimDeadline,
    status,
  });
  it.each([
    ['2026-10-18', '2026-10-14', '4 days to claim', false, false],
    ['2026-10-17', '2026-10-14', '3 days to claim', true, false],
    ['2026-10-15', '2026-10-14', '1 day to claim', true, false],
    ['2026-10-14', '2026-10-14', 'Last day to claim', true, false],
    ['2026-10-13', '2026-10-14', 'Claim window closed', false, true],
  ])('deadline %s on %s: %s', (deadline, today, label, urgent, closed) => {
    expect(claimWindow(r(deadline), today)).toEqual({ label, urgent, closed });
  });

  it('says nothing without a deadline, or once the claim is filed', () => {
    expect(claimWindow(r(null), '2026-10-14')).toBeNull();
    expect(claimWindow(r('2026-10-18', 'CLAIM_FILED'), '2026-10-14')).toBeNull();
  });
});

describe('timeline', () => {
  it('lists the steps with when each was reached', () => {
    const steps = damageTimeline({
      submittedAt: '2026-10-04T18:00:00.000Z',
      acknowledgedAt: '2026-10-05T09:00:00.000Z',
      claimFiledAt: null,
      resolvedAt: null,
    });
    expect(steps.map((s) => [s.label, s.at !== null])).toEqual([
      ['Reported', true],
      ['Acknowledged', true],
      ['Claim filed', false],
      ['Resolved', false],
    ]);
  });
});
