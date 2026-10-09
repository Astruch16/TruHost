import { CalendarPlus, ReceiptText, Upload } from 'lucide-react';
import type { Dashboard } from '../../lib/api-types';
import type { CalendarStay } from '../../lib/calendar';
import { formatChange, formatPoints, greeting, longDate } from '../../lib/dashboard-format';
import { formatBps, formatOccupancy } from '../../lib/format';
import { monthLabel } from '../../lib/months';
import { LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { MonthStepper } from '../ui/month-stepper';
import { cx } from '../../lib/cx';
import { updatingStyles } from '../../lib/styles';
import { Skeleton } from '../ui/skeleton';
import { ComingUp } from './coming-up';
import { BookingsIllustration } from '../illustrations/bookings';
import { RevenueIllustration } from '../illustrations/revenue';
import { PropertyCard } from '../property-card';
import { KpiCard, KpiMoney, KpiOf, type KpiChange } from './kpi-card';
import { NightlyRange, NightsStrip, ShareBar, StaysBar } from './kpi-charts';
import { CalendarLegend, MonthCalendar } from './month-calendar';
import { NeedsAttention } from './needs-attention';
import { RevenueBreakdown } from './revenue-breakdown';

export type DashboardAction = 'booking' | 'expense' | 'receipt';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const shortMonth = (month: string) => monthLabel(month).split(' ')[0]!.slice(0, 3);

/** Two by two on narrow content, four across from medium up (container query on the content area). */
const KPI_GRID = 'grid grid-cols-2 gap-3 @2xl/content:grid-cols-4 @2xl/content:gap-4';

/**
 * The admin dashboard's layout, from data alone (no fetching), so the real page and the dev preview render the
 * same thing. Layout follows the width of the content area (container queries), not the viewport:
 * - narrow: one column; rail panels stack under the main content
 * - medium (≥ 42rem): KPIs four across; rail panels in a two-column grid below
 * - wide (≥ 68.75rem ≈ 1100px of content): main column plus a 380px right rail
 * - extra wide (≥ 100rem): performance and breakdown side by side, calendar full width beneath
 */
export function DashboardView({
  firstName,
  now,
  month,
  onMonthChange,
  scope,
  properties,
  dashboard: d,
  dashboardUpdating = false,
  dashboardError,
  onRetryDashboard,
  retryingDashboard,
  stays,
  staysMonth,
  staysUpdating = false,
  staysError,
  onRetryStays,
  retryingStays,
  onAction,
  onAddProperty,
}: {
  firstName: string;
  now: Date;
  month: string;
  onMonthChange: (month: string) => void;
  /** Selected property in the switcher, or null for all. */
  scope: { propertyId: string | null; name: string | null };
  /** All properties the admin can see (for names and stable tints); undefined while loading. */
  properties: { id: string; name: string }[] | undefined;
  dashboard: Dashboard | undefined;
  /** `dashboard` is still the previous month's while the chosen month loads: it is shown dimmed. */
  dashboardUpdating?: boolean;
  dashboardError: unknown;
  onRetryDashboard: () => void;
  retryingDashboard: boolean;
  /** Confirmed stays overlapping the month; undefined while loading. */
  stays: CalendarStay[] | undefined;
  /** The month `stays` are for (the previous one while the chosen month loads). Defaults to `month`. */
  staysMonth?: string;
  staysUpdating?: boolean;
  staysError: unknown;
  onRetryStays: () => void;
  retryingStays: boolean;
  onAction: (action: DashboardAction) => void;
  onAddProperty: () => void;
}) {
  const propertyList = properties ?? [];
  const noProperties = properties !== undefined && properties.length === 0;
  const multi = !scope.propertyId && propertyList.length > 1;
  // After a failed load, sections that depend on the data show nothing (the KPI area offers a retry), never a
  // skeleton that suggests it is still loading.
  const failed = Boolean(dashboardError) && !d;
  const tintIndex = (id: string, fallback: number) => {
    const i = propertyList.findIndex((p) => p.id === id);
    return i === -1 ? fallback : i;
  };
  const railSkeleton = failed ? null : <Skeleton className="h-40 rounded-card" />;
  // While the next month loads, the figures on screen are still the previous month's: label them with their own
  // month and dim them, rather than blanking to skeletons.
  const dataMonth = d?.month ?? month;
  const calendarMonth = staysMonth ?? month;
  const dim = (updating: boolean) => ({ 'aria-busy': updating || undefined, className: updatingStyles(updating) });

  return (
    <div className="grid gap-6 @[68.75rem]/content:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
                {greeting(now.getHours())},
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-ink">{firstName}</h1>
              <p className="mt-1.5 text-muted">
                {longDate(now)}.{' '}
                {noProperties
                  ? 'Add your first property to get started.'
                  : `Here’s how ${scope.name ?? 'your portfolio'} is doing ${
                      d?.period === 'MONTH_TO_DATE' ? 'this month' : `in ${monthLabel(month)}`
                    }.`}
              </p>
            </div>
            <MonthStepper month={month} onChange={onMonthChange} />
          </div>
          {!noProperties && (
            <div className="mt-6">
              {failed ? (
                <LoadError what="the dashboard" onRetry={onRetryDashboard} retrying={retryingDashboard} />
              ) : !d ? (
                <div className={KPI_GRID}>
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-36 rounded-inner" />
                  ))}
                </div>
              ) : (
                <div {...dim(dashboardUpdating)}>
                  <Kpis d={d} />
                </div>
              )}
            </div>
          )}
        </Card>

        {noProperties ? (
          <Card>
            <EmptyState
              title="Add your first property"
              action={<Button onClick={onAddProperty}>Go to Properties</Button>}
            >
              Once a property exists you can add bookings and expenses, and this dashboard fills in from them.
            </EmptyState>
          </Card>
        ) : failed ? null : (
          <>
            <div className="grid gap-6 @[100rem]/content:grid-cols-2">
              <Card title="Property performance" description={monthLabel(dataMonth)}>
                {!d ? (
                  <Skeleton className="h-56 rounded-inner" />
                ) : (
                  <div
                    aria-busy={dashboardUpdating || undefined}
                    className={cx(
                      'grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-4',
                      updatingStyles(dashboardUpdating),
                    )}
                  >
                    {d.properties.map((p, i) => (
                      <PropertyCard
                        key={p.id}
                        property={{
                          id: p.id,
                          name: p.name,
                          location: `${p.city}, ${p.province}`,
                          archived: p.archived,
                          hasPlan: p.hasPlan,
                          photoUrl: p.coverPhoto?.thumbUrl ?? null,
                        }}
                        figures={p}
                        index={tintIndex(p.id, i)}
                        revenueLabel={`Gross, ${shortMonth(dataMonth)}`}
                      />
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Where the revenue went" description={monthLabel(dataMonth)}>
                {!d ? (
                  <Skeleton className="h-40" />
                ) : d.breakdown.grossCents === 0 &&
                  d.breakdown.ownerExpensesCents === 0 &&
                  d.breakdown.cleaningFeesCents === 0 ? (
                  <div {...dim(dashboardUpdating)}>
                    <EmptyState size="compact" illustration={<RevenueIllustration />} title="No revenue this month yet">
                      Once a stay's payout is entered, you'll see how it splits between owners, fees and expenses.
                    </EmptyState>
                  </div>
                ) : (
                  <div {...dim(dashboardUpdating)}>
                    <RevenueBreakdown breakdown={d.breakdown} feeRatesBps={d.kpis.feeRatesBps} />
                  </div>
                )}
              </Card>
            </div>

            <Card title="Bookings" description={monthLabel(calendarMonth)} actions={<CalendarLegend />}>
              {staysError && !stays ? (
                <LoadError what="the calendar" onRetry={onRetryStays} retrying={retryingStays} />
              ) : !stays ? (
                <Skeleton className="h-72" />
              ) : stays.length === 0 ? (
                <div {...dim(staysUpdating)}>
                  <EmptyState
                    size="compact"
                    illustration={<BookingsIllustration />}
                    title="No stays this month"
                    action={
                      <Button variant="secondary" onClick={() => onAction('booking')}>
                        Add booking
                      </Button>
                    }
                  >
                    Add a booking and it appears here as a bar across its nights.
                  </EmptyState>
                </div>
              ) : (
                <div {...dim(staysUpdating)}>
                  <MonthCalendar
                    month={calendarMonth}
                    stays={stays}
                    propertyNames={new Map(propertyList.map((p) => [p.id, p.name]))}
                    today={d?.today ?? null}
                    showProperty={multi}
                  />
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      {/* Rail: stacks under the main content (narrow), two columns below it (medium), right rail (wide). */}
      <aside className="grid min-w-0 content-start items-start gap-6 @2xl/content:grid-cols-2 @[68.75rem]/content:grid-cols-1">
        <Card title="Quick actions">
          <div className="flex flex-col gap-2">
            <Button block disabled={noProperties} onClick={() => onAction('booking')}>
              <CalendarPlus aria-hidden className="size-4" /> Add booking
            </Button>
            <Button block variant="secondary" disabled={noProperties} onClick={() => onAction('expense')}>
              <ReceiptText aria-hidden className="size-4" /> Add expense
            </Button>
            <Button block variant="secondary" disabled={noProperties} onClick={() => onAction('receipt')}>
              <Upload aria-hidden className="size-4" /> Upload receipt
            </Button>
          </div>
        </Card>
        {d ? (
          <div {...dim(dashboardUpdating)}>
            <NeedsAttention items={d.attention.items} total={d.attention.total} showProperty={multi} />
          </div>
        ) : (
          railSkeleton
        )}
        {d ? (
          <div {...dim(dashboardUpdating)}>
            <ComingUp items={d.upcoming.items} total={d.upcoming.total} showProperty={multi} />
          </div>
        ) : (
          railSkeleton
        )}
      </aside>
    </div>
  );
}

/** The four KPI cards: four across on wide screens, two by two below that. */
function Kpis({ d }: { d: Dashboard }) {
  const periodNote =
    d.period === 'MONTH_TO_DATE' ? 'Month to date' : d.period === 'UPCOMING' ? 'Booked so far' : undefined;
  const vs = d.comparison ? shortMonth(d.comparison.month) : '';
  const rel = (c: { changeBps: number | null } | undefined): KpiChange | null =>
    c && c.changeBps !== null
      ? { label: formatChange(c.changeBps), direction: c.changeBps > 0 ? 'up' : c.changeBps < 0 ? 'down' : 'flat', vs }
      : null;
  const k = d.kpis;

  return (
    <div className="flex flex-col gap-2">
      {/* Said once for all four cards, so their labels stay on one line. */}
      {periodNote && <p className="text-xs font-semibold tracking-wide text-muted uppercase">{periodNote}</p>}
      <div className={KPI_GRID}>
        <KpiCard
          label="Gross revenue"
          value={<KpiMoney cents={k.grossCents} />}
          chart={<StaysBar grossByStayCents={k.grossByStayCents} />}
          support={
            <>
              From <strong className="text-ink">{plural(k.stays, 'stay', 'stays')}</strong>
              {k.incompleteBookings > 0 && <> · {k.incompleteBookings} waiting on payout</>}
            </>
          }
          change={rel(d.comparison?.grossCents)}
        />
        <KpiCard
          label="TruPlan fees earned"
          value={<KpiMoney cents={k.managementFeeCents} />}
          chart={<ShareBar shareBps={k.feeShareBps} />}
          support={
            k.feeRatesBps.length === 0
              ? 'No plan in force'
              : k.feeRatesBps.length === 1
                ? `${formatBps(k.feeRatesBps[0]!)} of gross`
                : `Across ${plural(d.scope.propertyCount, 'property', 'properties')}`
          }
          change={rel(d.comparison?.managementFeeCents)}
        />
        <KpiCard
          label="Nights booked"
          value={<KpiOf value={k.nightsBooked} of={k.availableNights} />}
          chart={<NightsStrip nightsByDay={k.nightsByDay} />}
          support={
            k.occupancyBps === null ? (
              'No nights available'
            ) : (
              <>
                <strong className="text-ink">{formatOccupancy(k.occupancyBps)}</strong> occupancy
              </>
            )
          }
          change={
            d.comparison && d.comparison.occupancyBps.changeBps !== null
              ? {
                  label: formatPoints(d.comparison.occupancyBps.changeBps),
                  direction:
                    d.comparison.occupancyBps.changeBps > 0
                      ? 'up'
                      : d.comparison.occupancyBps.changeBps < 0
                        ? 'down'
                        : 'flat',
                  vs,
                }
              : null
          }
        />
        <KpiCard
          label="Avg. nightly earnings"
          value={k.avgNightlyEarningsCents === null ? '—' : <KpiMoney cents={k.avgNightlyEarningsCents} />}
          chart={<NightlyRange lowCents={k.nightlyLowCents} highCents={k.nightlyHighCents} />}
          support={
            k.completeNights > 0 ? (
              <>
                Across <strong className="text-ink">{plural(k.completeNights, 'night', 'nights')}</strong>
              </>
            ) : (
              'No completed stays yet'
            )
          }
          change={rel(d.comparison?.avgNightlyEarningsCents)}
        />
      </div>
    </div>
  );
}
