import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { DAMAGE_SEVERITY_LABELS, type DamageReportDetail, type DamageSeverity } from '@truhost/shared';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { addDamagePhoto } from '../../lib/damage-photo';
import { todayIso } from '../../lib/dates';
import { channelLabel } from '../../lib/format';
import { parseDollarsToCents } from '../../lib/money';
import { shortDate } from '../../lib/months';
import { queries } from '../../lib/queries';
import { ErrorAlert } from '../ui/alert';
import { Button } from '../ui/button';
import { DatePicker } from '../ui/date-picker';
import { Dialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { Input, Textarea } from '../ui/input';
import { Select } from '../ui/select';
import { PhotoPicker } from './photo-picker';

const SEVERITY_HINT: Record<DamageSeverity, string> = {
  MINOR: 'Cosmetic, or a small item',
  MODERATE: 'Needs a repair or replacement',
  SEVERE: 'Major, or the place can’t be let',
};
const NONE = '';

/**
 * Report damage: what, how bad, the day it was found, where, the stay believed responsible (for the claim), an
 * estimate, and photos (at least one). Sending saves a draft, uploads the photos one by one, then sends it; if any
 * step fails, trying again carries on from there rather than starting over.
 */
export function ReportDamageDialog({
  open,
  onOpenChange,
  properties,
  initialPropertyId,
  cleanId,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where the caller can report. With one, there's no property question. */
  properties: { id: string; name: string }[];
  initialPropertyId?: string;
  /** Reported from a clean's checklist: the report is linked to it (and answers its damage question yes). */
  cleanId?: string;
  onSent?: (report: DamageReportDetail) => void;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const [propertyId, setPropertyId] = useState(initialPropertyId ?? properties[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<DamageSeverity>('MODERATE');
  const [foundOn, setFoundOn] = useState(todayIso());
  const [roomId, setRoomId] = useState(NONE);
  const [stayId, setStayId] = useState<string | null>(null);
  const [cost, setCost] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  // Progress through sending, kept so a retry resumes: the draft once created, and how many photos are on it.
  const [draft, setDraft] = useState<{ id: string; propertyId: string } | null>(null);
  const [uploaded, setUploaded] = useState(0);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [touched, setTouched] = useState(false);

  const rooms = useQuery({ ...queries.rooms(api, propertyId), enabled: open && Boolean(propertyId) });
  const stays = useQuery({ ...queries.damageStays(api, propertyId, foundOn), enabled: open && Boolean(propertyId) });
  // Until someone picks, the most recent stay (the one that just checked out) is the likely one.
  const stayChoice = stayId ?? stays.data?.items[0]?.id ?? NONE;
  const costCents = cost.trim() ? parseDollarsToCents(cost) : null;
  const problems = {
    title: !title.trim() ? 'Say what’s damaged' : undefined,
    description: !description.trim() ? 'Describe the damage' : undefined,
    photos: photos.length === 0 ? 'Add at least one photo of the damage' : undefined,
    cost: cost.trim() && costCents === null ? 'Enter an amount like 250 or 249.99' : undefined,
  };
  const valid = !Object.values(problems).some(Boolean);
  const busy = step !== null;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || busy) return;
    setError(null);
    try {
      let report = draft;
      if (!report) {
        setStep('Saving the report…');
        const created = await unwrap(
          api.POST('/v1/properties/{id}/damage-reports', {
            params: { path: { id: propertyId } },
            body: {
              title: title.trim(),
              description: description.trim(),
              severity,
              discoveredOn: foundOn,
              bookingId: stayChoice || null,
              roomId: roomId || null,
              estimatedCostCents: costCents,
              cleanId: cleanId ?? null,
            },
          }),
        );
        report = { id: created.id, propertyId };
        setDraft(report);
      }
      for (let i = uploaded; i < photos.length; i++) {
        setStep(`Uploading photo ${i + 1} of ${photos.length}…`);
        await addDamagePhoto(api, report, photos[i]!);
        setUploaded(i + 1);
      }
      setStep('Sending…');
      const sent = await unwrap(api.POST('/v1/damage-reports/{id}/submit', { params: { path: { id: report.id } } }));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['damage'] }),
        qc.invalidateQueries({ queryKey: ['me', 'notifications'] }),
      ]);
      onSent?.(sent);
      onOpenChange(false);
    } catch (err) {
      setError(err);
      // A saved draft shows on the list too, so nothing is lost if they give up here.
      void qc.invalidateQueries({ queryKey: ['damage'] });
    } finally {
      setStep(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      size="lg"
      title="Report damage"
      description="For a claim with the booking site: what happened, when, after which stay, with photos."
    >
      <form onSubmit={send} noValidate className="@container/content flex flex-col gap-5">
        {properties.length > 1 && (
          <Field label="Property">
            <Select
              value={propertyId}
              disabled={busy || draft !== null}
              onValueChange={(v) => {
                setPropertyId(v);
                setRoomId(NONE);
                setStayId(null);
              }}
              options={properties.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
        )}
        <Field label="What’s damaged" error={touched ? problems.title : undefined} required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. Wine stain on the sofa"
            disabled={busy || draft !== null}
          />
        </Field>
        <Field label="What happened" error={touched ? problems.description : undefined} required>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
            rows={4}
            placeholder="Where it is, how big, anything the guest said or left behind…"
            disabled={busy || draft !== null}
          />
        </Field>
        <fieldset disabled={busy || draft !== null}>
          <legend className="mb-1.5 text-sm font-semibold text-ink">How bad</legend>
          <div role="radiogroup" aria-label="How bad" className="grid grid-cols-1 gap-2 @md/content:grid-cols-3">
            {(['MINOR', 'MODERATE', 'SEVERE'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={severity === s}
                onClick={() => setSeverity(s)}
                className={cx(
                  'flex flex-col items-start rounded-inner border px-3.5 py-2.5 text-left transition-colors',
                  severity === s
                    ? 'border-primary bg-sage-tint/40 ring-1 ring-primary'
                    : 'border-line bg-surface hover:bg-ground',
                )}
              >
                <span className="font-semibold text-ink">{DAMAGE_SEVERITY_LABELS[s]}</span>
                <span className="text-xs text-muted">{SEVERITY_HINT[s]}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-1 gap-4 @md/content:grid-cols-2">
          <Field label="Found on">
            <DatePicker
              value={foundOn}
              onChange={(v) => {
                setFoundOn(v);
                setStayId(null);
              }}
              max={todayIso()}
              disabled={busy || draft !== null}
            />
          </Field>
          <Field label="Where" hint="Optional">
            <Select
              value={roomId}
              onValueChange={setRoomId}
              disabled={busy || draft !== null}
              options={[
                { value: NONE, label: 'Not a particular room' },
                ...(rooms.data?.items ?? []).map((r) => ({ value: r.id, label: r.displayName })),
              ]}
            />
          </Field>
        </div>
        <Field
          label="The stay"
          hint={
            stays.data && stays.data.items.length === 0
              ? 'No guest stays around that day.'
              : 'The guests believed responsible: the claim is made against their stay.'
          }
        >
          <Select
            value={stayChoice}
            onValueChange={(v) => setStayId(v)}
            disabled={busy || draft !== null || !stays.data}
            options={[
              ...(stays.data?.items ?? []).map((s) => ({
                value: s.id,
                label: `${s.guestName ?? 'Guest'} · ${shortDate(s.checkInDate)} → ${shortDate(s.checkOutDate)} · ${channelLabel(s.channel)}`,
              })),
              { value: NONE, label: 'Not linked to a stay' },
            ]}
          />
        </Field>
        <Field
          label="Estimated cost"
          hint="Optional: to repair or replace it"
          error={touched ? problems.cost : undefined}
        >
          <Input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            inputMode="decimal"
            placeholder="$0.00"
            className="max-w-48"
            disabled={busy || draft !== null}
          />
        </Field>
        <Field label="Photos" error={touched ? problems.photos : undefined} required>
          <PhotoPicker files={photos} onChange={setPhotos} done={uploaded} disabled={busy} />
        </Field>
        <ErrorAlert error={error} />
        <div className="flex flex-wrap items-center justify-end gap-3">
          {step && (
            <p role="status" className="mr-auto text-sm text-muted">
              {step}
            </p>
          )}
          <Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {draft ? 'Try sending again' : 'Send report'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
