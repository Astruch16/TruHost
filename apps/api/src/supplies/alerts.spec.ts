import { describe, expect, it } from 'vitest';
import { supplyAlert, supplyState } from './alerts.js';

describe('supply state', () => {
  it.each([
    [null, 25, 'UNKNOWN'],
    [100, 25, 'OK'],
    [26, 25, 'OK'],
    [25, 25, 'LOW'],
    [10, 25, 'LOW'],
    [0, 25, 'OUT'],
    [50, 50, 'LOW'],
  ] as const)('%s%% with a %s%% restock point is %s', (level, threshold, state) =>
    expect(supplyState(level, threshold)).toBe(state),
  );
});

describe('supply alerts', () => {
  it.each([
    // [previous, next, threshold, alert]
    ['full to half: nothing', 100, 50, 25, null],
    ['half to the restock point: low', 50, 25, 25, 'SUPPLY_LOW'],
    ['never checked, first reading low: low', null, 25, 25, 'SUPPLY_LOW'],
    ['never checked, first reading fine: nothing', null, 75, 25, null],
    ['low to lower, still not empty: nothing', 25, 10, 25, null],
    ['low to low again: nothing', 25, 25, 25, null],
    ['low to empty: out', 25, 0, 25, 'SUPPLY_OUT'],
    ['full straight to empty: out (not low as well)', 100, 0, 25, 'SUPPLY_OUT'],
    ['never checked, first reading empty: out', null, 0, 25, 'SUPPLY_OUT'],
    ['empty again: nothing', 0, 0, 25, null],
    ['empty to low (partly restocked): nothing', 0, 25, 25, null],
    ['restocked to full: nothing', 0, 100, 25, null],
    ['restocked, then low again: low', 100, 25, 25, 'SUPPLY_LOW'],
    ['a higher restock point counts', 75, 50, 50, 'SUPPLY_LOW'],
  ] as const)('%s', (_case, previous, next, threshold, alert) =>
    expect(supplyAlert(previous, next, threshold)).toBe(alert),
  );
});
