import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, unwrap } from '@truhost/api-client';
import {
  CLEAN_STEP_LABELS,
  DAMAGE_STATUS_LABELS,
  type Clean,
  type CleanPhoto,
  type CleanRoom,
  type CleanStep,
  type MissingCleanPhotos,
  type PhotoPhase,
} from '@truhost/shared';
import { Camera, Check, ChevronDown, Lock } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { addCleanPhoto, CLEAN_PHOTO_ACCEPT } from '../../lib/clean-photo';
import { CLEAN_STEPS } from '../../lib/cleans';
import { cx } from '../../lib/cx';
import { STATUS_TONE } from '../../lib/damage';
import { queries } from '../../lib/queries';
import { LEVEL_OPTIONS } from '../../lib/supplies';
import { DamageReportDialog } from '../damage/damage-report-dialog';
import { CleanStepIcon } from '../illustrations/clean-step-icons';
import { DamageAlertIcon } from '../illustrations/damage';
import { SuppliesIcon } from '../illustrations/category-icons';
import { ReportDamageDialog } from '../damage/report-damage-dialog';
import { ErrorAlert } from '../ui/alert';
import { Button } from '../ui/button';
import { Pill } from '../ui/pill';

/**
 * A clean in progress, as a checklist worked in order: before photos of every room, the damage question (with a
 * report, photos and all, when there is some), the stock count, after photos, then "Clean finished". The API decides
 * which step is current and what's allowed; a done step can be opened again (another photo, a recount).
 */
export function CleanChecklist({
  clean: c,
  onUpdated,
  onFinish,
  finishing,
  finishError,
  missing,
}: {
  clean: Clean;
  onUpdated: (c: Clean) => void;
  onFinish: () => void;
  finishing: boolean;
  finishError: unknown;
  missing: MissingCleanPhotos | null;
}) {
  const current = c.checklist.current ?? 'FINISH';
  const [reopened, setReopened] = useState<CleanStep | null>(null);
  const at = CLEAN_STEPS.indexOf(current);
  const done = (step: CleanStep) => CLEAN_STEPS.indexOf(step) < at;

  const steps: { step: CleanStep; summary: string; body: ReactNode }[] = [
    {
      step: 'BEFORE_PHOTOS',
      summary: photoSummary(c, 'BEFORE'),
      body: <RoomPhotos clean={c} phase="BEFORE" onUpdated={onUpdated} missing={missing} />,
    },
    { step: 'DAMAGE', summary: damageSummary(c), body: <DamageStep clean={c} onUpdated={onUpdated} /> },
    {
      step: 'STOCK_COUNT',
      summary: c.checklist.stockCount.done ? stockSummary(c) : `${c.checklist.stockCount.items} items to count`,
      body: <StockStep clean={c} onUpdated={onUpdated} />,
    },
    {
      step: 'AFTER_PHOTOS',
      summary: photoSummary(c, 'AFTER'),
      body: <RoomPhotos clean={c} phase="AFTER" onUpdated={onUpdated} missing={missing} />,
    },
    {
      step: 'FINISH',
      summary: 'Tell TruHost and the owner it’s ready',
      body: <FinishStep clean={c} onFinish={onFinish} finishing={finishing} error={finishError} />,
    },
  ];

  return (
    <section aria-labelledby="checklist-heading" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 id="checklist-heading" className="text-lg font-bold text-ink">
          Checklist
        </h2>
        <p className="figure text-sm font-semibold text-muted">
          Step {at + 1} of {CLEAN_STEPS.length}
        </p>
      </div>
      <ol className="flex flex-col">
        {steps.map(({ step, summary, body }, i) => {
          const state = done(step) ? 'done' : step === current ? 'current' : 'locked';
          const open = state === 'current' || (state === 'done' && reopened === step);
          return (
            <StepCard
              key={step}
              step={step}
              n={i + 1}
              last={i === steps.length - 1}
              title={CLEAN_STEP_LABELS[step]}
              state={state}
              summary={state === 'locked' ? `Opens after “${CLEAN_STEP_LABELS[CLEAN_STEPS[i - 1]!]}”` : summary}
              open={open}
              onToggle={state === 'done' ? () => setReopened(reopened === step ? null : step) : undefined}
            >
              {body}
            </StepCard>
          );
        })}
      </ol>
    </section>
  );
}

