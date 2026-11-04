import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, unwrap } from '@truhost/api-client';
import { CLEAN_STEP_LABELS, type Clean, type MissingCleanPhotos } from '@truhost/shared';
import { ArrowLeft, Camera, Check, MapPin, Play, StickyNote } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { CLEAN_STEP_HINTS, CLEAN_STEPS, cleanOccasion, freeFrom, readyBy } from '../../lib/cleans';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { formatCents } from '../../lib/money';
import { queries } from '../../lib/queries';
import { CleanStepIcon } from '../illustrations/clean-step-icons';
import { CleanDoneIcon, DoorOpenIcon, ReadyByIcon } from '../illustrations/list-icons';
import { GrossIcon } from '../illustrations/statement-icons';
import { NotAvailable } from '../shell/not-available';
import { ErrorAlert } from '../ui/alert';
import { Skeleton } from '../ui/skeleton';
import { SuccessNotice } from '../ui/success-notice';
import { CleanChecklist, CompletedClean } from './clean-checklist';
import { Pill } from '../ui/pill';
import { CleanStatusPill } from './clean-status-pill';

/**
 * One clean, as its cleaner works it on a phone. A hero on the deep green says where and when (free from, ready by,
 * the pay), how far along it is, and what to do now (book it, start it, or why it can't be started yet). Below it,
 * before the start, the five steps it will take; once started, its checklist (CleanChecklist): before photos, damage,
 * a stock count, after photos and "Clean finished", which tells TruHost and the owner. Finishing is a milestone: the
 * celebrating guide. A finished clean shows what was done. Wide, a side column beside it has the notes and every room's
 * photos; it scrolls with the page, so its heading stays level with the checklist's.
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
            className="flex min-w-0 flex-col gap-4 @4xl/content:col-start-2 @4xl/content:row-start-1"
          >
            {/* Rooms first: its heading sits level with the checklist's, so their cards line up. Phones don't show it. */}
            {working && c.rooms.length > 0 && <RoomsAtAGlance clean={c} />}
            {c.notes && <CleanNotes notes={c.notes} />}
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

/**
 * The top of the page, as cards. A deep-green card says where (the day and occasion, the property, its status) and
 * what to do now; beside it (below, on a phone), a white card for each fact: free from, ready by, how far along it is
 * (once started) and the pay (once TruHost has set it).
 */
function CleanHero({ clean: c, children }: { clean: Clean; children: ReactNode }) {
  const from = freeFrom(c);
  const stepsDone =
    c.status === 'COMPLETE'
      ? CLEAN_STEPS.length
      : c.status === 'IN_PROGRESS'
        ? CLEAN_STEPS.indexOf(c.checklist.current ?? 'FINISH')
        : null;
  const facts: ReactNode[] = [
    <FactCard
      key="from"
      icon={<DoorOpenIcon size={44} />}
      label="Free from"
      value={from ? from.replace('Free from ', '') : 'Any time'}
    />,
    <FactCard
      key="ready"
      icon={<ReadyByIcon size={44} />}
      label="Ready by"
      value={readyBy(c).replace('Ready by ', '')}
    />,
  ];
  if (stepsDone !== null) {
    facts.push(
      <FactCard
        key="progress"
        icon={<CleanDoneIcon size={44} />}
        label="Progress"
        value={stepsDone === CLEAN_STEPS.length ? 'All done' : `${CLEAN_STEPS.length - stepsDone} to go`}
        aside={<StepsRing done={stepsDone} total={CLEAN_STEPS.length} />}
      />,
    );
  }
  // Pay, once TruHost has set it (a clean at $0 means it hasn't been).
  if (c.cleanerPayCents) {
    facts.push(
      <FactCard
        key="pay"
        icon={<GrossIcon size={44} />}
        label="You earn"
        value={formatCents(c.cleanerPayCents)}
        figure
      />,
    );
  }
  // Under way or done, the green card closes on where it's at (before the start, it holds what to do instead).
  const now = c.status === 'IN_PROGRESS' ? c.checklist.current : null;
  const line = now ? (
    <>
      <span className="font-semibold text-white">Now: {CLEAN_STEP_LABELS[now]}.</span> {CLEAN_STEP_HINTS[now]}
    </>
  ) : c.status === 'COMPLETE' ? (
    <>
      <span className="font-semibold text-white">All {CLEAN_STEPS.length} steps done.</span> TruHost and the owner have
      been told it’s ready for guests.
    </>
  ) : null;
  return (
    <section
      aria-labelledby="clean-heading"
      className="grid gap-3 @2xl/content:gap-4 @4xl/content:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
    >
      <div className="relative flex flex-col overflow-hidden rounded-card bg-primary p-6 text-primary-ink @2xl/content:p-7">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-12 size-56 rounded-full bg-white/5" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -bottom-28 size-64 rounded-full bg-white/[0.04]"
        />
        <div className="relative flex flex-1 flex-col">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary-ink-muted uppercase @2xl/content:text-sm">
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
            <CleanStatusPill status={c.status} glass />
          </div>
          {line && <p className="mt-auto pt-6 text-primary-ink-muted">{line}</p>}
          {children && (
            <div className="mt-auto pt-6">
              <div className="border-t border-white/15 pt-5">{children}</div>
            </div>
          )}
        </div>
      </div>

      <dl
        className={cx(
          // A phone: two by two. A tablet, below the green card: one row. Wide, beside it: two by two again, or two
          // stacked when there are only two. An odd one out spans the bottom of a two-by-two.
          'grid auto-rows-fr grid-cols-2 gap-3 @2xl/content:auto-cols-fr @2xl/content:grid-flow-col @2xl/content:grid-cols-none @2xl/content:gap-4',
          '@4xl/content:grid-flow-row',
          facts.length === 2 ? '@4xl/content:grid-cols-1' : '@4xl/content:grid-cols-2',
          facts.length % 2 === 1 &&
            '[&>*:last-child]:col-span-2 @2xl/content:[&>*:last-child]:col-span-1 @4xl/content:[&>*:last-child]:col-span-2',
        )}
      >
        {facts}
      </dl>
    </section>
  );
}

