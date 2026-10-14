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

const line = (label: string) => screen.getByText(label, { selector: 'dt' }).closest('div')!.parentElement!;

describe('where the revenue went', () => {
  it('reads like a statement: gross, the fee and expenses with their shares, then net to owners', () => {
    render(<RevenueBreakdown breakdown={BREAKDOWN} feeRatesBps={[2200]} />);
    expect(screen.getByText('Owners keep 76%')).toBeInTheDocument();
    expect(within(line('Management fee')).getByText('22% of gross')).toBeInTheDocument();
    expect(within(line('Management fee')).getByText('−$907.15')).toBeInTheDocument();
    expect(within(line('Owner-borne expenses')).getByText('−$64.18')).toBeInTheDocument();
    expect(screen.getByText('$3,152.07')).toBeInTheDocument();
    expect(screen.getByText('$510.00')).toBeInTheDocument();
  });

  it('says “No fee” for an own property, not “TruPlan fee (0%)”', () => {
    render(
      <RevenueBreakdown
        breakdown={{ ...BREAKDOWN, managementFeeCents: 0, netToOwnersCents: 405_922 }}
        feeRatesBps={[0]}
      />,
    );
    expect(within(line('Management fee')).getByText('Own property · no fee')).toBeInTheDocument();
    expect(within(line('Management fee')).getByText('No fee')).toBeInTheDocument();
    expect(screen.queryByText(/TruPlan fee/)).not.toBeInTheDocument();
  });

  it('lists the rates when properties have different ones', () => {
    render(<RevenueBreakdown breakdown={BREAKDOWN} feeRatesBps={[0, 2200]} />);
    expect(within(line('Management fee')).getByText('Rates: 0% and 22%')).toBeInTheDocument();
  });
});
