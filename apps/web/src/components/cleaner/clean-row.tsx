import { Link } from '@tanstack/react-router';
import { type CleanSummary } from '@truhost/shared';
import { ChevronRight } from 'lucide-react';
import { cleanOccasion, freeFrom, readyBy } from '../../lib/cleans';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { shortDate } from '../../lib/months';
import { CleanStatusPill } from './clean-status-pill';

/** A compact line for coming up and recently done: the day, where (with its colour), and the window or how it went. */
export function CleanRow({ clean: c, color }: { clean: CleanSummary; color?: string }) {
  const [mon, day] = shortDate(c.scheduledDate).split(' ');
  const weekday = dayLabel(c.scheduledDate).split(',')[0];
  const cancelled = c.status === 'CANCELLED';
  return (
    <li>
      <Link
        to="/cleaner/cleans/$cleanId"
        params={{ cleanId: c.id }}
        className="flex items-center gap-3.5 rounded-inner px-2 py-3 transition-colors hover:bg-ground focus-visible:outline-2 focus-visible:outline-blue-deep"
      >
        <span
          className={cx(
            'flex w-13 shrink-0 flex-col items-center rounded-inner bg-ground py-1.5 text-center',
            cancelled && 'opacity-60',
          )}
        >
          <span className="text-[11px] font-semibold text-muted uppercase">{weekday}</span>
          <span className="figure text-lg leading-none font-bold text-ink">{day}</span>
          <span className="text-[10px] font-semibold text-muted uppercase">{mon}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cx(
              'flex items-center gap-2 truncate font-semibold text-ink',
              cancelled && 'line-through decoration-muted',
            )}
          >
            {color && <span aria-hidden className={cx('size-2 shrink-0 rounded-full', color)} />}
            <span className="truncate">{c.property.name}</span>
          </span>
          <span className="line-clamp-2 block text-xs text-muted">
            {cancelled
              ? (c.cancelReason ?? 'Cancelled')
              : c.status === 'COMPLETE'
                ? `Done${c.completedAt ? ` at ${new Date(c.completedAt).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}` : ''} · ${c.progress.rooms} rooms photographed`
                : [c.kind === 'TURNOVER' && c.stay?.kind === 'GUEST' ? null : cleanOccasion(c), freeFrom(c), readyBy(c)]
                    .filter(Boolean)
                    .join(' · ')}
          </span>
        </span>
        {c.status !== 'SCHEDULED' && <CleanStatusPill status={c.status} />}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
      </Link>
    </li>
  );
}
