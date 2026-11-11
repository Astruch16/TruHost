import { describe, expect, it } from 'vitest';
import { attentionGroups, type AttentionItem } from './attention';

const item = (kind: AttentionItem['kind'], id: string, propertyName: string | null, date: string | null) => ({
  kind,
  id,
  propertyId: propertyName ? `p-${propertyName}` : null,
  propertyName,
  title: `${kind} title`,
  detail: `${kind} ${id} detail`,
  date,
});

describe('needs attention groups', () => {
  it('turns several of a kind into one row, keeps a lone item as it is, in a fixed order', () => {
    const groups = attentionGroups(
      [
        item('RECEIPT_MISSING', 'e1', 'Cedar Cabin', '2026-11-03'),
        item('PAYOUT_MISSING', 'b1', 'Seaside Loft', '2026-11-02'),
        item('PAYOUT_MISSING', 'b2', 'Cedar Cabin', '2026-11-04'),
        item('PAYOUT_MISSING', 'b3', 'Seaside Loft', '2026-11-09'),
      ],
      { PAYOUT_MISSING: 3, RECEIPT_MISSING: 1, NO_PLAN: 0, INVITE_PENDING: 0 },
    );
    expect(groups.map((g) => [g.kind, g.count, g.title, g.properties])).toEqual([
      ['PAYOUT_MISSING', 3, '3 stays waiting on payout', ['Seaside Loft', 'Cedar Cabin']],
      ['RECEIPT_MISSING', 1, 'RECEIPT_MISSING title', ['Cedar Cabin']],
    ]);
    expect(groups[0]!.detail).toContain('the earliest from Nov 2');
    expect(groups[1]!.detail).toBe('RECEIPT_MISSING e1 detail');
  });

  it('counts from the API, not just the items listed (it lists at most ten of a kind)', () => {
    const listed = Array.from({ length: 10 }, (_, i) => item('PAYOUT_MISSING', `b${i}`, 'Cedar Cabin', '2026-10-01'));
    const [payouts] = attentionGroups(listed, { PAYOUT_MISSING: 14 });
    expect(payouts!.title).toBe('14 stays waiting on payout');
  });

  it('has nothing when nothing needs attention', () => {
    expect(attentionGroups([], { PAYOUT_MISSING: 0, RECEIPT_MISSING: 0, NO_PLAN: 0, INVITE_PENDING: 0 })).toEqual([]);
  });
});
