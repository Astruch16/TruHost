import { cx } from '../../lib/cx';
import { formatCentsShort } from '../../lib/money';

/**
 * The small charts under each KPI (docs/design/KpiCards.dc.html, Option A). Decorative: the figures beside them
 * carry the meaning, so they are hidden from screen readers. Every value comes from GET /v1/dashboard.
 */

/** Gross revenue: one segment per stay, each as wide as its share of the month's gross. */
export function StaysBar({ grossByStayCents }: { grossByStayCents: number[] }) {
  if (grossByStayCents.length === 0) return <span aria-hidden className="block h-1.5 rounded-[3px] bg-line" />;
  const gap = grossByStayCents.length > 40 ? 'gap-px' : grossByStayCents.length > 16 ? 'gap-0.5' : 'gap-1';
  return (
    <span aria-hidden className={cx('flex', gap)}>
      {grossByStayCents.map((cents, i) => (
        <span key={i} className="h-1.5 min-w-px rounded-[3px] bg-[#4F7A63]" style={{ flexGrow: cents, flexBasis: 0 }} />
      ))}
    </span>
  );
}

/** TruPlan fees: a bar filled to the fee's share of gross. */
export function ShareBar({ shareBps }: { shareBps: number | null }) {
  return (
    <span aria-hidden className="flex h-1.5 overflow-hidden rounded-[3px] bg-lavender-tint">
      <span className="bg-[#6A5FB8]" style={{ width: `${(shareBps ?? 0) / 100}%` }} />
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
        return <span key={i} className="h-1.5 flex-1 rounded-[2px]" style={{ background }} data-share={share} />;
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
