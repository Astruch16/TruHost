import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatCentsShort, splitCents } from '../../lib/money';
import { KpiCard, KpiMoney, KpiOf } from './kpi-card';
import { NightlyRange, NightsStrip, ShareBar, StaysBar } from './kpi-charts';

describe('KPI figures', () => {
  it.each([
    [285_600, '$2,856', '.00'],
    [62_832, '$628', '.32'],
    [5, '$0', '.05'],
    [123_456_789, '$1,234,567', '.89'],
  ])('splits %i cents into %s and %s', (cents, whole, fraction) => {
    expect(splitCents(cents)).toEqual({ whole, cents: fraction });
  });

  it('drops ".00" only for whole dollars in short labels', () => {
    expect([formatCentsShort(14_200), formatCentsShort(14_250)]).toEqual(['$142', '$142.50']);
  });

  it('shows the label, the figure with smaller cents, the supporting line and the chart', () => {
    render(
      <KpiCard
        label="Gross revenue"
        value={<KpiMoney cents={285_600} />}
        support="From 5 stays"
        change={{ label: '+12%', direction: 'up', vs: 'Sep' }}
        chart={<StaysBar grossByStayCents={[100, 200]} />}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Gross revenue' })).toBeInTheDocument();
    expect(screen.getByText('.00')).toHaveClass('text-muted');
    expect(screen.getByText('$2,856', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('From 5 stays')).toBeInTheDocument();
    expect(screen.getByText('+12%', { exact: false })).toHaveTextContent('+12%vs Sep');
  });

  it('shows "17 of 31" with the denominator lighter', () => {
    render(<KpiOf value={17} of={31} />);
    expect(screen.getByText('of 31')).toHaveClass('text-muted');
  });
});

describe('KPI charts', () => {
  it('sizes one segment per stay by its gross', () => {
    const { container } = render(<StaysBar grossByStayCents={[50_400, 67_200, 33_600]} />);
    const segments = [...container.querySelectorAll('span > span')] as HTMLElement[];
    expect(segments.map((s) => s.style.flexGrow)).toEqual(['50400', '67200', '33600']);
  });

  it('shows an empty track with no stays', () => {
    const { container } = render(<StaysBar grossByStayCents={[]} />);
    expect(container.querySelectorAll('span > span')).toHaveLength(0);
  });

  it.each([
    [2200, '22%'],
    [1350, '13.5%'],
    [null, '0%'],
  ])('fills the fee bar to %s bps', (bps, width) => {
    const { container } = render(<ShareBar shareBps={bps} />);
    expect((container.querySelector('span > span') as HTMLElement).style.width).toBe(width);
  });

  it('marks each day booked, open, partly booked or unavailable', () => {
    const { container } = render(
      <NightsStrip
        nightsByDay={[
          { booked: 1, available: 1 },
          { booked: 0, available: 1 },
          { booked: 1, available: 2 },
          { booked: 0, available: 0 },
        ]}
      />,
    );
    const days = [...container.querySelectorAll('[data-share]')] as HTMLElement[];
    expect(days.map((d) => d.dataset.share)).toEqual(['1', '0', '0.5', '0']);
    expect(days.map((d) => d.style.background)).toEqual([
      'rgb(95, 143, 203)',
      'rgb(227, 228, 225)',
      expect.stringContaining('color-mix'),
      'rgb(241, 242, 238)',
    ]);
  });

  it('shows the lowest and highest nightly earnings, or dashes', () => {
    const { rerender } = render(<NightlyRange lowCents={14_200} highCents={19_550} />);
    expect(screen.getByText('Low $142')).toBeInTheDocument();
    expect(screen.getByText('High $195.50')).toBeInTheDocument();
    rerender(<NightlyRange lowCents={null} highCents={null} />);
    expect(screen.getByText('Low —')).toBeInTheDocument();
  });
});
