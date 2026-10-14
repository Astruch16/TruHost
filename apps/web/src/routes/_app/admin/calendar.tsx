import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus } from 'lucide-react';
import { BookingDialog } from '../../../components/booking-dialog';
import { MonthAgenda } from '../../../components/calendar/month-agenda';
import { MonthSummary } from '../../../components/calendar/month-summary';
import { CalendarLegend, MonthCalendar } from '../../../components/dashboard/month-calendar';
import { ErrorAlert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { MonthStepper } from '../../../components/ui/month-stepper';
import { PageHeader } from '../../../components/ui/page-header';
import { Skeleton } from '../../../components/ui/skeleton';
import { useApi } from '../../../lib/api-context';
import { monthAgenda } from '../../../lib/calendar';
import { todayIso } from '../../../lib/dates';
import { monthKey, monthLabel, monthRange } from '../../../lib/months';
import { usePrefetchAdjacentMonths } from '../../../lib/month-prefetch';
import { queries } from '../../../lib/queries';
import { monthSearch, useScope } from '../../../lib/scope';
import { updatingStyles } from '../../../lib/styles';

/**
 * Full calendar for the property chosen in the switcher (or all): the month at a glance (nights booked, stays,
 * check-ins and cleans), every confirmed stay as a bar with the guest's name, and the month's arrivals and departures
 * beside it. Clicking a stay opens its booking; "Add booking" adds one.
 */
export const Route = createFileRoute('/_app/admin/calendar')({
  validateSearch: monthSearch,
  component: Calendar,
});

const dim = (updating: boolean) => ({ 'aria-busy': updating || undefined, className: updatingStyles(updating) });

function Calendar() {
  const api = useApi();
  const navigate = Route.useNavigate();
  const month = Route.useSearch().month ?? monthKey();
  const { propertyId } = useScope();
  const properties = useQuery(queries.properties(api));
  const bookings = useQuery(queries.bookings(api, monthRange(month), propertyId ?? undefined));
  // Nights booked and stays come from the API's reporting (the dashboard read), never counted here.
  const summary = useQuery(queries.dashboard(api, month, propertyId));
  usePrefetchAdjacentMonths(
    month,
    (m) => queries.bookings(api, monthRange(m), propertyId ?? undefined),
    bookings.isSuccess,
  );
  usePrefetchAdjacentMonths(month, (m) => queries.dashboard(api, m, propertyId), summary.isSuccess);
  // The month the stays on screen are for: the previous one while the chosen month loads.
  const [shownMonth, setShownMonth] = useState(month);
  if (bookings.data && !bookings.isPlaceholderData && shownMonth !== month) setShownMonth(month);
  const calendarMonth = bookings.isPlaceholderData ? shownMonth : month;
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const list = properties.data?.items ?? [];
  const names = new Map(list.map((p) => [p.id, p.name]));
  const multi = !propertyId && list.length > 1;
  const stays = (bookings.data?.items ?? []).filter((b) => b.status === 'CONFIRMED');
  const agenda = monthAgenda(calendarMonth, stays);
  const today = todayIso();
  const editing = editingId ? bookings.data?.items.find((b) => b.id === editingId) : undefined;

  return (
    <>
      <PageHeader
        title="Calendar"
        description={propertyId ? names.get(propertyId) : 'All properties'}
        actions={
          <>
            <MonthStepper month={month} onChange={(m) => void navigate({ search: { month: m } })} />
            <Button onClick={() => setAdding(true)} disabled={list.length === 0}>
              <CalendarPlus aria-hidden className="size-4" /> Add booking
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-6">
        {summary.data ? (
          <div {...dim(summary.isPlaceholderData || bookings.isPlaceholderData)}>
            <MonthSummary month={calendarMonth} kpis={summary.data.kpis} agenda={agenda} today={today} />
          </div>
        ) : summary.error ? null : (
          <div className="grid grid-cols-2 gap-3 @2xl/content:grid-cols-4 @2xl/content:gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-6 @[68.75rem]/content:grid-cols-[minmax(0,1fr)_340px]">
          <Card title={monthLabel(calendarMonth)} actions={<CalendarLegend month={calendarMonth} stays={stays} />}>
            {bookings.error ? (
              <ErrorAlert error={bookings.error} />
            ) : !bookings.data ? (
              <Skeleton className="h-[34rem]" />
            ) : (
              <div {...dim(bookings.isPlaceholderData)}>
                {stays.length === 0 && (
                  <p className="mb-3 text-sm text-muted">
                    No stays in {monthLabel(calendarMonth)} yet. Use “Add booking” to put one on the calendar.
                  </p>
                )}
                <MonthCalendar
                  month={calendarMonth}
                  stays={stays}
                  propertyNames={names}
                  today={today}
                  showProperty={multi}
                  onSelect={setEditingId}
                  roomy
                />
              </div>
            )}
          </Card>
          {bookings.data ? (
            <div {...dim(bookings.isPlaceholderData)}>
              <MonthAgenda
                month={calendarMonth}
                agenda={agenda}
                today={today}
                propertyNames={names}
                showProperty={multi}
                onSelect={setEditingId}
              />
            </div>
          ) : bookings.error ? null : (
            <Skeleton className="h-96 rounded-card" />
          )}
        </div>
      </div>

      {adding && (
        <BookingDialog
          open
          onOpenChange={(open) => !open && setAdding(false)}
          properties={list}
          initialPropertyId={propertyId ?? undefined}
        />
      )}
      {editing && (
        <BookingDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditingId(null)}
          properties={list}
          booking={editing}
        />
      )}
    </>
  );
}
