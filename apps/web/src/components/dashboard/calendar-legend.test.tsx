import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { monthLegend, stayStyle, type CalendarStay } from '../../lib/calendar';
import { CalendarLegend, MonthCalendar } from './month-calendar';

const stay = (
  id: string,
  checkInDate: string,
  checkOutDate: string,
  channel: CalendarStay['channel'] = 'AIRBNB',
  kind: CalendarStay['kind'] = 'GUEST',
): CalendarStay => ({ id, propertyId: 'p1', kind, channel, checkInDate, checkOutDate, nights: 2 });

describe('stay colours', () => {
  it('colours guest stays by channel, owner stays and blocks by kind', () => {
    expect(stayStyle(stay('a', '2026-10-01', '2026-10-03', 'AIRBNB')).bar).toContain('bg-rose-tint');
    expect(stayStyle(stay('a', '2026-10-01', '2026-10-03', 'VRBO')).bar).toContain('bg-blue-tint');
    expect(stayStyle(stay('a', '2026-10-01', '2026-10-03', 'BOOKING_COM')).bar).toContain('bg-amber-tint');
    expect(stayStyle(stay('a', '2026-10-01', '2026-10-03', 'DIRECT')).bar).toContain('bg-sage-tint');
    expect(stayStyle(stay('a', '2026-10-01', '2026-10-03', 'OTHER')).label).toBe('Other channel');
    // An owner stay is an owner stay, whatever channel it was entered with.
    expect(stayStyle(stay('a', '2026-10-01', '2026-10-03', 'AIRBNB', 'OWNER_STAY')).label).toBe('Owner stay');
    expect(stayStyle(stay('a', '2026-10-01', '2026-10-03', 'VRBO', 'BLOCK')).label).toBe('Blocked');
  });
});

describe('legend', () => {
  const labels = (month: string, stays: CalendarStay[]) => monthLegend(month, stays).styles.map((s) => s.label);

  it('lists only what is on the calendar that month, in a fixed order', () => {
    const stays = [
      stay('a', '2026-10-20', '2026-10-23', 'DIRECT'),
      stay('b', '2026-10-02', '2026-10-05', 'AIRBNB'),
      stay('c', '2026-10-08', '2026-10-10', 'AIRBNB'),
    ];
    expect(labels('2026-10', stays)).toEqual(['Airbnb', 'Direct']);
    expect(labels('2026-10', [...stays, stay('d', '2026-10-12', '2026-10-15', 'VRBO', 'OWNER_STAY')])).toEqual([
      'Airbnb',
      'Direct',
      'Owner stay',
    ]);
  });

  it('counts a stay that only checks out on the 1st (half a day shows), but not one that ended before', () => {
    const stays = [stay('a', '2026-09-28', '2026-10-01', 'VRBO'), stay('b', '2026-10-05', '2026-10-07', 'AIRBNB')];
    expect(labels('2026-10', stays)).toEqual(['Airbnb', 'Vrbo']);
    expect(monthLegend('2026-10', [stays[0]!]).cleans).toBe(true);
    expect(labels('2026-10', [stay('c', '2026-09-20', '2026-09-30', 'DIRECT')])).toEqual([]);
  });

  it('counts a stay running in from the month before', () => {
    expect(labels('2026-10', [stay('a', '2026-09-29', '2026-10-03', 'BOOKING_COM')])).toEqual(['Booking.com']);
  });

  it('shows nothing for an empty month, and the clean marker only with a check-out', () => {
    const { container } = render(<CalendarLegend month="2026-10" stays={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(monthLegend('2026-10', [stay('a', '2026-10-28', '2026-11-02')]).cleans).toBe(false);
  });

  it('renders the key next to a calendar whose bars use the same colours', () => {
    const stays = [
      stay('a', '2026-10-02', '2026-10-05', 'AIRBNB'),
      stay('b', '2026-10-13', '2026-10-15', 'BOOKING_COM'),
    ];
    render(
      <>
        <CalendarLegend month="2026-10" stays={stays} />
        <MonthCalendar
          month="2026-10"
          stays={stays}
          propertyNames={new Map([['p1', 'Cedar']])}
          today={null}
          showProperty={false}
        />
      </>,
    );
    const key = screen.getByRole('list', { name: 'Calendar key' });
    expect(
      within(key)
        .getAllByRole('listitem')
        .map((li) => li.textContent?.trim()),
    ).toEqual(['Airbnb', 'Booking.com', 'Clean to schedule']);
    // Oct 2–5 crosses a week, so it's drawn as two segments: both in Airbnb's colour.
    const airbnb = screen.getAllByTitle(/Airbnb, Oct 2 to/);
    expect(airbnb).toHaveLength(2);
    for (const bar of airbnb) expect(bar).toHaveClass('bg-rose-tint');
    expect(screen.getByTitle(/Booking\.com, Oct 13 to/)).toHaveClass('bg-amber-tint');
  });
});
