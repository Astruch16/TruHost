import type { RestockUrgency, SupplyState } from '@truhost/shared';
import { cx } from '../../lib/cx';
import { checkedAgo, levelText, URGENCY_LABELS } from '../../lib/supplies';
import { Pill } from '../ui/pill';

const FILL: Record<SupplyState, string> = {
  OK: 'bg-sage-mid',
  LOW: 'bg-amber-mid',
  OUT: 'bg-danger-mid',
  UNKNOWN: '',
};

/** Each quarter of the bar, as the levels people tap: ¼, ½, ¾ and Full. */
const QUARTERS = [0, 25, 50, 75] as const;

/**
 * A supply's level bar, like the statements tracker: four quarter segments that fill in the colour of where the item
 * stands (stocked, running low, out). A level between quarters part-fills its segment. Empty: the segments tinted red.
 * Not checked yet: four dashed segments. The restock point is in the text beside it ("Restock at 25%"), and on hover.
 */
export function SupplyBar({
  name,
  levelPct,
  state,
  thresholdPct,
  size = 'md',
  className,
}: {
  name: string;
  levelPct: number | null;
  state: SupplyState;
  thresholdPct: number;
  /** md: 8px (cards); sm: 6px (dashboard). */
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      role="meter"
      aria-label={`${name} level`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={levelPct ?? undefined}
      aria-valuetext={levelText(levelPct)}
      title={`Restock at ${thresholdPct}%`}
      className={cx('grid grid-cols-4 gap-1', className)}
    >
      {QUARTERS.map((from) => {
        const filled = levelPct === null ? 0 : Math.min(1, Math.max(0, (levelPct - from) / 25));
        return (
          <span
            key={from}
            aria-hidden
            data-filled={filled}
            className={cx(
              'overflow-hidden rounded-full',
              size === 'sm' ? 'h-1.5' : 'h-2',
              levelPct === null
                ? 'border border-dashed border-line'
                : state === 'OUT'
                  ? 'bg-danger-light/30'
                  : 'bg-line',
            )}
          >
            {filled > 0 && (
              <span
                className={cx(
                  'block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none',
                  FILL[state],
                )}
                style={{ width: `${filled * 100}%` }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

/** The line under a bar: "¼ left · Checked 1 day ago · Restock at 25%". */
export function SupplyMeta({
  levelPct,
  lastCheckedAt,
  thresholdPct,
  showLevel = true,
}: {
  levelPct: number | null;
  lastCheckedAt: string | null;
  thresholdPct: number;
  /** Leave "¼ left" out where it's already shown beside the bar. */
  showLevel?: boolean;
}) {
  const rest = [lastCheckedAt && checkedAgo(new Date(lastCheckedAt)), `Restock at ${thresholdPct}%`].filter(
    (part): part is string => Boolean(part),
  );
  return (
    <p className="text-xs text-muted">
      {showLevel && <span className="font-medium text-ink">{levelText(levelPct)} · </span>}
      {rest.join(' · ')}
    </p>
  );
}

/** Out (red), Running low (amber) or Low soon (blue): where an item on the restock list stands. */
export function UrgencyPill({ urgency }: { urgency: RestockUrgency }) {
  return (
    <Pill tone={urgency === 'OUT' ? 'danger' : urgency === 'LOW' ? 'amber' : 'blue'}>{URGENCY_LABELS[urgency]}</Pill>
  );
}
