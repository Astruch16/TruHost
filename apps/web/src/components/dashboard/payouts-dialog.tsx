import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { Booking } from '@truhost/shared';
import { Check } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { fieldErrors } from '../../lib/errors';
import { channelLabel } from '../../lib/format';
import { centsToInput, parseDollarsToCents } from '../../lib/money';
import { payoutRange } from '../../lib/payouts';
import { queries } from '../../lib/queries';
import { stayDates } from '../../lib/statements';
import { AllClearIllustration } from '../illustrations/all-clear';
import { ErrorAlert, LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { EmptyState } from '../ui/empty-state';
import { Field } from '../ui/field';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';

/**
 * Every stay waiting on its payout, in one place: each with its payout and cleaning fee to enter and save. A saved
 * stay leaves the list (it now counts), and the dashboard refreshes. The API recomputes everything from what's
 * entered; this only sends the two amounts.
 */
export function PayoutsDialog({
  open,
  onOpenChange,
  earliest,
  today,
  propertyId,
  propertyNames,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The earliest check-in waiting on a payout (from Needs attention). */
  earliest: string;
  /** The property's local today: stays that have checked in by then are due. */
  today: string;
  /** The property in scope, or null for all. */
  propertyId: string | null;
  propertyNames: Map<string, string>;
}) {
  const api = useApi();
  const range = payoutRange(earliest, today);
  const list = useQuery(queries.bookings(api, range, propertyId ?? undefined));
  const waiting = (list.data?.items ?? []).filter(
    (b) => b.kind === 'GUEST' && b.status === 'CONFIRMED' && !b.complete && b.checkInDate <= today,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="Stays waiting on payout"
      description="Enter each stay’s payout and cleaning fee from the channel. A stay counts towards revenue once both are in."
      footer={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      {list.error ? (
        <LoadError what="the stays" onRetry={() => void list.refetch()} retrying={list.isFetching} />
      ) : !list.data ? (
        <div role="status" aria-label="Loading stays" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-inner" />
          ))}
        </div>
      ) : waiting.length === 0 ? (
        <EmptyState size="compact" illustration={<AllClearIllustration />} title="Every payout is in">
          All stays that have checked in have their payout and cleaning fee.
        </EmptyState>
      ) : (
        <ul aria-label="Stays waiting on payout" className="flex flex-col gap-3">
          {waiting.map((b) => (
            <PayoutRow key={b.id} booking={b} property={propertyNames.get(b.propertyId) ?? ''} />
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function PayoutRow({ booking: b, property }: { booking: Booking; property: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const [payout, setPayout] = useState(b.payoutCents == null ? '' : centsToInput(b.payoutCents));
  const [fee, setFee] = useState(b.guestCleaningFeeCents == null ? '' : centsToInput(b.guestCleaningFeeCents));
  const [local, setLocal] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (body: { payoutCents: number; guestCleaningFeeCents: number }) =>
      unwrap(
        api.PATCH('/v1/bookings/{id}', {
          params: { path: { id: b.id } },
          body: { ...body, version: b.version ?? 0 },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
  const errors = { ...fieldErrors(save.error), ...local };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const payoutCents = parseDollarsToCents(payout);
    const feeCents = parseDollarsToCents(fee);
    const problems: Record<string, string> = {};
    if (payoutCents === null) problems.payoutCents = 'Enter the payout';
    if (feeCents === null) problems.guestCleaningFeeCents = 'Enter the cleaning fee';
    setLocal(problems);
    if (payoutCents !== null && feeCents !== null) save.mutate({ payoutCents, guestCleaningFeeCents: feeCents });
  };

  const field = (
    key: 'payoutCents' | 'guestCleaningFeeCents',
    label: string,
    value: string,
    set: (v: string) => void,
  ) => (
    <Field label={label} error={errors[key]} className="min-w-0">
      <Input
        value={value}
        onChange={(e) => set(e.target.value)}
        inputMode="decimal"
        placeholder="0.00"
        className="figure"
      />
    </Field>
  );

  return (
    <li className="rounded-inner border border-line bg-surface p-4">
      {/* Phone: the stay, then both amounts side by side, then Save. Wider: all on one line. */}
      <form
        onSubmit={submit}
        className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] sm:items-start"
      >
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <p className="font-semibold text-ink">{property}</p>
          <p className="text-sm text-muted">
            {stayDates(b.checkInDate, b.checkOutDate)} · {b.nights} night{b.nights === 1 ? '' : 's'} ·{' '}
            {channelLabel(b.channel)}
            {b.guestName ? ` · ${b.guestName}` : ''}
          </p>
        </div>
        {field('payoutCents', 'Payout ($)', payout, setPayout)}
        {field('guestCleaningFeeCents', 'Cleaning fee ($)', fee, setFee)}
        <Button
          type="submit"
          size="sm"
          className="col-span-2 sm:col-span-1 sm:mt-7"
          loading={save.isPending}
          aria-label={`Save payout: ${property}, ${stayDates(b.checkInDate, b.checkOutDate)}`}
        >
          <Check aria-hidden className="size-4" /> Save
        </Button>
        {save.error && Object.keys(fieldErrors(save.error)).length === 0 && (
          <div className="col-span-2 sm:col-span-4">
            <ErrorAlert error={save.error} />
          </div>
        )}
      </form>
    </li>
  );
}
