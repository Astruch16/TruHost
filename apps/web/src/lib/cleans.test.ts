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
