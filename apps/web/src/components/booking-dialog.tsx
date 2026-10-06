import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { Booking } from '../lib/api-types';
import { useApi } from '../lib/api-context';
import { fieldErrors } from '../lib/errors';
import { CHANNELS, channelLabel, kindLabel } from '../lib/format';
import { centsToInput, parseDollarsToCents } from '../lib/money';
import { ErrorAlert } from './ui/alert';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Field } from './ui/field';
import { Input, Select, Textarea } from './ui/input';

const KINDS = ['GUEST', 'OWNER_STAY', 'BLOCK'] as const;

/** Add or edit a booking. Money is typed in dollars and sent as integer cents. */
export function BookingDialog({
  open,
  onOpenChange,
  properties,
  initialPropertyId,
  booking,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: { id: string; name: string }[];
  initialPropertyId?: string;
  /** Present when editing. */
  booking?: Booking;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const editing = Boolean(booking);
  const [v, setV] = useState({
    propertyId: booking?.propertyId ?? initialPropertyId ?? properties[0]?.id ?? '',
    kind: booking?.kind ?? ('GUEST' as (typeof KINDS)[number]),
    channel: booking?.channel ?? ('AIRBNB' as (typeof CHANNELS)[number]),
    checkInDate: booking?.checkInDate ?? '',
    checkOutDate: booking?.checkOutDate ?? '',
    externalId: booking?.externalId ?? '',
    guestName: booking?.guestName ?? '',
    guestCount: booking?.guestCount?.toString() ?? '',
    payout: booking?.payoutCents != null ? centsToInput(booking.payoutCents) : '',
    cleaningFee: booking?.guestCleaningFeeCents != null ? centsToInput(booking.guestCleaningFeeCents) : '',
    notes: booking?.notes ?? '',
  });
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [key]: e.target.value });
  const isGuest = v.kind === 'GUEST';

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing
        ? unwrap(api.PATCH('/v1/bookings/{id}', { params: { path: { id: booking!.id } }, body: body as never }))
        : unwrap(
            api.POST('/v1/properties/{id}/bookings', { params: { path: { id: v.propertyId } }, body: body as never }),
          ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['bookings'] });
      onOpenChange(false);
    },
  });
  const errors = { ...fieldErrors(save.error), ...localErrors };

  const money = (input: string, key: string, problems: Record<string, string>) => {
    if (!input.trim()) return null;
    const cents = parseDollarsToCents(input);
    if (cents === null) problems[key] = 'Enter an amount like 450 or 450.50';
    return cents;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problems: Record<string, string> = {};
    const payoutCents = isGuest ? money(v.payout, 'payoutCents', problems) : null;
    const guestCleaningFeeCents = isGuest ? money(v.cleaningFee, 'guestCleaningFeeCents', problems) : null;
    setLocalErrors(problems);
    if (Object.keys(problems).length) return;
    const orNull = (s: string) => (s.trim() ? s.trim() : null);
    save.mutate({
      kind: v.kind,
      channel: v.channel,
      checkInDate: v.checkInDate,
      checkOutDate: v.checkOutDate,
      externalId: orNull(v.externalId),
      guestName: isGuest ? orNull(v.guestName) : null,
      guestCount: isGuest && v.guestCount ? Number(v.guestCount) : null,
      payoutCents,
      guestCleaningFeeCents,
      notes: orNull(v.notes),
      ...(editing ? { version: booking!.version } : {}),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      title={editing ? 'Edit booking' : 'Add booking'}
      description="Enter the payout once the channel pays it out. Until then the stay counts as incomplete."
      size="lg"
    >
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {!editing && properties.length > 1 && (
          <Field label="Property" className="sm:col-span-2" required>
            <Select value={v.propertyId} onChange={set('propertyId')}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Type">
          <Select value={v.kind} onChange={set('kind')}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Channel" error={errors.channel}>
          <Select value={v.channel} onChange={set('channel')}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {channelLabel(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Check-in" error={errors.checkInDate} required>
          <Input type="date" value={v.checkInDate} onChange={set('checkInDate')} />
        </Field>
        <Field label="Check-out" error={errors.checkOutDate} required>
          <Input type="date" value={v.checkOutDate} onChange={set('checkOutDate')} />
        </Field>
        {isGuest && (
          <>
            <Field
              label="Payout received ($)"
              error={errors.payoutCents}
              hint="After the channel’s fee. Blank if not paid yet."
            >
              <Input value={v.payout} onChange={set('payout')} inputMode="decimal" className="figure" />
            </Field>
            <Field label="Cleaning fee charged ($)" error={errors.guestCleaningFeeCents} hint="TruHost revenue.">
              <Input value={v.cleaningFee} onChange={set('cleaningFee')} inputMode="decimal" className="figure" />
            </Field>
            <Field label="Guest name" error={errors.guestName}>
              <Input value={v.guestName} onChange={set('guestName')} autoComplete="off" />
            </Field>
            <Field label="Guests" error={errors.guestCount}>
              <Input
                type="number"
                min={1}
                max={50}
                value={v.guestCount}
                onChange={set('guestCount')}
                className="figure"
              />
            </Field>
          </>
        )}
        <Field label="Confirmation code" error={errors.externalId} hint="From the channel, e.g. HM4XYZ…">
          <Input value={v.externalId} onChange={set('externalId')} autoComplete="off" />
        </Field>
        <Field label="Notes" error={errors.notes} className="sm:col-span-2" hint="Admin only.">
          <Textarea value={v.notes} onChange={set('notes')} rows={2} />
        </Field>
        <div className="flex flex-col gap-3 sm:col-span-2">
          <ErrorAlert error={Object.keys(fieldErrors(save.error)).length ? null : save.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={save.isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {editing ? 'Save changes' : 'Add booking'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
