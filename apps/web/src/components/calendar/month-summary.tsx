import type { Dashboard } from '../../lib/api-types';
import { type AgendaEvent, nextEvent } from '../../lib/calendar';
import { formatOccupancy } from '../../lib/format';
import { shortDate } from '../../lib/months';
import { KpiCard, KpiOf } from '../dashboard/kpi-card';
import { NightsStrip, StaysBar } from '../dashboard/kpi-charts';

type Agenda = { date: string; events: AgendaEvent[] }[];

/**
 * The month at a glance, above the calendar: nights booked and guest stays (from the API's reporting), and how many
 * check-ins and cleans the month holds, with the next of each. Same tiles as the dashboard's.
 */
export function MonthSummary({
  month,
  kpis,
  agenda,
  today,
}: {
  month: string;
  kpis: Dashboard['kpis'];
  agenda: Agenda;
  today: string;
}) {
  const days = daysInMonth(month);
  const count = (type: AgendaEvent['type']) =>
    agenda.reduce((n, d) => n + d.events.filter((e) => e.type === type).length, 0);
  const marks = (type: AgendaEvent['type']) => {
    const on = new Set(agenda.filter((d) => d.events.some((e) => e.type === type)).map((d) => Number(d.date.slice(8))));
    return Array.from({ length: days }, (_, i) => on.has(i + 1));
  };
  const next = (type: AgendaEvent['type']) => {
    const date = nextEvent(agenda, type, today);
    if (date === today) return <strong className="text-ink">Today</strong>;
    if (date)
      return (
        <>
          Next <strong className="text-ink">{shortDate(date)}</strong>
        </>
      );
    return month < today.slice(0, 7) ? 'All done' : 'None still to come';
  };

  return (
    <div className="grid grid-cols-2 gap-3 @2xl/content:grid-cols-4 @2xl/content:gap-4">
      <KpiCard
        label="Nights booked"
        value={<KpiOf value={kpis.nightsBooked} of={kpis.availableNights} />}
        support={
          kpis.occupancyBps === null ? (
            'No nights available'
          ) : (
            <>
              <strong className="text-ink">{formatOccupancy(kpis.occupancyBps)}</strong> occupancy
            </>
          )
        }
        chart={<NightsStrip nightsByDay={kpis.nightsByDay} />}
      />
      <KpiCard
        label="Guest stays"
        value={kpis.stays}
        support={
          kpis.incompleteBookings > 0 ? (
            <>
              <strong className="text-ink">{kpis.incompleteBookings}</strong> waiting on payout
            </>
          ) : kpis.stays > 0 ? (
            'All payouts entered'
          ) : (
            'None yet'
          )
        }
        chart={<StaysBar grossByStayCents={kpis.grossByStayCents} />}
      />
      <KpiCard
        label="Check-ins"
        value={count('CHECK_IN')}
        support={next('CHECK_IN')}
        chart={<DayMarks marks={marks('CHECK_IN')} color="var(--color-sage-mid)" />}
      />
      <KpiCard
        label="Cleans to schedule"
        value={count('CHECK_OUT')}
        support={next('CHECK_OUT')}
        chart={<DayMarks marks={marks('CHECK_OUT')} color="var(--color-lavender-deep)" />}
      />
    </div>
  );
}

/** One mark per day of the month, filled on days with the event (as NightsStrip draws nights). */
function DayMarks({ marks, color }: { marks: boolean[]; color: string }) {
  return (
    <span aria-hidden className="flex gap-px @[13rem]/kpi:gap-0.5">
      {marks.map((on, i) => (
        <span
          key={i}
          className="h-1.5 flex-1 rounded-[2px]"
          style={{ background: on ? color : 'var(--color-line-soft)' }}
        />
      ))}
    </span>
  );
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}
