import { checkoutsByDay, monthGrid, type CalendarStay } from '../../lib/calendar';
import { cx } from '../../lib/cx';
import { monogram } from '../../lib/dashboard-format';
import { useWeekStart, weekdayNames } from '../../lib/preferences';

const BAR_H = 22;
const BAR_GAP = 4;

/** Month grid with stays as continuous bars and check-outs marked as cleans to schedule. */
export function MonthCalendar({
  month,
  stays,
  propertyNames,
  today,
  showProperty,
}: {
  month: string;
  stays: CalendarStay[];
  propertyNames: Map<string, string>;
  today: string | null;
  showProperty: boolean;
}) {
  const weekStartsOn = useWeekStart();
  const weeks = monthGrid(month, stays, weekStartsOn);
  const checkouts = checkoutsByDay(month, stays);

  return (
    <div className="scroll-area overflow-x-auto">
      <div className="min-w-[640px] overflow-hidden rounded-inner border border-line">
        <div className="grid grid-cols-7 border-b border-line bg-ground text-xs font-semibold text-muted">
          {weekdayNames(weekStartsOn).map((d) => (
            <div key={d} className="px-2.5 py-2">
              {d.slice(0, 3)}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="relative grid grid-cols-7 border-b border-line-soft last:border-b-0">
            {week.days.map((day, di) => (
              <div
                key={di}
                className={cx(
                  'flex flex-col gap-1 border-r border-line-soft px-2.5 pt-2 last:border-r-0',
                  !day && 'bg-ground/60',
                )}
                style={{ minHeight: 64 + week.lanes * (BAR_H + BAR_GAP) }}
              >
                {day && (
                  <span
                    className={cx(
                      'figure grid size-7 place-items-center rounded-full text-sm',
                      day === today ? 'bg-primary font-bold text-white' : 'text-ink',
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                )}
                {day && checkouts.has(day) && (
                  <span className="mt-auto mb-1.5 flex items-center gap-1 text-xs font-medium text-lavender-deep">
                    <span aria-hidden className="size-1.5 rounded-full bg-lavender-deep" />
                    Clean{checkouts.get(day)! > 1 ? ` ×${checkouts.get(day)}` : ''}
                  </span>
                )}
              </div>
            ))}
            {week.segments.map((seg) => {
              const label = `${showProperty ? `${monogram(propertyNames.get(seg.stay.propertyId) ?? '')} · ` : ''}${
                seg.stay.kind === 'GUEST'
                  ? `${seg.stay.nights} night${seg.stay.nights === 1 ? '' : 's'}`
                  : seg.stay.kind === 'OWNER_STAY'
                    ? 'Owner stay'
                    : 'Blocked'
              }`;
              return (
                <div
                  key={seg.stay.id}
                  title={`${propertyNames.get(seg.stay.propertyId) ?? ''}: ${seg.stay.checkInDate} → ${seg.stay.checkOutDate}`}
                  className={cx(
                    'absolute flex items-center overflow-hidden px-2 text-xs font-semibold whitespace-nowrap',
                    seg.stay.kind === 'GUEST' && 'bg-blue-tint text-blue-deep',
                    seg.stay.kind === 'OWNER_STAY' && 'bg-lavender-tint text-lavender-deep',
                    seg.stay.kind === 'BLOCK' && 'bg-line-soft text-muted',
                    seg.continuesBefore ? 'rounded-l-none' : 'rounded-l-md',
                    seg.continuesAfter ? 'rounded-r-none' : 'rounded-r-md',
                  )}
                  style={{
                    left: `calc(${(seg.startCol / 7) * 100}% + ${seg.continuesBefore ? 0 : 6}px)`,
                    width: `calc(${((seg.endCol - seg.startCol + 1) / 7) * 100}% - ${(seg.continuesBefore ? 0 : 6) + (seg.continuesAfter ? 0 : 6)}px)`,
                    top: 40 + seg.lane * (BAR_H + BAR_GAP),
                    height: BAR_H,
                  }}
                >
                  <span className="min-w-0 truncate">{!seg.continuesBefore || seg.startCol === 0 ? label : ''}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="h-2.5 w-5 rounded-sm bg-blue-tint" /> Guest stay
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="h-2.5 w-5 rounded-sm bg-lavender-tint" /> Owner stay
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 rounded-full bg-lavender-deep" /> Clean to schedule
      </span>
    </div>
  );
}
