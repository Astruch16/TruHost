import type { RestockUrgency, SupplyState } from '@truhost/shared';
import { cx } from '../../lib/cx';
import { checkedAgo, levelText, URGENCY_LABELS } from '../../lib/supplies';
import { Pill } from '../ui/pill';

const FILL: Record<SupplyState, string> = {
  OK: 'from-sage-light to-sage-mid',
  LOW: 'from-amber-light to-amber-mid',
  OUT: 'from-danger-light to-danger-mid',
  UNKNOWN: '',
};

/**
 * A supply's health bar: how full it is (0–100%), coloured by where it stands (stocked, running low, out), with a
 * notch at its restock point that stands just proud of the bar. The fill is one smooth piece with a soft gradient and
 * sheen; faint quarter marks show on the empty part of the track only. Not checked yet: an empty dashed track.
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
  /** md: 10px (cards); sm: 8px (dashboard). */
  size?: 'sm' | 'md';
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
      className={cx('relative py-[3px]', className)}
    >
      <div
        className={cx(
          'relative overflow-hidden rounded-full',
          size === 'sm' ? 'h-2' : 'h-2.5',
          unknown
            ? 'border border-dashed border-line bg-ground'
            : 'bg-ink/[0.06] shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)]',
        )}
      >
        {/* Quarter marks, under the fill so they only show on the empty part. */}
        {[25, 50, 75].map((pct) => (
          <span
            key={pct}
            aria-hidden
            className="absolute inset-y-[30%] w-px -translate-x-1/2 rounded-full bg-ink/15"
            style={{ left: `${pct}%` }}
          />
        ))}
        {!unknown && (
          <div
            aria-hidden
            className={cx(
              'absolute inset-y-0 left-0 rounded-full bg-linear-to-r shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]',
              'transition-[width] duration-500 ease-out motion-reduce:transition-none',
              FILL[state],
              // Empty still shows a dot, so the bar reads as a bar.
              state === 'OUT' && (size === 'sm' ? 'min-w-2' : 'min-w-2.5'),
            )}
            style={{ width: `${levelPct}%` }}
          />
        )}
      </div>
      {/* Restock point: a notch standing just proud of the track. */}
      <span
        aria-hidden
        title={`Restock at ${thresholdPct}%`}
        className="absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full bg-ink/50 ring-1 ring-surface/80"
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
