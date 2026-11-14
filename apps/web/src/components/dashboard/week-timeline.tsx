import type { CSSProperties } from 'react';
import { Sparkles } from 'lucide-react';
import type { CalendarStay } from '../../lib/calendar';
import { stayLabel } from '../../lib/calendar';
import { propertyColors, propertyColorValue } from '../../lib/cleans';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { timelineDays, timelineRow, TIMELINE_DAYS } from '../../lib/timeline';

/** A bar's height, the gap between lanes, and the room under them for clean markers. */
const BAR_H = 26;
const LANE_GAP = 4;
const MARKS_H = 18;

const weekday = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'UTC' });

/** A bar's look: guest stays in the property's colour, owner stays striped lavender, blocks dashed and quiet. */
function barStyle(stay: CalendarStay, color: string): { className: string; style: CSSProperties } {
  if (stay.kind === 'OWNER_STAY') {
    return {
      className: 'border border-lavender-deep/35 text-lavender-deep',
      style: {
        background:
          'repeating-linear-gradient(135deg, var(--color-lavender-tint) 0 6px, color-mix(in srgb, var(--color-lavender-mid) 22%, var(--color-lavender-tint)) 6px 12px)',
      },
    };
  }
  if (stay.kind === 'BLOCK') return { className: 'border border-dashed border-ink/25 bg-ground text-muted', style: {} };
  return {
    className: 'border text-ink',
    style: {
      background: `color-mix(in srgb, ${color} 20%, var(--color-surface))`,
      borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
    },
  };
}

/**
 * Dashboard: the next seven days at a glance. One row per property (its colour beside its name), a column per day
 * (today marked), each stay as a bar from midday on check-in to midday on check-out. Guest stays are in the
 * property's colour, owner stays striped lavender; a gold marker shows each clean a check-out needs. Narrow, each
 * property's name sits above its row.
 */
export function WeekTimeline({
  start,
  stays,
  properties,
  allProperties,
}: {
  /** Today: the first day shown. */
  start: string;
  stays: CalendarStay[];
  /** The properties shown, one row each. */
  properties: { id: string; name: string }[];
  /** Every property, so each keeps its colour whatever the scope. */
  allProperties: { id: string; name: string }[];
}) {
  const days = timelineDays(start);
  const colors = propertyColors(allProperties);
  const rows = [...properties]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({
      property: p,
      ...timelineRow(
        stays.filter((s) => s.propertyId === p.id),
        start,
      ),
    }));
  const pos = (at: number) => `${(at / TIMELINE_DAYS) * 100}%`;

  return (
    <div className="@container/timeline flex flex-col gap-3">
      {/* Day headers, over the day columns */}
      <div className="grid grid-cols-7 @xl/timeline:grid-cols-[9rem_repeat(7,minmax(0,1fr))]">
        <span className="hidden @xl/timeline:block" />
        {days.map((d, i) => (
          <span key={d} className="flex flex-col items-center gap-0.5 text-center">
            <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">{weekday(d)}</span>
            <span
              className={cx(
                'figure grid size-7 place-items-center rounded-full text-sm font-semibold',
                i === 0 ? 'bg-primary text-white' : 'text-ink',
              )}
            >
              {Number(d.slice(8))}
              {i === 0 && <span className="sr-only"> (today)</span>}
            </span>
          </span>
        ))}
      </div>

      <div className="flex flex-col divide-y divide-line-soft">
        {rows.map(({ property, bars, cleans, lanes }) => {
          const color = propertyColorValue(colors.get(property.id));
          const height = lanes * BAR_H + (lanes - 1) * LANE_GAP + MARKS_H + 8;
          return (
            <div
              key={property.id}
              className="grid grid-cols-7 items-center gap-y-1.5 py-2.5 @xl/timeline:grid-cols-[9rem_repeat(7,minmax(0,1fr))]"
            >
              <p className="col-span-7 flex min-w-0 items-center gap-2 pr-3 @xl/timeline:col-span-1">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
                <span className="truncate text-sm font-semibold text-ink">{property.name}</span>
              </p>
              <div className="relative col-span-7" style={{ height }}>
                {/* Day columns, today tinted */}
                <div aria-hidden className="absolute inset-0 grid grid-cols-7">
                  {days.map((d, i) => (
                    <span
                      key={d}
                      className={cx('border-l border-line-soft first:border-l-0', i === 0 && 'bg-sage-tint/40')}
                    />
                  ))}
                </div>
                <ul aria-label={`${property.name}: the next 7 days`} className="contents">
                  {bars.length === 0 && <li className="sr-only">Nothing booked</li>}
                  {bars.map((b) => {
                    const look = barStyle(b.stay, color);
                    const label = stayLabel(b.stay);
                    return (
                      <li
                        key={b.stay.id}
                        title={`${label}, ${dayLabel(b.stay.checkInDate)} to ${dayLabel(b.stay.checkOutDate)}`}
                        className={cx(
                          'absolute flex items-center overflow-hidden px-2 text-xs font-semibold whitespace-nowrap',
                          look.className,
                          b.clippedStart ? 'rounded-l-none border-l-0' : 'rounded-l-md',
                          b.clippedEnd ? 'rounded-r-none border-r-0' : 'rounded-r-md',
                        )}
                        style={{
                          ...look.style,
                          left: `calc(${pos(b.from)} + ${b.clippedStart ? 0 : 2}px)`,
                          width: `calc(${pos(b.to - b.from)} - ${(b.clippedStart ? 0 : 2) + (b.clippedEnd ? 0 : 2)}px)`,
                          top: 4 + b.lane * (BAR_H + LANE_GAP),
                          height: BAR_H,
                        }}
                      >
                        <span className="min-w-0 truncate">{label}</span>
                        <span className="sr-only">
                          , {dayLabel(b.stay.checkInDate)} to {dayLabel(b.stay.checkOutDate)}
                        </span>
                      </li>
                    );
                  })}
                  {cleans.map((d) => (
                    <li
                      key={`clean-${d}`}
                      title={`Clean, ${dayLabel(days[d]!)}`}
                      className="absolute grid size-[18px] -translate-x-1/2 place-items-center rounded-full bg-surface ring-1 ring-amber-mid"
                      style={{ left: pos(d + 0.5), bottom: 2 }}
                    >
                      <Sparkles aria-hidden className="size-3 text-amber-deep" strokeWidth={2} />
                      <span className="sr-only">Clean, {dayLabel(days[d]!)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Key */}
      <ul
        aria-label="Timeline key"
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-ink"
      >
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-5 rounded-sm border border-sage-mid/55 bg-sage-tint" /> Guest stay, in
          the property’s colour
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-5 rounded-sm border border-lavender-deep/35"
            style={{ background: barStyle({ kind: 'OWNER_STAY' } as CalendarStay, '').style.background }}
          />{' '}
          Owner stay
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="grid size-4 place-items-center rounded-full bg-surface ring-1 ring-amber-mid">
            <Sparkles className="size-2.5 text-amber-deep" strokeWidth={2} />
          </span>{' '}
          Clean
        </li>
      </ul>
    </div>
  );
}
