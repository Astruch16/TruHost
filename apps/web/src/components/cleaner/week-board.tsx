import { Link } from '@tanstack/react-router';
import { type CleanSummary } from '@truhost/shared';
import { ChevronLeft, ChevronRight, Clock, DoorOpen } from 'lucide-react';
import { cleanOccasion } from '../../lib/cleans';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { addDays } from '../../lib/dates';
import { shortDate } from '../../lib/months';
import { formatTime } from '../../lib/my-properties';
import { CleanStatusPill } from './clean-status-pill';

/**
 * One week of a cleaner's cleans, a day to a column, moved through a week at a time, so the page stays the same size
 * however many cleans are booked ahead. Each clean is a compact tile topped in its property's colour, with when the
 * place is free and when it must be ready. Below 42rem of its own width, the week becomes a list of its days.
 */
export function WeekBoard({
  days,
  currentStart,
  cleans,
  colors,
  today,
  highlight,
  onWeek,
  loading = false,
  filters,
}: {
  days: string[];
  /** The first day of the current week. */
  currentStart: string;
  cleans: readonly CleanSummary[];
  colors: Map<string, string>;
  today: string;
  /** A day picked on the calendar. */
  highlight: string | null;
  /** -1 for the week before, 1 for the next, 0 back to this week. */
  onWeek: (delta: -1 | 0 | 1) => void;
  loading?: boolean;
  filters?: React.ReactNode;
}) {
  const first = days[0]!;
  const last = days[6]!;
  const thisWeek = first === currentStart;
  const total = cleans.filter((c) => c.status !== 'CANCELLED').length;
  const range = `${shortDate(first)} – ${first.slice(0, 7) === last.slice(0, 7) ? last.slice(8).replace(/^0/, '') : shortDate(last)}`;
  return (
    <section
      aria-labelledby="week-board"
      className="@container/board min-w-0 rounded-card border border-line-soft bg-surface p-4 @2xl/content:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="week-board" className="text-lg font-bold text-ink">
            {first === currentStart
              ? 'This week'
              : first === addDays(currentStart, 7)
                ? 'Next week'
                : first === addDays(currentStart, -7)
                  ? 'Last week'
                  : `Week of ${shortDate(first)}`}
          </h2>
          <p className="text-sm text-muted">
            {range} · {total} {total === 1 ? 'clean' : 'cleans'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {!thisWeek && (
            <button
              type="button"
              onClick={() => onWeek(0)}
              className="min-h-9 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-ground"
            >
              This week
            </button>
          )}
          <button
            type="button"
            aria-label="Week before"
            onClick={() => onWeek(-1)}
            className="grid size-9 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-ground"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Week after"
            onClick={() => onWeek(1)}
            className="grid size-9 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-ground"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      {filters}

      <ol
        aria-busy={loading || undefined}
        className={cx(
          'mt-5 flex flex-col gap-3 transition-opacity @2xl/board:grid @2xl/board:grid-cols-7 @2xl/board:gap-2',
          loading && 'opacity-60',
        )}
      >
        {days.map((day) => {
          const here = cleans.filter((c) => c.scheduledDate === day);
          const [mon, num] = shortDate(day).split(' ');
          const weekday = dayLabel(day).split(',')[0];
          const isToday = day === today;
          return (
            <li
              key={day}
              aria-label={`${dayLabel(day)}: ${here.length ? `${here.length} clean${here.length === 1 ? '' : 's'}` : 'nothing'}`}
              className={cx(
                // Narrow: a row per day (days without cleans stay out of the way). Wide: a column per day.
                'grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 @2xl/board:flex @2xl/board:min-h-40 @2xl/board:flex-col @2xl/board:gap-2 @2xl/board:rounded-inner @2xl/board:p-1.5',
                here.length === 0 && '@max-2xl/board:hidden',
                day === highlight && '@2xl/board:bg-sage-tint/60 @2xl/board:ring-1 @2xl/board:ring-sage-deep/30',
              )}
            >
              <div className="pt-1 text-center @2xl/board:pt-0">
                <p
                  className={cx(
                    'text-[11px] font-semibold tracking-[0.06em] uppercase',
                    isToday ? 'text-primary' : 'text-muted',
                  )}
                >
                  {weekday}
                </p>
                <p
                  className={cx(
                    'figure mx-auto grid size-8 place-items-center rounded-full text-lg leading-none font-bold',
                    isToday ? 'bg-primary text-primary-ink' : 'text-ink',
                  )}
                >
                  {num}
                </p>
                <p className="text-[10px] font-semibold text-muted uppercase @2xl/board:hidden">{mon}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {here.map((c) => (
                  <WeekTile key={c.id} clean={c} color={colors.get(c.property.id)} />
                ))}
                {here.length === 0 && (
                  <li
                    aria-hidden
                    className="hidden h-full min-h-24 rounded-inner border border-dashed border-line-soft @2xl/board:block"
                  />
                )}
              </ul>
            </li>
          );
        })}
      </ol>
      {total === 0 && (
        <p className="mt-2 text-sm text-muted @2xl/board:mt-4 @2xl/board:text-center">Nothing scheduled this week.</p>
      )}
    </section>
  );
}

/** A clean on the board: its property (in its colour), when it's free and when it must be ready. Opens the clean. */
function WeekTile({ clean: c, color }: { clean: CleanSummary; color?: string }) {
  const cancelled = c.status === 'CANCELLED';
  const unusual = c.kind === 'TURNOVER' && c.stay?.kind === 'GUEST' ? null : cleanOccasion(c);
  const until = c.window.until;
  return (
    <li>
      <Link
        to="/cleaner/cleans/$cleanId"
        params={{ cleanId: c.id }}
        title={`${c.property.name}${unusual ? ` · ${unusual}` : ''}`}
        className={cx(
          'group block overflow-hidden rounded-inner border border-line-soft bg-surface transition-[border-color,box-shadow] hover:border-line hover:shadow-[0_4px_12px_rgb(16_20_18/0.07)] focus-visible:outline-2 focus-visible:outline-blue-deep',
          cancelled && 'opacity-55',
        )}
      >
        <span aria-hidden className={cx('block h-1', color ?? 'bg-line')} />
        <span className="flex flex-col gap-1 px-2.5 pt-2 pb-2.5">
          <span
            className={cx(
              'line-clamp-2 text-sm leading-snug font-semibold text-ink',
              cancelled && 'line-through decoration-muted',
            )}
          >
            {c.property.name}
          </span>
          {unusual && <span className="text-[11px] font-semibold text-lavender-deep">{unusual}</span>}
          {cancelled ? (
            <span className="text-[11px] text-muted">Cancelled</span>
          ) : (
            <span className="flex flex-col gap-0.5 text-[11px] text-muted">
              {c.window.from.time && (
                <span className="inline-flex items-center gap-1">
                  <DoorOpen aria-hidden className="size-3" />
                  {formatTime(c.window.from.time)}
                </span>
              )}
              <span className="inline-flex items-center gap-1 font-semibold text-ink">
                <Clock aria-hidden className="size-3 text-muted" />
                {until
                  ? `${until.date === c.scheduledDate ? '' : `${dayLabel(until.date).split(',')[0]} `}${until.time ? formatTime(until.time) : ''}`
                  : 'Open'}
              </span>
            </span>
          )}
          {c.status !== 'SCHEDULED' && !cancelled && (
            <span className="mt-0.5">
              <CleanStatusPill status={c.status} />
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
