import type { RestockUrgency, SupplyState } from '@truhost/shared';

/** Where an item stands: never checked, fine, at or below its restock point, or empty. */
export function supplyState(levelPct: number | null, thresholdPct: number): SupplyState {
  if (levelPct === null) return 'UNKNOWN';
  if (levelPct === 0) return 'OUT';
  if (levelPct <= thresholdPct) return 'LOW';
  return 'OK';
}

/** How far above its restock point an item still counts as close to it: one tap (a quarter). */
export const SOON_MARGIN_PCT = 25;

/**
 * Whether an item belongs on the restock list: OUT or LOW (at or below its restock point), SOON (still above it, but
 * within SOON_MARGIN_PCT, e.g. half full with a 25% restock point), otherwise null. Never-checked items aren't listed.
 */
export function restockUrgency(levelPct: number | null, thresholdPct: number): RestockUrgency | null {
  const state = supplyState(levelPct, thresholdPct);
  if (state === 'OUT' || state === 'LOW') return state;
  if (state === 'OK' && levelPct! <= thresholdPct + SOON_MARGIN_PCT) return 'SOON';
  return null;
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
