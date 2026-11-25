import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import { ApiContext } from '../../lib/api-context';
import type { Booking } from '../../lib/api-types';
import { BookingDialog } from '../booking-dialog';

const stay = (over: Partial<Booking> = {}): Booking =>
  ({
    id: 'b1',
    propertyId: 'p1',
    source: 'MANUAL',
    channel: 'AIRBNB',
    kind: 'GUEST',
    status: 'CONFIRMED',
    checkInDate: '2026-11-02',
    checkOutDate: '2026-11-05',
    nights: 3,
    ownerGrossCents: 25_500,
    complete: true,
    cancelledAt: null,
    externalId: 'HM4XYZ',
    guestName: 'Maya',
    guestCount: 2,
    payoutCents: 38_000,
    guestCleaningFeeCents: 12_500,
    taxesCollectedCents: null,
    notes: null,
    version: 1,
    ...over,
  }) as Booking;

function open(booking: Booking, details = true) {
  render(
    <ApiContext.Provider value={{} as ApiClient}>
      <QueryClientProvider client={new QueryClient()}>
        <BookingDialog
          open
          onOpenChange={() => undefined}
          properties={[{ id: 'p1', name: 'Cedar Cabin' }]}
          booking={booking}
          details={details}
        />
      </QueryClientProvider>
    </ApiContext.Provider>,
  );
  return screen.getByRole('dialog');
}

describe('the calendar’s stay dialog', () => {
  it('opens on the stay’s details: dates, guests and what it earned', () => {
    const dialog = open(stay());
    expect(within(dialog).getByRole('heading', { name: 'Maya' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Details' })).toHaveAttribute('aria-pressed', 'true');
    expect(dialog).toHaveTextContent('Cedar Cabin');
    expect(dialog).toHaveTextContent('HM4XYZ');
    const revenue = within(dialog).getByRole('region', { name: 'Revenue' });
    expect(revenue).toHaveTextContent('Payout received');
    expect(revenue).toHaveTextContent('$380.00');
    expect(revenue).toHaveTextContent('−$125.00');
    expect(revenue).toHaveTextContent('Owner gross');
    expect(revenue).toHaveTextContent('$255.00');
    // Per night: the owner gross over the nights.
    expect(revenue).toHaveTextContent('$85.00');
    expect(within(dialog).queryByRole('button', { name: 'Save changes' })).toBeNull();
  });

  it('switches to the edit form and back, keeping what was typed', async () => {
    const dialog = open(stay());
    await userEvent.click(within(dialog).getByRole('button', { name: 'Edit' }));
    expect(within(dialog).getByRole('heading', { name: 'Edit booking' })).toBeInTheDocument();
    const name = within(dialog).getByLabelText('Guest name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Maya R');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Details' }));
    expect(within(dialog).queryByLabelText('Guest name')).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Edit booking' }));
    expect(within(dialog).getByLabelText('Guest name')).toHaveValue('Maya R');
  });

  it('says what’s missing on a stay without its payout', () => {
    const dialog = open(stay({ payoutCents: null, ownerGrossCents: null, complete: false }));
    expect(dialog).toHaveTextContent('Payout not entered');
    const revenue = within(dialog).getByRole('region', { name: 'Revenue' });
    expect(revenue).toHaveTextContent('Not entered');
    expect(revenue).toHaveTextContent('Needs both amounts');
  });

  it('shows no revenue for an owner stay', () => {
    const dialog = open(stay({ kind: 'OWNER_STAY', guestName: null, payoutCents: null, ownerGrossCents: null }));
    expect(within(dialog).getByRole('heading', { name: 'Owner stay' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('region', { name: 'Revenue' })).toBeNull();
    expect(dialog).toHaveTextContent('An owner stay earns nothing');
  });

  it('opens straight on the form without `details` (the Bookings page)', () => {
    const dialog = open(stay(), false);
    expect(within(dialog).getByRole('heading', { name: 'Edit booking' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Details' })).toBeNull();
  });
});
