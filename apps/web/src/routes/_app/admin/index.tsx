import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BookingDialog } from '../../../components/booking-dialog';
import { DamageReportDialog } from '../../../components/damage/damage-report-dialog';
import { ReportDamageDialog } from '../../../components/damage/report-damage-dialog';
import { DashboardView, type DashboardAction } from '../../../components/dashboard/dashboard-view';
import { ExpenseDialog } from '../../../components/expense-dialog';
import { ReceiptDialog } from '../../../components/receipt-dialog';
import { useApi } from '../../../lib/api-context';
import { monthKey, monthRange } from '../../../lib/months';
import { usePrefetchAdjacentMonths } from '../../../lib/month-prefetch';
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
  const restock = useQuery(queries.restock(api));
  const damage = useQuery(queries.damageReports(api, 'OPEN', propertyId ?? undefined));
  const [reportingDamage, setReportingDamage] = useState(false);
  const [openDamage, setOpenDamage] = useState<string | null>(null);
  const calendar = useQuery(queries.bookings(api, monthRange(month), propertyId ?? undefined));
  usePrefetchAdjacentMonths(month, (m) => queries.dashboard(api, m, propertyId), dash.isSuccess);
  usePrefetchAdjacentMonths(
    month,
    (m) => queries.bookings(api, monthRange(m), propertyId ?? undefined),
    calendar.isSuccess,
  );
  // The month the calendar's stays are for: the previous one while the chosen month loads.
  const [staysMonth, setStaysMonth] = useState(month);
  if (calendar.data && !calendar.isPlaceholderData && staysMonth !== month) setStaysMonth(month);
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
        dashboardUpdating={dash.isPlaceholderData}
        dashboardError={dash.error}
        onRetryDashboard={() => void dash.refetch()}
        retryingDashboard={dash.isFetching}
        stays={calendar.data?.items.filter((b) => b.status === 'CONFIRMED')}
        staysMonth={calendar.isPlaceholderData ? staysMonth : month}
        staysUpdating={calendar.isPlaceholderData}
        staysError={calendar.error}
        onRetryStays={() => void calendar.refetch()}
        retryingStays={calendar.isFetching}
        supplies={restock.data?.items.filter((i) => !propertyId || i.property.id === propertyId)}
        suppliesError={restock.error}
        onRetrySupplies={() => void restock.refetch()}
        damage={damage.data?.items}
        onReportDamage={() => setReportingDamage(true)}
        onOpenDamage={setOpenDamage}
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
      {reportingDamage && (
        <ReportDamageDialog
          open
          onOpenChange={(o) => !o && setReportingDamage(false)}
          properties={propertyList}
          initialPropertyId={propertyId ?? undefined}
        />
      )}
      {openDamage && <DamageReportDialog reportId={openDamage} open onOpenChange={(o) => !o && setOpenDamage(null)} />}
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
