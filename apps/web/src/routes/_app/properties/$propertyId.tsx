import { useState } from 'react';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { ApiError } from '@truhost/api-client';
import { PropertyAddressCard, PropertyRoomsCard } from '../../../components/property-basics';
import { NotAvailable } from '../../../components/shell/not-available';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { ErrorAlert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { Pill } from '../../../components/ui/pill';
import { LoadingBlock, Skeleton } from '../../../components/ui/skeleton';
import { MonthStepper } from '../../../components/ui/month-stepper';
import { Table, TableState, TBody, Td, Th, THead, Tr } from '../../../components/ui/table';
import { useApi } from '../../../lib/api-context';
import { formatCents } from '../../../lib/money';
import { monthKey, monthLabel, monthRange, shortDate } from '../../../lib/months';
import { usePrefetchAdjacentMonths } from '../../../lib/month-prefetch';
import { cx } from '../../../lib/cx';
import { updatingStyles } from '../../../lib/styles';
import { formatBps, formatOccupancy, kindLabel } from '../../../lib/format';
import { propertyPath } from '../../../lib/access';
import { queries } from '../../../lib/queries';
import { openFile } from '../../../lib/upload';

/**
 * The owner's property page: the month's figures, plan, stays and expenses, plus address and rooms. Only for owners
 * of this property. Cleaners go to their own page (/cleaner/properties/:id), which has no financial sections, and
 * admins to the admin page; anyone else sees "not available". The API enforces the same on every call.
 */
export const Route = createFileRoute('/_app/properties/$propertyId')({
  component: PropertyPage,
});

function PropertyPage() {
  const { propertyId } = Route.useParams();
  const me = useQuery(queries.me(useApi()));
  if (!me.data) return <LoadingBlock />;
  const path = propertyPath(me.data, propertyId);
  if (path === null) return <NotAvailable />;
  if (path !== '/properties/$propertyId') return <Navigate to={path} params={{ propertyId }} replace />;
  return <OwnerPropertyView propertyId={propertyId} />;
}

function OwnerPropertyView({ propertyId }: { propertyId: string }) {
  const api = useApi();
  const property = useQuery(queries.property(api, propertyId));
  const plan = useQuery(queries.propertyPlan(api, propertyId));

  if (property.error) {
    return property.error instanceof ApiError && property.error.status === 404 ? (
      <NotAvailable />
    ) : (
      <ErrorAlert error={property.error} />
    );
  }
  if (!property.data) return <LoadingBlock />;
  const p = property.data;

  return (
    <>
      <PageHeader eyebrow="Property details" title={p.name} description={`${p.city}, ${p.province}`} />
      <div className="grid gap-6 @4xl/content:grid-cols-2">
        <OwnerMonth propertyId={propertyId} />
        <PropertyAddressCard property={p} />
        <Card title="Plan">
          {plan.error ? (
            <ErrorAlert error={plan.error} />
          ) : plan.isPending ? (
            <Skeleton className="h-6 w-2/3" />
          ) : plan.data?.current ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Pill tone="lavender">{plan.data.current.plan.name}</Pill>
              <span>
                <span className="figure font-semibold">{formatBps(plan.data.current.plan.managementFeeBps)}</span> of
                monthly gross revenue, since <span className="figure">{plan.data.current.effectiveFrom}</span>
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted">No plan assigned yet.</p>
          )}
        </Card>
        <OwnerBookings propertyId={propertyId} />
        <OwnerExpenses propertyId={propertyId} />
        <PropertyRoomsCard propertyId={propertyId} />
      </div>
    </>
  );
}

