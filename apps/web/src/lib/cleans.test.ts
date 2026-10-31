import { describe, expect, it } from 'vitest';
import { cleanOccasion, freeFrom, readyBy, scheduleGroups } from './cleans';

const window = (from: string | null, until: { date: string; time: string } | null) => ({
  from: { date: '2026-11-20', time: from },
  until,
});

describe('cleans', () => {
  it('says what a clean follows', () => {
    expect(cleanOccasion({ kind: 'TURNOVER', stay: { kind: 'GUEST', checkInDate: '', checkOutDate: '' } })).toBe(
      'After a guest stay',
    );
    expect(cleanOccasion({ kind: 'TURNOVER', stay: { kind: 'OWNER_STAY', checkInDate: '', checkOutDate: '' } })).toBe(
      'After an owner stay',
    );
    expect(cleanOccasion({ kind: 'ADHOC', stay: null })).toBe('Extra clean');
  });

  it('words the window: free from check-out, ready by the next check-in', () => {
    expect(freeFrom({ window: window('11:00', null) })).toBe('Free from 11 AM');
    expect(freeFrom({ window: window(null, null) })).toBeNull();
    expect(
      readyBy({ scheduledDate: '2026-11-20', window: window('11:00', { date: '2026-11-20', time: '16:00' }) }),
    ).toBe('Ready by 4 PM');
    expect(
      readyBy({ scheduledDate: '2026-11-20', window: window('11:00', { date: '2026-11-21', time: '15:30' }) }),
    ).toBe('Ready by 3:30 PM Sat, Nov 21');
    expect(readyBy({ scheduledDate: '2026-11-20', window: window('11:00', null) })).toBe('No one arriving after');
  });

  it('groups a schedule into today, coming up and recently done', () => {
    const c = (id: string, scheduledDate: string, status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETE' | 'CANCELLED') => ({
      id,
      scheduledDate,
      status,
      completedAt: null,
    });
    const groups = scheduleGroups(
      [
        c('later', '2026-11-25', 'SCHEDULED'),
        c('today', '2026-11-20', 'SCHEDULED'),
        c('leftover', '2026-11-19', 'IN_PROGRESS'),
        c('cancelledToday', '2026-11-20', 'CANCELLED'),
        c('cancelledLater', '2026-11-22', 'CANCELLED'),
        c('done1', '2026-11-18', 'COMPLETE'),
        c('done2', '2026-11-19', 'COMPLETE'),
        c('missed', '2026-11-17', 'SCHEDULED'),
      ],
      '2026-11-20',
    );
    expect(groups.today.map((x) => x.id)).toEqual(['leftover', 'today']);
    expect(groups.upcoming.map((x) => x.id)).toEqual(['cancelledLater', 'later']);
    expect(groups.recent.map((x) => x.id)).toEqual(['done2', 'done1']);
  });
});

describe('schedule organising', () => {
  it('gives each property a lasting colour, in name order', async () => {
    const { propertyColors } = await import('./cleans');
    const colors = propertyColors([
      { id: 'b', name: 'Seaside Loft' },
      { id: 'a', name: 'Cedar Cabin' },
      { id: 'b', name: 'Seaside Loft' },
    ]);
    expect([...colors]).toEqual([
      ['a', 'bg-sage-mid'],
      ['b', 'bg-blue-deep'],
    ]);
  });
});

