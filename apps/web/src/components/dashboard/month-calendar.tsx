import { checkoutsByDay, monthGrid, monthLegend, stayLabel, stayStyle, type CalendarStay } from '../../lib/calendar';
import { shortDate } from '../../lib/months';
import { cx } from '../../lib/cx';
import { monogram } from '../../lib/dashboard-format';
import { useWeekStart, weekdayNames } from '../../lib/preferences';

const BAR_H = 22;
const BAR_GAP = 4;

/**
 * Month grid with stays as continuous bars, from the middle of the check-in day to the middle of the check-out day (as
 * on Airbnb and Vrbo), and check-outs marked as cleans to schedule. Bars say who's staying when the name is known.
 * With `onSelect`, each bar is a button (e.g. to open the booking). `roomy` is the full-page size: taller days,
 * weekends shaded, days gone by quieter.
 */
export function MonthCalendar({
  month,
  stays,
  propertyNames,
  today,
  showProperty,
  onSelect,
  roomy = false,
  showCleans = true,
}: {
  month: string;
  stays: CalendarStay[];
  propertyNames: Map<string, string>;
  today: string | null;
  showProperty: boolean;
  onSelect?: (stayId: string) => void;
  roomy?: boolean;
  /** Mark check-outs as cleans to schedule (staff); owners see the stays only. */
  showCleans?: boolean;
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
                  !day
                    ? 'bg-ground/60'
                    : roomy && day === today
                      ? 'bg-sage-tint/30'
                      : roomy && isWeekend(di, weekStartsOn) && 'bg-ground/45',
                )}
                style={{ minHeight: (roomy ? 92 : 64) + week.lanes * (BAR_H + BAR_GAP) }}
              >
                {day && (
                  <span
                    className={cx(
                      'figure grid size-7 place-items-center rounded-full text-sm',
                      day === today
                        ? 'bg-primary font-bold text-white'
                        : roomy && today && day < today
                          ? 'text-muted'
                          : 'text-ink',
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                )}
                {showCleans && day && checkouts.has(day) && (
                  <span className="mt-auto mb-1.5 flex items-center gap-1 text-xs font-medium text-lavender-deep">
                    <span aria-hidden className="size-1.5 rounded-full bg-lavender-deep" />
                    Clean{checkouts.get(day)! > 1 ? ` ×${checkouts.get(day)}` : ''}
                  </span>
                )}
              </div>
            ))}
            {week.segments.map((seg) => {
              const style = stayStyle(seg.stay);
              const property = propertyNames.get(seg.stay.propertyId) ?? '';
              const label = `${showProperty ? `${monogram(property)} · ` : ''}${stayLabel(seg.stay)}`;
              const description = `${showProperty ? `${property}: ` : ''}${stayLabel(seg.stay)}, ${style.label}, ${shortDate(
                seg.stay.checkInDate,
              )} to ${shortDate(seg.stay.checkOutDate)}`;
              // Day columns, fractional: a stay starts halfway through its check-in day and ends halfway through its
              // check-out day. A small inset at those midpoints leaves a gap between back-to-back stays.
              const from = seg.startCol + (seg.startsMidDay ? 0.5 : 0);
              const to = seg.endCol + (seg.endsMidDay ? 0.5 : 1);
              const insetStart = seg.continuesBefore ? 0 : 2;
              const insetEnd = seg.continuesAfter ? 0 : 2;
              // The label goes where the bar starts, or at the start of a week it runs into (if there's room). A start
              // with less than a day of room that carries on to another row of this month leaves it to that row.
              const room = to - from >= 1;
              const continuesBelow = seg.continuesAfter && wi < weeks.length - 1;
              const showLabel = seg.continuesBefore ? seg.startCol === 0 && room : room || !continuesBelow;
              const Bar = onSelect ? 'button' : 'div';
              return (
                <Bar
                  key={seg.stay.id}
                  {...(onSelect
                    ? { type: 'button' as const, onClick: () => onSelect(seg.stay.id), 'aria-label': description }
                    : {})}
                  title={description}
                  className={cx(
                    'absolute flex items-center overflow-hidden px-2 text-left text-xs font-semibold whitespace-nowrap',
                    style.bar,
                    // Outlined in a darker shade; a bar carrying on into another week is left open at that end.
                    'border-y',
                    style.edge,
                    seg.continuesBefore ? 'rounded-l-none border-l-0' : 'rounded-l-md border-l',
                    seg.continuesAfter ? 'rounded-r-none border-r-0' : 'rounded-r-md border-r',
                    onSelect &&
                      'cursor-pointer transition-[filter,box-shadow] hover:shadow-[0_2px_6px_rgb(0_0_0/0.12)] hover:brightness-[0.97] focus-visible:z-10',
                  )}
                  style={{
                    left: `calc(${(from / 7) * 100}% + ${insetStart}px)`,
                    width: `calc(${((to - from) / 7) * 100}% - ${insetStart + insetEnd}px)`,
                    top: 40 + seg.lane * (BAR_H + BAR_GAP),
                    height: BAR_H,
                  }}
                >
                  <span className="min-w-0 truncate">{showLabel ? label : ''}</span>
                </Bar>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Saturday or Sunday, for a column of a week that starts on `weekStartsOn`. */
const isWeekend = (column: number, weekStartsOn: number) => [0, 6].includes((column + weekStartsOn) % 7);

/**
 * What the colours mean, for this month only: a channel (or owner stay, or block) is listed once a stay of it is on
 * the calendar, and "Clean to schedule" once a check-out falls in the month. Nothing on the calendar, no legend.
 */
export function CalendarLegend({
  month,
  stays,
  showCleans = true,
}: {
  month: string;
  stays: readonly CalendarStay[] | undefined;
  showCleans?: boolean;
}) {
  const legend = monthLegend(month, stays ?? []);
  const styles = legend.styles;
  const cleans = showCleans && legend.cleans;
  if (styles.length === 0 && !cleans) return null;
  return (
    <ul aria-label="Calendar key" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-ink">
      {styles.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden className={cx('h-2.5 w-5 rounded-sm', s.swatch)} /> {s.label}
        </li>
      ))}
      {cleans && (
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-lavender-deep" /> Clean to schedule
        </li>
      )}
    </ul>
  );
}
