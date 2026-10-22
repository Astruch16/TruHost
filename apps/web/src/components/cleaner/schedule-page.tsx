import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CLEAN_STATUS_LABELS, type CleanSummary } from '@truhost/shared';
import { ArrowRight, Clock, DoorOpen } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import {
  CLEAN_STATUS_TONE,
  cleanOccasion,
  freeFrom,
  propertyColors,
  propertySummaries,
  readyBy,
  scheduleCounts,
  scheduleGroups,
  weekOf,
} from '../../lib/cleans';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { addDays, calendarDays, todayIso } from '../../lib/dates';
import { shortDate } from '../../lib/months';
import { greeting } from '../../lib/owner';
import { useWeekStart } from '../../lib/preferences';
import { queries } from '../../lib/queries';
import { LoadError } from '../ui/alert';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';
import { ScheduleCalendar } from './schedule-calendar';
import { RailProperties, RailRecent, RailSupplies } from './schedule-rail';
import { WeekBoard } from './week-board';

/**
 * A cleaner's home (mobile-first). A hero says what today holds and what's next, with the week's counts; today's cleans
 * follow as action cards. Then a week board, a day to a column, moved through a week at a time (narrowed to a property
 * if they like), so the page never grows with the bookings; beside it, a rail with the month calendar (picking a day
 * jumps the board to its week), their properties with each one's next clean, the supplies to check on their next
 * visits, and the last few cleans done. On phones it all stacks. Only cleans assigned to them; each opens its
 * walkthrough.
 */
export function CleanerSchedulePage() {
  const api = useApi();
  const today = todayIso();
  const weekStartsOn = useWeekStart();
  const me = useQuery(queries.me(api));
  const [property, setProperty] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const current = weekOf(today, weekStartsOn);
  const [weekStart, setWeekStart] = useState(current.start);
  const week = weekOf(weekStart, weekStartsOn);
  const list = useQuery(queries.cleans(api, { assignee: 'me', from: addDays(today, -14), to: addDays(today, 90) }));
  const visible = calendarDays(month, weekStartsOn);
  const calendar = useQuery({
    ...queries.cleans(api, { assignee: 'me', from: visible[0]!, to: visible.at(-1)! }),
    placeholderData: (previous) => previous,
  });
  const board = useQuery({
    ...queries.cleans(api, { assignee: 'me', from: week.days[0]!, to: week.days[6]! }),
    placeholderData: (previous) => previous,
  });
  const all = list.data?.items ?? [];
  const groups = list.data ? scheduleGroups(all, today) : null;
  const next = groups?.upcoming.find((c) => c.status !== 'CANCELLED');
  const colors = propertyColors(
    [...all, ...(calendar.data?.items ?? []), ...(board.data?.items ?? [])].map((c) => c.property),
  );
  const summaries = propertySummaries(all, today);
  const boardCleans = (board.data?.items ?? []).filter((c) => !property || c.property.id === property);
  const boardProperties = summaries.map((s) => s.property);

  const pickDay = (d: string | null) => {
    setDay(d);
    if (d) setWeekStart(weekOf(d, weekStartsOn).start);
  };
  const moveWeek = (delta: -1 | 0 | 1) => {
    setDay(null);
    setWeekStart(delta === 0 ? current.start : addDays(weekStart, 7 * delta));
  };

  if (list.error) {
    return <LoadError what="your schedule" onRetry={() => void list.refetch()} retrying={list.isFetching} />;
  }
  if (!groups) {
    return (
      <div role="status" aria-label="Loading your schedule" className="flex flex-col gap-6">
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-80 rounded-card" />
        <div className="grid gap-6 @2xl/content:grid-cols-2 @5xl/content:grid-cols-3">
          <Skeleton className="h-96 rounded-card" />
          <Skeleton className="h-96 rounded-card" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      </div>
    );
  }
  const counts = scheduleCounts(all, today, weekStartsOn);

  return (
    <div className="flex flex-col gap-6">
      <ScheduleHero
        firstName={me.data?.firstName ?? ''}
        todayCount={groups.today.filter((c) => c.status !== 'COMPLETE').length}
        doneToday={groups.today.filter((c) => c.status === 'COMPLETE').length}
        next={next ?? null}
        counts={counts}
      />

      {/*
        The week across the top. Under it the cards sit in a grid whose cells line up: wide, three columns (the month,
        supplies, then your properties over what you did last); medium, two (the month beside your properties and
        what you did last, supplies across the foot); narrow, one after another. Every card always shows, saying when
        it has nothing, so the grid never shifts.
      */}
      <div className="grid grid-flow-row-dense gap-6 @2xl/content:grid-cols-2 @5xl/content:grid-cols-3">
        {groups.today.length > 0 && (
          <section aria-labelledby="today" className="col-span-full">
            <h2 id="today" className="mb-3 text-lg font-bold text-ink">
              Today
            </h2>
            <ul className="grid gap-4 @3xl/content:grid-cols-2">
              {groups.today.map((c) => (
                <TodayCard key={c.id} clean={c} today={today} />
              ))}
            </ul>
          </section>
        )}
        <div className="col-span-full min-w-0">
          <WeekBoard
            days={week.days}
            currentStart={current.start}
            cleans={boardCleans}
            colors={colors}
            today={today}
            highlight={day}
            onWeek={moveWeek}
            loading={board.isFetching && board.isPlaceholderData}
            filters={
              boardProperties.length > 1 && (
                <div role="group" aria-label="Property" className="mt-4 flex flex-wrap gap-2">
                  {[{ id: null, name: 'All properties' }, ...boardProperties].map((p) => (
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
              )
            }
          />
        </div>

        <aside aria-label="Your month" className="min-w-0 @2xl/content:row-span-2">
          <ScheduleCalendar
            month={month}
            onMonthChange={setMonth}
            cleans={calendar.data?.items ?? []}
            colors={colors}
            today={today}
            selected={day}
            onSelect={pickDay}
            loading={calendar.isFetching}
            className="h-full"
          />
        </aside>
        <RailProperties rows={summaries} colors={colors} className="@5xl/content:col-start-3" />
        <RailSupplies
          rows={summaries}
          colors={colors}
          className="@2xl/content:col-span-2 @5xl/content:col-span-1 @5xl/content:col-start-2 @5xl/content:row-span-2"
        />
        <RailRecent cleans={groups.recent} colors={colors} className="@5xl/content:col-start-3" />
      </div>
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
      {/*
        Wide: three columns, the outer two sharing what's left, so the counts sit in the middle of the hero, level with
        the button. The text's column never gets narrower than the text (up to 28rem), so where the middle would run
        into it, the counts sit just after it instead.
      */}
      <div className="relative flex flex-col gap-6 @4xl/content:grid @4xl/content:grid-cols-[minmax(max-content,1fr)_auto_minmax(0,1fr)] @4xl/content:items-end @4xl/content:gap-x-12">
        <div className="min-w-0 @4xl/content:max-w-[28rem]">
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
      <dt className="flex min-h-[calc(2lh+0.5rem)] items-end justify-center border-b border-white/15 pb-2 text-[11px] leading-tight font-semibold tracking-[0.08em] text-center text-white uppercase @4xl/content:min-h-0">
        {label}
      </dt>
      <dd className="figure mt-2.5 text-center text-2xl leading-none font-bold text-white">{value}</dd>
    </div>
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
