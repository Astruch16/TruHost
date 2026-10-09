import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { CalendarPlus, Pencil, XCircle } from 'lucide-react';
import { BookingDialog } from '../../../components/booking-dialog';
import { ErrorAlert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Dialog } from '../../../components/ui/dialog';
import { EmptyState } from '../../../components/ui/empty-state';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { MonthStepper } from '../../../components/ui/month-stepper';
import { PageHeader } from '../../../components/ui/page-header';
import { Pill } from '../../../components/ui/pill';
import { Table, TableState, TBody, Td, Th, THead, Tr } from '../../../components/ui/table';
import { useApi } from '../../../lib/api-context';
import type { Booking } from '../../../lib/api-types';
import { channelLabel, kindLabel } from '../../../lib/format';
import { formatCents } from '../../../lib/money';
import { monthKey, monthLabel, monthRange, shortDate } from '../../../lib/months';
import { queries } from '../../../lib/queries';
import { usePrefetchAdjacentMonths } from '../../../lib/month-prefetch';
import { updatingStyles } from '../../../lib/styles';
import { monthSearch, useScope } from '../../../lib/scope';

export const Route = createFileRoute('/_app/admin/bookings')({
  validateSearch: monthSearch,
  component: Bookings,
});

const money = (cents: number | null | undefined) => (cents == null ? '—' : formatCents(cents));

function Bookings() {
  const api = useApi();
  const navigate = Route.useNavigate();
  const month = Route.useSearch().month ?? monthKey();
  const setMonth = (m: string) => void navigate({ search: { month: m } });
  const { propertyId: scopedId } = useScope();
  const propertyId = scopedId ?? '';
  const [editing, setEditing] = useState<Booking | 'new' | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const properties = useQuery(queries.properties(api));
  const range = monthRange(month);
  const bookings = useQuery(queries.bookings(api, range, propertyId || undefined));
  usePrefetchAdjacentMonths(
    month,
    (m) => queries.bookings(api, monthRange(m), propertyId || undefined),
    bookings.isSuccess,
  );
  const propertyList = properties.data?.items ?? [];
  const nameOf = (id: string) => propertyList.find((p) => p.id === id)?.name ?? '';
  const items = bookings.data?.items ?? [];
  const noProperties = properties.isSuccess && propertyList.length === 0;

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Stays overlapping the month. Enter each payout and cleaning fee as they arrive."
        actions={
          <Button onClick={() => setEditing('new')} disabled={noProperties}>
            <CalendarPlus aria-hidden className="size-4" /> Add booking
          </Button>
        }
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <MonthStepper month={month} onChange={setMonth} />
        </div>
        {noProperties ? (
          <EmptyState title="Add a property first">
            Bookings belong to a property. Create one under Properties, then come back here.
          </EmptyState>
        ) : bookings.isSuccess && !bookings.isPlaceholderData && items.length === 0 ? (
          <EmptyState
            title={`No bookings in ${monthLabel(month)}`}
            action={<Button onClick={() => setEditing('new')}>Add booking</Button>}
          >
            Add each stay with its dates. You can enter the payout once the channel pays out.
          </EmptyState>
        ) : (
          <Table
            aria-busy={bookings.isPlaceholderData || undefined}
            className={updatingStyles(bookings.isPlaceholderData)}
          >
            <THead>
              <tr>
                <Th>Dates</Th>
                {propertyList.length > 1 && <Th>Property</Th>}
                <Th>Stay</Th>
                <Th align="right">Payout</Th>
                <Th align="right">Cleaning fee</Th>
                <Th align="right">Owner gross</Th>
                <Th>Status</Th>
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              <TableState columns={8} loading={bookings.isPending} error={bookings.error} empty={false} />
              {items.map((b) => (
                <Tr key={b.id} interactive>
                  <Td className="whitespace-nowrap">
                    <span className="font-medium">
                      {shortDate(b.checkInDate)} → {shortDate(b.checkOutDate)}
                    </span>
                    <span className="block text-xs text-muted">
                      {b.nights} night{b.nights === 1 ? '' : 's'}
                    </span>
                  </Td>
                  {propertyList.length > 1 && <Td>{nameOf(b.propertyId)}</Td>}
                  <Td>
                    {b.kind === 'GUEST' ? (b.guestName ?? 'Guest') : kindLabel(b.kind)}
                    <span className="block text-xs text-muted">{channelLabel(b.channel)}</span>
                  </Td>
                  <Td align="right">{money(b.payoutCents)}</Td>
                  <Td align="right">{money(b.guestCleaningFeeCents)}</Td>
                  <Td align="right" className="font-semibold">
                    {money(b.ownerGrossCents)}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1.5">
                      {b.status === 'CANCELLED' && <Pill tone="neutral">Cancelled</Pill>}
                      {b.kind === 'OWNER_STAY' && <Pill tone="blue">Owner stay</Pill>}
                      {b.kind === 'BLOCK' && <Pill tone="neutral">Block</Pill>}
                      {!b.complete && <Pill tone="lavender">Payout pending</Pill>}
                    </span>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => setEditing(b)}
                        aria-label={`Edit booking ${b.checkInDate}`}
                      >
                        <Pencil aria-hidden className="size-4" />
                      </Button>
                      {b.status === 'CONFIRMED' && (
                        <Button
                          variant="quiet"
                          size="sm"
                          onClick={() => setCancelling(b)}
                          aria-label={`Cancel booking ${b.checkInDate}`}
                        >
                          <XCircle aria-hidden className="size-4" />
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      {editing && (
        <BookingDialog
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          properties={propertyList}
          initialPropertyId={propertyId || undefined}
          booking={editing === 'new' ? undefined : editing}
        />
      )}
      {cancelling && <CancelDialog booking={cancelling} onClose={() => setCancelling(null)} />}
    </>
  );
}

function CancelDialog({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const cancel = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/bookings/{id}/cancel', {
          params: { path: { id: booking.id } },
          body: { version: booking.version ?? 0, note: note.trim() || null },
        }),
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['bookings'] });
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !cancel.isPending && onClose()}
      title="Cancel this booking?"
      description={`${shortDate(booking.checkInDate)} → ${shortDate(booking.checkOutDate)}. The dates become available again. If a payout still arrives, edit the booking to record it.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" disabled={cancel.isPending} onClick={onClose}>
            Keep booking
          </Button>
          <Button variant="danger-solid" loading={cancel.isPending} onClick={() => cancel.mutate()}>
            Cancel booking
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Note" hint="Optional, e.g. the cancellation policy that applied.">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <ErrorAlert error={cancel.error} />
      </div>
    </Dialog>
  );
}