function photoSummary(c: Clean, phase: PhotoPhase) {
  const taken = c.rooms.filter((r) => (phase === 'BEFORE' ? r.before : r.after).length > 0).length;
  return `${taken} of ${c.rooms.length} room${c.rooms.length === 1 ? '' : 's'}`;
}

function damageSummary(c: Clean) {
  const { found, reports } = c.checklist.damage;
  if (found === null) return 'Not answered yet';
  if (!found) return 'No damage';
  const sent = reports.filter((r) => r.status !== 'DRAFT').length;
  return sent ? `${sent} report${sent === 1 ? '' : 's'} sent` : 'Damage found: send a report';
}

function stockSummary(c: Clean) {
  const n = c.checklist.stockCount.restock.length;
  return n ? `Counted · ${n} to restock` : 'Counted · nothing to restock';
}

/**
 * One step, on a timeline: its icon (ticked once done, greyed while locked) on a line down to the next, beside a card
 * with its number, title and summary; the current step (or a reopened one) shows its body.
 */
function StepCard({
  step,
  n,
  last,
  title,
  state,
  summary,
  open,
  onToggle,
  children,
}: {
  step: CleanStep;
  n: number;
  last: boolean;
  title: string;
  state: 'done' | 'current' | 'locked';
  summary: string;
  open: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  const head = (
    <>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
          <span className="figure">Step {n}</span>
          {state === 'current' && (
            <span className="rounded-full bg-amber-tint px-2 py-px tracking-[0.06em] text-amber-deep">Now</span>
          )}
          {state === 'done' && (
            <span className="rounded-full bg-sage-tint px-2 py-px tracking-[0.06em] text-sage-deep">Done</span>
          )}
        </span>
        <span
          className={cx(
            'mt-0.5 block font-semibold',
            state === 'locked' ? 'text-muted' : 'text-ink',
            state === 'current' && 'text-lg',
          )}
        >
          {title}
        </span>
        <span className="block text-sm text-muted">{summary}</span>
      </span>
    </>
  );
  return (
    <li
      aria-current={state === 'current' ? 'step' : undefined}
      aria-label={`Step ${n}: ${title}, ${state === 'done' ? 'done' : state === 'current' ? 'to do now' : 'locked'}`}
      className="flex gap-3 @2xl/content:gap-4"
    >
      <div aria-hidden className="flex flex-col items-center pt-3">
        <span
          className={cx(
            'relative shrink-0 rounded-full',
            state === 'current' && 'ring-4 ring-amber-light/45',
            state === 'locked' && 'opacity-45 grayscale',
          )}
        >
          <CleanStepIcon step={step} size={44} />
          {state === 'done' && (
            <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-sage-deep text-white ring-2 ring-ground">
              <Check className="size-3" />
            </span>
          )}
          {state === 'locked' && (
            <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-muted text-white ring-2 ring-ground">
              <Lock className="size-2.5" />
            </span>
          )}
        </span>
        {!last && (
          <span className={cx('my-1.5 w-0.5 flex-1 rounded-full', state === 'done' ? 'bg-sage-mid/60' : 'bg-line')} />
        )}
      </div>
      <div
        className={cx(
          'mb-3 min-w-0 flex-1 rounded-card border',
          state === 'current'
            ? 'border-primary/30 bg-surface shadow-[0_10px_30px_rgb(16_20_18/0.07)]'
            : state === 'locked'
              ? 'border-dashed border-line bg-transparent'
              : 'border-line-soft bg-surface',
        )}
      >
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center gap-3 rounded-card p-4 focus-visible:outline-2 focus-visible:outline-blue-deep @2xl/content:px-5"
          >
            {head}
            <ChevronDown
              aria-hidden
              className={cx('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')}
            />
          </button>
        ) : (
          <div
            className={cx(
              'flex items-center gap-3 rounded-t-card p-4 @2xl/content:px-5',
              state === 'current' &&
                'bg-[linear-gradient(90deg,var(--color-amber-tint)_0%,transparent_70%)] @2xl/content:py-5',
            )}
          >
            {head}
          </div>
        )}
        {open && <div className="border-t border-line-soft p-4 @2xl/content:p-5">{children}</div>}
      </div>
    </li>
  );
}

