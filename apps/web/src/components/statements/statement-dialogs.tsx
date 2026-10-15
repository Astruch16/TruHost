import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { ExternalLink } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import type { Statement } from '../../lib/api-types';
import { cx } from '../../lib/cx';
import { todayIso } from '../../lib/dates';
import { fieldErrors } from '../../lib/errors';
import { channelLabel } from '../../lib/format';
import { formatCents, parseDollarsToCents } from '../../lib/money';
import { addMonths, monthLabel } from '../../lib/months';
import { stayDates } from '../../lib/statements';
import { ErrorAlert } from '../ui/alert';
import { Button } from '../ui/button';
import { DatePicker } from '../ui/date-picker';
import { Dialog } from '../ui/dialog';
import { Field } from '../ui/field';
import { Input, Textarea } from '../ui/input';
import { Select } from '../ui/select';
import { Skeleton } from '../ui/skeleton';

type Done = (statement: Statement) => void;

/**
 * Finalize: says what locking the month means, and when stays are still waiting on their payout, lists them and asks
 * for an explicit confirmation that they go in at $0.
 */
export function FinalizeDialog({
  statement: s,
  open,
  onOpenChange,
  onDone,
}: {
  statement: Statement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: Done;
}) {
  const api = useApi();
  const [confirmed, setConfirmed] = useState(false);
  const pending = s.pendingPayouts;
  const finalize = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/statements/{id}/finalize', {
          params: { path: { id: s.id } },
          body: { confirmPendingPayouts: pending.length > 0 && confirmed },
        }),
      ),
    onSuccess: onDone,
  });
  const month = monthLabel(s.month);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !finalize.isPending && onOpenChange(next)}
      title={`Finalize ${month} for ${s.property.name}?`}
      description={`The statement is copied as it stands and ${month}’s bookings and expenses are locked. Later corrections go on ${monthLabel(addMonths(s.month, 1))}’s statement as adjustments.`}
      size="md"
      footer={
        <>
          <Button variant="secondary" disabled={finalize.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={finalize.isPending}
            disabled={pending.length > 0 && !confirmed}
            onClick={() => finalize.mutate()}
          >
            Finalize statement
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-inner bg-ground px-4 py-3">
          <span className="text-sm font-semibold text-ink">Net to owner</span>
          <span className="figure text-xl font-bold text-ink">{formatCents(s.totals.netCents)}</span>
        </div>
        {pending.length > 0 && (
          <div className="rounded-inner border border-amber-light bg-amber-tint px-4 py-3 text-sm text-amber-deep">
            <p className="font-semibold">
              {pending.length === 1 ? 'One stay is' : `${pending.length} stays are`} still waiting on a payout
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {pending.map((p) => (
                <li key={p.bookingId} className="text-ink">
                  {stayDates(p.checkInDate, p.checkOutDate)} · {channelLabel(p.channel)}
                  {p.guestName ? ` · ${p.guestName}` : ''}
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-start gap-2.5 text-ink">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--color-primary)]"
              />
              <span>
                Finalize with {pending.length === 1 ? 'it' : 'them'} at $0. A payout that arrives later goes on a later
                statement as an adjustment.
              </span>
            </label>
          </div>
        )}
        <ErrorAlert error={finalize.error} />
      </div>
    </Dialog>
  );
}

/** Release: the day the money was sent and its reference; the PDF is generated and stored at this moment. */
export function ReleaseDialog({
  statement: s,
  open,
  onOpenChange,
  onDone,
}: {
  statement: Statement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: Done;
}) {
  const api = useApi();
  const today = todayIso();
  const [releasedOn, setReleasedOn] = useState(today);
  const [reference, setReference] = useState('');
  const release = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/statements/{id}/release', {
          params: { path: { id: s.id } },
          body: { releasedOn, paymentReference: reference.trim() || null },
        }),
      ),
    onSuccess: onDone,
  });
  const errors = fieldErrors(release.error);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    release.mutate();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !release.isPending && onOpenChange(next)}
      title="Release payout"
      description={`Record the payment for ${s.property.name}’s ${monthLabel(s.month)} statement. The PDF is generated and stored now, and the statement can’t change after this.`}
      size="md"
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="rounded-inner bg-primary px-4 py-3 text-primary-ink">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary-ink-muted uppercase">Pay the owner</p>
          <p className="figure text-2xl font-bold">{formatCents(s.totals.netCents)}</p>
        </div>
        <Field label="Paid on" error={errors.releasedOn} required hint="The day you sent the e-Transfer or deposit.">
          <DatePicker value={releasedOn} onChange={setReleasedOn} max={today} min={`${addMonths(s.month, 1)}-01`} />
        </Field>
        <Field
          label="Payment reference"
          error={errors.paymentReference}
          hint="Optional: the e-Transfer or bank reference."
        >
          <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} autoComplete="off" />
        </Field>
        <ErrorAlert error={Object.keys(errors).length ? null : release.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={release.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={release.isPending} disabled={!releasedOn}>
            Release payout
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Add an adjustment to a draft: which way, how much, why, and optionally which earlier month it corrects. */
export function AdjustmentDialog({
  statement: s,
  open,
  onOpenChange,
  onDone,
  initialCorrects = '',
}: {
  statement: Statement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: Done;
  initialCorrects?: string;
}) {
  const api = useApi();
  const [direction, setDirection] = useState<'credit' | 'charge'>('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [corrects, setCorrects] = useState(initialCorrects);
  const [localError, setLocalError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: (amountCents: number) =>
      unwrap(
        api.POST('/v1/statements/{id}/adjustments', {
          params: { path: { id: s.id } },
          body: { amountCents, reason: reason.trim(), correctsStatementId: corrects || null },
        }),
      ),
    onSuccess: onDone,
  });
  const errors = fieldErrors(add.error);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseDollarsToCents(amount);
    if (cents === null || cents === 0) {
      setLocalError('Enter an amount like 42 or 42.50');
      return;
    }
    setLocalError(null);
    add.mutate(direction === 'credit' ? cents : -cents);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !add.isPending && onOpenChange(next)}
      title="Add adjustment"
      description={`A line on ${s.property.name}’s ${monthLabel(s.month)} statement. It changes the net directly (no fee is taken on it), so enter exactly what the owner should gain or pay.`}
      size="md"
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Direction" className="grid grid-cols-2 gap-2">
          {(
            [
              ['credit', 'Pay the owner more', 'e.g. a late payout'],
              ['charge', 'Charge the owner', 'e.g. a missed expense'],
            ] as const
          ).map(([key, label, note]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={direction === key}
              onClick={() => setDirection(key)}
              className={cx(
                'rounded-inner border px-3.5 py-3 text-left transition-colors',
                direction === key ? 'border-primary bg-sage-tint ring-1 ring-primary' : 'border-line hover:bg-ground',
              )}
            >
              <span className="block text-sm font-semibold text-ink">{label}</span>
              <span className="block text-xs text-muted">{note}</span>
            </button>
          ))}
        </div>
        <Field label="Amount ($)" error={localError ?? errors.amountCents} required>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="figure" />
        </Field>
        <Field label="Reason" error={errors.reason} required hint="Shown to the owner on the statement.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} />
        </Field>
        {s.correctable.length > 0 && (
          <Field label="Corrects" hint="The finalized month this fixes, if any.">
            <Select
              value={corrects}
              onValueChange={setCorrects}
              options={[
                { value: '', label: 'Not a correction' },
                ...s.correctable.map((c) => ({ value: c.id, label: monthLabel(c.month) })),
              ]}
            />
          </Field>
        )}
        <ErrorAlert error={Object.keys(errors).length ? null : add.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={add.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={add.isPending} disabled={!amount.trim() || !reason.trim()}>
            Add adjustment
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Void an adjustment on a draft, with a reason (it stays listed, struck through). */
export function VoidAdjustmentDialog({
  adjustment,
  open,
  onOpenChange,
  onDone,
}: {
  adjustment: Statement['adjustments'][number];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: Done;
}) {
  const api = useApi();
  const [reason, setReason] = useState('');
  const voidIt = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/adjustments/{id}/void', {
          params: { path: { id: adjustment.id } },
          body: { reason: reason.trim() },
        }),
      ),
    onSuccess: onDone,
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !voidIt.isPending && onOpenChange(next)}
      title="Void adjustment"
      description={`“${adjustment.reason}” comes off the statement. It stays listed as voided, with your reason.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" disabled={voidIt.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="danger-solid"
            loading={voidIt.isPending}
            disabled={!reason.trim()}
            onClick={() => voidIt.mutate()}
          >
            Void adjustment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Reason" required>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoComplete="off" />
        </Field>
        <ErrorAlert error={voidIt.error} />
      </div>
    </Dialog>
  );
}

/**
 * The PDF as it would print now (draft or finalized), fetched from the API and shown in the dialog, with a way to
 * open it in a tab (phones often can't show a PDF inline).
 */
export function PdfPreviewDialog({
  statement: s,
  open,
  onOpenChange,
}: {
  statement: Statement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const api = useApi();
  // Fetched fresh each time the dialog opens (a draft's figures move), and dropped when it closes.
  const preview = useQuery({
    queryKey: ['statements', 'preview', s.id],
    queryFn: async () =>
      new Blob(
        [
          (await unwrap(
            api.GET('/v1/statements/{id}/preview', { params: { path: { id: s.id } }, parseAs: 'blob' }),
          )) as BlobPart,
        ],
        { type: 'application/pdf' },
      ),
    enabled: open,
    gcTime: 0,
    staleTime: 0,
  });
  const url = useMemo(() => (preview.data ? URL.createObjectURL(preview.data) : null), [preview.data]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  const error = preview.error;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="PDF preview"
      description={
        s.status === 'DRAFT'
          ? 'As it would print now. A draft’s figures change with the month’s records until it’s finalized.'
          : 'As it will print. The PDF is stored when you release the payout.'
      }
      size="xl"
    >
      <div className="flex flex-col gap-3">
        <ErrorAlert error={error} />
        {url ? (
          <>
            <iframe
              title={`${s.property.name} statement preview`}
              src={url}
              className="h-[70dvh] w-full rounded-inner border border-line bg-ground"
            />
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 self-end text-sm font-semibold text-primary hover:underline"
            >
              Open in a new tab <ExternalLink aria-hidden className="size-4" />
            </a>
          </>
        ) : (
          !error && <Skeleton className="h-[70dvh] w-full rounded-inner" />
        )}
      </div>
    </Dialog>
  );
}
