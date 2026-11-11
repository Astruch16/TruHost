import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import type { Booking } from '@truhost/shared';
import { ApiContext } from '../../lib/api-context';
import { PayoutsDialog } from './payouts-dialog';

const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null, { status: 200 }) });

const stay = (
  id: string,
  propertyId: string,
  checkInDate: string,
  checkOutDate: string,
  extra: Partial<Booking> = {},
) =>
  ({
    id,
    propertyId,
    source: 'MANUAL',
    channel: 'AIRBNB',
    kind: 'GUEST',
    status: 'CONFIRMED',
    checkInDate,
    checkOutDate,
    nights: 2,
    ownerGrossCents: null,
    complete: false,
    cancelledAt: null,
    guestName: null,
    payoutCents: null,
    guestCleaningFeeCents: null,
    version: 3,
    ...extra,
  }) as Booking;

function renderDialog() {
  const items = [
    stay('b1', 'p1', '2026-11-02', '2026-11-04', { guestName: 'Maya' }),
    // Cleaning fee already in: only the payout is missing.
    stay('b2', 'p2', '2026-11-05', '2026-11-07', { guestCleaningFeeCents: 9_000 }),
    // Done, not yet checked in, or an owner stay: not listed.
    stay('b3', 'p1', '2026-11-06', '2026-11-08', { complete: true, payoutCents: 60_000, guestCleaningFeeCents: 9_000 }),
    stay('b4', 'p1', '2026-11-12', '2026-11-14'),
    stay('b5', 'p2', '2026-11-01', '2026-11-02', { kind: 'OWNER_STAY' }),
  ];
  const GET = vi.fn(() => ok({ items }));
  const PATCH = vi.fn(() => ok({}));
  const api = { GET, PATCH } as unknown as ApiClient;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={client}>
        <PayoutsDialog
          open
          onOpenChange={() => undefined}
          earliest="2026-11-02"
          today="2026-11-10"
          propertyId={null}
          propertyNames={
            new Map([
              ['p1', 'Cedar Cabin'],
              ['p2', 'Seaside Loft'],
            ])
          }
        />
      </QueryClientProvider>
    </ApiContext.Provider>,
  );
  return { GET, PATCH };
}

describe('stays waiting on payout', () => {
  it('lists only checked-in guest stays still missing a payout or cleaning fee', async () => {
    const { GET } = renderDialog();
    const list = await screen.findByRole('list', { name: 'Stays waiting on payout' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((r) => r.querySelector('p')?.textContent)).toEqual(['Cedar Cabin', 'Seaside Loft']);
    expect(rows[0]).toHaveTextContent('Maya');
    expect(GET).toHaveBeenCalledWith('/v1/bookings', {
      params: { query: { from: '2026-11-02', to: '2026-11-11', propertyId: undefined } },
    });
    // What's already entered is filled in.
    expect(within(rows[1]!).getByLabelText('Cleaning fee ($)')).toHaveValue('90.00');
  });

  it('saves a stay’s payout and cleaning fee, in cents, with its version', async () => {
    const { PATCH } = renderDialog();
    const list = await screen.findByRole('list', { name: 'Stays waiting on payout' });
    const row = within(list).getAllByRole('listitem')[0]!;
    await userEvent.type(within(row).getByLabelText('Payout ($)'), '642.50');
    await userEvent.type(within(row).getByLabelText('Cleaning fee ($)'), '90');
    await userEvent.click(within(row).getByRole('button', { name: /Save payout: Cedar Cabin/ }));
    expect(PATCH).toHaveBeenCalledWith('/v1/bookings/{id}', {
      params: { path: { id: 'b1' } },
      body: { payoutCents: 64_250, guestCleaningFeeCents: 9_000, version: 3 },
    });
  });

  it('asks for both amounts before saving', async () => {
    const { PATCH } = renderDialog();
    const list = await screen.findByRole('list', { name: 'Stays waiting on payout' });
    const row = within(list).getAllByRole('listitem')[0]!;
    await userEvent.click(within(row).getByRole('button', { name: /Save payout/ }));
    expect(within(row).getByText('Enter the payout')).toBeInTheDocument();
    expect(PATCH).not.toHaveBeenCalled();
  });
});
