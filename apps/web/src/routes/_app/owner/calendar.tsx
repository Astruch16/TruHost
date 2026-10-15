import { createFileRoute } from '@tanstack/react-router';
import { OwnerCalendarPage } from '../../../components/owner-portal/owner-calendar';
import { todayIso } from '../../../lib/dates';
import { monthKey } from '../../../lib/months';
import { monthSearch, useScope } from '../../../lib/scope';

/** The owner's calendar, a month at a time. */
export const Route = createFileRoute('/_app/owner/calendar')({
  validateSearch: monthSearch,
  component: OwnerCalendar,
});

function OwnerCalendar() {
  const navigate = Route.useNavigate();
  const month = Route.useSearch().month ?? monthKey();
  const { propertyId } = useScope();
  return (
    <OwnerCalendarPage
      month={month}
      onMonthChange={(m) => void navigate({ search: { month: m } })}
      propertyId={propertyId}
      today={todayIso()}
    />
  );
}
