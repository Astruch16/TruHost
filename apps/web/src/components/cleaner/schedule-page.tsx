import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CLEAN_STATUS_LABELS, type CleanSummary } from '@truhost/shared';
import { ArrowRight, ChevronRight, Clock, DoorOpen } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { CLEAN_STATUS_TONE, cleanOccasion, freeFrom, readyBy, scheduleGroups } from '../../lib/cleans';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { addDays, todayIso } from '../../lib/dates';
import { shortDate } from '../../lib/months';
import { queries } from '../../lib/queries';
import { AllClearIllustration } from '../illustrations/all-clear';
import { LoadError } from '../ui/alert';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { PageHeader } from '../ui/page-header';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';

/**
 * A cleaner's schedule (mobile-first): today's cleans as big cards (start, carry on, or see what's done), then what's
 * coming up and the last few done. Only cleans assigned to them; each opens its walkthrough.
 */
export function CleanerSchedulePage() {
  const api = useApi();
  const today = todayIso();
  const list = useQuery(queries.cleans(api, { assignee: 'me', from: addDays(today, -14), to: addDays(today, 45) }));
  const groups = list.data ? scheduleGroups(list.data.items, today) : null;
  const next = groups?.upcoming.find((c) => c.status !== 'CANCELLED');

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
        <div className="flex flex-col gap-8">
          <section aria-labelledby="today" data-tour="cleaner-schedule">
            <h2 id="today" className="mb-3 text-sm font-semibold tracking-[0.08em] text-muted uppercase">
              Today · {dayLabel(today)}
            </h2>
            {groups.today.length > 0 ? (
              <ul className="grid gap-4 @3xl/content:grid-cols-2">
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

          {groups.upcoming.length > 0 && (
            <section aria-labelledby="upcoming">
              <h2 id="upcoming" className="mb-3 text-sm font-semibold tracking-[0.08em] text-muted uppercase">
                Coming up
              </h2>
              <Card className="p-2! @2xl/content:p-3!">
                <ul className="divide-y divide-line-soft">
                  {groups.upcoming.map((c) => (
                    <CleanRow key={c.id} clean={c} />
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {groups.recent.length > 0 && (
            <section aria-labelledby="recent">
              <h2 id="recent" className="mb-3 text-sm font-semibold tracking-[0.08em] text-muted uppercase">
                Recently done
              </h2>
              <Card className="p-2! @2xl/content:p-3!">
                <ul className="divide-y divide-line-soft">
                  {groups.recent.map((c) => (
                    <CleanRow key={c.id} clean={c} />
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

/** A compact line for coming up and recently done: the day, where, and the window or how it went. */
export function CleanRow({ clean: c }: { clean: CleanSummary }) {
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
          <span className={cx('block truncate font-semibold text-ink', cancelled && 'line-through decoration-muted')}>
            {c.property.name}
          </span>
          <span className="line-clamp-2 block text-xs text-muted">
            {cancelled
              ? (c.cancelReason ?? 'Cancelled')
              : c.status === 'COMPLETE'
                ? `Done${c.completedAt ? ` at ${new Date(c.completedAt).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}` : ''} · ${c.progress.rooms} rooms photographed`
                : [cleanOccasion(c), freeFrom(c), readyBy(c)].filter(Boolean).join(' · ')}
          </span>
        </span>
        {c.status !== 'SCHEDULED' && <Pill tone={CLEAN_STATUS_TONE[c.status]}>{CLEAN_STATUS_LABELS[c.status]}</Pill>}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
      </Link>
    </li>
  );
}