/** Owners see their stays and the gross each earned; guest details stay with TruHost. */
function OwnerBookings({ propertyId }: { propertyId: string }) {
  const api = useApi();
  const [month, setMonth] = useState(monthKey);
  const bookings = useQuery(queries.propertyBookings(api, propertyId, monthRange(month)));
  usePrefetchAdjacentMonths(month, (m) => queries.propertyBookings(api, propertyId, monthRange(m)), bookings.isSuccess);
  const items = bookings.data?.items ?? [];
  return (
    <Card
      title="Bookings"
      actions={<MonthStepper month={month} onChange={setMonth} />}
      className="@4xl/content:col-span-2"
    >
      <Table aria-busy={bookings.isPlaceholderData || undefined} className={updatingStyles(bookings.isPlaceholderData)}>
        <THead>
          <tr>
            <Th>Dates</Th>
            <Th>Stay</Th>
            <Th align="right">Your gross</Th>
          </tr>
        </THead>
        <TBody>
          <TableState
            columns={3}
            loading={bookings.isPending}
            error={bookings.error}
            empty={items.length === 0 && !bookings.isPlaceholderData}
            emptyMessage={`No stays in ${monthLabel(month)}.`}
          />
          {items.map((b) => (
            <Tr key={b.id}>
              <Td>
                {shortDate(b.checkInDate)} → {shortDate(b.checkOutDate)}
                <span className="block text-xs text-muted">
                  {b.nights} night{b.nights === 1 ? '' : 's'}
                </span>
              </Td>
              <Td>
                {kindLabel(b.kind)}
                {b.status === 'CANCELLED' && (
                  <span className="ml-2">
                    <Pill tone="neutral">Cancelled</Pill>
                  </span>
                )}
              </Td>
              <Td align="right" className="font-semibold">
                {b.ownerGrossCents != null ? formatCents(b.ownerGrossCents) : b.complete ? '—' : 'Payout pending'}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

/** Owner-borne expenses for the month, with their receipts. */
function OwnerExpenses({ propertyId }: { propertyId: string }) {
  const api = useApi();
  const [month, setMonth] = useState(monthKey);
  const [viewError, setViewError] = useState<unknown>(null);
  const expenses = useQuery(queries.propertyExpenses(api, propertyId, monthRange(month)));
  usePrefetchAdjacentMonths(month, (m) => queries.propertyExpenses(api, propertyId, monthRange(m)), expenses.isSuccess);
  const items = expenses.data?.items ?? [];
  return (
    <Card
      title="Expenses"
      actions={<MonthStepper month={month} onChange={setMonth} />}
      className="@4xl/content:col-span-2"
    >
      <ErrorAlert error={viewError} />
      <Table aria-busy={expenses.isPlaceholderData || undefined} className={updatingStyles(expenses.isPlaceholderData)}>
        <THead>
          <tr>
            <Th>Date</Th>
            <Th>Expense</Th>
            <Th align="right">Amount</Th>
            <Th>Receipt</Th>
          </tr>
        </THead>
        <TBody>
          <TableState
            columns={4}
            loading={expenses.isPending}
            error={expenses.error}
            empty={items.length === 0 && !expenses.isPlaceholderData}
            emptyMessage={`No expenses in ${monthLabel(month)}.`}
          />
          {items.map((e) => (
            <Tr key={e.id}>
              <Td className="whitespace-nowrap">{shortDate(e.incurredOn)}</Td>
              <Td>
                {e.description}
                {e.vendor && <span className="block text-xs text-muted">{e.vendor}</span>}
              </Td>
              <Td align="right" className="font-semibold">
                {formatCents(e.amountCents)}
              </Td>
              <Td>
                {e.receipts.length ? (
                  e.receipts.map((r) => (
                    <Button
                      key={r.id}
                      variant="quiet"
                      size="sm"
                      onClick={() => void openFile(api, r.fileId).catch(setViewError)}
                    >
                      <FileText aria-hidden className="size-4" /> View
                    </Button>
                  ))
                ) : (
                  <span className="text-sm text-muted">Pending</span>
                )}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

/** The owner's month at a glance. All figures come from the API's reporting module. */
function OwnerMonth({ propertyId }: { propertyId: string }) {
  const api = useApi();
  const [month, setMonth] = useState(monthKey);
  const summary = useQuery(queries.propertySummary(api, propertyId, month));
  usePrefetchAdjacentMonths(month, (m) => queries.propertySummary(api, propertyId, m), summary.isSuccess);
  const f = summary.data;
  const row = (label: string, value: string, strong = false) => (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? 'figure text-lg font-bold text-ink' : 'figure font-semibold text-ink'}>{value}</dd>
    </div>
  );
  return (
    <Card
      title="Month at a glance"
      actions={<MonthStepper month={month} onChange={setMonth} />}
      className="@4xl/content:col-span-2"
    >
      {summary.error ? (
        <ErrorAlert error={summary.error} />
      ) : !f ? (
        <Skeleton className="h-40" />
      ) : f.nightsBooked === 0 && f.grossCents === 0 && f.ownerExpensesCents === 0 ? (
        <p
          aria-busy={summary.isPlaceholderData || undefined}
          className={cx('py-6 text-center text-sm text-muted', updatingStyles(summary.isPlaceholderData))}
        >
          No stays or expenses in {monthLabel(month)} yet.
        </p>
      ) : (
        <div
          aria-busy={summary.isPlaceholderData || undefined}
          className={cx('grid gap-x-10 @xl/content:grid-cols-2', updatingStyles(summary.isPlaceholderData))}
        >
          <dl className="divide-y divide-line-soft text-sm">
            {row('Gross revenue', formatCents(f.grossCents))}
            {row(
              f.managementFeeBps === null
                ? 'Management fee'
                : `${f.plan?.name ?? 'Plan'} fee (${formatBps(f.managementFeeBps)})`,
              `−${formatCents(f.managementFeeCents)}`,
            )}
            {row('Expenses', `−${formatCents(f.ownerExpensesCents)}`)}
            {row('Net to you', formatCents(f.netCents), true)}
          </dl>
          <dl className="divide-y divide-line-soft text-sm">
            {row('Nights booked', `${f.nightsBooked} of ${f.availableNights}`)}
            {row('Occupancy', formatOccupancy(f.occupancyBps))}
            {row(
              'Avg. nightly earnings',
              f.avgNightlyEarningsCents === null ? '—' : formatCents(f.avgNightlyEarningsCents),
            )}
            {row('Stays', String(f.stays))}
          </dl>
        </div>
      )}
      {f && f.incompleteBookings > 0 && (
        <p className="mt-3 text-sm text-muted">
          {f.incompleteBookings} stay{f.incompleteBookings === 1 ? ' is' : 's are'} waiting on a payout and not counted
          yet.
        </p>
      )}
    </Card>
  );
}