/** Steps 1 and 4: a photo of every room, before or after (the after step shows the before shot for reference). */
function RoomPhotos({
  clean: c,
  phase,
  onUpdated,
  missing,
}: {
  clean: Clean;
  phase: PhotoPhase;
  onUpdated: (c: Clean) => void;
  missing: MissingCleanPhotos | null;
}) {
  if (c.rooms.length === 0) {
    return <p className="text-muted">This property has no rooms set up yet. Ask TruHost to add them.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        {phase === 'BEFORE'
          ? 'Photograph every room as you find it, before you clean. TruHost and the owner can see these.'
          : 'Now photograph every room again, cleaned and ready for guests.'}
      </p>
      <ul className="grid grid-cols-2 gap-2.5 @2xl/content:gap-3 @4xl/content:grid-cols-3">
        {c.rooms.map((room) => {
          const photos = phase === 'BEFORE' ? room.before : room.after;
          const flagged = missing?.some((m) => m.roomId === room.id && m.phases.includes(phase)) ?? false;
          return (
            <li
              key={room.id}
              className={cx(
                'flex min-w-0 flex-col gap-2 rounded-inner border p-2.5 @2xl/content:p-3',
                photos.length
                  ? 'border-sage-mid/40 bg-sage-tint/25'
                  : flagged
                    ? 'border-amber-mid bg-amber-tint/30'
                    : 'border-line-soft bg-surface',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="min-w-0 truncate text-sm font-semibold text-ink">{room.displayName}</h4>
                {photos.length > 0 && <span className="sr-only">Done</span>}
              </div>
              <PhotoSlot clean={c} room={room} phase={phase} photos={photos} onUpdated={onUpdated} />
              {phase === 'AFTER' && room.before.at(-1) && (
                <p className="flex items-center gap-2 text-xs text-muted">
                  <img
                    src={room.before.at(-1)!.thumbUrl}
                    alt=""
                    className="size-8 rounded-[6px] object-cover"
                    loading="lazy"
                  />
                  How you found it
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PhotoSlot({
  clean,
  room,
  phase,
  photos,
  onUpdated,
}: {
  clean: Clean;
  room: CleanRoom;
  phase: PhotoPhase;
  photos: CleanPhoto[];
  onUpdated: (c: Clean) => void;
}) {
  const api = useApi();
  const add = useMutation({
    mutationFn: (file: File) => addCleanPhoto(api, clean, room.id, phase, file),
    onSuccess: onUpdated,
  });
  const label = phase === 'BEFORE' ? 'before' : 'after';
  const latest = photos.at(-1);
  const inputId = `photo-${room.id}-${phase}`;
  const can = phase === 'BEFORE' ? clean.can.addPhotos : clean.can.addAfterPhotos;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {latest ? (
        <a
          href={latest.url}
          target="_blank"
          rel="noreferrer"
          className="relative block overflow-hidden rounded-inner border border-line-soft bg-ground"
          aria-label={`${room.displayName}, ${label} photo (opens full size)`}
        >
          <img src={latest.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
          <span className="absolute top-2 left-2 grid size-6 place-items-center rounded-full bg-sage-deep text-white shadow-sm">
            <Check aria-hidden className="size-3.5" />
          </span>
          {photos.length > 1 && (
            <span className="absolute right-2 bottom-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-ink">
              {photos.length} photos
            </span>
          )}
        </a>
      ) : (
        <div className="grid aspect-[4/3] place-items-center rounded-inner border border-dashed border-line bg-ground text-muted">
          <span className="flex flex-col items-center gap-2">
            <span className="grid size-11 place-items-center rounded-full bg-surface shadow-[0_2px_8px_rgb(16_20_18/0.06)] ring-1 ring-line-soft">
              <Camera aria-hidden className="size-5" />
            </span>
            <span className="text-xs font-medium">{phase === 'BEFORE' ? 'As you find it' : 'Clean and ready'}</span>
          </span>
        </div>
      )}
      {can && (
        <>
          <input
            id={inputId}
            type="file"
            accept={CLEAN_PHOTO_ACCEPT}
            capture="environment"
            className="sr-only"
            disabled={add.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) add.mutate(file);
            }}
          />
          <label
            htmlFor={inputId}
            className={cx(
              'inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
              latest ? 'border-line bg-surface text-ink hover:bg-ground' : 'border-primary bg-primary text-primary-ink',
              add.isPending && 'pointer-events-none opacity-60',
            )}
          >
            {/* Narrow tiles drop the icon so the label fits on one line (the empty slot shows a camera anyway). */}
            <Camera aria-hidden className="hidden size-4 shrink-0 @sm/content:block" />
            {add.isPending ? 'Uploading…' : latest ? 'Add another' : 'Take photo'}
            <span className="sr-only">
              {' '}
              ({label}, {room.displayName})
            </span>
          </label>
          {add.error && <p className="text-xs text-danger-deep">{add.error.message}</p>}
        </>
      )}
    </div>
  );
}

/** Step 2: any damage? No moves on; yes asks for a report (what, how bad, photos), done once it's sent. */
function DamageStep({ clean: c, onUpdated }: { clean: Clean; onUpdated: (c: Clean) => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const [reporting, setReporting] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const answer = useMutation({
    mutationFn: (found: boolean) =>
      unwrap(api.POST('/v1/cleans/{id}/damage-check', { params: { path: { id: c.id } }, body: { found } })),
    onSuccess: (data, found) => {
      onUpdated(data);
      if (found && data.checklist.damage.reports.length === 0) setReporting(true);
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: queries.clean(api, c.id).queryKey });
  const { found, reports } = c.checklist.damage;
  const sent = reports.some((r) => r.status !== 'DRAFT');
  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink">Did you find any damage, or anything broken or missing?</p>
      <div role="radiogroup" aria-label="Any damage?" className="grid grid-cols-2 gap-2">
        {[
          { value: false, label: 'No damage' },
          { value: true, label: 'Yes, there’s damage' },
        ].map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={found === o.value}
            disabled={!c.can.checkDamage || answer.isPending || (o.value === false && sent)}
            onClick={() => (found === o.value && o.value ? setReporting(true) : answer.mutate(o.value))}
            className={cx(
              'min-h-12 rounded-inner border px-3 text-sm font-semibold transition-colors disabled:opacity-50',
              found === o.value
                ? o.value
                  ? 'border-danger-deep bg-danger-tint text-danger-deep'
                  : 'border-primary bg-sage-tint/50 text-sage-deep'
                : 'border-line bg-surface text-ink hover:bg-ground',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <ErrorAlert error={answer.error} />

      {found && (
        <div className="flex flex-col gap-3 rounded-inner bg-ground p-3.5">
          <p className="text-sm text-ink">
            {sent
              ? 'Sent to TruHost and the owner. Report anything else you find.'
              : 'Describe what’s damaged and add at least one photo. Sending it tells TruHost and the owner.'}
          </p>
          {reports.length > 0 && (
            <ul className="flex flex-col gap-2">
              {reports.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setViewing(r.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-inner border border-line-soft bg-surface px-3 py-2.5 text-left hover:bg-ground"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{r.title}</span>
                      <span className="block text-xs text-muted">
                        {r.photoCount} photo{r.photoCount === 1 ? '' : 's'}
                        {r.status === 'DRAFT' && ' · not sent yet: open it to add a photo and send'}
                      </span>
                    </span>
                    <Pill tone={STATUS_TONE[r.status]}>{DAMAGE_STATUS_LABELS[r.status]}</Pill>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <Button variant={sent ? 'secondary' : 'primary'} onClick={() => setReporting(true)}>
              <Camera aria-hidden className="size-4" /> {reports.length ? 'Report more damage' : 'Report the damage'}
            </Button>
          </div>
        </div>
      )}

      {reporting && (
        <ReportDamageDialog
          open={reporting}
          onOpenChange={(o) => {
            setReporting(o);
            if (!o) void refresh();
          }}
          properties={[c.property]}
          cleanId={c.id}
          onSent={() => void refresh()}
        />
      )}
      {viewing && (
        <DamageReportDialog
          reportId={viewing}
          open
          onOpenChange={(o) => {
            if (!o) {
              setViewing(null);
              void refresh();
            }
          }}
        />
      )}
    </div>
  );
}

/** Step 3: a level for every supply, then what needs restocking (from the API). It can be counted again. */
function StockStep({ clean: c, onUpdated }: { clean: Clean; onUpdated: (c: Clean) => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const supplies = useQuery(queries.supplies(api, c.property.id));
  const counted = c.checklist.stockCount.done;
  const [levels, setLevels] = useState<Record<string, number>>({});
  const items = supplies.data?.items ?? [];
  // Once counted, the current levels are this clean's count.
  const levelOf = (id: string, current: number | null) => levels[id] ?? (counted ? current : null) ?? undefined;
  const chosen = items.filter((i) => levelOf(i.id, i.levelPct) !== undefined).length;
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/cleans/{id}/stock-count', {
          params: { path: { id: c.id } },
          body: { readings: items.map((i) => ({ supplyItemId: i.id, levelPct: levelOf(i.id, i.levelPct)! })) },
        }),
      ),
    onSuccess: (data) => {
      setLevels({});
      onUpdated(data);
      void qc.invalidateQueries({ queryKey: ['supplies'] });
    },
  });
  const restock = c.checklist.stockCount.restock;

  if (supplies.error) return <ErrorAlert error={supplies.error} />;
  if (!supplies.data) return <p className="text-sm text-muted">Loading the supplies…</p>;
  // With nothing tracked, there's nothing to count (the API counts the step done).
  if (items.length === 0) return <p className="text-muted">No supplies are tracked at this property yet.</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">How much of each is left? Pick a level for every item.</p>
      <ul className="flex flex-col divide-y divide-line-soft">
        {items.map((item) => {
          const value = levelOf(item.id, item.levelPct);
          return (
            <li key={item.id} className="flex flex-col gap-2 py-3 @xl/content:flex-row @xl/content:items-center">
              <span className="min-w-0 flex-1 font-semibold text-ink">{item.name}</span>
              <div role="radiogroup" aria-label={`${item.name} level`} className="grid grid-cols-5 gap-1.5">
                {LEVEL_OPTIONS.map((o) => (
                  <button
                    key={o.pct}
                    type="button"
                    role="radio"
                    aria-checked={value === o.pct}
                    aria-label={o.name}
                    disabled={!c.can.countStock || save.isPending}
                    onClick={() => setLevels((l) => ({ ...l, [item.id]: o.pct }))}
                    className={cx(
                      'min-h-11 min-w-12 rounded-inner border px-2 text-sm font-semibold transition-colors disabled:opacity-50',
                      value === o.pct
                        ? o.pct === 0
                          ? 'border-danger-deep bg-danger-tint text-danger-deep'
                          : 'border-primary bg-primary text-primary-ink'
                        : 'border-line bg-surface text-ink hover:bg-ground',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <ErrorAlert error={save.error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => save.mutate()}
          loading={save.isPending}
          disabled={!c.can.countStock || chosen < items.length || (counted && Object.keys(levels).length === 0)}
        >
          {counted ? 'Save the new count' : 'Save the stock count'}
        </Button>
        <span className="figure text-sm text-muted">
          {chosen} of {items.length} counted
        </span>
      </div>
      {counted && (
        <div className="rounded-inner bg-ground p-3.5">
          <p className="text-sm font-semibold text-ink">
            {restock.length ? 'Needs restocking' : 'Nothing needs restocking'}
          </p>
          {restock.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {restock.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink">{r.name}</span>
                  <Pill tone={r.state === 'OUT' ? 'danger' : 'amber'}>{r.state === 'OUT' ? 'Out' : 'Low'}</Pill>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">TruHost and the owner see these levels.</p>
        </div>
      )}
    </div>
  );
}

/** Step 5: what was done, and "Clean finished", which tells TruHost and the owner the place is ready. */
function FinishStep({
  clean: c,
  onFinish,
  finishing,
  error,
}: {
  clean: Clean;
  onFinish: () => void;
  finishing: boolean;
  error: unknown;
}) {
  const showError = Boolean(error) && !(error instanceof ApiError && error.problem.code === 'CLEAN_MISSING_PHOTOS');
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2.5 rounded-inner bg-sage-tint/40 p-4 text-sm text-ink">
        {[`Before and after photos of ${c.rooms.length} rooms`, damageSummary(c), stockSummary(c)].map((line) => (
          <li key={line} className="flex items-center gap-2.5">
            <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-sage-deep text-white">
              <Check className="size-3" />
            </span>
            {line}
          </li>
        ))}
      </ul>
      {showError && <ErrorAlert error={error} />}
      <Button onClick={onFinish} loading={finishing} disabled={!c.can.complete} className="min-h-12 w-full sm:w-auto">
        <Check aria-hidden className="size-4" /> Clean finished
      </Button>
      <p className="text-xs text-muted">TruHost and the owner will be told {c.property.name} is ready for guests.</p>
    </div>
  );
}

/** A finished clean: each room as found and as left, what was reported, and what needs restocking. */
export function CompletedClean({ clean: c }: { clean: Clean }) {
  const [viewing, setViewing] = useState<string | null>(null);
  const restock = c.checklist.stockCount.restock;
  return (
    <section aria-labelledby="done-heading" className="flex flex-col gap-3">
      <h2 id="done-heading" className="text-lg font-bold text-ink">
        What was done
      </h2>
      <ul className="grid grid-cols-1 gap-3 @xl/content:grid-cols-2">
        {c.rooms.map((room) => (
          <li key={room.id} className="rounded-card border border-line-soft bg-surface p-3.5">
            <h3 className="px-0.5 font-semibold text-ink">{room.displayName}</h3>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {(['BEFORE', 'AFTER'] as const).map((phase) => {
                const photo = (phase === 'BEFORE' ? room.before : room.after).at(-1);
                const label = phase === 'BEFORE' ? 'Before' : 'After';
                return (
                  <figure key={phase} className="relative">
                    {photo ? (
                      <a
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${room.displayName}, ${label.toLowerCase()} photo (opens full size)`}
                        className="block overflow-hidden rounded-inner border border-line-soft bg-ground"
                      >
                        <img src={photo.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
                      </a>
                    ) : (
                      <div className="aspect-[4/3] rounded-inner border border-dashed border-line bg-ground" />
                    )}
                    <figcaption
                      className={cx(
                        'pointer-events-none absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase',
                        phase === 'BEFORE' ? 'bg-white/90 text-ink' : 'bg-sage-deep text-white',
                      )}
                    >
                      {label}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-1 gap-3 @xl/content:grid-cols-2">
        <div className="rounded-card border border-line-soft bg-surface p-4">
          <div className="flex items-center gap-3">
            <DamageAlertIcon size={40} className="shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-ink">Damage</h3>
              <p className="text-sm text-muted">{damageSummary(c)}</p>
            </div>
          </div>
          {c.checklist.damage.reports.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5 border-t border-line-soft pt-3">
              {c.checklist.damage.reports.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setViewing(r.id)}
                    className="flex w-full items-center justify-between gap-2 text-left text-sm text-ink hover:underline"
                  >
                    <span className="truncate">{r.title}</span>
                    <Pill tone={STATUS_TONE[r.status]}>{DAMAGE_STATUS_LABELS[r.status]}</Pill>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-card border border-line-soft bg-surface p-4">
          <div className="flex items-center gap-3">
            <SuppliesIcon size={40} className="shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-ink">Stock count</h3>
              <p className="text-sm text-muted">
                {c.checklist.stockCount.items === 0
                  ? 'No supplies tracked'
                  : restock.length
                    ? 'Needs restocking:'
                    : 'Nothing needs restocking'}
              </p>
            </div>
          </div>
          {restock.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5 border-t border-line-soft pt-3">
              {restock.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink">{r.name}</span>
                  <Pill tone={r.state === 'OUT' ? 'danger' : 'amber'}>{r.state === 'OUT' ? 'Out' : 'Low'}</Pill>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {viewing && <DamageReportDialog reportId={viewing} open onOpenChange={(o) => !o && setViewing(null)} />}
    </section>
  );
}
