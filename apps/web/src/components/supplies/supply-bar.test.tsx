import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SupplyState } from '@truhost/shared';
import { SupplyBar } from './supply-bar';

/** How full each of the four quarter segments is, 0 to 1. */
function segments(levelPct: number | null, state: SupplyState) {
  render(<SupplyBar name="Shampoo" levelPct={levelPct} state={state} thresholdPct={25} />);
  const bar = screen.getByRole('meter', { name: 'Shampoo level' });
  return { bar, filled: [...bar.children].map((s) => Number(s.getAttribute('data-filled'))) };
}

describe('supply bar', () => {
  it.each([
    [100, 'OK', [1, 1, 1, 1]],
    [75, 'OK', [1, 1, 1, 0]],
    [60, 'OK', [1, 1, 0.4, 0]],
    [25, 'LOW', [1, 0, 0, 0]],
    [0, 'OUT', [0, 0, 0, 0]],
    [null, 'UNKNOWN', [0, 0, 0, 0]],
  ] as const)('at %s%% fills the quarters %j', (level, state, expected) => {
    expect(segments(level, state).filled).toEqual(expected);
  });

  it('reads as a meter with its level, and gives the restock point on hover', () => {
    const { bar } = segments(25, 'LOW');
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(bar).toHaveAttribute('aria-valuetext', '¼ left');
    expect(bar).toHaveAttribute('title', 'Restock at 25%');
  });
});
