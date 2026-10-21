import type { CleanSummary } from '@truhost/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { calendarDays } from '../../lib/dates';
import { addMonths, monthLabel } from '../../lib/months';
import { useWeekStart } from '../../lib/preferences';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * A cleaner's month at a glance: each day they clean carries a dot per clean, in its property's colour, with a legend.
 * A day with cleans can be picked (again to unpick) to show just that day's cleans. Cancelled cleans aren't marked.
 */
export function ScheduleCalendar({
  month,
  onMonthChange,
  cleans,
  colors,
  today,
  selected,
  onSelect,
  loading = false,
  className,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  cleans: readonly CleanSummary[];
  colors: Map<string, string>;
  today: string;
  selected: string | null;
  onSelect: (day: string | null) => void;
  loading?: boolean;
  className?: string;
}) {
  const weekStartsOn = useWeekStart();
  const days = calendarDays(month, weekStartsOn);
  const byDay = new Map<string, CleanSummary[]>();
  for (const c of cleans) {
    if (c.status === 'CANCELLED') continue;
    byDay.set(c.scheduledDate, [...(byDay.get(c.scheduledDate) ?? []), c]);
  }
  const properties = [
    ...new Map(cleans.filter((c) => c.status !== 'CANCELLED').map((c) => [c.property.id, c.property])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const heads = Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);

  return (
    <section
      aria-labelledby="schedule-calendar"
      className={cx('flex flex-col rounded-card border border-line-soft bg-surface p-4 @2xl/content:p-5', className)}
      data-tour="cleaner-calendar"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-ground focus-visible:outline-2 focus-visible:outline-blue-deep"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <h2 id="schedule-calendar" className="font-semibold text-ink">
          {monthLabel(month)}
        </h2>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-ground focus-visible:outline-2 focus-visible:outline-blue-deep"
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>

      <div
        role="grid"
        aria-label={`${monthLabel(month)}: the days you clean`}
        aria-busy={loading || undefined}
        className={cx('mt-3 transition-opacity', loading && 'opacity-60')}
      >
        <div role="row" className="grid grid-cols-7 text-center">
          {heads.map((d) => (
            <span
              key={d}
              role="columnheader"
              aria-label={WEEKDAY_NAMES[d]}
              className="py-1 text-xs font-semibold text-muted"
            >
              {WEEKDAYS[d]}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, w) => (
          <div key={w} role="row" className="grid grid-cols-7">
            {days.slice(w * 7, w * 7 + 7).map((day) => {
              const inMonth = day.startsWith(month);
              const here = byDay.get(day) ?? [];
              const isToday = day === today;
              const isSelected = day === selected;
              const label = `${dayLabel(day)}${here.length ? `: ${here.length} clean${here.length === 1 ? '' : 's'} (${here.map((c) => c.property.name).join(', ')})` : ''}`;
              const body = (
                <>
                  <span
                    className={cx(
                      'figure grid size-8 place-items-center rounded-full text-sm',
                      isToday && 'bg-primary font-bold text-primary-ink',
                      !isToday && here.length > 0 && 'font-semibold text-ink',
                      !isToday && here.length === 0 && (inMonth ? 'text-ink/70' : 'text-muted/50'),
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <span aria-hidden className="flex h-2 items-center justify-center gap-0.5">
                    {here.slice(0, 3).map((c) => (
                      <span key={c.id} className={cx('size-1.5 rounded-full', colors.get(c.property.id))} />
                    ))}
                    {here.length > 3 && <span className="text-[9px] leading-none font-bold text-muted">+</span>}
                  </span>
                </>
              );
              return (
                <div
                  key={day}
                  role="gridcell"
                  aria-selected={isSelected || undefined}
                  className="flex justify-center py-0.5"
                >
                  {here.length > 0 ? (
                    <button
                      type="button"
                      aria-label={label}
                      aria-pressed={isSelected}
                      onClick={() => onSelect(isSelected ? null : day)}
                      className={cx(
                        'flex w-full max-w-11 flex-col items-center gap-0.5 rounded-inner py-1 transition-colors focus-visible:outline-2 focus-visible:outline-blue-deep',
                        isSelected ? 'bg-sage-tint ring-1 ring-sage-deep/40' : 'hover:bg-ground',
                        !inMonth && 'opacity-60',
                      )}
                    >
                      {body}
                    </button>
                  ) : (
                    <span className="flex w-full max-w-11 flex-col items-center gap-0.5 py-1" aria-label={label}>
                      {body}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Stretched beside taller cards, the legend stays at the foot. */}
      <div className="mt-auto">
        {properties.length > 0 && (
          <ul aria-label="Properties" className="mt-4 flex flex-col gap-1.5 border-t border-line-soft pt-3 text-sm">
            {properties.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-ink">
                <span aria-hidden className={cx('size-2.5 shrink-0 rounded-full', colors.get(p.id))} />
                <span className="truncate font-medium">{p.name}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">Pick a day to see its week.</p>
      </div>
    </section>
  );
}
