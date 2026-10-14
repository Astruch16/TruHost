import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import {
  DAMAGE_SEVERITY_LABELS,
  DAMAGE_STATUS_LABELS,
  type DamageReportDetail,
  type SetDamageStatus,
} from '@truhost/shared';
import { Camera, ExternalLink } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { claimWindow, damageTimeline, SEVERITY_TONE, STATUS_TONE } from '../../lib/damage';
import { addDamagePhoto, DAMAGE_PHOTO_ACCEPT } from '../../lib/damage-photo';
import { todayIso } from '../../lib/dates';
import { channelLabel } from '../../lib/format';
import { formatCents } from '../../lib/money';
import { shortDate } from '../../lib/months';
import { queries } from '../../lib/queries';
import { ErrorAlert } from '../ui/alert';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { Input, Textarea } from '../ui/input';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';

const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * One damage report: its photos (each opens full size), what was reported, the claim window, and where it stands.
 * What the caller can do comes from the API (`can`): add photos, send a draft, or (admins) move it on.
 */
export function DamageReportDialog({
  reportId,
  open,
  onOpenChange,
}: {
  reportId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const report = useQuery({ ...queries.damageReport(useApi(), reportId), enabled: open });
  const r = report.data;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={r ? r.title : 'Damage report'}
      description={r ? `${r.property.name} · found ${shortDate(r.discoveredOn)}` : undefined}
    >
      {report.error ? (
        <ErrorAlert error={report.error} />
      ) : !r ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading the report">
          <Skeleton className="h-28" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <ReportBody report={r} />
      )}
    </Dialog>
  );
}

