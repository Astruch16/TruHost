import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Booking } from '../../lib/api-types';
import { BookingsList } from './bookings-list';

const booking = (id: string, checkInDate: string, checkOutDate: string, extra: Partial<Booking> = {}): Booking => ({
  id,
  propertyId: 'p1',
  source: 'MANUAL',
  channel: 'AIRBNB',
  kind: 'GUEST',
  status: 'CONFIRMED',
  checkInDate,
  checkOutDate,
  nights: 2,
  guestName: 'Guest',
  payoutCents: 50_000,
  guestCleaningFeeCents: 3_500,
  ownerGrossCents: 46_500,
  complete: true,
  cancelledAt: null,
  ...extra,
});

const ITEMS = [
  booking('done', '2026-10-02', '2026-10-04', { guestName: 'Maya' }),
  booking('here', '2026-10-13', '2026-10-16', { guestName: 'Andrew', channel: 'VRBO' }),
  booking('owed', '2026-10-20', '2026-10-22', {
    guestName: 'Priya',
    payoutCents: null,
    guestCleaningFeeCents: null,
    ownerGrossCents: null,
    complete: false,
  }),
  booking('gone', '2026-10-24', '2026-10-26', { guestName: 'Chris', status: 'CANCELLED', complete: false }),
];

function renderList(props: Partial<Parameters<typeof BookingsList>[0]> = {}) {
  const onEdit = vi.fn();
  const onCancel = vi.fn();
  render(
    <BookingsList
      month="2026-10"
      items={ITEMS}
      loading={false}
      error={null}
      updating={false}
      today="2026-10-14"
      onEdit={onEdit}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onEdit, onCancel };
}

const rowOf = (name: string) => screen.getByText(name).closest('tr')!;

describe('bookings list', () => {
  it('says where each stay stands', () => {
    renderList();
    expect(within(rowOf('Maya')).getByText('Checked out')).toBeInTheDocument();
    expect(within(rowOf('Andrew')).getByText('In house')).toBeInTheDocument();
    expect(within(rowOf('Andrew')).getByText('Vrbo')).toBeInTheDocument();
    expect(within(rowOf('Priya')).getByText('Upcoming')).toBeInTheDocument();
    expect(within(rowOf('Priya')).getByText('Payout pending')).toBeInTheDocument();
    expect(within(rowOf('Chris')).getByText('Cancelled')).toBeInTheDocument();
    // A cancelled stay can still be edited (a late payout), not cancelled again.
    expect(within(rowOf('Chris')).queryByRole('button', { name: /Cancel booking/ })).not.toBeInTheDocument();
  });

  it('offers to add a missing payout, which opens the booking', async () => {
    const { onEdit } = renderList();
    await userEvent.click(within(rowOf('Priya')).getByRole('button', { name: 'Add payout' }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'owed' }));
    expect(within(rowOf('Maya')).queryByRole('button', { name: 'Add payout' })).not.toBeInTheDocument();
  });

  it('filters with counts, and says so when a filter is empty', async () => {
    renderList({ items: ITEMS.slice(0, 2) });
    const filters = screen.getByRole('group', { name: 'Show' });
    // Filters with nothing in them are left out.
    expect(within(filters).queryByRole('button', { name: /Waiting on payout/ })).not.toBeInTheDocument();
    await userEvent.click(within(filters).getByRole('button', { name: /In house/ }));
    expect(screen.getByText('Andrew')).toBeInTheDocument();
    expect(screen.queryByText('Maya')).not.toBeInTheDocument();
  });

  it('shows the property only when there are several', () => {
    renderList({ propertyName: () => 'Petersburg Retreat' });
    expect(screen.getByRole('columnheader', { name: 'Property' })).toBeInTheDocument();
    expect(within(rowOf('Maya')).getByText('Petersburg Retreat')).toBeInTheDocument();
  });
});
