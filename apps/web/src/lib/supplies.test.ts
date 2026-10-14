import { describe, expect, it } from 'vitest';
import {
  checkedAgo,
  groupByCategory,
  groupByProperty,
  restockSummary,
  levelText,
  restockCount,
  suggestedSupplies,
  suppliesSummary,
} from './supplies';

describe('supplies helpers', () => {
  it.each([
    [null, 'Not checked yet'],
    [100, 'Full'],
    [75, '¾ left'],
    [50, '½ left'],
    [25, '¼ left'],
    [60, '60% left'],
    [0, 'Empty'],
  ])('describes %s as “%s”', (pct, text) => {
    expect(levelText(pct)).toBe(text);
  });

  it('groups by category in a fixed order, keeping each group’s order', () => {
    const groups = groupByCategory([
      { id: 'a', category: 'KITCHEN', position: 1 },
      { id: 'b', category: 'BATHROOM', position: 3 },
      { id: 'c', category: 'KITCHEN', position: 0 },
      { id: 'd', category: 'OTHER', position: 2 },
    ] as const);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Bathroom', ['b']],
      ['Kitchen', ['c', 'a']],
      ['Other', ['d']],
    ]);
  });

  it('counts what needs restocking and sums it up', () => {
    const states = (...s: string[]) => s.map((state) => ({ state }) as { state: 'OK' | 'LOW' | 'OUT' | 'UNKNOWN' });
    expect(restockCount(states('OK', 'LOW', 'OUT', 'UNKNOWN'))).toBe(2);
    expect(suppliesSummary(states('OK', 'LOW', 'OUT'))).toBe('2 to restock');
    expect(suppliesSummary(states('OK', 'UNKNOWN'))).toBe('All stocked');
    expect(suppliesSummary(states('UNKNOWN', 'UNKNOWN'))).toBe('Not checked yet');
  });

  it('suggests common supplies the property doesn’t track yet', () => {
    const names = suggestedSupplies([{ name: 'toilet PAPER' }]).map((s) => s.name);
    expect(names).not.toContain('Toilet paper');
    expect(names).toContain('Coffee pods');
  });
});

describe('checkedAgo', () => {
  const now = new Date('2026-10-13T18:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);
  it.each([
    [30_000, 'Checked just now'],
    [5 * 60_000, 'Checked 5 min ago'],
    [60 * 60_000, 'Checked 1 hour ago'],
    [3 * 3600_000, 'Checked 3 hours ago'],
    [26 * 3600_000, 'Checked 1 day ago'],
    [4 * 86_400_000, 'Checked 4 days ago'],
  ])('%sms ago reads “%s”', (ms, text) => {
    expect(checkedAgo(ago(ms), now)).toBe(text);
  });
});

describe('restock list helpers', () => {
  const item = (id: string, propertyId: string, urgency: 'OUT' | 'LOW' | 'SOON') => ({
    id,
    urgency,
    property: { id: propertyId, name: propertyId.toUpperCase() },
  });

  it('groups by property in the order given', () => {
    const groups = groupByProperty([item('a', 'p2', 'OUT'), item('b', 'p1', 'LOW'), item('c', 'p2', 'SOON')]);
    expect(groups.map((g) => [g.property.name, g.items.map((i) => i.id)])).toEqual([
      ['P2', ['a', 'c']],
      ['P1', ['b']],
    ]);
  });

  it('sums up what to restock now and soon', () => {
    expect(restockSummary([item('a', 'p', 'OUT'), item('b', 'p', 'LOW'), item('c', 'p', 'SOON')])).toBe(
      '2 to restock · 1 low soon',
    );
    expect(restockSummary([item('c', 'p', 'SOON')])).toBe('1 low soon');
    expect(restockSummary([])).toBe('');
  });
});
