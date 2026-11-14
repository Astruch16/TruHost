import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CalendarStay } from '../../lib/calendar';
import { MonthCalendar } from './month-calendar';

const stay = (id: string, checkInDate: string, checkOutDate: string, nights: number, guestName: string) =>
  ({
    id,
    propertyId: 'p1',
    kind: 'GUEST',
    channel: 'AIRBNB',
    checkInDate,
    checkOutDate,
    nights,
    guestName,
  }) as CalendarStay;

describe('month calendar', () => {
  it('repeats a stay’s label at the start of each week it runs into, even for half a day', () => {
    // Weeks start on Sunday (the default).
    // Maya's Saturday Oct 3 → Sunday Oct 4 stay has half a day in each week: its label goes on the half day it runs
    // into (Sunday the 4th). Andrew's Sunday Oct 11 → Monday Oct 19 is labelled in both weeks.
    render(
      <MonthCalendar
        month="2026-10"
        stays={[
          stay('maya', '2026-10-03', '2026-10-04', 1, 'Maya'),
          stay('andrew', '2026-10-11', '2026-10-19', 8, 'Andrew'),
        ]}
        propertyNames={new Map([['p1', 'Cedar Cabin']])}
        today={null}
        showProperty={false}
      />,
    );
    const maya = screen.getAllByText('Maya · 1 night');
    expect(maya).toHaveLength(1);
    expect(maya[0]!.closest('[title]')).toHaveStyle({ left: 'calc(0% + 0px)' });
    expect(screen.getAllByText('Andrew · 8 nights')).toHaveLength(2);
  });
});
