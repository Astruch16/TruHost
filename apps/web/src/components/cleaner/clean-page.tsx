import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, unwrap } from '@truhost/api-client';
import {
  CLEAN_STATUS_LABELS,
  type Clean,
  type CleanPhoto,
  type CleanRoom,
  type MissingCleanPhotos,
  type PhotoPhase,
} from '@truhost/shared';
import { ArrowLeft, Camera, Check, Clock, DoorOpen, Play } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { addCleanPhoto, CLEAN_PHOTO_ACCEPT } from '../../lib/clean-photo';
import { CLEAN_STATUS_TONE, cleanOccasion, freeFrom, readyBy } from '../../lib/cleans';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { formatCents } from '../../lib/money';
import { queries } from '../../lib/queries';
import { NotAvailable } from '../shell/not-available';
import { SuppliesCard } from '../supplies/supplies-card';
import { ErrorAlert } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';
import { SuccessNotice } from '../ui/success-notice';

/**
 * One clean, as its cleaner works it on a phone: when the place is free and when it must be ready, then (once started
 * on its day) every room's BEFORE and AFTER photos taken with the camera, the supplies check, and completing, which
 * needs every photo. Completing is a milestone: the celebrating guide.
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
      <div role="status" aria-label="Loading the clean" className="flex flex-col gap-4">
        <Skeleton className="h-10 w-2/3 rounded-inner" />
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }
  const c = query.data;
  const from = freeFrom(c);
  const allDone = c.progress.rooms > 0 && c.progress.done === c.progress.rooms;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link
        to="/cleaner"
        className="inline-flex w-fit items-center gap-1.5 rounded-control text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" /> Your schedule
      </Link>

      {justCompleted && c.status === 'COMPLETE' && (
        <SuccessNotice title="Clean complete. Nice work.">
          All {c.progress.rooms} rooms photographed. TruHost can see it’s done.
        </SuccessNotice>
      )}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
            {dayLabel(c.scheduledDate)} · {cleanOccasion(c)}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink @2xl/content:text-3xl">{c.property.name}</h1>
          <p className="mt-0.5 text-muted">{c.property.city}</p>
        </div>
        <Pill tone={CLEAN_STATUS_TONE[c.status]}>{CLEAN_STATUS_LABELS[c.status]}</Pill>
      </header>

      <Card>
        <dl className="grid grid-cols-2 gap-4 @xl/content:grid-cols-[1fr_1fr_auto]">
          <Fact
            icon={<DoorOpen className="size-4" />}
            label="Free from"
            value={from ? from.replace('Free from ', '') : 'Any time'}
          />
          <Fact
            icon={<Clock className="size-4" />}
            label="Ready by"
            value={readyBy(c).replace('Ready by ', '')}
            strong
          />
          {/* Pay, once TruHost has set it (a clean at $0 means it hasn't been). */}
          {c.cleanerPayCents ? <Fact label="You earn" value={formatCents(c.cleanerPayCents)} figure /> : null}
        </dl>
        {c.notes && <p className="mt-4 rounded-inner bg-ground px-3.5 py-3 text-sm text-ink">{c.notes}</p>}
      </Card>

      {c.status === 'SCHEDULED' && (
        <Card>
          {c.can.start ? (
            <div className="flex flex-col gap-3">
              <p className="text-ink">
                When you arrive, start the clean. Then photograph every room <strong>before</strong> you clean it and{' '}
                <strong>after</strong>.
              </p>
              <ErrorAlert error={start.error} />
              <Button onClick={() => start.mutate()} loading={start.isPending} className="min-h-12 w-full sm:w-auto">
                <Play aria-hidden className="size-4" /> Start the clean
              </Button>
            </div>
          ) : (
            <p className="text-muted">
              {c.assignedCleaner
                ? c.scheduledDate > c.today
                  ? `You can start this clean on ${dayLabel(c.scheduledDate)}.`
                  : `This clean was for ${dayLabel(c.scheduledDate)} and can’t be started now. Ask TruHost if it still needs doing.`
                : 'No one is assigned to this clean yet.'}
            </p>
          )}
        </Card>
      )}

      {c.status === 'CANCELLED' && (
        <Card>
          <p className="font-semibold text-ink">This clean was cancelled.</p>
          {c.cancelReason && <p className="mt-1 text-muted">{c.cancelReason}</p>}
        </Card>
      )}

      {(c.status === 'IN_PROGRESS' || c.status === 'COMPLETE') && (
        <>
          <section aria-labelledby="rooms-heading" className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <h2 id="rooms-heading" className="text-lg font-bold text-ink">
                Rooms
              </h2>
              <p className="figure text-sm font-semibold text-muted">
                {c.progress.done} of {c.progress.rooms} done
              </p>
            </div>
            <div aria-hidden className="h-2 overflow-hidden rounded-full bg-line">
              <div
                className={cx(
                  'h-full rounded-full transition-[width] duration-500',
                  allDone ? 'bg-sage-mid' : 'bg-amber-mid',
                )}
                style={{ width: `${c.progress.rooms ? (c.progress.done / c.progress.rooms) * 100 : 0}%` }}
              />
            </div>
            {c.rooms.length === 0 ? (
              <Card>
                <p className="text-muted">This property has no rooms set up yet. Ask TruHost to add them.</p>
              </Card>
            ) : (
              <ol className="flex flex-col gap-3">
                {c.rooms.map((room, i) => (
                  <RoomCard
                    key={room.id}
                    clean={c}
                    room={room}
                    index={i}
                    highlight={missing?.some((m) => m.roomId === room.id) ?? false}
                    onUpdated={store}
                  />
                ))}
              </ol>
            )}
          </section>

          {c.status === 'IN_PROGRESS' && (
            <>
              <section aria-label="Supplies check">
                <SuppliesCard propertyId={c.property.id} mode="report" />
              </section>
              <Card title="Finish up" description="Once every room has its before and after photos.">
                <div className="flex flex-col gap-3">
                  {missing && missing.length > 0 && (
                    <div role="alert" className="rounded-inner bg-amber-tint px-3.5 py-3 text-sm text-amber-deep">
                      <p className="font-semibold">Still missing:</p>
                      <ul className="mt-1 list-disc pl-5">
                        {missing.map((m) => (
                          <li key={m.roomId}>
                            {m.displayName}: {m.phases.map((p) => (p === 'BEFORE' ? 'before' : 'after')).join(' and ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {complete.error && !missing && <ErrorAlert error={complete.error} />}
                  <Button
                    onClick={() => complete.mutate()}
                    loading={complete.isPending}
                    className="min-h-12 w-full sm:w-auto"
                  >
                    <Check aria-hidden className="size-4" /> Complete the clean
                  </Button>
                  {!allDone && (
                    <p className="text-xs text-muted">
                      {c.progress.rooms - c.progress.done} room{c.progress.rooms - c.progress.done === 1 ? '' : 's'}{' '}
                      still need photos.
                    </p>
                  )}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
  strong = false,
  figure = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  strong?: boolean;
  figure?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
        {icon && <span aria-hidden>{icon}</span>}
        {label}
      </dt>
      <dd className={cx('mt-1 text-lg text-ink', (strong || figure) && 'font-bold', figure && 'figure')}>{value}</dd>
    </div>
  );
}

/** A room on the checklist: its BEFORE and AFTER photos, each with a camera button while the clean is under way. */
function RoomCard({
  clean,
  room,
  index,
  highlight,
  onUpdated,
}: {
  clean: Clean;
  room: CleanRoom;
  index: number;
  highlight: boolean;
  onUpdated: (c: Clean) => void;
}) {
  const done = room.before.length > 0 && room.after.length > 0;
  return (
    <li
      className={cx(
        'rounded-card border bg-surface p-4 @2xl/content:p-5',
        done ? 'border-sage-mid/40' : highlight ? 'border-amber-mid' : 'border-line-soft',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cx(
            'figure grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold',
            done ? 'bg-sage-deep text-white' : 'bg-ground text-muted',
          )}
        >
          {done ? <Check className="size-4" /> : index + 1}
        </span>
        <h3 className="min-w-0 flex-1 truncate font-semibold text-ink">{room.displayName}</h3>
        {done && <span className="text-xs font-semibold text-sage-deep">Done</span>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <PhotoSlot clean={clean} room={room} phase="BEFORE" photos={room.before} onUpdated={onUpdated} />
        <PhotoSlot clean={clean} room={room} phase="AFTER" photos={room.after} onUpdated={onUpdated} />
      </div>
    </li>
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
  const label = phase === 'BEFORE' ? 'Before' : 'After';
  const latest = photos.at(-1);
  const inputId = `photo-${room.id}-${phase}`;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="flex items-center justify-between text-xs font-semibold tracking-[0.08em] text-muted uppercase">
        {label}
        {photos.length > 1 && <span className="tracking-normal normal-case">{photos.length} photos</span>}
      </p>
      {latest ? (
        <a
          href={latest.url}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-inner border border-line-soft bg-ground"
          aria-label={`${room.displayName}, ${label.toLowerCase()} photo (opens full size)`}
        >
          <img src={latest.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
        </a>
      ) : (
        <div className="grid aspect-[4/3] place-items-center rounded-inner border border-dashed border-line bg-ground text-muted">
          <Camera aria-hidden className="size-6" />
        </div>
      )}
      {clean.can.addPhotos && (
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
              'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors',
              latest ? 'border-line bg-surface text-ink hover:bg-ground' : 'border-primary bg-primary text-primary-ink',
              add.isPending && 'pointer-events-none opacity-60',
            )}
          >
            <Camera aria-hidden className="size-4" />
            {add.isPending ? 'Uploading…' : latest ? 'Another' : `Take ${label.toLowerCase()} photo`}
          </label>
          {add.error && <p className="text-xs text-danger-deep">{add.error.message}</p>}
        </>
      )}
    </div>
  );
}
