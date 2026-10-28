import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, unwrap } from '@truhost/api-client';
import {
  CLEAN_STATUS_LABELS,
  CLEAN_STEP_LABELS,
  type Clean,
  type CleanStatus,
  type MissingCleanPhotos,
} from '@truhost/shared';
import { ArrowLeft, ArrowRight, Camera, Check, Clock, DoorOpen, MapPin, Play, StickyNote, Wallet } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { CLEAN_STEP_HINTS, CLEAN_STEPS, cleanOccasion, freeFrom, readyBy } from '../../lib/cleans';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { formatCents } from '../../lib/money';
import { queries } from '../../lib/queries';
import { CleanStepIcon } from '../illustrations/clean-step-icons';
import { NotAvailable } from '../shell/not-available';
import { ErrorAlert } from '../ui/alert';
import { Skeleton } from '../ui/skeleton';
import { SuccessNotice } from '../ui/success-notice';
import { CleanChecklist, CompletedClean } from './clean-checklist';

/**
 * One clean, as its cleaner works it on a phone. A hero on the deep green says where and when (free from, ready by,
 * the pay), how far along it is, and what to do now (book it, start it, or why it can't be started yet). Below it,
 * before the start, the five steps it will take; once started, its checklist (CleanChecklist): before photos, damage,
 * a stock count, after photos and "Clean finished", which tells TruHost and the owner. Finishing is a milestone: the
 * celebrating guide. A finished clean shows what was done. Wide, a side column keeps the notes and every room's photos
 * in view.
 */
export function CleanPage({ cleanId }: { cleanId: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const query = useQuery(queries.clean(api, cleanId));
  const [justCompleted, setJustCompleted] = useState(false);
  const [missing, setMissing] = useState<MissingCleanPhotos | null>(null);
  const store = (data: Clean) => {
    qc.setQueryData(queries.clean(api, cleanId).queryKey, data);
    void qc.invalidateQueries({ queryKey: ['cleans', 'list'] });
  };
  const start = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/cleans/{id}/start', { params: { path: { id: cleanId } } })),
    onSuccess: store,
  });
  const complete = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/cleans/{id}/complete', { params: { path: { id: cleanId } } })),
    onSuccess: (data) => {
      store(data);
      setMissing(null);
      setJustCompleted(true);
      window.scrollTo({ top: 0 });
    },
    onError: (e) => {
      const list = e instanceof ApiError ? (e.problem as { missing?: MissingCleanPhotos }).missing : undefined;
      setMissing(list ?? null);
    },
  });

  if (query.error) {
    return query.error instanceof ApiError && query.error.status === 404 ? (
      <NotAvailable />
    ) : (
      <ErrorAlert error={query.error} />
    );
  }
  if (!query.data) {
    return (
      <div role="status" aria-label="Loading the clean" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Skeleton className="h-5 w-32 rounded-inner" />
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-80 rounded-card" />
      </div>
    );
  }
  const c = query.data;
  const working = c.status === 'IN_PROGRESS' || c.status === 'COMPLETE';
  const side = Boolean(c.notes) || (working && c.rooms.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Link
        to="/cleaner"
        className="inline-flex w-fit items-center gap-1.5 rounded-control text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" /> Your schedule
      </Link>

      {justCompleted && c.status === 'COMPLETE' && (
        <SuccessNotice title="Clean finished. Nice work.">
          TruHost and the owner have been told {c.property.name} is ready for guests.
        </SuccessNotice>
      )}

      <CleanHero clean={c}>
        {c.can.book ? (
          <BookClean clean={c} onBooked={store} />
        ) : c.status === 'SCHEDULED' ? (
          c.can.start ? (
            <HeroAction
              text="When you arrive, start the clean. The checklist then takes you through it, a step at a time."
              error={start.error}
            >
              <HeroButton onClick={() => start.mutate()} busy={start.isPending} busyLabel="Starting…">
                <Play aria-hidden className="size-4" /> Start the clean
              </HeroButton>
            </HeroAction>
          ) : (
            <p className="text-primary-ink-muted">
              {c.assignedCleaner
                ? c.scheduledDate > c.today
                  ? `You can start this clean on ${dayLabel(c.scheduledDate)}.`
                  : `This clean was for ${dayLabel(c.scheduledDate)} and can’t be started now. Ask TruHost if it still needs doing.`
                : 'No one is assigned to this clean yet.'}
            </p>
          )
        ) : c.status === 'CANCELLED' ? (
          <div>
            <p className="font-semibold">This clean was cancelled.</p>
            {c.cancelReason && <p className="mt-1 text-primary-ink-muted">{c.cancelReason}</p>}
          </div>
        ) : null}
      </CleanHero>

      <div className={cx('grid items-start gap-6', side && '@4xl/content:grid-cols-[minmax(0,1fr)_18rem]')}>
        {/* First in the page so a phone reads the notes before the checklist; wide, it's the right-hand column. */}
        {side && (
          <aside
            aria-label="About this clean"
            className="flex min-w-0 flex-col gap-4 @4xl/content:sticky @4xl/content:top-6 @4xl/content:col-start-2 @4xl/content:row-start-1"
          >
            {c.notes && <CleanNotes notes={c.notes} />}
            {working && c.rooms.length > 0 && <RoomsAtAGlance clean={c} />}
          </aside>
        )}
        <div className="min-w-0 @4xl/content:col-start-1 @4xl/content:row-start-1">
          {c.status === 'SCHEDULED' && <StepsAhead />}
          {c.status === 'IN_PROGRESS' && (
            <CleanChecklist
              clean={c}
              onUpdated={store}
              onFinish={() => complete.mutate()}
              finishing={complete.isPending}
              finishError={complete.error}
              missing={missing}
            />
          )}
          {c.status === 'COMPLETE' && <CompletedClean clean={c} />}
        </div>
      </div>
    </div>
  );
}

