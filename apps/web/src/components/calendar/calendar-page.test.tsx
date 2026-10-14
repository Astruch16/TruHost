import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { monthAgenda, type CalendarStay } from '../../lib/calendar';
import { MonthCalendar } from '../dashboard/month-calendar';
import { MonthAgenda } from './month-agenda';

const stay = (
  id: string,
  checkInDate: string,
  checkOutDate: string,
  guestName: string | null,
  kind: CalendarStay['kind'] = 'GUEST',
): CalendarStay => ({ id, propertyId: 'p1', kind, channel: 'AIRBNB', checkInDate, checkOutDate, nights: 2, guestName });

const NAMES = new Map([['p1', 'Petersburg Retreat']]);
const STAYS = [
  stay('a', '2026-10-10', '2026-10-12', 'Andrew'),
  stay('b', '2026-10-20', '2026-10-22', null, 'OWNER_STAY'),
];

describe('calendar bars', () => {
  it('say who is staying, and open the booking when clickable', async () => {
    const onSelect = vi.fn();
    render(
      <MonthCalendar
        month="2026-10"
        stays={STAYS}
        propertyNames={NAMES}
        today="2026-10-14"
        showProperty={false}
        onSelect={onSelect}
        roomy
      />,
    );
    // Oct 10 is a Saturday: the stay carries on into the next week, so it's two pieces, each opening it.
    const pieces = screen.getAllByRole('button', { name: /^Andrew · 2 nights, Airbnb, Oct 10 to Oct 12/ });
    expect(pieces).toHaveLength(2);
    await userEvent.click(pieces[1]!);
    expect(onSelect).toHaveBeenCalledWith('a');
    expect(screen.getByRole('button', { name: /^Owner stay/ })).toBeInTheDocument();
  });

  it('are plain (not buttons) without onSelect, as on the dashboard', () => {
    render(<MonthCalendar month="2026-10" stays={STAYS} propertyNames={NAMES} today={null} showProperty={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Andrew · 2 nights')).toBeInTheDocument();
  });
});

describe('arrivals and departures', () => {
  it('lists each day’s check-outs and check-ins, marks today, and opens the booking', async () => {
    const onSelect = vi.fn();
    const stays = [...STAYS, stay('c', '2026-10-14', '2026-10-16', 'Leila')];
    render(
      <MonthAgenda
        month="2026-10"
        agenda={monthAgenda('2026-10', stays)}
        today="2026-10-14"
        propertyNames={NAMES}
        showProperty={false}
        onSelect={onSelect}
      />,
    );
    const days = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(days).toEqual([
      'Sat, Oct 10',
      'Mon, Oct 12',
      'Wed, Oct 14Today',
      'Fri, Oct 16',
      'Tue, Oct 20',
      'Thu, Oct 22',
    ]);
    const today = screen.getByText('Today').closest('li')!;
    await userEvent.click(within(today).getByRole('button', { name: 'Check-in Leila · 2 nights · Airbnb' }));
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('says so when nobody is coming or going', () => {
    render(<MonthAgenda month="2026-10" agenda={[]} today="2026-10-14" propertyNames={NAMES} showProperty={false} />);
    expect(screen.getByText('Nobody coming or going')).toBeInTheDocument();
  });
});
