import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CLEAN_STATUS_LABELS, type CleanSummary } from '@truhost/shared';
import { ArrowRight, ChevronRight, Clock, DoorOpen } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import {
  CLEAN_STATUS_TONE,
  cleanOccasion,
  freeFrom,
  propertyColors,
  readyBy,
  scheduleGroups,
  weekGroups,
  type ScheduleSort,
} from '../../lib/cleans';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { addDays, calendarDays, todayIso } from '../../lib/dates';
import { shortDate } from '../../lib/months';
import { useWeekStart } from '../../lib/preferences';
import { queries } from '../../lib/queries';
import { AllClearIllustration } from '../illustrations/all-clear';
import { LoadError } from '../ui/alert';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { PageHeader } from '../ui/page-header';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';
import { ScheduleCalendar } from './schedule-calendar';

/**
 * A cleaner's schedule (mobile-first): today's cleans as big cards (start, carry on, or see what's done); a month
 * calendar of the days they clean, each property in its colour; then what's coming up, grouped by week, which they
 * can sort, narrow to a property, or narrow to a day picked on the calendar; and the last few done. On wide screens
 * the calendar sits beside the lists. Only cleans assigned to them; each opens its walkthrough.
 */
export function CleanerSchedulePage() {
  const api = useApi();
  const today = todayIso();
  const weekStartsOn = useWeekStart();
  const [sort, setSort] = useState<ScheduleSort>('soonest');
  const [property, setProperty] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const list = useQuery(queries.cleans(api, { assignee: 'me', from: addDays(today, -14), to: addDays(today, 90) }));
  const visible = calendarDays(month, weekStartsOn);
  const calendar = useQuery({
    ...queries.cleans(api, { assignee: 'me', from: visible[0]!, to: visible.at(-1)! }),
    placeholderData: (previous) => previous,
  });
  const all = list.data?.items ?? [];
  const groups = list.data ? scheduleGroups(all, today) : null;
  const next = groups?.upcoming.find((c) => c.status !== 'CANCELLED');
  const colors = propertyColors([...all, ...(calendar.data?.items ?? [])].map((c) => c.property));
  const upcomingProperties = [
    ...new Map((groups?.upcoming ?? []).map((c) => [c.property.id, c.property])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const upcoming = (groups?.upcoming ?? []).filter((c) => !property || c.property.id === property);
  const dayCleans = day ? (calendar.data?.items ?? []).filter((c) => c.scheduledDate === day) : null;

  return (
    <>
      <PageHeader title="Your schedule" description="The cleans assigned to you. Each one starts on its day." />
      {list.error ? (
        <LoadError what="your schedule" onRetry={() => void list.refetch()} retrying={list.isFetching} />
      ) : !groups ? (
        <div role="status" aria-label="Loading your schedule" className="flex flex-col gap-4">
          <Skeleton className="h-52 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
      ) : (
        <div className="grid items-start gap-8 @3xl/content:grid-cols-[minmax(0,1fr)_17rem] @5xl/content:grid-cols-[minmax(0,1fr)_20rem] @[90rem]/content:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-labelledby="today" data-tour="cleaner-schedule" className="min-w-0 @3xl/content:col-start-1">
            <h2 id="today" className="mb-3 text-sm font-semibold tracking-[0.08em] text-muted uppercase">
              Today · {dayLabel(today)}
            </h2>
            {groups.today.length > 0 ? (
              <ul className="grid gap-4 @[80rem]/content:grid-cols-2">
                {groups.today.map((c) => (
                  <TodayCard key={c.id} clean={c} today={today} />
                ))}
              </ul>
            ) : (
              <Card>
                <EmptyState size="compact" illustration={<AllClearIllustration />} title="Nothing to clean today">
                  {next
                    ? `Your next clean is ${dayLabel(next.scheduledDate)} at ${next.property.name}.`
                    : 'Nothing is scheduled for you yet. New cleans show up here as stays are booked.'}
                </EmptyState>
              </Card>
            )}
          </section>

          {/* Beside the lists on wide screens (and stays in view while they scroll); between them on phones. */}
          <div className="min-w-0 @3xl/content:sticky @3xl/content:top-6 @3xl/content:col-start-2 @3xl/content:row-span-3 @3xl/content:row-start-1">
            <ScheduleCalendar
              month={month}
              onMonthChange={setMonth}
              cleans={calendar.data?.items ?? []}
              colors={colors}
              today={today}
              selected={day}
              onSelect={setDay}
              loading={calendar.isFetching}
            />
          </div>

          <section aria-labelledby="upcoming" className="min-w-0 @3xl/content:col-start-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="upcoming" className="text-sm font-semibold tracking-[0.08em] text-muted uppercase">
                {day ? dayLabel(day) : 'Coming up'}
              </h2>
              {day ? (
                <button
                  type="button"
                  onClick={() => setDay(null)}
                  className="rounded-control text-sm font-semibold text-primary hover:underline"
                >
                  Show everything coming up
                </button>
              ) : (
                <div role="group" aria-label="Order" className="flex rounded-full border border-line bg-surface p-0.5">
                  {(
                    [
                      ['soonest', 'Soonest first'],
                      ['latest', 'Latest first'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={sort === key}
                      onClick={() => setSort(key)}
                      className={cx(
                        'min-h-8 rounded-full px-3 text-xs font-semibold transition-colors',
                        sort === key ? 'bg-primary text-primary-ink' : 'text-ink hover:bg-ground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!day && upcomingProperties.length > 1 && (
              <div role="group" aria-label="Property" className="mb-4 flex flex-wrap gap-2">
                {[{ id: null, name: 'All properties' }, ...upcomingProperties].map((p) => (
                  <button
                    key={p.id ?? 'all'}
                    type="button"
                    aria-pressed={property === p.id}
                    onClick={() => setProperty(p.id)}
                    className={cx(
                      'inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
                      property === p.id
                        ? 'border-primary bg-primary text-primary-ink'
                        : 'border-line bg-surface text-ink hover:bg-ground',
                    )}
                  >
                    {p.id && <span aria-hidden className={cx('size-2 rounded-full', colors.get(p.id))} />}
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            {dayCleans ? (
              <Card className="p-2! @2xl/content:p-3!">
                {dayCleans.length > 0 ? (
                  <ul className="divide-y divide-line-soft">
                    {dayCleans.map((c) => (
                      <CleanRow key={c.id} clean={c} color={colors.get(c.property.id)} />
                    ))}
                  </ul>
                ) : (
                  <p className="p-3 text-sm text-muted">No cleans that day.</p>
                )}
              </Card>
            ) : upcoming.length === 0 ? (
              <Card>
                <p className="text-sm text-muted">Nothing else is scheduled for you yet.</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-5">
                {weekGroups(upcoming, today, weekStartsOn, sort).map((g) => (
                  <section key={g.label} aria-label={g.label}>
                    <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-ink">
                      {g.label}
                      <span className="text-xs font-medium text-muted">
                        {g.items.length} {g.items.length === 1 ? 'clean' : 'cleans'}
                      </span>
                    </h3>
                    <Card className="p-2! @2xl/content:p-3!">
                      <ul className="divide-y divide-line-soft">
                        {g.items.map((c) => (
                          <CleanRow key={c.id} clean={c} color={colors.get(c.property.id)} />
                        ))}
                      </ul>
                    </Card>
                  </section>
                ))}
              </div>
            )}
          </section>

          {groups.recent.length > 0 && !day && (
            <section aria-labelledby="recent" className="min-w-0 @3xl/content:col-start-1">
              <h2 id="recent" className="mb-3 text-sm font-semibold tracking-[0.08em] text-muted uppercase">
                Recently done
              </h2>
              <Card className="p-2! @2xl/content:p-3!">
                <ul className="divide-y divide-line-soft">
                  {groups.recent.map((c) => (
                    <CleanRow key={c.id} clean={c} color={colors.get(c.property.id)} />
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </div>
      )}
    </>
  );
}

/** One of today's cleans: where, the window, progress, and the next step. The whole card opens it. */
function TodayCard({ clean: c, today }: { clean: CleanSummary; today: string }) {
  const from = freeFrom(c);
  const late = c.scheduledDate < today;
  const action =
    c.status === 'SCHEDULED' ? 'Start the clean' : c.status === 'IN_PROGRESS' ? 'Carry on' : 'See the photos';
  const pct = c.progress.rooms ? Math.round((c.progress.done / c.progress.rooms) * 100) : 0;
  return (
    <li className="group relative flex flex-col rounded-card border border-line-soft bg-surface p-5 transition-[border-color,box-shadow] hover:border-line hover:shadow-[0_6px_18px_rgb(16_20_18/0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg leading-snug font-bold text-ink">
            <Link
              to="/cleaner/cleans/$cleanId"
              params={{ cleanId: c.id }}
              className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-blue-deep"
            >
              {c.property.name}
            </Link>
          </h3>
          <p className="text-sm text-muted">
            {c.property.city} · {cleanOccasion(c)}
            {late && ` · from ${shortDate(c.scheduledDate)}`}
          </p>
        </div>
        <Pill tone={CLEAN_STATUS_TONE[c.status]}>{CLEAN_STATUS_LABELS[c.status]}</Pill>
      </div>
      <dl className="mt-4 grid gap-2 text-sm">
        {from && (
          <div className="flex items-center gap-2 text-ink">
            <DoorOpen aria-hidden className="size-4 shrink-0 text-muted" />
            <dt className="sr-only">Free from</dt>
            <dd>{from}</dd>
          </div>
        )}
        <div className="flex items-center gap-2 font-semibold text-ink">
          <Clock aria-hidden className="size-4 shrink-0 text-muted" />
          <dt className="sr-only">Ready by</dt>
          <dd>{readyBy(c)}</dd>
        </div>
      </dl>
      {c.status !== 'SCHEDULED' && c.progress.rooms > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs font-semibold text-muted">
            <span>Rooms photographed</span>
            <span className="figure">
              {c.progress.done} of {c.progress.rooms}
            </span>
          </div>
          <div aria-hidden className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
            <div
              className={cx('h-full rounded-full', c.status === 'COMPLETE' ? 'bg-sage-deep' : 'bg-amber-mid')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
      <span
        aria-hidden
        className={cx(
          'mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors',
          c.status === 'COMPLETE'
            ? 'border border-line bg-surface text-ink group-hover:bg-ground'
            : 'bg-primary text-primary-ink group-hover:brightness-110',
        )}
      >
        {action} <ArrowRight className="size-4" />
      </span>
    </li>
  );
}

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
        {c.status !== 'SCHEDULED' && <Pill tone={CLEAN_STATUS_TONE[c.status]}>{CLEAN_STATUS_LABELS[c.status]}</Pill>}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
      </Link>
    </li>
  );
}
