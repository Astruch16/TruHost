import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreferencesContext } from '../../lib/preferences';
import { DatePicker } from '../ui/date-picker';
import { Switch } from '../ui/switch';
import { ChoiceCards } from './choice-cards';

describe('Switch', () => {
  it('toggles and reports its state', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} aria-label="Email" />);
    const sw = screen.getByRole('switch', { name: 'Email' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('ChoiceCards', () => {
  const options = [
    { value: 0, title: 'Sunday', description: '', preview: null },
    { value: 1, title: 'Monday', description: '', preview: null },
  ];

  it('is a radio group: click or arrow keys pick', async () => {
    const onChange = vi.fn();
    render(<ChoiceCards label="Week starts on" value={0} onChange={onChange} options={options} />);
    const group = screen.getByRole('radiogroup', { name: 'Week starts on' });
    const sunday = within(group).getByRole('radio', { name: /Sunday/ });
    expect(sunday).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getByRole('radio', { name: /Monday/ })).toHaveAttribute('tabindex', '-1');
    sunday.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(1);
    await userEvent.click(within(group).getByRole('radio', { name: /Monday/ }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });
});

describe('DatePicker with a Monday week start', () => {
  it('puts Monday in the first column', async () => {
    render(
      <PreferencesContext.Provider value={{ weekStartsOn: 1, motion: 'SYSTEM' }}>
        <DatePicker value="2026-10-08" onChange={vi.fn()} aria-label="Date" />
      </PreferencesContext.Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Date' }));
    const headers = within(screen.getByRole('grid')).getAllByRole('columnheader');
    expect(headers.map((h) => h.getAttribute('aria-label'))).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    const firstRow = within(screen.getByRole('grid')).getAllByRole('row')[1]!;
    expect(within(firstRow).getAllByRole('button')[0]).toHaveAttribute('data-date', '2026-09-28');
  });
});
