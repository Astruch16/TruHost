import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BookingDialog } from '../../../components/booking-dialog';
import { DashboardView, type DashboardAction } from '../../../components/dashboard/dashboard-view';
import { ExpenseDialog } from '../../../components/expense-dialog';
import { ReceiptDialog } from '../../../components/receipt-dialog';
import { useApi } from '../../../lib/api-context';
import { monthKey, monthRange } from '../../../lib/months';
import { queries } from '../../../lib/queries';
import { monthSearch, useScope } from '../../../lib/scope';

/**
 * Admin home. Portfolio-wide unless the top-bar switcher narrows it to one property. Every figure comes from
 * GET /v1/dashboard (the reporting module); DashboardView only lays it out.
 */
export const Route = createFileRoute('/_app/admin/')({
  validateSearch: monthSearch,
  component: Dashboard,
});

function Dashboard() {
  const api = useApi();
  const navigate = Route.useNavigate();
  const month = Route.useSearch().month ?? monthKey();
  const { propertyId } = useScope();
  const [action, setAction] = useState<DashboardAction | null>(null);

  const me = useQuery(queries.me(api));
  const properties = useQuery(queries.properties(api));
  const dash = useQuery(queries.dashboard(api, month, propertyId));
  const calendar = useQuery(queries.bookings(api, monthRange(month), propertyId ?? undefined));
  const propertyList = properties.data?.items ?? [];

  return (
    <>
      <DashboardView
        firstName={me.data?.firstName ?? ''}
        now={new Date()}
        month={month}
        onMonthChange={(m) => void navigate({ search: { month: m } })}
        scope={{ propertyId, name: propertyList.find((p) => p.id === propertyId)?.name ?? null }}
        properties={properties.data?.items}
        dashboard={dash.data}
        dashboardError={dash.error}
        onRetryDashboard={() => void dash.refetch()}
        retryingDashboard={dash.isFetching}
        stays={calendar.data?.items.filter((b) => b.status === 'CONFIRMED')}
        staysError={calendar.error}
        onRetryStays={() => void calendar.refetch()}
        retryingStays={calendar.isFetching}
        onAction={setAction}
        onAddProperty={() => void navigate({ to: '/admin/properties' })}
      />
      {action === 'booking' && (
        <BookingDialog
          open
          onOpenChange={(open) => !open && setAction(null)}
          properties={propertyList}
          initialPropertyId={propertyId ?? undefined}
        />
      )}
      {action === 'expense' && (
        <ExpenseDialog
          onClose={() => setAction(null)}
          properties={propertyList}
          initialPropertyId={propertyId ?? undefined}
        />
      )}
      {action === 'receipt' && (
        <ReceiptDialog
          onClose={() => setAction(null)}
          properties={propertyList}
          initialPropertyId={propertyId ?? undefined}
        />
      )}
    </>
  );
}
