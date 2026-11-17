import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { CalendarStay } from '../../lib/calendar';
import { WeekTimeline } from './week-timeline';

const PROPERTY = { id: 'p1', name: 'Cedar Cabin' };
const stay = (id: string, checkInDate: string, checkOutDate: string, nights: number) =>
  ({ id, propertyId: 'p1', kind: 'GUEST', channel: 'AIRBNB', checkInDate, checkOutDate, nights }) as CalendarStay;

function renderWeek(stays: CalendarStay[]) {
  render(<WeekTimeline start="2026-11-16" stays={stays} properties={[PROPERTY]} allProperties={[PROPERTY]} />);
  return within(screen.getByRole('list', { name: 'Cedar Cabin: the next 7 days' }));
}

describe('the next-7-days timeline', () => {
  it('draws a stay that began before today whole, with an arrow and when it began, never cut flat', () => {
    const row = renderWeek([stay('s', '2026-11-13', '2026-11-19', 6)]);
    const bar = row.getByText('6 nights · since Nov 13').closest('li')!;
    expect(bar).toHaveClass('rounded-md');
    expect(bar.className).not.toMatch(/rounded-l-none|border-l-0/);
    // Inset from the edge like any other bar.
    expect(bar.style.left).toBe('calc(0% + 2px)');
    expect(bar.querySelectorAll('svg')).toHaveLength(1);
  });

  it('says when a stay running past the week ends', () => {
    const row = renderWeek([stay('s', '2026-11-20', '2026-11-25', 5)]);
    expect(row.getByText('5 nights · until Nov 25')).toBeInTheDocument();
  });

  it('names both ends of a stay longer than the week', () => {
    const row = renderWeek([stay('s', '2026-11-10', '2026-11-30', 20)]);
    const bar = row.getByText('20 nights · since Nov 10 · until Nov 30').closest('li')!;
    expect(bar.querySelectorAll('svg')).toHaveLength(2);
  });

  it('leaves a stay inside the week as it is', () => {
    const row = renderWeek([stay('s', '2026-11-17', '2026-11-19', 2)]);
    expect(row.getByText('2 nights')).toBeInTheDocument();
  });
});
