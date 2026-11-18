import { cx } from '../../lib/cx';
import { formatCentsShort } from '../../lib/money';
import { monthInitial } from '../../lib/trends';

/**
 * The small charts under each KPI (docs/design/KpiCards.dc.html, Option A). Decorative: the figures beside them
 * carry the meaning, so they are hidden from screen readers. Every value comes from GET /v1/dashboard.
 */

/** Gross revenue: one segment per stay, each as wide as its share of the month's gross. Empty with no gross. */
export function StaysBar({ grossByStayCents }: { grossByStayCents: number[] }) {
  if (grossByStayCents.every((cents) => cents === 0))
    return <span aria-hidden className="block h-1.5 rounded-[3px] bg-line" />;
  const gap = grossByStayCents.length > 40 ? 'gap-px' : grossByStayCents.length > 16 ? 'gap-0.5' : 'gap-1';
  return (
    <span aria-hidden className={cx('flex', gap)}>
      {grossByStayCents.map((cents, i) => (
        <span
          key={i}
          className="h-1.5 min-w-px rounded-[3px] bg-[#4F7A63] transition-[flex-grow] duration-500 ease-out"
          style={{ flexGrow: cents, flexBasis: 0 }}
        />
      ))}
    </span>
  );
}

/** TruPlan fees: a bar filled to the fee's share of gross. */
export function ShareBar({ shareBps }: { shareBps: number | null }) {
  return (
    <span aria-hidden className="flex h-1.5 overflow-hidden rounded-[3px] bg-lavender-tint">
      <span
        className="bg-[#6A5FB8] transition-[width] duration-500 ease-out"
        style={{ width: `${(shareBps ?? 0) / 100}%` }}
      />
    </span>
  );
}

const BOOKED = '#5F8FCB';
const OPEN = '#E3E4E1';

/**
 * Nights booked: one segment per day. Booked nights are blue; across several properties a day is as blue as the
 * share of properties booked that night. Nights that couldn't be sold (owner stays, blocks) are paler.
 */
export function NightsStrip({ nightsByDay }: { nightsByDay: { booked: number; available: number }[] }) {
  return (
    // 1px gaps in narrow cards, so 31 days still read as a strip rather than hairlines.
    <span aria-hidden className="flex gap-px @[13rem]/kpi:gap-0.5">
      {nightsByDay.map((d, i) => {
        const share = d.available > 0 ? Math.min(1, d.booked / d.available) : 0;
        const background =
          d.available === 0
            ? '#F1F2EE'
            : share === 1
              ? BOOKED
              : share === 0
                ? OPEN
                : `color-mix(in srgb, ${BOOKED} ${Math.round(share * 100)}%, ${OPEN})`;
        return (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-[2px] transition-[background-color] duration-300"
            style={{ background }}
            data-share={share}
          />
        );
      })}
    </span>
  );
}

/** Avg. nightly earnings: the lowest and highest nightly earnings of the period. */
export function NightlyRange({ lowCents, highCents }: { lowCents: number | null; highCents: number | null }) {
  return (
    <span className="figure flex justify-between text-xs text-muted">
      <span>Low {lowCents === null ? '—' : formatCentsShort(lowCents)}</span>
      <span>High {highCents === null ? '—' : formatCentsShort(highCents)}</span>
    </span>
  );
}

/**
 * The year's months as small bars, each lettered underneath (J F M…, in the small-label style: bold tracked caps, the latest in ink). Hovering a bar shows its month and value;
 * months still to come are paler. The bars are a glance: the card opens the full trend for numbers and a table.
 */
export function MonthBars({
  months,
  values,
  upcoming,
  color,
  describe,
}: {
  months: string[];
  values: (number | null)[];
  upcoming: boolean[];
  color: string;
  /** The month and its figure, for the tooltip: "Aug 2026 · $6,125.00". */
  describe: (i: number) => string;
}) {
  const max = Math.max(0, ...values.map((v) => v ?? 0));
  const latest = upcoming.lastIndexOf(false);
  return (
    <span aria-hidden className="flex flex-col gap-1">
      <span className="flex h-7 items-end gap-[2px]">
        {values.map((v, i) => {
          const share = max > 0 && v ? Math.max(0, v) / max : 0;
          return (
            <span key={i} className="group/bar relative flex h-full min-w-px flex-1 items-end">
              <span
                className="w-full rounded-t-[2px] transition-[height,filter] duration-500 ease-out group-hover/bar:brightness-110"
                style={{
                  height: share > 0 ? `max(${share * 100}%, 3px)` : '2px',
                  background: share > 0 ? color : 'var(--color-line)',
                  opacity: upcoming[i] ? 0.45 : 1,
                }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-control bg-ink px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-white shadow-lg group-hover/bar:block">
                {describe(i)}
              </span>
            </span>
          );
        })}
      </span>
      {/* Lettered like the app's small labels (bold tracked caps); the latest month that isn't still to come is in ink. */}
      <span className="flex gap-[2px]">
        {months.map((m, i) => (
          <span
            key={m}
            className={cx(
              'min-w-px flex-1 text-center text-[9.5px] leading-none font-bold tracking-[0.08em] uppercase',
              i === latest ? 'text-ink' : 'text-muted/80',
            )}
          >
            {monthInitial(m)}
          </span>
        ))}
      </span>
    </span>
  );
}
