import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarLegend, MonthCalendar } from '../../../components/dashboard/month-calendar';
import { ErrorAlert } from '../../../components/ui/alert';
import { Card } from '../../../components/ui/card';
import { EmptyState } from '../../../components/ui/empty-state';
import { MonthStepper } from '../../../components/ui/month-stepper';
import { PageHeader } from '../../../components/ui/page-header';
import { Skeleton } from '../../../components/ui/skeleton';
import { useApi } from '../../../lib/api-context';
import { monthKey, monthLabel, monthRange } from '../../../lib/months';
import { queries } from '../../../lib/queries';
import { monthSearch, useScope } from '../../../lib/scope';

/** Full calendar: every confirmed stay in the month, for the property chosen in the switcher (or all). */
export const Route = createFileRoute('/_app/admin/calendar')({
  validateSearch: monthSearch,
  component: Calendar,
});

function Calendar() {
  const api = useApi();
  const navigate = Route.useNavigate();
  const month = Route.useSearch().month ?? monthKey();
  const { propertyId } = useScope();
  const properties = useQuery(queries.properties(api));
  const bookings = useQuery(queries.bookings(api, monthRange(month), propertyId ?? undefined));
  const list = properties.data?.items ?? [];
  const stays = (bookings.data?.items ?? []).filter((b) => b.status === 'CONFIRMED');
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <>
      <PageHeader
        title="Calendar"
        description={propertyId ? list.find((p) => p.id === propertyId)?.name : 'All properties'}
        actions={<MonthStepper month={month} onChange={(m) => void navigate({ search: { month: m } })} />}
      />
      <Card actions={<CalendarLegend />} title={monthLabel(month)}>
        {bookings.error ? (
          <ErrorAlert error={bookings.error} />
        ) : !bookings.data ? (
          <Skeleton className="h-96" />
        ) : stays.length === 0 ? (
          <EmptyState title={`No stays in ${monthLabel(month)}`}>
            Add bookings from the Bookings page or the dashboard’s quick actions.
          </EmptyState>
        ) : (
          <MonthCalendar
            month={month}
            stays={stays}
            propertyNames={new Map(list.map((p) => [p.id, p.name]))}
            today={todayIso}
            showProperty={!propertyId && list.length > 1}
          />
        )}
      </Card>
    </>
  );
}
