import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type { ApiClient } from '@truhost/api-client';
import type { ReactNode } from 'react';
import { ApiContext } from '../../lib/api-context';
import type { Statement } from '../../lib/api-types';
import {
  CEDAR_DRAFT,
  CEDAR_FINALIZED,
  CEDAR_RELEASED,
  SEASIDE_DRAFT,
  SEPTEMBER,
} from '../../lib/dev-statement-fixtures';
import { StatementDetail } from './statement-detail';
import { StatementsPage } from './statements-page';

const ok = (data: unknown, status = 200) => Promise.resolve({ data, response: new Response(null, { status }) });

/** Renders `ui` inside a router (the pages link to each other) with a fake API. */
function renderWith(api: Partial<ApiClient>, ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute();
  const page = createRoute({ getParentRoute: () => root, path: '/', component: () => <>{ui}</> });
  const other = createRoute({ getParentRoute: () => root, path: '$', component: () => <p>Elsewhere</p> });
  const router = createRouter({
    routeTree: root.addChildren([page, other]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(
    <ApiContext.Provider value={api as ApiClient}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ApiContext.Provider>,
  );
}

const detailApi = (statement: Statement, post: ReturnType<typeof vi.fn> = vi.fn(() => ok(statement))) => ({
  api: { GET: vi.fn(() => ok(statement)), POST: post } as unknown as Partial<ApiClient>,
  post,
});

describe('Statements page', () => {
  it('lists each property with its state, net and what to do next', async () => {
    const post = vi.fn(() => ok({ ...CEDAR_DRAFT, id: 's-kits' }));
    renderWith(
      { GET: vi.fn(() => ok(SEPTEMBER)), POST: post } as unknown as Partial<ApiClient>,
      <StatementsPage month="2026-09" onMonthChange={() => undefined} />,
    );
    const rows = await screen.findAllByRole('row');
    const text = rows.slice(1).map((r) => r.textContent);
    expect(text[0]).toContain('Cedar Cabin');
    expect(text[0]).toContain('Finalized');
    expect(text[0]).toContain('$2,762.15');
    expect(text[1]).toContain('Paid Oct 5');
    expect(text[3]).toContain('1 to fix');
    expect(text[3]).toContain('1 payout pending');
    expect(screen.getByRole('link', { name: 'Release: Cedar Cabin' })).toBeInTheDocument();

    await userEvent.click(within(rows[3]!).getByRole('button', { name: 'Start draft' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/v1/properties/{id}/statements', {
        params: { path: { id: 'p-kits' } },
        body: { month: '2026-09' },
      }),
    );
  });
});

describe('Statement page', () => {
  it('keeps Finalize off while something blocks it, and says what', async () => {
    const { api } = detailApi(SEASIDE_DRAFT);
    renderWith(api, <StatementDetail statementId="s-seaside" />);
    expect(await screen.findByRole('button', { name: 'Finalize' })).toBeDisabled();
    expect(screen.getByText(/One expense needs a receipt/)).toBeInTheDocument();
    expect(screen.getByText('Missing receipt')).toBeInTheDocument();
    expect(screen.getByText('Payout not entered')).toBeInTheDocument();
  });

  it('asks for confirmation before finalizing with a payout still pending, then celebrates', async () => {
    const pending: Statement = {
      ...CEDAR_DRAFT,
      pendingPayouts: [
        {
          bookingId: 'b6',
          checkInDate: '2026-09-29',
          checkOutDate: '2026-09-30',
          channel: 'AIRBNB',
          guestName: 'Late',
        },
      ],
    };
    const { api, post } = detailApi(
      pending,
      vi.fn(() => ok(CEDAR_FINALIZED)),
    );
    renderWith(api, <StatementDetail statementId="s-cedar" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Finalize' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Finalize statement' });
    expect(confirm).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/v1/statements/{id}/finalize', {
        params: { path: { id: 's-cedar' } },
        body: { confirmPendingPayouts: true },
      }),
    );
    expect(await screen.findByText('September 2026 is finalized for Cedar Cabin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release payout' })).toBeEnabled();
  });

  it('releases with the payment date and reference', async () => {
    const { api, post } = detailApi(
      CEDAR_FINALIZED,
      vi.fn(() => ok(CEDAR_RELEASED)),
    );
    renderWith(api, <StatementDetail statementId="s-cedar" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Release payout' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Payment reference/), 'ETF-88412');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Release payout' }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]![1]).toMatchObject({ body: { paymentReference: 'ETF-88412' } });
    expect(await screen.findByText(/Released\. The PDF is stored/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Statement PDF' })).toBeInTheDocument();
  });

  it('sends a charge to the owner as a negative adjustment, with its reason', async () => {
    const { api, post } = detailApi(CEDAR_DRAFT);
    renderWith(api, <StatementDetail statementId="s-cedar" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add adjustment' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('radio', { name: /Charge the owner/ }));
    await userEvent.type(within(dialog).getByLabelText(/Amount/), '25.40');
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Missed receipt from August');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add adjustment' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/v1/statements/{id}/adjustments', {
        params: { path: { id: 's-cedar' } },
        body: { amountCents: -2_540, reason: 'Missed receipt from August', correctsStatementId: null },
      }),
    );
  });

  it('shows the per-night split of a stay crossing a month end, and voided adjustments struck through', async () => {
    const { api } = detailApi(CEDAR_FINALIZED);
    renderWith(api, <StatementDetail statementId="s-cedar" />);
    expect(await screen.findByText(/2 of 4 nights in September/)).toBeInTheDocument();
    expect(screen.getByText('of $1,280.00 for the stay')).toBeInTheDocument();
    expect(screen.getByText('Voided: Entered twice')).toBeInTheDocument();
    // Final: no new adjustments here, only a correction on next month's statement.
    expect(screen.queryByRole('button', { name: 'Add adjustment' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add a correction next month/ })).toBeInTheDocument();
  });
});
