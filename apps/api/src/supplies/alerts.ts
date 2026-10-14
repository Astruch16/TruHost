import type { SupplyState } from '@truhost/shared';

/** Where an item stands: never checked, fine, at or below its restock point, or empty. */
export function supplyState(levelPct: number | null, thresholdPct: number): SupplyState {
  if (levelPct === null) return 'UNKNOWN';
  if (levelPct === 0) return 'OUT';
  if (levelPct <= thresholdPct) return 'LOW';
  return 'OK';
}

/**
 * The alert a new reading causes, if any. Only a change into LOW (from OK or never checked) or into OUT (from anything
 * else) alerts; staying low, going lower while still above empty, or repeating a level sends nothing, so one item
 * running down over several cleans alerts at most twice (low, then out). Restocking and running down again alerts
 * again.
 */
export function supplyAlert(
  previousPct: number | null,
  nextPct: number,
  thresholdPct: number,
): 'SUPPLY_LOW' | 'SUPPLY_OUT' | null {
  const before = supplyState(previousPct, thresholdPct);
  const after = supplyState(nextPct, thresholdPct);
  if (after === 'OUT' && before !== 'OUT') return 'SUPPLY_OUT';
  if (after === 'LOW' && (before === 'OK' || before === 'UNKNOWN')) return 'SUPPLY_LOW';
  return null;
}
