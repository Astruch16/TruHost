import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DashboardYear } from '../../lib/api-types';
import { TrendsChart } from './trends-chart';
import { YearKpis } from './year-kpis';

const month = (
  m: string,
  period: 'COMPLETE' | 'MONTH_TO_DATE' | 'UPCOMING',
  grossCents: number,
  occupancyBps: number,
) => ({
  month: m,
  period,
  grossCents,
  managementFeeCents: Math.round(grossCents * 0.22),
  ownerExpensesCents: 0,
  netToOwnersCents: grossCents - Math.round(grossCents * 0.22),
  cleaningFeesCents: 0,
  stays: 1,
  incompleteBookings: 0,
  nightsBooked: 3,
  availableNights: 30,
  occupancyBps,
  avgNightlyEarningsCents: 17_000,
  completeNights: 3,
  feeShareBps: 2200,
});

const YEAR: DashboardYear = {
  year: 2026,
  through: '2026-03',
  today: '2026-02-10',
  months: [
    month('2026-01', 'COMPLETE', 51_000, 1000),
    month('2026-02', 'MONTH_TO_DATE', 102_000, 2000),
    month('2026-03', 'UPCOMING', 0, 0),
  ],
  totals: {
    ...month('2026-01', 'COMPLETE', 153_000, 1000),
    stays: 3,
    incompleteBookings: 2,
    nightsBooked: 9,
    availableNights: 90,
    completeNights: 9,
    feeShareBps: 2200,
  },
};

describe('the year so far', () => {
  it('shows the year’s four cards from the API’s totals', () => {
    render(<YearKpis year={YEAR} grid="" />);
    expect(screen.getByRole('heading', { name: 'Gross revenue' }).closest('section')).toHaveTextContent(
      '$1,530.00From 3 stays · 2 waiting on payout',
    );
    expect(screen.getByRole('heading', { name: 'TruPlan fees earned' }).closest('section')).toHaveTextContent(
      '22% of gross',
    );
    expect(screen.getByRole('heading', { name: 'Nights booked' }).closest('section')).toHaveTextContent(
      '9 of 9010% occupancy',
    );
  });

  it('charts the chosen figure by month, says which months are under way or to come, and has a table', async () => {
    render(<TrendsChart year={YEAR} />);
    const bars = within(screen.getByRole('list', { name: 'Gross revenue by month' })).getAllByRole('listitem');
    expect(bars.map((b) => b.getAttribute('aria-label'))).toEqual([
      'January 2026: $510.00',
      'February 2026: $1,020.00 (so far)',
      'March 2026: $0.00 (booked so far)',
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Occupancy' }));
    expect(screen.getByRole('button', { name: 'Occupancy' })).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(screen.getByRole('list', { name: 'Occupancy by month' })).getAllByRole('listitem')[1],
    ).toHaveAttribute('aria-label', 'February 2026: 20% (so far)');

    await userEvent.click(screen.getByRole('button', { name: 'View as table' }));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('January 202610%');
    expect(rows[3]).toHaveTextContent('March 2026 (booked so far)0%');
  });
});
