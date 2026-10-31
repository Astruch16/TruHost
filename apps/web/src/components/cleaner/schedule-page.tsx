import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { type CleanSummary } from '@truhost/shared';
import { ArrowRight, Clock, DoorOpen } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import {
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
import { addDays, calendarDays, nightsBetween, todayIso } from '../../lib/dates';
import { shortDate } from '../../lib/months';
import { greeting } from '../../lib/owner';
import { useWeekStart } from '../../lib/preferences';
import { queries } from '../../lib/queries';
import { daysOff } from '../../lib/time-off';
import { ComingUpIllustration } from '../illustrations/coming-up';
import type { IconProps } from '../illustrations/defs';
import { CleanDoneIcon, WeekIcon } from '../illustrations/list-icons';
import { OwnPropertyIcon } from '../illustrations/statement-icons';
import { LoadError } from '../ui/alert';
import { Skeleton } from '../ui/skeleton';
import { ScheduleCalendar } from './schedule-calendar';
import { RailProperties, RailRecent, RailSupplies } from './schedule-rail';
import { OpenCleans } from './open-cleans';
import { WeekBoard } from './week-board';
import { CleanStatusPill } from './clean-status-pill';

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
  const approvedOff = useQuery(queries.timeOff(api, { status: 'APPROVED' }));
  const board = useQuery({
    ...queries.cleans(api, { assignee: 'me', from: week.days[0]!, to: week.days[6]! }),
    placeholderData: (previous) => previous,
  });
  // Open cleans (no cleaner yet) at the properties they clean, from today for two months, to book.
  const open = useQuery(
    queries.cleans(api, { assignee: 'none', status: 'SCHEDULED', from: today, to: addDays(today, 60) }),
  );
  const all = list.data?.items ?? [];
  const groups = list.data ? scheduleGroups(all, today) : null;
  const next = groups?.upcoming.find((c) => c.status !== 'CANCELLED');
  const colors = propertyColors(
    [...all, ...(calendar.data?.items ?? []), ...(board.data?.items ?? []), ...(open.data?.items ?? [])].map(
      (c) => c.property,
    ),
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
        weekEnd={current.days[6]!}
        today={today}
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
              {/* Two to a row: an odd one out gets what's next beside it, rather than a gap. */}
              {groups.today.length % 2 === 1 && <UpNextCard clean={next ?? null} today={today} colors={colors} />}
            </ul>
          </section>
        )}
        <OpenCleans cleans={open.data?.items ?? []} colors={colors} />
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
            daysOff={daysOff(approvedOff.data?.items ?? [])}
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
 * The top of the page, as four cards of one size in a row (two by two on a tablet; on a phone, today across the top
 * and the three counts under it). First, on the deep green the owner home uses: a greeting, what today holds (or
 * what's next) and a way straight into the next clean. Then a card for each count: cleans left this week, in the next
 * 30 days, and the properties they're at, each saying the dates it covers.
 */
function ScheduleHero({
  firstName,
  todayCount,
  doneToday,
  next,
  counts,
  weekEnd,
  today,
}: {
  firstName: string;
  todayCount: number;
  doneToday: number;
  next: CleanSummary | null;
  counts: { thisWeek: number; next30: number; properties: number };
  weekEnd: string;
  today: string;
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
      className="grid grid-cols-3 gap-3 @2xl/content:auto-rows-fr @2xl/content:grid-cols-2 @2xl/content:gap-4 @5xl/content:grid-cols-4"
    >
      <div className="relative col-span-3 flex flex-col overflow-hidden rounded-card bg-primary p-6 text-primary-ink @2xl/content:col-span-1">
        <div aria-hidden className="pointer-events-none absolute -top-14 -right-12 size-40 rounded-full bg-white/5" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -bottom-20 size-44 rounded-full bg-white/5"
        />
        <div className="relative flex flex-1 flex-col">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary-ink-muted uppercase">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </p>
          <h1 id="schedule-hero" className="mt-2 text-3xl leading-tight font-bold tracking-[-0.02em]">
            {headline}
          </h1>
          {next ? (
            <p className="mt-2 text-sm text-primary-ink-muted">
              {todayCount > 0 ? 'After that: ' : 'Next up: '}
              <span className="font-semibold text-primary-ink">{next.property.name}</span>,{' '}
              {dayLabel(next.scheduledDate)}
              {freeFrom(next) ? ` · ${freeFrom(next)!.replace('Free from', 'from')}` : ''}
            </p>
          ) : (
            <p className="mt-2 text-sm text-primary-ink-muted">
              Nothing else is scheduled yet. New cleans appear as stays are booked.
            </p>
          )}
          {next && (
            <div className="mt-auto pt-5">
              <Link
                to="/cleaner/cleans/$cleanId"
                params={{ cleanId: next.id }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary-ink-muted"
              >
                Open the next clean <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
      <CountCard
        icon={WeekIcon}
        label="This week"
        value={counts.thisWeek}
        detail={`To do, through ${dayLabel(weekEnd)}`}
      />
      <CountCard
        icon={CleanDoneIcon}
        label="Next 30 days"
        value={counts.next30}
        detail={`To do, through ${dayLabel(addDays(today, 30))}`}
      />
      <CountCard
        icon={OwnPropertyIcon}
        label={counts.properties === 1 ? 'Property' : 'Properties'}
        value={counts.properties}
        detail="With cleans still to do"
      />
    </section>
  );
}

/**
 * One count, as its own card: an illustrated icon, the label, the figure and the dates it covers. On a phone (three to
 * a row) it keeps to the label and figure, the figures level however the labels wrap.
 */
function CountCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: (props: IconProps) => ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-card border border-line-soft bg-surface p-4 @2xl/content:p-6">
      <Icon size={44} className="hidden shrink-0 @2xl/content:block" />
      <dl className="flex flex-1 flex-col @2xl/content:mt-4">
        <dt className="text-[11px] leading-tight font-semibold tracking-[0.08em] text-muted uppercase @2xl/content:text-xs">
          {label}
        </dt>
        <dd className="figure mt-auto pt-1.5 text-3xl leading-none font-bold tracking-[-0.02em] text-ink @2xl/content:pt-3 @2xl/content:text-4xl">
          {value}
        </dd>
        <dd className="mt-1.5 hidden text-sm text-muted @2xl/content:block">{detail}</dd>
      </dl>
    </div>
  );
}

/** One of today's cleans: where, the window, progress, and the next step. The whole card opens it. */
function TodayCard({ clean: c, today }: { clean: CleanSummary; today: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const from = freeFrom(c);
  const late = c.scheduledDate < today;
  // Today's scheduled clean starts right here, then opens on its checklist. If it can't be started (someone else's
  // now, say), its page says why.
  const startable = c.status === 'SCHEDULED' && !late;
  const open = () => navigate({ to: '/cleaner/cleans/$cleanId', params: { cleanId: c.id } });
  const start = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/cleans/{id}/start', { params: { path: { id: c.id } } })),
    onSuccess: (data) => {
      qc.setQueryData(queries.clean(api, c.id).queryKey, data);
      void qc.invalidateQueries({ queryKey: ['cleans', 'list'] });
    },
    onSettled: () => void open(),
  });
  const action =
    c.status === 'SCHEDULED'
      ? late
        ? 'Open the clean'
        : 'Start the clean'
      : c.status === 'IN_PROGRESS'
        ? 'Carry on'
        : 'See the photos';
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
        <CleanStatusPill status={c.status} />
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
      {startable ? (
        // A real button, above the card's link (z-10), so it starts the clean rather than only opening it.
        <button
          type="button"
          onClick={() => start.mutate()}
          disabled={start.isPending}
          className="relative z-10 mt-5 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-deep disabled:cursor-progress disabled:opacity-80"
        >
          {start.isPending ? 'Starting…' : action} <ArrowRight aria-hidden className="size-4" />
        </button>
      ) : (
        // Looks like a button; the card's link takes the click (pointer-events-none keeps it from catching it).
        <span
          aria-hidden
          className={cx(
            'pointer-events-none mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors',
            c.status === 'COMPLETE'
              ? 'border border-line bg-surface text-ink group-hover:bg-ground'
              : 'bg-primary text-primary-ink group-hover:bg-primary/90',
          )}
        >
          {action} <ArrowRight className="size-4" />
        </span>
      )}
    </li>
  );
}

