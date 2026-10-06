import { describe, expect, it } from 'vitest';
import { formatBps, percentToBps } from './format';

describe('percentToBps', () => {
  it.each([
    ['22', 2200],
    ['12.5', 1250],
    ['0.01', 1],
    ['100', 10000],
  ])('%s%% → %i bps', (input, bps) => expect(percentToBps(input)).toBe(bps));

  it.each(['', '101', '22.555', 'x', '-1'])('rejects %j', (input) => expect(percentToBps(input)).toBeNull());
});

describe('formatBps', () => {
  it('formats', () => {
    expect(formatBps(2200)).toBe('22%');
    expect(formatBps(1250)).toBe('12.5%');
  });
});