describe('agenda and hero helpers', () => {
  it('splits a list by day in its order, and counts what’s ahead', async () => {
    const { byDay, scheduleCounts } = await import('./cleans');
    const p = (id: string) => ({ id, name: id, city: '' });
    const items = [
      { scheduledDate: '2026-10-22', status: 'SCHEDULED' as const, property: p('a') },
      { scheduledDate: '2026-10-22', status: 'SCHEDULED' as const, property: p('b') },
      { scheduledDate: '2026-10-26', status: 'SCHEDULED' as const, property: p('a') },
      { scheduledDate: '2026-11-25', status: 'SCHEDULED' as const, property: p('c') },
      { scheduledDate: '2026-10-23', status: 'CANCELLED' as const, property: p('d') },
    ];
    expect(byDay(items.slice(0, 3)).map((d) => [d.day, d.items.length])).toEqual([
      ['2026-10-22', 2],
      ['2026-10-26', 1],
    ]);
    // Tue Oct 20; weeks from Sunday: this week ends Sat Oct 24.
    expect(scheduleCounts(items, '2026-10-20', 0)).toEqual({ thisWeek: 2, next30: 3, properties: 3 });
  });

  it('counts a clean still under way from an earlier day, but not one done, missed or cancelled', async () => {
    const { scheduleCounts } = await import('./cleans');
    const p = (id: string) => ({ id, name: id, city: '' });
    const items = [
      // Started on Tuesday and not finished: still to do this week.
      { scheduledDate: '2026-10-27', status: 'IN_PROGRESS' as const, property: p('a') },
      // Done, never started (a missed day) and cancelled: nothing left to do.
      { scheduledDate: '2026-10-28', status: 'COMPLETE' as const, property: p('b') },
      { scheduledDate: '2026-10-29', status: 'SCHEDULED' as const, property: p('c') },
      { scheduledDate: '2026-10-31', status: 'CANCELLED' as const, property: p('d') },
      // Today, and later this month.
      { scheduledDate: '2026-10-31', status: 'SCHEDULED' as const, property: p('a') },
      { scheduledDate: '2026-11-04', status: 'SCHEDULED' as const, property: p('e') },
    ];
    // Sat Oct 31; weeks from Sunday: this week ends today.
    expect(scheduleCounts(items, '2026-10-31', 0)).toEqual({ thisWeek: 2, next30: 3, properties: 2 });
    // Weeks from Monday: this week runs to Sun Nov 1.
    expect(scheduleCounts(items, '2026-10-31', 1)).toEqual({ thisWeek: 2, next30: 3, properties: 2 });
  });
});

describe('calendar day marks', () => {
  it('turns a property’s dot class into its colour', async () => {
    const { propertyColorValue, PROPERTY_DOTS } = await import('./cleans');
    expect(propertyColorValue('bg-sage-mid')).toBe('var(--color-sage-mid)');
    expect(propertyColorValue(undefined)).toBe('var(--color-line)');
    // Every colour a property can get is a theme token.
    for (const dot of PROPERTY_DOTS) expect(propertyColorValue(dot)).toMatch(/^var\(--color-[a-z]+-[a-z]+\)$/);
  });

  it('rings a day in its colour with a faint fill of it, a slice each for several, and keeps today green', async () => {
    const { dayMarkStyle } = await import('./cleans');
    const one = dayMarkStyle(['var(--color-sage-mid)']);
    expect(one.border).toBe('2px solid transparent');
    expect(one.background).toBe(
      'conic-gradient(color-mix(in srgb, var(--color-sage-mid) 16%, transparent) 0% 100%) padding-box, ' +
        'linear-gradient(var(--color-surface), var(--color-surface)) padding-box, ' +
        'conic-gradient(var(--color-sage-mid) 0% 100%) border-box',
    );
    const two = dayMarkStyle(['var(--color-sage-mid)', 'var(--color-blue-deep)']);
    expect(two.background).toContain(
      'conic-gradient(var(--color-sage-mid) 0% 50%, var(--color-blue-deep) 50% 100%) border-box',
    );
    expect(one.boxShadow).toBeUndefined();
    const today = dayMarkStyle(['var(--color-sage-mid)'], true);
    expect(today.boxShadow).toBe('inset 0 0 0 1.5px var(--color-surface)');
    expect(today.background).toBe(
      'linear-gradient(var(--color-primary), var(--color-primary)) padding-box, ' +
        'conic-gradient(var(--color-sage-mid) 0% 100%) border-box',
    );
  });
});

describe('week board and rail helpers', () => {
  it('finds the week a day falls in, from the user’s first day of the week', async () => {
    const { weekOf } = await import('./cleans');
    expect(weekOf('2026-10-28', 0)).toEqual({
      start: '2026-10-25',
      days: ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'],
    });
    expect(weekOf('2026-10-25', 1).start).toBe('2026-10-19');
  });

  it('sums up each property ahead: its next clean and how many are coming', async () => {
    const { propertySummaries } = await import('./cleans');
    const a = { id: 'a', name: 'Cedar', city: '' };
    const b = { id: 'b', name: 'Seaside', city: '' };
    const c = (id: string, scheduledDate: string, property: typeof a, status = 'SCHEDULED' as const) => ({
      id,
      scheduledDate,
      status,
      property,
    });
    const rows = propertySummaries(
      [
        c('1', '2026-10-27', a),
        c('2', '2026-10-26', b),
        c('3', '2026-11-04', a),
        c('4', '2026-10-19', a), // past
        { ...c('5', '2026-10-30', b), status: 'CANCELLED' as const },
      ],
      '2026-10-20',
    );
    expect(rows.map((r) => [r.property.id, r.next.id, r.upcoming])).toEqual([
      ['b', '2', 1],
      ['a', '1', 2],
    ]);
  });
});
