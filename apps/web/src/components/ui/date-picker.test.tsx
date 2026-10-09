import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from './date-picker';
import { Field } from './field';
import { MonthPicker } from './month-picker';
import { MonthStepper } from './month-stepper';

// Fix "today" at Thu Oct 8, 2026 (fake Date only, so user-event's timers keep working).
beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 9, 8, 12), toFake: ['Date'] }));
afterEach(() => vi.useRealTimers());

const user = () => userEvent.setup();

describe('DatePicker', () => {
  it('shows the date in words and is labelled by its field', () => {
    render(
      <Field label="Check-in">
        <DatePicker value="2026-10-08" onChange={vi.fn()} />
      </Field>,
    );
    expect(screen.getByRole('button', { name: /Check-in/ })).toHaveTextContent('Thu, Oct 8, 2026');
  });

  it('opens on the chosen month with the date selected and today marked, and picks a day', async () => {
    const onChange = vi.fn();
    const u = user();
    render(<DatePicker value="2026-11-20" onChange={onChange} aria-label="Date" />);
    await u.click(screen.getByRole('button', { name: 'Date' }));
    const grid = screen.getByRole('grid', { name: 'November 2026' });
    expect(
      within(grid).getByRole('button', { name: 'Friday, November 20, 2026' }).closest('[role=gridcell]'),
    ).toHaveAttribute('aria-selected', 'true');
    expect(within(grid).getByRole('button', { name: 'Friday, November 20, 2026' })).toHaveFocus();
    await u.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('button', { name: 'Thursday, October 8, 2026, today' })).toHaveAttribute(
      'aria-current',
      'date',
    );
    await u.click(screen.getByRole('button', { name: 'Monday, October 12, 2026' }));
    expect(onChange).toHaveBeenCalledWith('2026-10-12');
  });

  it('moves with the keyboard and picks with Enter', async () => {
    const onChange = vi.fn();
    const u = user();
    render(<DatePicker value="2026-10-08" onChange={onChange} aria-label="Date" />);
    await u.click(screen.getByRole('button', { name: 'Date' }));
    await u.keyboard('{ArrowRight}{ArrowDown}{PageDown}');
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Monday, November 16, 2026' })).toHaveFocus();
    await u.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('2026-11-16');
  });

  it('blocks days before the minimum, shades the stay and counts nights', async () => {
    const u = user();
    render(
      <DatePicker
        value="2026-10-14"
        onChange={vi.fn()}
        rangeStart="2026-10-10"
        min="2026-10-11"
        aria-label="Check-out"
      />,
    );
    await u.click(screen.getByRole('button', { name: 'Check-out' }));
    expect(screen.getByRole('button', { name: 'Friday, October 9, 2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saturday, October 10, 2026, check-in' })).toBeDisabled();
    expect(screen.getByText('4 nights')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull(); // today is before the minimum
  });

  it('offers Today, and Clear when the date is optional', async () => {
    const onChange = vi.fn();
    const u = user();
    render(<DatePicker value="2026-10-20" onChange={onChange} clearable aria-label="Date" />);
    await u.click(screen.getByRole('button', { name: 'Clear date' }));
    expect(onChange).toHaveBeenLastCalledWith('');
    await u.click(screen.getByRole('button', { name: 'Date' }));
    await u.click(screen.getByRole('button', { name: 'Today' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-10-08');
  });
});

describe('MonthPicker and MonthStepper', () => {
  it('picks a month from a year grid, with this month marked', async () => {
    const onChange = vi.fn();
    const u = user();
    render(
      <Field label="Starting month">
        <MonthPicker value="2026-11" onChange={onChange} />
      </Field>,
    );
    const trigger = screen.getByRole('button', { name: /Starting month/ });
    expect(trigger).toHaveTextContent('November 2026');
    await u.click(trigger);
    expect(screen.getByRole('button', { name: 'November 2026' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'October 2026, this month' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Next year' }));
    await u.click(screen.getByRole('button', { name: 'March 2027' }));
    expect(onChange).toHaveBeenCalledWith('2027-03');
  });

  it('moves through months with the keyboard', async () => {
    const onChange = vi.fn();
    const u = user();
    render(<MonthPicker value="2026-11" onChange={onChange} />);
    await u.click(screen.getByRole('button', { name: /November 2026/ }));
    const panel = screen.getByRole('dialog', { name: 'Choose a month' });
    expect(within(panel).getByRole('button', { name: 'November 2026' })).toHaveFocus();
    await u.keyboard('{ArrowDown}{Enter}'); // three months on, into next year
    expect(onChange).toHaveBeenCalledWith('2027-02');
  });

  it('steps a month with the arrows and jumps to any month from the label', async () => {
    const onChange = vi.fn();
    const u = user();
    render(<MonthStepper month="2026-10" onChange={onChange} />);
    await u.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-11');
    await u.click(screen.getByRole('button', { name: 'October 2026. Choose a month' }));
    await u.click(screen.getByRole('button', { name: 'June 2026' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-06');
    expect(screen.queryByRole('button', { name: 'June 2026' })).toBeNull(); // closed after picking
  });
});
