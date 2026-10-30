import type { ReactNode } from 'react';
import { Pill } from './ui/pill';

/**
 * One line of a money breakdown, read like a statement: its illustration, what it is (with a short note), and the
 * amount, or a word when there's nothing ("None", "No fee") instead of "−$0.00". Used on the owner property page and
 * the dashboard. Render inside a <dl>.
 */
export function StatementLine({
  icon,
  label,
  note,
  value,
  empty = '—',
  share = null,
}: {
  icon: ReactNode;
  label: string;
  note: string;
  value: string | null;
  empty?: string;
  /** Share of gross, in whole percent, for reading only. */
  share?: number | null;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 first:pt-0 last:border-b-0">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="font-medium text-ink">{label}</dt>
        <p className="text-xs text-muted">{note}</p>
      </div>
      <dd className="flex shrink-0 items-center gap-2">
        {/* The share gives way to the amount on narrow screens (the fee's note says it too). */}
        {share !== null && (
          <span className="hidden @md/content:inline-flex">
            <Pill dot={false} className="figure">
              {share}%
            </Pill>
          </span>
        )}
        {value === null ? (
          <span className="rounded-full bg-surface px-2.5 py-0.5 text-sm font-medium text-muted">{empty}</span>
        ) : (
          <span className="figure font-semibold text-ink">{value}</span>
        )}
      </dd>
    </div>
  );
}
