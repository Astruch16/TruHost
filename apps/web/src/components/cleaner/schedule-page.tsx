import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CLEAN_STATUS_LABELS, type CleanSummary } from '@truhost/shared';
import { ArrowRight, ChevronRight, Clock, DoorOpen } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import {
  byDay,
  CLEAN_STATUS_TONE,
  cleanOccasion,
  freeFrom,
  propertyColors,
  readyBy,
  scheduleCounts,
  scheduleGroups,
  weekGroups,
  type ScheduleSort,
} from '../../lib/cleans';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { addDays, calendarDays, todayIso } from '../../lib/dates';
import { shortDate } from '../../lib/months';
import { greeting } from '../../lib/owner';
import { useWeekStart } from '../../lib/preferences';
import { queries } from '../../lib/queries';
import { LoadError } from '../ui/alert';
import { Card } from '../ui/card';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';
import { ScheduleCalendar } from './schedule-calendar';

/**
 * A cleaner's home (mobile-first). A hero says what today holds and what's next, with the week's counts; today's cleans
 * follow as action cards. Below, a month calendar of the days they clean (each property in its colour) sits beside an
 * agenda of what's coming up: a date column beside each day's cleans, grouped by week, which they can sort, narrow
 * to a property, or narrow to a day picked on the calendar. The last few cleans done close the page. Only cleans
 * assigned to them; each opens its walkthrough.
 */
