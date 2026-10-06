import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cx } from '../../lib/cx';

export interface KpiChange {
  label: string;
  /** Direction only; the label carries the number. */
  direction: 'up' | 'down' | 'flat';
  vs: string;
}

/** One KPI tile: tinted icon, label (with period note), big figure, supporting line, optional change chip. */
export function KpiCard({
  icon: Icon,
  tint,
  label,
  periodNote,
  value,
  suffix,
  support,
  change,
}: {
  icon: LucideIcon;
  tint: { bg: string; fg: string };
  label: string;
  periodNote?: string;
  value: ReactNode;
  suffix?: ReactNode;
  support: ReactNode;
  change?: KpiChange | null;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-inner border border-line bg-surface p-3.5 sm:p-4">
      <header className="flex flex-col gap-2.5">
        <span className={cx('grid size-9 shrink-0 place-items-center rounded-full sm:size-10', tint.bg, tint.fg)}>
          <Icon aria-hidden className="size-[18px]" />
        </span>
        <div className="min-w-0 leading-tight">
          <h3 className="text-sm leading-snug font-medium text-ink">{label}</h3>
          <p className="min-h-4 text-xs text-muted">{periodNote}</p>
        </div>
      </header>
      <p className="figure flex flex-wrap items-baseline gap-x-1.5 text-xl leading-none font-bold tracking-tight text-ink sm:text-[1.75rem] xl:text-[1.6rem]">
        {value}
        {suffix && <span className="text-base font-normal text-muted">{suffix}</span>}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
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
    </section>
  );
}
