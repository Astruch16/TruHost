import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Clock, FileText, MapPin } from 'lucide-react';
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
import { formatBps, formatOccupancy, kindLabel } from '../../../lib/format';
import { queries } from '../../../lib/queries';
import { openFile } from '../../../lib/upload';

/**
 * Read-only property view for owners and cleaners. The API decides which fields come back; this page renders what it
 * gets. The owner dashboard from the mockup replaces this view once Phase 2 data exists.
 */
export const Route = createFileRoute('/_app/properties/$propertyId')({
  component: PropertyView,
});

function PropertyView() {
  const { propertyId } = Route.useParams();
  const api = useApi();
  const me = useQuery(queries.me(api));
  const property = useQuery(queries.property(api, propertyId));
  const rooms = useQuery(queries.rooms(api, propertyId));
  const isOwner = me.data?.memberships.some((m) => m.property.id === propertyId && m.role === 'OWNER') ?? false;
  const plan = useQuery({ ...queries.propertyPlan(api, propertyId), enabled: isOwner });

  if (property.error) return <ErrorAlert error={property.error} />;
  if (!property.data) return <LoadingBlock />;
  const p = property.data;

  return (
    <>
      <PageHeader eyebrow="Property details" title={p.name} description={`${p.city}, ${p.province}`} />
      <div className="grid gap-5 lg:grid-cols-2">
        {isOwner && <OwnerMonth propertyId={propertyId} />}
        <Card title="Address">
          <div className="flex flex-col gap-3 text-sm">
            <p className="flex gap-2.5">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <span>
                {p.addressLine1}
                {p.addressLine2 && <>, {p.addressLine2}</>}
                <br />
                {p.city}, {p.province} {p.postalCode}
              </span>
            </p>
            <p className="flex gap-2.5">
              <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <span className="figure">
                Check-in {p.checkInTime} · Check-out {p.checkOutTime}
              </span>
            </p>
          </div>
        </Card>
        {isOwner && (
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
        )}
        {isOwner && <OwnerBookings propertyId={propertyId} />}
        {isOwner && <OwnerExpenses propertyId={propertyId} />}
        <Card title="Rooms" description="In cleaning-checklist order.">
          {rooms.error ? (
            <ErrorAlert error={rooms.error} />
          ) : !rooms.data ? (
            <Skeleton className="h-16" />
          ) : (
            <ol className="flex flex-col divide-y divide-line-soft text-sm">
              {rooms.data.items.map((r, i) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <span className="figure grid size-6 place-items-center rounded-full bg-ground text-xs font-semibold text-muted">
                    {i + 1}
                  </span>
                  {r.name}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}

/** Owners see their stays and the gross each earned; guest details stay with TruHost. */
function OwnerBookings({ propertyId }: { propertyId: string }) {
  const api = useApi();
  const [month, setMonth] = useState(monthKey);
  const bookings = useQuery(queries.propertyBookings(api, propertyId, monthRange(month)));
  const items = bookings.data?.items ?? [];
  return (
    <Card title="Bookings" actions={<MonthStepper month={month} onChange={setMonth} />} className="lg:col-span-2">
      <Table>
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
            empty={items.length === 0}
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
  const items = expenses.data?.items ?? [];
  return (
    <Card title="Expenses" actions={<MonthStepper month={month} onChange={setMonth} />} className="lg:col-span-2">
      <ErrorAlert error={viewError} />
      <Table>
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
            empty={items.length === 0}
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
      className="lg:col-span-2"
    >
      {summary.error ? (
        <ErrorAlert error={summary.error} />
      ) : !f ? (
        <Skeleton className="h-40" />
      ) : f.nightsBooked === 0 && f.grossCents === 0 && f.ownerExpensesCents === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No stays or expenses in {monthLabel(month)} yet.</p>
      ) : (
        <div className="grid gap-x-10 sm:grid-cols-2">
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