/** One fact about the clean, on its own white card: an icon and a label, its value, and any mark beside them. */
function FactCard({
  icon,
  label,
  value,
  aside,
  figure = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  aside?: ReactNode;
  figure?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr] gap-x-3 rounded-card border border-line-soft bg-surface p-4 @2xl/content:p-5">
      <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
        <span className="mb-3 block w-fit">{icon}</span>
        {label}
      </dt>
      <dd
        className={cx(
          'col-start-1 self-end pt-1 text-lg leading-snug font-bold text-ink @2xl/content:text-xl',
          figure && 'figure',
        )}
      >
        {value}
      </dd>
      {/* Narrower cards say it in words only: a mark beside them would squeeze the value onto two lines. */}
      {aside && <dd className="col-start-2 row-span-2 row-start-1 hidden self-center @4xl/content:block">{aside}</dd>}
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
      className="relative grid size-16 shrink-0 place-items-center @2xl/content:size-20"
    >
      <svg viewBox="0 0 72 72" aria-hidden className="absolute inset-0 size-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-line-soft)" strokeWidth="6" />
        {done > 0 && (
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            stroke={finished ? 'var(--color-sage-mid)' : 'var(--color-primary)'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={length}
            strokeDashoffset={length * (1 - done / total)}
          />
        )}
      </svg>
      {finished ? (
        <Check aria-hidden className="size-7 text-sage-mid" />
      ) : (
        <span aria-hidden className="figure text-base leading-none font-bold text-ink @2xl/content:text-lg">
          {done}/{total}
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

/**
 * Wide screens only: every room, its latest photo, and whether it has its before and after shots. Its heading is
 * outside the card, like the checklist's beside it, so the two cards' tops line up.
 */
function RoomsAtAGlance({ clean: c }: { clean: Clean }) {
  const done = c.rooms.filter((r) => r.before.length > 0 && r.after.length > 0).length;
  return (
    <section aria-labelledby="rooms-glance" className="hidden flex-col gap-3 @4xl/content:flex">
      <div className="flex items-end justify-between gap-3">
        <h2 id="rooms-glance" className="text-lg font-bold text-ink">
          Rooms
        </h2>
        <p className="figure text-sm font-semibold text-muted">
          {done} of {c.rooms.length} done
        </p>
      </div>
      <ul className="flex flex-col gap-2.5 rounded-card border border-line-soft bg-surface p-4">
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
    <Pill tone={done ? 'sage' : 'neutral'} size="sm">
      {label}
      <span className="sr-only">{done ? ' taken' : ' not taken yet'}</span>
    </Pill>
  );
}
