import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DashboardYear } from '../../lib/api-types';
import { queries } from '../../lib/queries';
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

/** Last year, in full: every month finished, gross rising through the year. */
const LAST_YEAR: DashboardYear = {
  ...YEAR,
  year: 2025,
  through: '2025-12',
  months: Array.from({ length: 12 }, (_, i) =>
    month(`2025-${String(i + 1).padStart(2, '0')}`, 'COMPLETE', (i + 1) * 10_000, 500),
  ),
};

/** The year query, answered by a stand-in client: 2025 as above, earlier years empty. */
const yearQuery = (through: string) =>
  queries.dashboardYear(
    {
      GET: vi.fn(async () => ({
        data: through.startsWith('2025')
          ? LAST_YEAR
          : {
              ...LAST_YEAR,
              year: Number(through.slice(0, 4)),
              through,
              months: LAST_YEAR.months.map((m) => ({
                ...month(m.month.replace('2025', through.slice(0, 4)), 'COMPLETE', 0, 0),
                stays: 0,
                nightsBooked: 0,
              })),
            },
        response: new Response(),
      })),
    } as never,
    through,
    null,
  );

const showTrend = (metric?: 'gross' | 'nights') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TrendsChart year={YEAR} yearQuery={yearQuery} initialMetric={metric} />
    </QueryClientProvider>,
  );

const months = (label: string) =>
  within(screen.getByRole('group', { name: label }))
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));

describe('the year so far', () => {
  it('shows the year’s four cards from the API’s totals, each with its best month', () => {
    render(<YearKpis year={YEAR} grid="" onOpenTrend={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Gross revenue' }).closest('section')).toHaveTextContent(
      '$1,530.00From 3 stays · 2 waiting on payout',
    );
    expect(screen.getByRole('heading', { name: 'Gross revenue' }).closest('section')).toHaveTextContent(
      'Best Feb $1,020.00',
    );
    expect(screen.getByRole('heading', { name: 'TruPlan fees earned' }).closest('section')).toHaveTextContent(
      '22% of gross',
    );
    expect(screen.getByRole('heading', { name: 'Nights booked' }).closest('section')).toHaveTextContent(
      '9 of 9010% occupancy',
    );
  });

  it('opens a figure’s trend from its card', async () => {
    const onOpenTrend = vi.fn();
    render(<YearKpis year={YEAR} grid="" onOpenTrend={onOpenTrend} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nights booked by month: view the trend' }));
    expect(onOpenTrend).toHaveBeenCalledWith('nights');
  });
});

describe('the trend', () => {
  it('charts the chosen figure by month and says which months are under way or to come', async () => {
    showTrend();
    expect(months('Gross revenue by month')).toEqual([
      'January 2026: $510.00',
      'February 2026: $1,020.00 (so far)',
      'March 2026: $0.00 (booked so far)',
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Occupancy' }));
    expect(screen.getByRole('button', { name: 'Occupancy' })).toHaveAttribute('aria-pressed', 'true');
    expect(months('Occupancy by month')[1]).toBe('February 2026: 20% (so far)');
  });

  it('leads with the chosen month, the month before it and the best month, and steps through months', async () => {
    showTrend();
    const readout = () => screen.getByText(/^Gross revenue ·/).parentElement!;
    // Opens on the dashboard's month.
    expect(readout()).toHaveTextContent(
      'Gross revenue · March 2026 (booked so far)$0.00Feb: $1,020.00Best (Feb): $1,020.00',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(readout()).toHaveTextContent('February 2026 (so far)$1,020.00Jan: $510.00');
    // Clicking a month picks it; the arrow keys move from there.
    await userEvent.click(screen.getByRole('button', { name: 'January 2026: $510.00' }));
    expect(screen.getByRole('button', { name: 'January 2026: $510.00' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'February 2026: $1,020.00 (so far)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Nothing after the dashboard's month, and no year after this one.
    expect(screen.getByRole('button', { name: 'Next year' })).toBeDisabled();
  });

  it('steps back a year, loading it, and stops at a year with nothing in it', async () => {
    showTrend('nights');
    await userEvent.click(screen.getByRole('button', { name: 'Previous year' }));
    expect(await screen.findByRole('button', { name: 'March 2025: 3 nights' })).toHaveAttribute('aria-pressed', 'true');
    expect(months('Nights booked by month')).toHaveLength(12);
    // From January, the previous month is last December.
    await userEvent.click(screen.getByRole('button', { name: 'January 2025: 3 nights' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next year' }));
    expect(await screen.findByRole('button', { name: 'January 2026: 3 nights' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByRole('button', { name: 'December 2025: 3 nights' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // 2024 has nothing, so there's no going further back from it.
    await userEvent.click(screen.getByRole('button', { name: 'Previous year' }));
    expect(await screen.findByText('No stays in 2024')).toBeTruthy();
    expect(screen.getByText(/^Nights booked ·/)).toHaveTextContent('Nights booked · December 2024');
    expect(screen.getByRole('button', { name: 'Previous year' })).toBeDisabled();
  });

  it('marks a month with no figure with a hairline, named for screen readers', async () => {
    const noNightly = { ...YEAR, months: YEAR.months.map((x) => ({ ...x, avgNightlyEarningsCents: null })) };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TrendsChart year={noNightly} yearQuery={yearQuery} initialMetric="nightly" />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/^Avg. nightly ·/).parentElement).toHaveTextContent('No figure yet');
  });

  it('shows the same numbers as a table', async () => {
    showTrend();
    await userEvent.click(screen.getByRole('button', { name: 'Occupancy' }));
    await userEvent.click(screen.getByRole('button', { name: 'View as table' }));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('January 202610%');
    expect(rows[3]).toHaveTextContent('March 2026booked so far0%');
    // The chosen month is pressed, and clicking another month picks it.
    expect(within(rows[3]!).getByRole('button', { name: 'March 2026' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(rows[1]!).getByRole('button', { name: 'January 2026' }));
    expect(within(rows[1]!).getByRole('button', { name: 'January 2026' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/^Occupancy ·/)).toHaveTextContent('January 2026');
  });
});
