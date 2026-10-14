import type { SupplyState } from '@truhost/shared';
import { cx } from '../../lib/cx';
import { checkedAgo, levelText } from '../../lib/supplies';

const FILL: Record<SupplyState, string> = {
  OK: 'bg-sage-mid',
  LOW: 'bg-amber-mid',
  OUT: 'bg-danger-mid',
  UNKNOWN: 'bg-transparent',
};

/**
 * A supply's health bar: how full it is (0–100%), coloured by where it stands (stocked, running low, out), with a
 * notch at its restock point. Quarter marks give it the look of a gauge. Not checked yet: an empty dashed track.
 */
export function SupplyBar({
  name,
  levelPct,
  state,
  thresholdPct,
  className,
}: {
  name: string;
  levelPct: number | null;
  state: SupplyState;
  thresholdPct: number;
  className?: string;
}) {
  const unknown = levelPct === null;
  return (
    <div
      role="meter"
      aria-label={`${name} level`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={levelPct ?? undefined}
      aria-valuetext={levelText(levelPct)}
      className={cx(
        'relative h-3 overflow-hidden rounded-full',
        unknown ? 'border border-dashed border-line bg-ground' : 'bg-line-soft',
        className,
      )}
    >
      {!unknown && (
        <div
          className={cx(
            'absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none',
            FILL[state],
          )}
          // A sliver stays visible at empty so the bar still reads as a bar.
          style={{ width: `${Math.max(levelPct, state === 'OUT' ? 3 : 0)}%` }}
        />
      )}
      {/* Quarter marks */}
      {[25, 50, 75].map((pct) => (
        <span key={pct} aria-hidden className="absolute inset-y-0 w-0.5 bg-surface/80" style={{ left: `${pct}%` }} />
      ))}
      {/* Restock point */}
      <span
        aria-hidden
        title={`Restock at ${thresholdPct}%`}
        className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ink/45"
        style={{ left: `${thresholdPct}%` }}
      />
    </div>
  );
}

/** The line under a bar: "¼ left · Checked 1 day ago · Restock at 25%". */
export function SupplyMeta({
  levelPct,
  lastCheckedAt,
  thresholdPct,
}: {
  levelPct: number | null;
  lastCheckedAt: string | null;
  thresholdPct: number;
}) {
  const rest = [lastCheckedAt && checkedAgo(new Date(lastCheckedAt)), `Restock at ${thresholdPct}%`].filter(Boolean);
  return (
    <p className="text-xs text-muted">
      <span className="font-medium text-ink">{levelText(levelPct)}</span>
      {rest.map((part) => (
        <span key={part as string}> · {part}</span>
      ))}
    </p>
  );
}
