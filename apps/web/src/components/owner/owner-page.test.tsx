import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiClient } from '@truhost/api-client';
import { OWN_PROPERTY_PLAN_ID } from '@truhost/shared';
import { ApiContext } from '../../lib/api-context';
import { ManagementCard } from './management-card';
import { MonthOverview } from './month-overview';

const ok = (data: unknown) => ({ data, response: new Response(null, { status: 200 }) });
const truPlan = { id: 'p-tru', name: 'TruPlan', managementFeeBps: 2200 };
const ownPlan = { id: OWN_PROPERTY_PLAN_ID, name: 'Own property', managementFeeBps: 0 };
const period = (plan: typeof truPlan) => ({ id: 'pp1', plan, effectiveFrom: '2026-10-01', effectiveTo: null });

function renderWith(node: React.ReactNode, GET: (path: string) => unknown, POST = vi.fn()) {
  const api = { GET: vi.fn(async (path: string) => ok(GET(path))), POST } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {node}
      </QueryClientProvider>
    </ApiContext.Provider>,
  );
  return { POST };
}

describe('Management fee card', () => {
  it('lets an admin switch their own property to no fee, after confirming', async () => {
    const user = userEvent.setup();
    let current = period(truPlan);
    const POST = vi.fn(async () => {
      current = period(ownPlan);
      return ok({ current, history: [current] });
    });
    renderWith(<ManagementCard propertyId="p1" canMarkOwn />, () => ({ current, history: [current] }), POST);
    expect(await screen.findByText(/TruPlan/)).toHaveTextContent('TruPlan · 22%');
    await user.click(screen.getByRole('button', { name: 'No fee: it’s my own property' }));
    const dialog = screen.getByRole('dialog', { name: 'Stop charging a fee on your own property?' });
    await user.click(within(dialog).getByRole('button', { name: 'Switch to no fee' }));
    expect(POST).toHaveBeenCalledWith('/v1/properties/{id}/plan/correct', {
      params: { path: { id: 'p1' } },
      body: { planId: OWN_PROPERTY_PLAN_ID },
    });
    expect(await screen.findByText('No management fee')).toBeInTheDocument();
  });

  it('shows the plan without the switch to owners', async () => {
    renderWith(<ManagementCard propertyId="p1" canMarkOwn={false} />, () => ({
      current: period(truPlan),
      history: [],
    }));
    expect(await screen.findByText(/TruPlan/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /my own property/ })).not.toBeInTheDocument();
  });
});

describe('Your month', () => {
  const summary = (over: object) => ({
    propertyId: 'p1',
    month: '2026-10',
    daysInMonth: 31,
    nightsBooked: 12,
    ownerStayNights: 0,
    blockNights: 0,
    availableNights: 31,
    occupancyBps: 3871,
    stays: 3,
    grossCents: 240_000,
    plan: { id: truPlan.id, name: 'TruPlan' },
    managementFeeBps: 2200,
    managementFeeCents: 52_800,
    ownerExpensesCents: 6_420,
    netCents: 180_780,
    avgNightlyEarningsCents: 20_000,
    incompleteBookings: 1,
    expensesMissingReceipt: 0,
    ...over,
  });

  it('leads with what the owner earned, then reads as a statement', async () => {
    renderWith(<MonthOverview propertyId="p1" month="2026-10" onMonthChange={vi.fn()} />, () => summary({}));
    expect((await screen.findAllByText('$1,807.80')).length).toBe(2); // the headline and the statement's total
    expect(screen.getByText('12 of 31')).toBeInTheDocument();
    expect(screen.getByText(/1 stay is waiting on a payout/)).toBeInTheDocument();
    // Gross, each deduction with what it is and its share, then what's kept.
    const statement = screen.getByRole('region', { name: 'Where it went' });
    expect(
      within(statement)
        .getAllByRole('term')
        .map((t) => t.textContent),
    ).toEqual(['Gross revenue', 'Management fee', 'Expenses']);
    expect(within(statement).getByText('TruPlan · 22% of gross')).toBeInTheDocument();
    expect(within(statement).getByText('−$528.00')).toBeInTheDocument();
    expect(within(statement).getByText('−$64.20')).toBeInTheDocument();
    expect(within(statement).getByText('You keep 75%')).toBeInTheDocument();
  });

  it('says there’s no fee on an own property, and no expenses, in words', async () => {
    renderWith(<MonthOverview propertyId="p1" month="2026-10" onMonthChange={vi.fn()} />, () =>
      summary({
        plan: { id: OWN_PROPERTY_PLAN_ID, name: 'Own property' },
        managementFeeBps: 0,
        managementFeeCents: 0,
        ownerExpensesCents: 0,
        netCents: 240_000,
      }),
    );
    const statement = await screen.findByRole('region', { name: 'Where it went' });
    expect(within(statement).getByText('Own property · no fee')).toBeInTheDocument();
    expect(within(statement).getByText('No fee')).toBeInTheDocument();
    expect(within(statement).getByText('None this month')).toBeInTheDocument();
    expect(within(statement).getByText('You keep 100%')).toBeInTheDocument();
    // Nothing reads "−$0.00".
    expect(screen.queryByText(/−\$0\.00/)).not.toBeInTheDocument();
  });
});
