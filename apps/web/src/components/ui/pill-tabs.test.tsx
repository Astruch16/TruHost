import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PillTabs } from './pill-tabs';

const OPTIONS = [
  { key: 'a', label: 'First' },
  { key: 'b', label: 'Second' },
] as const;

describe('PillTabs', () => {
  it('is a labelled group of toggle buttons with the chosen one pressed', async () => {
    const onChange = vi.fn();
    render(<PillTabs label="Figure" options={OPTIONS} value="a" onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Figure' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'First' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Second' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Second' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