function ReportBody({ report: r }: { report: DamageReportDetail }) {
  const window = claimWindow(r, todayIso());
  return (
    <div className="@container/content flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <Pill tone={STATUS_TONE[r.status]}>{DAMAGE_STATUS_LABELS[r.status]}</Pill>
        <Pill tone={SEVERITY_TONE[r.severity]}>{DAMAGE_SEVERITY_LABELS[r.severity]}</Pill>
      </div>
      {window && r.claimDeadline && (
        <p
          className={cx(
            'rounded-inner px-4 py-3 text-sm',
            window.closed
              ? 'bg-ground text-muted'
              : window.urgent
                ? 'bg-danger-tint text-danger-deep'
                : 'bg-amber-tint text-amber-deep',
          )}
        >
          {window.closed ? (
            <>The AirCover claim window closed on {shortDate(r.claimDeadline)}.</>
          ) : (
            <>
              <strong>{window.label}.</strong> File the AirCover claim by {shortDate(r.claimDeadline)} (14 days after
              checkout).
            </>
          )}
        </p>
      )}

      <section aria-label="Photos">
        {r.photos.length === 0 ? (
          <p className="rounded-inner bg-ground px-4 py-3 text-sm text-muted">No photos yet.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 @md/content:grid-cols-4">
            {r.photos.map((p, i) => (
              <li key={p.id}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative block aspect-square overflow-hidden rounded-inner bg-ground"
                  aria-label={`Open photo ${i + 1} full size`}
                >
                  <img
                    src={p.thumbUrl}
                    alt=""
                    className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                  />
                  <ExternalLink
                    aria-hidden
                    className="absolute right-1.5 bottom-1.5 size-6 rounded-full bg-white/85 p-1 text-ink opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}
        {r.can.addPhotos && <AddPhotos report={r} />}
      </section>

      <p className="text-sm whitespace-pre-line text-ink">{r.description}</p>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm @md/content:grid-cols-2">
        <Fact label="Found on">{shortDate(r.discoveredOn)}</Fact>
        <Fact label="Where">{r.room?.displayName ?? 'Not a particular room'}</Fact>
        <Fact label="The stay">
          {r.booking
            ? `${r.booking.guestName ?? 'Guest'} · ${shortDate(r.booking.checkInDate)} → ${shortDate(r.booking.checkOutDate)} · ${channelLabel(r.booking.channel)}`
            : 'Not linked to a stay'}
        </Fact>
        <Fact label="Reported by">
          {r.reportedBy.firstName} {r.reportedBy.lastName}
          {r.submittedAt ? `, ${when(r.submittedAt)}` : ' (draft)'}
        </Fact>
        <Fact label="Estimated cost">{r.estimatedCostCents === null ? '—' : formatCents(r.estimatedCostCents)}</Fact>
        {r.claimReference && <Fact label="Claim reference">{r.claimReference}</Fact>}
      </dl>

      {r.status !== 'DRAFT' && (
        <ol aria-label="Progress" className="flex flex-col gap-0 @md/content:flex-row @md/content:gap-2">
          {damageTimeline(r).map((s, i) => (
            <li key={s.key} className="flex flex-1 items-center gap-2.5 py-1">
              <span
                aria-hidden
                className={cx(
                  'grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold',
                  s.at ? 'bg-sage-mid text-white' : 'bg-line-soft text-muted',
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className={cx('block text-sm font-semibold', s.at ? 'text-ink' : 'text-muted')}>{s.label}</span>
                <span className="block text-xs text-muted">{s.at ? when(s.at) : 'Not yet'}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {r.resolutionNote && (
        <p className="rounded-inner bg-sage-tint/50 px-4 py-3 text-sm text-sage-deep">{r.resolutionNote}</p>
      )}

      {r.can.submit && <SendDraft report={r} />}
      {r.can.manage && r.status !== 'DRAFT' && r.status !== 'RESOLVED' && <NextStep report={r} />}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

/** Adds photos to a report straight away (each uploaded and attached in turn). */
function AddPhotos({ report }: { report: DamageReportDetail }) {
  const api = useApi();
  const qc = useQueryClient();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const add = async (files: File[]) => {
    setError(null);
    try {
      for (const [i, file] of files.entries()) {
        setProgress(`Uploading photo ${i + 1} of ${files.length}…`);
        await addDamagePhoto(api, { id: report.id, propertyId: report.property.id }, file);
      }
    } catch (e) {
      setError(e);
    } finally {
      setProgress(null);
      await qc.invalidateQueries({ queryKey: ['damage'] });
    }
  };
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={cx(
            'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-3.5 text-sm font-semibold text-ink hover:bg-ground',
            progress && 'pointer-events-none opacity-60',
          )}
        >
          <Camera aria-hidden className="size-4" /> Add photos
          <input
            type="file"
            accept={DAMAGE_PHOTO_ACCEPT}
            multiple
            className="sr-only"
            disabled={progress !== null}
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              if (files.length) void add(files);
            }}
          />
        </label>
        {progress && (
          <span role="status" className="text-sm text-muted">
            {progress}
          </span>
        )}
      </div>
      <ErrorAlert error={error} />
    </div>
  );
}

/** A draft (e.g. one whose sending was interrupted): send it once it has a photo. */
function SendDraft({ report }: { report: DamageReportDetail }) {
  const api = useApi();
  const qc = useQueryClient();
  const send = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/damage-reports/{id}/submit', { params: { path: { id: report.id } } })),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['damage'] }),
        qc.invalidateQueries({ queryKey: ['me', 'notifications'] }),
      ]),
  });
  return (
    <div className="flex flex-col gap-2 rounded-inner border border-dashed border-line p-4">
      <p className="text-sm text-ink">
        This is still a draft: only you and TruHost can see it.{' '}
        {report.photoCount === 0 ? 'Add a photo, then send it.' : 'Send it to tell TruHost and the owner.'}
      </p>
      <ErrorAlert error={send.error} />
      <div>
        <Button onClick={() => send.mutate()} loading={send.isPending} disabled={report.photoCount === 0}>
          Send report
        </Button>
      </div>
    </div>
  );
}

/** Admins: the report's next step (acknowledge, claim filed with its reference, resolved with a note). */
function NextStep({ report }: { report: DamageReportDetail }) {
  const api = useApi();
  const qc = useQueryClient();
  const [reference, setReference] = useState(report.claimReference ?? '');
  const [note, setNote] = useState('');
  const move = useMutation({
    mutationFn: (body: SetDamageStatus) =>
      unwrap(api.POST('/v1/damage-reports/{id}/status', { params: { path: { id: report.id } }, body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['damage'] }),
  });
  const claimed = report.status === 'CLAIM_FILED';
  return (
    <section aria-label="Next step" className="flex flex-col gap-4 rounded-inner bg-ground p-4">
      <p className="text-sm font-semibold text-ink">Next step</p>
      {report.status === 'SUBMITTED' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Let the reporter know it’s been seen.</p>
          <Button variant="secondary" onClick={() => move.mutate({ status: 'ACKNOWLEDGED' })} loading={move.isPending}>
            Acknowledge
          </Button>
        </div>
      )}
      {!claimed && (
        <div className="grid grid-cols-1 gap-3 @md/content:grid-cols-[minmax(0,1fr)_auto] @md/content:items-end">
          <Field label="Claim reference" hint="The case number from Airbnb, Vrbo or the booking site">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
          </Field>
          <Button
            variant="secondary"
            className="@md/content:mb-[1.625rem]"
            loading={move.isPending}
            onClick={() => move.mutate({ status: 'CLAIM_FILED', claimReference: reference.trim() || null })}
          >
            Mark claim filed
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 @md/content:grid-cols-[minmax(0,1fr)_auto] @md/content:items-end">
        <Field label="How it ended" hint="e.g. what the claim paid, or that it was repaired at cost">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} />
        </Field>
        <Button
          className="@md/content:mb-[1.625rem]"
          loading={move.isPending}
          onClick={() => move.mutate({ status: 'RESOLVED', resolutionNote: note.trim() || null })}
        >
          Resolve
        </Button>
      </div>
      <ErrorAlert error={move.error} />
    </section>
  );
}