export function CleanerSchedulePage() {
  const api = useApi();
  const today = todayIso();
  const weekStartsOn = useWeekStart();
  const me = useQuery(queries.me(api));
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

  if (list.error) {
    return <LoadError what="your schedule" onRetry={() => void list.refetch()} retrying={list.isFetching} />;
  }
  if (!groups) {
    return (
      <div role="status" aria-label="Loading your schedule" className="flex flex-col gap-6">
        <Skeleton className="h-56 rounded-card" />
        <div className="grid gap-6 @3xl/content:grid-cols-[17rem_minmax(0,1fr)]">
          <Skeleton className="h-80 rounded-card" />
          <Skeleton className="h-80 rounded-card" />
        </div>
      </div>
    );
  }
  const counts = scheduleCounts(all, today, weekStartsOn);

  return (
    <div className="flex flex-col gap-8">
      <ScheduleHero
        firstName={me.data?.firstName ?? ''}
        todayCount={groups.today.filter((c) => c.status !== 'COMPLETE').length}
        doneToday={groups.today.filter((c) => c.status === 'COMPLETE').length}
        next={next ?? null}
        counts={counts}
      />

      {groups.today.length > 0 && (
        <section aria-labelledby="today">
          <h2 id="today" className="mb-3 text-lg font-bold text-ink">
            Today
          </h2>
          <ul className="grid gap-4 @3xl/content:grid-cols-2 @[90rem]/content:grid-cols-3">
            {groups.today.map((c) => (
              <TodayCard key={c.id} clean={c} today={today} />
            ))}
          </ul>
        </section>
      )}

      <div className="grid items-start gap-6 @3xl/content:grid-cols-[17rem_minmax(0,1fr)] @5xl/content:grid-cols-[20rem_minmax(0,1fr)]">
        {/* The calendar leads (picking a day narrows the agenda), and stays in view while the agenda scrolls. */}
        <div className="min-w-0 @3xl/content:sticky @3xl/content:top-6">
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

        <section
          aria-labelledby="upcoming"
          className="min-w-0 rounded-card border border-line-soft bg-surface p-4 @2xl/content:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="upcoming" className="text-lg font-bold text-ink">
                {day ? dayLabel(day) : 'Coming up'}
              </h2>
              <p className="text-sm text-muted">
                {day
                  ? `${dayCleans?.length ?? 0} clean${dayCleans?.length === 1 ? '' : 's'} that day`
                  : `${upcoming.filter((c) => c.status !== 'CANCELLED').length} cleans in the next 90 days`}
              </p>
            </div>
            {day ? (
              <button
                type="button"
                onClick={() => setDay(null)}
                className="min-h-9 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-ground"
              >
                Show everything coming up
              </button>
            ) : (
              <div role="group" aria-label="Order" className="flex rounded-full bg-ground p-1">
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
                      sort === key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!day && upcomingProperties.length > 1 && (
            <div role="group" aria-label="Property" className="mt-4 flex flex-wrap gap-2">
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

          <div className="mt-6">
            {dayCleans ? (
              dayCleans.length > 0 ? (
                <Agenda days={byDay(dayCleans)} colors={colors} today={today} />
              ) : (
                <p className="text-sm text-muted">No cleans that day.</p>
              )
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-muted">Nothing else is scheduled for you yet.</p>
            ) : (
              <div className="flex flex-col gap-7">
                {weekGroups(upcoming, today, weekStartsOn, sort).map((g) => (
                  <section key={g.label} aria-label={g.label}>
                    <h3 className="mb-3 flex items-center gap-3 text-xs font-semibold tracking-[0.1em] text-muted uppercase">
                      {g.label}
                      <span aria-hidden className="h-px flex-1 bg-line-soft" />
                      <span className="tracking-normal normal-case">
                        {g.items.length} {g.items.length === 1 ? 'clean' : 'cleans'}
                      </span>
                    </h3>
                    <Agenda days={byDay(g.items)} colors={colors} today={today} />
                  </section>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {groups.recent.length > 0 && (
        <section aria-labelledby="recent">
          <h2 id="recent" className="mb-3 text-lg font-bold text-ink">
            Recently done
          </h2>
          <Card className="p-2! @2xl/content:p-3!">
            <ul className="grid divide-line-soft @4xl/content:grid-cols-2 @4xl/content:gap-x-4 @max-4xl/content:divide-y">
              {groups.recent.map((c) => (
                <CleanRow key={c.id} clean={c} color={colors.get(c.property.id)} />
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

/**
 * The top of the page, on the deep green the owner home uses: a greeting, what today holds (or what's next), a way
 * straight into the next clean, and the week's counts.
 */
function ScheduleHero({
  firstName,
  todayCount,
  doneToday,
  next,
  counts,
}: {
  firstName: string;
  todayCount: number;
  doneToday: number;
  next: CleanSummary | null;
  counts: { thisWeek: number; next30: number; properties: number };
}) {
  const headline =
    todayCount > 0
      ? `${todayCount} clean${todayCount === 1 ? '' : 's'} today`
      : doneToday > 0
        ? 'All done for today'
        : 'Nothing to clean today';
  return (
    <section
      aria-labelledby="schedule-hero"
      data-tour="cleaner-schedule"
      className="relative overflow-hidden rounded-card bg-primary px-6 py-6 text-primary-ink @2xl/content:px-8 @2xl/content:py-7"
    >
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/5" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-[-6rem] size-64 rounded-full bg-white/5"
      />
      <div className="relative flex flex-col gap-6 @4xl/content:flex-row @4xl/content:items-end @4xl/content:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-[0.12em] text-primary-ink-muted uppercase">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </p>
          <h1
            id="schedule-hero"
            className="mt-2 text-3xl leading-tight font-bold tracking-[-0.02em] @2xl/content:text-4xl"
          >
            {headline}
          </h1>
          {next ? (
            <p className="mt-2 text-primary-ink-muted">
              {todayCount > 0 ? 'After that: ' : 'Next up: '}
              <span className="font-semibold text-primary-ink">{next.property.name}</span>,{' '}
              {dayLabel(next.scheduledDate)}
              {freeFrom(next) ? ` · ${freeFrom(next)!.replace('Free from', 'from')}` : ''}
            </p>
          ) : (
            <p className="mt-2 text-primary-ink-muted">
              Nothing else is scheduled yet. New cleans appear as stays are booked.
            </p>
          )}
          {next && (
            <Link
              to="/cleaner/cleans/$cleanId"
              params={{ cleanId: next.id }}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary-ink-muted"
            >
              Open the next clean <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-2.5 @4xl/content:w-[26rem]">
          <HeroStat label="This week" value={counts.thisWeek} />
          <HeroStat label="Next 30 days" value={counts.next30} />
          <HeroStat label={counts.properties === 1 ? 'Property' : 'Properties'} value={counts.properties} />
        </dl>
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl bg-white/[0.08] px-3.5 py-3 ring-1 ring-white/12 ring-inset">
      {/* Labels may wrap on phones; the reserved two lines keep the three figures level. */}
      <dt className="flex min-h-[calc(2lh+0.5rem)] items-end border-b border-white/15 pb-2 text-[11px] leading-tight font-semibold tracking-[0.08em] text-white uppercase @4xl/content:min-h-0">
        {label}
      </dt>
      <dd className="figure mt-2.5 text-2xl leading-none font-bold text-white">{value}</dd>
    </div>
  );
}

/** The agenda: each day's date on the left, its cleans beside it as cards. */
function Agenda({
  days,
  colors,
  today,
}: {
  days: { day: string; items: CleanSummary[] }[];
  colors: Map<string, string>;
  today: string;
}) {
  return (
    <ol className="flex flex-col gap-4">
      {days.map(({ day, items }) => {
        const [mon, num] = shortDate(day).split(' ');
        const weekday = dayLabel(day).split(',')[0];
        return (
          <li
            key={day}
            className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 @2xl/content:grid-cols-[3.75rem_minmax(0,1fr)] @2xl/content:gap-4"
          >
            <div className={cx('pt-1.5 text-center', day === today && 'text-primary')}>
              <p className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">{weekday}</p>
              <p className="figure text-2xl leading-tight font-bold text-ink">{num}</p>
              <p className="text-[11px] font-semibold text-muted uppercase">{mon}</p>
            </div>
            <ul className="flex flex-col gap-2.5">
              {items.map((c) => (
                <AgendaCard key={c.id} clean={c} color={colors.get(c.property.id)} />
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/** One clean in the agenda: a card edged in its property's colour, with the window as tags. Opens the clean. */
function AgendaCard({ clean: c, color }: { clean: CleanSummary; color?: string }) {
  const cancelled = c.status === 'CANCELLED';
  const from = freeFrom(c);
  const unusual = c.kind === 'TURNOVER' && c.stay?.kind === 'GUEST' ? null : cleanOccasion(c);
  return (
    <li>
      <Link
        to="/cleaner/cleans/$cleanId"
        params={{ cleanId: c.id }}
        className={cx(
          'group relative flex items-center gap-3 overflow-hidden rounded-inner border border-line-soft bg-surface py-3 pr-3 pl-5 transition-[border-color,box-shadow] hover:border-line hover:shadow-[0_4px_14px_rgb(16_20_18/0.06)] focus-visible:outline-2 focus-visible:outline-blue-deep',
          cancelled && 'opacity-60',
        )}
      >
        <span aria-hidden className={cx('absolute inset-y-0 left-0 w-1.5', color ?? 'bg-line')} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cx('font-semibold text-ink', cancelled && 'line-through decoration-muted')}>
              {c.property.name}
            </span>
            <span className="text-xs text-muted">{c.property.city}</span>
            {unusual && (
              <span className="rounded-full bg-lavender-tint px-2 py-0.5 text-[11px] font-semibold text-lavender-deep">
                {unusual}
              </span>
            )}
            {c.status !== 'SCHEDULED' && (
              <Pill tone={CLEAN_STATUS_TONE[c.status]}>{CLEAN_STATUS_LABELS[c.status]}</Pill>
            )}
          </span>
          {cancelled ? (
            <span className="mt-1 block text-xs text-muted">{c.cancelReason ?? 'Cancelled'}</span>
          ) : (
            <span className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {from && (
                <span className="inline-flex items-center gap-1 rounded-full bg-ground px-2.5 py-1 text-ink">
                  <DoorOpen aria-hidden className="size-3.5 text-muted" />
                  {from}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-ground px-2.5 py-1 font-semibold text-ink">
                <Clock aria-hidden className="size-3.5 text-muted" />
                {readyBy(c)}
              </span>
            </span>
          )}
        </span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </li>
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
