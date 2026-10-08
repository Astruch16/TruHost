import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cx } from '../../lib/cx';
import { splitCents } from '../../lib/money';

export interface KpiChange {
  label: string;
  /** Direction only; the label carries the number. */
  direction: 'up' | 'down' | 'flat';
  vs: string;
}

/**
 * One KPI tile, Option A in docs/design/KpiCards.dc.html: no icon, the number leads. Label, large figure,
 * supporting line (with the "vs. previous month" chip when there is one) and one small chart.
 */
export function KpiCard({
  label,
  value,
  support,
  change,
  chart,
}: {
  label: string;
  value: ReactNode;
  support: ReactNode;
  change?: KpiChange | null;
  chart: ReactNode;
}) {
  return (
    <section className="@container/kpi flex min-w-0 flex-col gap-1.5 rounded-2xl border border-line bg-surface px-4 py-4 @2xl/content:px-[22px] @2xl/content:py-5">
      <h3 className="text-[13px] font-semibold text-muted">{label}</h3>
      {/* The board's 32px wherever the card is wide enough (its own width, not the page's). */}
      <p className="figure text-[1.625rem] leading-[1.15] font-bold tracking-[-0.03em] whitespace-nowrap text-ink @[13rem]/kpi:text-[2rem]">
        {value}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[13px] text-muted">
        <span className="min-w-0">{support}</span>
        {change && (
          <span
            className={cx(
              'figure inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
              change.direction === 'up' && 'bg-sage-tint text-sage-deep',
              change.direction === 'down' && 'bg-danger-tint text-danger-deep',
              change.direction === 'flat' && 'bg-line-soft text-muted',
            )}
          >
            {change.direction === 'up' && <ArrowUpRight aria-hidden className="size-3" />}
            {change.direction === 'down' && <ArrowDownRight aria-hidden className="size-3" />}
            {change.label}
            <span className="font-normal">vs {change.vs}</span>
          </span>
        )}
      </div>
      <div className="mt-auto pt-2.5">{chart}</div>
    </section>
  );
}

/** "$2,856" large, ".00" smaller and lighter. */
export function KpiMoney({ cents }: { cents: number }) {
  const { whole, cents: fraction } = splitCents(cents);
  return (
    <>
      {whole}
      <span className="text-[0.625em] text-muted">{fraction}</span>
    </>
  );
}

/** "17 of 31": the denominator smaller and lighter. */
export function KpiOf({ value, of }: { value: number; of: number }) {
  return (
    <>
      {value} <span className="text-[0.625em] text-muted">of {of}</span>
    </>
  );
}
