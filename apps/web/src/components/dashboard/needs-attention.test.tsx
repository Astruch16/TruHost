import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import type { AttentionItem } from '../../lib/attention';
import { NeedsAttention } from './needs-attention';

const payout = (id: string, propertyName: string, date: string): AttentionItem => ({
  kind: 'PAYOUT_MISSING',
  id,
  propertyId: `p-${propertyName}`,
  propertyName,
  title: 'Payout not entered',
  detail: 'Stay isn’t counted until its payout and cleaning fee are entered.',
  date,
});

async function renderCard(onEnterPayouts = vi.fn()) {
  const items: AttentionItem[] = [
    payout('b1', 'Cedar Cabin', '2026-11-02'),
    payout('b2', 'Seaside Loft', '2026-11-04'),
    payout('b3', 'Cedar Cabin', '2026-11-06'),
    {
      kind: 'RECEIPT_MISSING',
      id: 'e1',
      propertyId: 'p1',
      propertyName: 'Cedar Cabin',
      title: 'Receipt missing',
      detail: 'Coffee pods, $24.99. Owner-borne expenses need a receipt.',
      date: '2026-11-03',
    },
  ];
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <NeedsAttention
          items={items}
          counts={{ PAYOUT_MISSING: 3, RECEIPT_MISSING: 1, NO_PLAN: 0, INVITE_PENDING: 0 }}
          showProperty
          onEnterPayouts={onEnterPayouts}
        />
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/admin'] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: 'Needs attention' });
  return onEnterPayouts;
}

describe('needs attention', () => {
  it('shows stays waiting on payout as one row that opens the payout list', async () => {
    const onEnterPayouts = await renderCard();
    const row = screen.getByRole('button', { name: /Stays waiting on payout/ });
    // Its count beside the title, then a quiet line: each property involved once, and the earliest date.
    expect(row).toHaveTextContent(/^Stays waiting on payout3Cedar Cabin · Seaside Loft · from Nov 2/);
    expect(row).toHaveTextContent('Enter their payouts and cleaning fees to count them.');
    expect(screen.queryByText('Payout not entered')).not.toBeInTheDocument();
    await userEvent.click(row);
    expect(onEnterPayouts).toHaveBeenCalled();
  });

  it('keeps a lone item as itself, linking to where it’s fixed', async () => {
    await renderCard();
    expect(screen.getByRole('link', { name: /Receipt missing/ })).toHaveAttribute(
      'href',
      '/admin/expenses?month=2026-11',
    );
  });
});