/**
 * Beside an odd one out among today's cleans (wide screens only, where they sit two to a row): the next clean after
 * today, with its day as a calendar tile, or that nothing else is booked yet. The whole card opens it.
 */
function UpNextCard({
  clean: c,
  today,
  colors,
}: {
  clean: CleanSummary | null;
  today: string;
  colors: Map<string, string>;
}) {
  if (!c) {
    return (
      <li className="hidden flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line bg-surface/60 p-5 text-center @3xl/content:flex">
        <ComingUpIllustration size={72} />
        <div>
          <p className="font-semibold text-ink">Nothing else booked yet</p>
          <p className="mt-0.5 text-sm text-muted">New cleans appear here as stays are booked.</p>
        </div>
      </li>
    );
  }
  const from = freeFrom(c);
  const date = new Date(`${c.scheduledDate}T00:00:00Z`);
  const part = (o: Intl.DateTimeFormatOptions) => date.toLocaleDateString('en-CA', { ...o, timeZone: 'UTC' });
  const days = nightsBetween(today, c.scheduledDate);
  return (
    <li className="group relative hidden flex-col rounded-card border border-line-soft bg-surface p-5 transition-[border-color,box-shadow] hover:border-line hover:shadow-[0_6px_18px_rgb(16_20_18/0.06)] @3xl/content:flex">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
            Up next · {days === 1 ? 'Tomorrow' : `In ${days} days`}
          </p>
          <h3 className="mt-1 flex items-center gap-2 text-lg leading-snug font-bold text-ink">
            <span
              aria-hidden
              className={cx('size-2.5 shrink-0 rounded-full', colors.get(c.property.id) ?? 'bg-line')}
            />
            <Link
              to="/cleaner/cleans/$cleanId"
              params={{ cleanId: c.id }}
              aria-label={`Up next: ${c.property.name}, ${dayLabel(c.scheduledDate)}`}
              className="truncate after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-blue-deep"
            >
              {c.property.name}
            </Link>
          </h3>
          <p className="text-sm text-muted">
            {c.property.city} · {cleanOccasion(c)}
          </p>
        </div>
        {/* The day, as a calendar tile. */}
        <span
          aria-hidden
          className="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-line-soft bg-ground text-center"
        >
          <span className="w-full bg-primary py-0.5 text-[10px] font-semibold tracking-[0.08em] text-primary-ink uppercase">
            {part({ month: 'short' })}
          </span>
          <span className="figure pt-1 text-xl leading-none font-bold text-ink">{part({ day: 'numeric' })}</span>
          <span className="pb-1.5 text-[10px] font-semibold tracking-[0.06em] text-muted uppercase">
            {part({ weekday: 'short' })}
          </span>
        </span>
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
      {/* Looks like a button, at the foot (level with today's card's); the card's link takes the click. */}
      <div className="mt-5 flex flex-1 flex-col justify-end">
        <span
          aria-hidden
          className="pointer-events-none inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors group-hover:bg-ground"
        >
          Open the clean <ArrowRight className="size-4" />
        </span>
      </div>
    </li>
  );
}