const STATUS_DOT: Record<CleanStatus, string> = {
  SCHEDULED: 'bg-blue-tint',
  IN_PROGRESS: 'bg-amber-light',
  COMPLETE: 'bg-sage-light',
  CANCELLED: 'bg-white/50',
};

/**
 * The top of the page, on the deep green the schedule uses: the day and occasion, the property, its status and (once
 * started) a ring of the steps done; then the window to clean in and the pay; then what to do now.
 */
function CleanHero({ clean: c, children }: { clean: Clean; children: ReactNode }) {
  const from = freeFrom(c);
  const stepsDone =
    c.status === 'COMPLETE'
      ? CLEAN_STEPS.length
      : c.status === 'IN_PROGRESS'
        ? CLEAN_STEPS.indexOf(c.checklist.current ?? 'FINISH')
        : null;
  return (
    <section
      aria-labelledby="clean-heading"
      className="relative overflow-hidden rounded-card bg-primary px-6 py-6 text-primary-ink @2xl/content:px-8 @2xl/content:py-7"
    >
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-12 size-64 rounded-full bg-white/5" />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-white/[0.04]"
      />
      <div className="relative flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-[0.12em] text-primary-ink-muted uppercase">
              {dayLabel(c.scheduledDate)} · {cleanOccasion(c)}
            </p>
            <h1
              id="clean-heading"
              className="mt-2 text-3xl leading-tight font-bold tracking-[-0.02em] @2xl/content:text-4xl"
            >
              {c.property.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-1.5 text-primary-ink-muted">
                <MapPin aria-hidden className="size-4" /> {c.property.city}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20 ring-inset">
                <span aria-hidden className={cx('size-2 rounded-full', STATUS_DOT[c.status])} />
                {CLEAN_STATUS_LABELS[c.status]}
              </span>
            </div>
          </div>
          {stepsDone !== null && <StepsRing done={stepsDone} total={CLEAN_STEPS.length} />}
        </div>

        <dl className="grid grid-cols-2 gap-2.5 @2xl/content:flex @2xl/content:items-stretch">
          <HeroFact
            icon={<DoorOpen className="size-4" />}
            label="Free from"
            value={from ? from.replace('Free from ', '') : 'Any time'}
          />
          {/* Free from, then on to ready by. */}
          <span aria-hidden className="hidden items-center gap-1 text-white/35 @2xl/content:flex">
            <span className="w-6 border-t-2 border-dashed border-current" />
            <ArrowRight className="size-4" />
          </span>
          <HeroFact icon={<Clock className="size-4" />} label="Ready by" value={readyBy(c).replace('Ready by ', '')} />
          {/* Pay, once TruHost has set it (a clean at $0 means it hasn't been). */}
          {c.cleanerPayCents ? (
            <HeroFact
              icon={<Wallet className="size-4" />}
              label="You earn"
              value={formatCents(c.cleanerPayCents)}
              gold
              className="col-span-2 @2xl/content:ml-auto"
            />
          ) : null}
        </dl>

        {children && <div className="border-t border-white/15 pt-5">{children}</div>}
      </div>
    </section>
  );
}

function HeroFact({
  icon,
  label,
  value,
  gold = false,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  gold?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'min-w-0 rounded-xl bg-white/[0.08] px-4 py-3 ring-1 ring-white/12 ring-inset @2xl/content:min-w-44',
        className,
      )}
    >
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-primary-ink-muted uppercase">
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd className={cx('mt-1.5 text-lg leading-snug font-bold', gold ? 'figure text-amber-light' : 'text-white')}>
        {value}
      </dd>
    </div>
  );
}

