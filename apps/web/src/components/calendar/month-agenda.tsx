import { useEffect, useRef } from 'react';
import { stayLabel, type AgendaEvent } from '../../lib/calendar';
import { cx } from '../../lib/cx';
import { channelLabel } from '../../lib/format';
import { BookingsIllustration } from '../illustrations/bookings';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { Pill } from '../ui/pill';

const DAY_HEADING = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * The month's arrivals and departures, day by day, beside the calendar. Today is marked and days gone by are quieter.
 * With `onSelect`, each one opens its booking.
 */
export function MonthAgenda({
  month,
  agenda,
  today,
  propertyNames,
  showProperty,
  onSelect,
  className,
}: {
  month: string;
  agenda: { date: string; events: AgendaEvent[] }[];
  today: string;
  propertyNames: Map<string, string>;
  showProperty: boolean;
  onSelect?: (stayId: string) => void;
  className?: string;
}) {
  const monthName = new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-CA', { month: 'long', timeZone: 'UTC' });
  // Where the list scrolls (wide screens), open it at today (or the next day with anything on), not the 1st.
  const list = useRef<HTMLOListElement>(null);
  const firstUpcoming = agenda.find((d) => d.date >= today)?.date;
  useEffect(() => {
    const el = list.current;
    const target = firstUpcoming && el?.querySelector<HTMLElement>(`[data-date="${firstUpcoming}"]`);
    if (el && target) el.scrollTop = target.offsetTop - el.offsetTop;
  }, [firstUpcoming, month]);
  return (
    <Card title="Arrivals and departures" description={`Who’s coming and going in ${monthName}.`} className={className}>
      {agenda.length === 0 ? (
        <EmptyState size="compact" illustration={<BookingsIllustration />} title="Nobody coming or going">
          No check-ins or check-outs this month yet.
        </EmptyState>
      ) : (
        <ol
          ref={list}
          className="scroll-area -mr-2 flex flex-col gap-4 pr-2 @[68.75rem]/content:max-h-[min(44rem,70dvh)] @[68.75rem]/content:overflow-y-auto"
        >
          {agenda.map(({ date, events }) => (
            <li key={date} data-date={date} className={cx(date < today && 'opacity-60')}>
              <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-muted uppercase">
                {DAY_HEADING.format(new Date(`${date}T00:00:00Z`))}
                {date === today && <Pill tone="sage">Today</Pill>}
              </h3>
              <ul className="flex flex-col gap-1">
                {events.map((event) => (
                  <li key={`${event.type}-${event.stay.id}`}>
                    <AgendaItem
                      event={event}
                      property={showProperty ? (propertyNames.get(event.stay.propertyId) ?? null) : null}
                      onSelect={onSelect}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function AgendaItem({
  event,
  property,
  onSelect,
}: {
  event: AgendaEvent;
  property: string | null;
  onSelect?: (stayId: string) => void;
}) {
  const { stay } = event;
  const checkIn = event.type === 'CHECK_IN';
  const detail = [stayLabel(stay), stay.kind === 'GUEST' ? channelLabel(stay.channel) : null, property]
    .filter(Boolean)
    .join(' · ');
  const body = (
    <>
      {/* Coming (green) or going (purple), as in Coming up and the calendar's clean markers. */}
      <span
        aria-hidden
        className={cx('mt-1.5 size-2.5 shrink-0 rounded-full', checkIn ? 'bg-sage-mid' : 'bg-lavender-deep')}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{checkIn ? 'Check-in' : 'Check-out and clean'}</span>{' '}
        <span className="block text-sm text-pretty text-muted">{detail}</span>
      </span>
    </>
  );
  const className = 'flex w-full items-start gap-3 rounded-control px-2 py-1.5 text-left';
  return onSelect ? (
    <button
      type="button"
      onClick={() => onSelect(stay.id)}
      className={cx(className, 'transition-colors hover:bg-ground focus-visible:bg-ground')}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}
