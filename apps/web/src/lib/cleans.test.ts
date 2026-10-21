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

  it('groups coming-up cleans into this week, next week and later months, in either order', async () => {
    const { weekGroups } = await import('./cleans');
    // Tuesday, Oct 20 2026; weeks start on Sunday: this week runs to Sat Oct 24, next week to Sat Oct 31.
    const items = ['2026-10-22', '2026-10-26', '2026-10-31', '2026-11-04', '2026-12-02'].map((d) => ({
      scheduledDate: d,
    }));
    const soonest = weekGroups(items, '2026-10-20', 0);
    expect(soonest.map((g) => [g.label, g.items.length])).toEqual([
      ['This week', 1],
      ['Next week', 2],
      ['Later in November', 1],
      ['December 2026', 1],
    ]);
    expect(weekGroups(items, '2026-10-20', 0, 'latest').map((g) => g.label)).toEqual([
      'December 2026',
      'Later in November',
      'Next week',
      'This week',
    ]);
    // Weeks starting on Monday: Sun Oct 25 is still this week.
    expect(weekGroups([{ scheduledDate: '2026-10-25' }], '2026-10-20', 1)[0]!.label).toBe('This week');
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
});