/** How many of the checklist's steps are done, as a ring (a tick once finished). */
function StepsRing({ done, total }: { done: number; total: number }) {
  const r = 30;
  const length = 2 * Math.PI * r;
  const finished = done === total;
  return (
    <div
      role="img"
      aria-label={`${done} of ${total} steps done`}
      className="relative grid size-20 shrink-0 place-items-center @2xl/content:size-24"
    >
      <svg viewBox="0 0 72 72" aria-hidden className="absolute inset-0 size-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgb(255 255 255 / 0.14)" strokeWidth="6" />
        {done > 0 && (
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            stroke={finished ? 'var(--color-sage-light)' : 'var(--color-amber-light)'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={length}
            strokeDashoffset={length * (1 - done / total)}
          />
        )}
      </svg>
      {finished ? (
        <Check aria-hidden className="size-8 text-sage-light" />
      ) : (
        <span aria-hidden className="text-center">
          <span className="figure block text-xl leading-none font-bold @2xl/content:text-2xl">
            {done}/{total}
          </span>
          <span className="mt-1 block text-[10px] font-semibold tracking-[0.08em] text-primary-ink-muted uppercase">
            Steps
          </span>
        </span>
      )}
    </div>
  );
}

/** The hero's action: a line of what it does, its button, and any error. */
function HeroAction({ text, error, children }: { text: ReactNode; error: unknown; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 @2xl/content:flex-row @2xl/content:items-center @2xl/content:justify-between">
        <p className="max-w-lg text-primary-ink-muted">{text}</p>
        {children}
      </div>
      <ErrorAlert error={error} />
    </div>
  );
}

function HeroButton({
  onClick,
  busy,
  busyLabel,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  busyLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-primary transition-colors hover:bg-primary-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-progress disabled:opacity-80"
    >
      {busy ? busyLabel : children}
    </button>
  );
}

/** An open clean (no cleaner yet) the caller cleans this property for: book it. The first cleaner to book gets it. */
function BookClean({ clean: c, onBooked }: { clean: Clean; onBooked: (c: Clean) => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const book = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/cleans/{id}/book', { params: { path: { id: c.id } } })),
    onSuccess: onBooked,
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) void qc.invalidateQueries({ queryKey: ['cleans'] });
    },
  });
  return (
    <HeroAction
      text={
        <>
          <strong className="text-white">This clean is open.</strong> No one has it yet: book it and it’s yours. TruHost
          will be told.
        </>
      }
      error={book.error}
    >
      <HeroButton onClick={() => book.mutate()} busy={book.isPending} busyLabel="Booking…">
        Book this clean
      </HeroButton>
    </HeroAction>
  );
}

/** Before the start: the five steps the checklist will take them through. */
function StepsAhead() {
  return (
    <section
      aria-labelledby="steps-ahead"
      className="rounded-card border border-line-soft bg-surface p-5 @2xl/content:p-6"
    >
      <h2 id="steps-ahead" className="text-lg font-bold text-ink">
        How the clean goes
      </h2>
      <p className="mt-1 text-sm text-muted">Once it’s started, a checklist takes you through five steps, in order.</p>
      <ol className="mt-5 grid gap-2.5 @3xl/content:grid-cols-5">
        {CLEAN_STEPS.map((step, i) => (
          <li
            key={step}
            className="flex items-center gap-3.5 rounded-inner bg-ground p-3 @3xl/content:flex-col @3xl/content:items-start @3xl/content:p-4"
          >
            <CleanStepIcon step={step} size={44} className="shrink-0" />
            <div className="min-w-0">
              <p className="figure text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Step {i + 1}</p>
              <p className="font-semibold text-ink">{CLEAN_STEP_LABELS[step]}</p>
              <p className="text-sm text-muted">{CLEAN_STEP_HINTS[step]}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** TruHost's notes on the clean, as a note pinned beside it. */
function CleanNotes({ notes }: { notes: string }) {
  return (
    <section aria-labelledby="clean-notes" className="rounded-card border border-amber-mid/30 bg-amber-tint/60 p-4">
      <h2 id="clean-notes" className="flex items-center gap-2 text-sm font-bold text-amber-deep">
        <StickyNote aria-hidden className="size-4" /> Notes for this clean
      </h2>
      <p className="mt-2 text-sm whitespace-pre-line text-ink">{notes}</p>
    </section>
  );
}

/** Wide screens only: every room, its latest photo, and whether it has its before and after shots. */
function RoomsAtAGlance({ clean: c }: { clean: Clean }) {
  const done = c.rooms.filter((r) => r.before.length > 0 && r.after.length > 0).length;
  return (
    <section
      aria-labelledby="rooms-glance"
      className="hidden rounded-card border border-line-soft bg-surface p-4 @4xl/content:block"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="rooms-glance" className="font-bold text-ink">
          Rooms
        </h2>
        <span className="figure text-xs font-semibold text-muted">
          {done} of {c.rooms.length} done
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-2.5">
        {c.rooms.map((room) => {
          const latest = room.after.at(-1) ?? room.before.at(-1);
          return (
            <li key={room.id} className="flex items-center gap-3">
              {latest ? (
                <img
                  src={latest.thumbUrl}
                  alt=""
                  className="size-10 shrink-0 rounded-[8px] object-cover"
                  loading="lazy"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-[8px] border border-dashed border-line bg-ground text-muted"
                >
                  <Camera className="size-4" />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{room.displayName}</span>
              <span className="flex shrink-0 gap-1">
                <PhaseTag label="Before" done={room.before.length > 0} />
                <PhaseTag label="After" done={room.after.length > 0} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PhaseTag({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        done ? 'bg-sage-tint text-sage-deep' : 'bg-ground text-muted',
      )}
    >
      {done && <Check aria-hidden className="size-2.5" />}
      {label}
      <span className="sr-only">{done ? ' taken' : ' not taken yet'}</span>
    </span>
  );
}
