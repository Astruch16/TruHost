import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { CalendarPlus } from 'lucide-react';
import { BookingDialog } from '../../../components/booking-dialog';
import { BookingsList } from '../../../components/bookings/bookings-list';
import { BookingsSummary } from '../../../components/bookings/bookings-summary';
import { ErrorAlert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Dialog } from '../../../components/ui/dialog';
import { EmptyState } from '../../../components/ui/empty-state';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { MonthStepper } from '../../../components/ui/month-stepper';
import { PageHeader } from '../../../components/ui/page-header';
import { Skeleton } from '../../../components/ui/skeleton';
import { useApi } from '../../../lib/api-context';
import type { Booking } from '../../../lib/api-types';
import { todayIso } from '../../../lib/dates';
import { monthKey, monthLabel, monthRange, shortDate } from '../../../lib/months';
import { queries } from '../../../lib/queries';
import { usePrefetchAdjacentMonths } from '../../../lib/month-prefetch';
import { updatingStyles } from '../../../lib/styles';
import { monthSearch, useScope } from '../../../lib/scope';

/**
 * Bookings for the month (stays overlapping it), for the property chosen in the switcher or all: the month's money at
 * a glance (from the API's reporting), quick filters, and each stay with its dates, guest, channel, money and where it
 * stands. A missing payout is one click away.
 */
export const Route = createFileRoute('/_app/admin/bookings')({
  validateSearch: monthSearch,
  component: Bookings,
});

const KPI_GRID = 'grid grid-cols-2 gap-3 @2xl/content:grid-cols-4 @2xl/content:gap-4';

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
  // The money tiles come from the API's reporting (the dashboard read), never added up here.
  const summary = useQuery(queries.dashboard(api, month, propertyId || null));
  usePrefetchAdjacentMonths(
    month,
    (m) => queries.bookings(api, monthRange(m), propertyId || undefined),
    bookings.isSuccess,
  );
  usePrefetchAdjacentMonths(month, (m) => queries.dashboard(api, m, propertyId || null), summary.isSuccess);
  const propertyList = properties.data?.items ?? [];
  const nameOf = (id: string) => propertyList.find((p) => p.id === id)?.name ?? '';
  const items = bookings.data?.items ?? [];
  const noProperties = properties.isSuccess && propertyList.length === 0;
  const showProperty = !propertyId && propertyList.length > 1;

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Stays overlapping the month. Enter each payout and cleaning fee as they arrive."
        actions={
          <>
            <MonthStepper month={month} onChange={setMonth} />
            <Button onClick={() => setEditing('new')} disabled={noProperties}>
              <CalendarPlus aria-hidden className="size-4" /> Add booking
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-6">
        {!noProperties &&
          (summary.data ? (
            <div
              aria-busy={summary.isPlaceholderData || undefined}
              className={updatingStyles(summary.isPlaceholderData)}
            >
              <BookingsSummary data={summary.data} />
            </div>
          ) : summary.error ? null : (
            <div className={KPI_GRID}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ))}
        <Card>
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
            <BookingsList
              month={month}
              items={items}
              loading={bookings.isPending}
              error={bookings.error}
              updating={bookings.isPlaceholderData}
              today={todayIso()}
              propertyName={showProperty ? nameOf : undefined}
              onEdit={setEditing}
              onCancel={setCancelling}
            />
          )}
        </Card>
      </div>
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
