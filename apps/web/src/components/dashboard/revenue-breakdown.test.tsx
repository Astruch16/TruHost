import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RevenueBreakdown } from './revenue-breakdown';

const BREAKDOWN = {
  grossCents: 412_340,
  managementFeeCents: 90_715,
  ownerExpensesCents: 6_418,
  netToOwnersCents: 315_207,
  cleaningFeesCents: 51_000,
};
const ON_TRUPLAN = [{ name: 'Cedar Cabin', feeRateBps: 2200 }];

const line = (label: string) => screen.getByText(label, { selector: 'dt' }).closest('div')!.parentElement!;

describe('where the revenue went', () => {
  it('reads like a statement: gross, the fee and expenses with their shares, then net to owners', () => {
    render(<RevenueBreakdown breakdown={BREAKDOWN} properties={ON_TRUPLAN} pendingStays={0} />);
    expect(screen.getByText('Owners keep 76%')).toBeInTheDocument();
    expect(within(line('Management fee')).getByText('22% of gross')).toBeInTheDocument();
    expect(within(line('Management fee')).getByText('−$907.15')).toBeInTheDocument();
    expect(within(line('Owner-borne expenses')).getByText('−$64.18')).toBeInTheDocument();
    expect(screen.getByText('$3,152.07')).toBeInTheDocument();
    expect(screen.getByText('$510.00')).toBeInTheDocument();
  });

  it('says “No fee” for an owner-managed property, not “TruPlan fee (0%)”', () => {
    render(
      <RevenueBreakdown
        breakdown={{ ...BREAKDOWN, managementFeeCents: 0, netToOwnersCents: 405_922 }}
        properties={[{ name: 'Cedar Cabin', feeRateBps: 0 }]}
        pendingStays={0}
      />,
    );
    expect(within(line('Management fee')).getByText('Owner-managed (0%)')).toBeInTheDocument();
    expect(within(line('Management fee')).getByText('No fee')).toBeInTheDocument();
    expect(screen.queryByText(/TruPlan fee/)).not.toBeInTheDocument();
  });

  it('gives the rate per number of properties, and names a 0% property as owner-managed', () => {
    render(
      <RevenueBreakdown
        breakdown={BREAKDOWN}
        properties={[
          { name: 'Cedar Cabin', feeRateBps: 2200 },
          { name: 'Petersburg Retreat', feeRateBps: 0 },
          { name: 'Seaside Loft', feeRateBps: 2200 },
        ]}
        pendingStays={0}
      />,
    );
    expect(
      within(line('Management fee')).getByText('22% on 2 properties · Petersburg Retreat owner-managed (0%)'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Rates:/)).not.toBeInTheDocument();
  });

  it('while stays wait on payout: no negative net and no warning, just what’s counted so far', () => {
    render(
      <RevenueBreakdown
        breakdown={{
          grossCents: 0,
          managementFeeCents: 0,
          ownerExpensesCents: 4_200,
          netToOwnersCents: -4_200,
          cleaningFeesCents: 0,
        }}
        properties={ON_TRUPLAN}
        pendingStays={3}
      />,
    );
    expect(screen.queryByText('-$42.00')).not.toBeInTheDocument();
    expect(screen.queryByText(/owners would owe/)).not.toBeInTheDocument();
    expect(screen.getByText(/counted so far/).textContent).toBe(
      '$0.00 counted so far · 3 stays waiting on payout · $42.00 expenses',
    );
    expect(screen.getByText('Not final yet')).toBeInTheDocument();
    expect(screen.queryByText(/Owners keep/)).not.toBeInTheDocument();
    // Nothing to split with no gross: the bar is empty, not full of expenses.
    const bar = screen.getByRole('img', { name: 'Nothing to split yet' });
    expect(bar.children).toHaveLength(0);
  });

  it('warns that owners would owe only once every payout is in and the month is still negative', () => {
    render(
      <RevenueBreakdown
        breakdown={{
          grossCents: 2_000,
          managementFeeCents: 440,
          ownerExpensesCents: 4_200,
          netToOwnersCents: -2_640,
          cleaningFeesCents: 9_000,
        }}
        properties={ON_TRUPLAN}
        pendingStays={0}
      />,
    );
    expect(screen.getByText('-$26.40')).toBeInTheDocument();
    expect(screen.getByText(/owners would owe the difference/)).toBeInTheDocument();
  });
});
