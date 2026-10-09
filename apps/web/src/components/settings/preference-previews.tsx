import { cx } from '../../lib/cx';
import type { WeekStart } from '../../lib/dates';
import { weekdayNames } from '../../lib/preferences';

/** A week row as calendars will show it: weekend days shaded, today's column marked. */
export function WeekPreview({ weekStartsOn }: { weekStartsOn: WeekStart }) {
  const names = weekdayNames(weekStartsOn);
  // October 2026 starts on a Thursday; show the week of Oct 4–10 (Sunday first) or Oct 5–11 (Monday first).
  const first = weekStartsOn === 0 ? 4 : 5;
  return (
    <span aria-hidden className="grid grid-cols-7 gap-0.5 p-2">
      {names.map((n, i) => {
        const weekend = n === 'Saturday' || n === 'Sunday';
        return (
          <span key={n} className="flex flex-col items-center gap-1">
            <span className={cx('text-[0.65rem] font-semibold', i === 0 ? 'text-sage-deep' : 'text-muted')}>
              {n.slice(0, 2)}
            </span>
            <span
              className={cx(
                'figure grid size-7 place-items-center rounded-full text-xs',
                i === 0 ? 'bg-primary font-bold text-white' : weekend ? 'bg-ground text-muted' : 'text-ink',
              )}
            >
              {first + i}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** A ball bouncing along its path (full motion) or simply resting (reduced). Static: it only illustrates the choice. */
export function MotionPreview({ reduced }: { reduced: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 240 60" className="block h-[3.75rem] w-full">
      <line x1="16" y1="50" x2="224" y2="50" stroke="var(--color-line)" strokeWidth="2" strokeLinecap="round" />
      {reduced ? (
        <circle cx="120" cy="40" r="9" fill="var(--color-sage-deep)" />
      ) : (
        <>
          <path
            d="M40 41 Q 80 -4 120 41 Q 160 -4 200 41"
            fill="none"
            stroke="var(--color-muted)"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            strokeDasharray="3 5"
          />
          {[
            [40, 41, 0.2],
            [80, 19, 0.35],
            [120, 41, 0.55],
            [160, 19, 0.75],
          ].map(([cx, cy, o]) => (
            <circle key={cx} cx={cx} cy={cy} r="9" fill="var(--color-sage-deep)" fillOpacity={o} />
          ))}
          <circle cx="200" cy="41" r="9" fill="var(--color-sage-deep)" />
        </>
      )}
    </svg>
  );
}
