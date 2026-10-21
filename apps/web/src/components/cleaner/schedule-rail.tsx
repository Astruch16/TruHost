import { Link } from '@tanstack/react-router';
import { useQueries } from '@tanstack/react-query';
import type { CleanSummary, SupplyItem, SupplyState } from '@truhost/shared';
import { CalendarDays, ChevronRight, CircleCheck, House, type LucideIcon, ShoppingBasket } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { queries } from '../../lib/queries';
import { checkedAgo, levelText } from '../../lib/supplies';
import { SupplyBar } from '../supplies/supply-bar';
import { CleanRow } from './clean-row';

// Laid out in columns under the week, so each card keeps itself whole and spaces the next.
const railCard = 'mb-6 break-inside-avoid rounded-card border border-line-soft bg-surface p-4 @2xl/content:p-5';

/** A side card's heading: an icon in a tinted tile, the title and a line under it. */
function RailHeading({
  id,
  icon: Icon,
  tint,
  title,
  detail,
}: {
  id: string;
  icon: LucideIcon;
  tint: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className={cx('grid size-10 shrink-0 place-items-center rounded-inner', tint)}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <h2 id={id} className="text-base font-bold text-ink">
          {title}
        </h2>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </div>
  );
}

/** The properties a cleaner has cleans ahead at: each one's next clean and how many are coming. Opens the property. */
export function RailProperties({
  rows,
  colors,
}: {
  rows: { property: CleanSummary['property']; next: CleanSummary; upcoming: number }[];
  colors: Map<string, string>;
}) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="rail-properties" className={railCard}>
      <RailHeading
        id="rail-properties"
        icon={House}
        tint="bg-sage-tint text-sage-deep"
        title="Your properties"
        detail="Where you’re cleaning next."
      />
      <ul className="-mx-2 mt-3 flex flex-col">
        {rows.map(({ property: p, next, upcoming }) => (
          <li key={p.id}>
            <Link
              to="/cleaner/properties/$propertyId"
              params={{ propertyId: p.id }}
              className="flex items-center gap-3 rounded-inner px-2 py-2.5 transition-colors hover:bg-ground focus-visible:outline-2 focus-visible:outline-blue-deep"
            >
              <span aria-hidden className={cx('h-9 w-1.5 shrink-0 rounded-full', colors.get(p.id) ?? 'bg-line')} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{p.name}</span>
                <span className="block truncate text-xs text-muted">
                  Next {dayLabel(next.scheduledDate)} · {upcoming} ahead
                </span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STATE: Record<Exclude<SupplyState, 'OK'>, { label: string; text: string; chip: string; dot: string }> = {
  OUT: { label: 'Out', text: 'text-danger-deep', chip: 'bg-danger-tint text-danger-deep', dot: 'bg-danger-mid' },
  LOW: { label: 'Low', text: 'text-amber-deep', chip: 'bg-amber-tint text-amber-deep', dot: 'bg-amber-mid' },
  UNKNOWN: {
    label: 'Not checked',
    text: 'text-muted',
    chip: 'bg-ground text-muted ring-1 ring-line ring-inset',
    dot: 'border border-dashed border-muted',
  },
};
const ORDER: Record<Exclude<SupplyState, 'OK'>, number> = { OUT: 0, LOW: 1, UNKNOWN: 2 };
const SHOWN = 4;

/**
 * Supplies to look at on the next visit: items out, running low or never checked at the properties the cleaner has
 * cleans ahead at, worst first. A count of each up top; then each property (in its colour, with when the cleaner is
 * next there) and its items, each with its level bar and when it was last checked. Nothing to show, nothing rendered.
 */
export function RailSupplies({
  rows,
  colors,
}: {
  rows: { property: CleanSummary['property']; next: CleanSummary }[];
  colors: Map<string, string>;
}) {
  const api = useApi();
  const results = useQueries({ queries: rows.map((r) => queries.supplies(api, r.property.id)) });
  const groups = rows
    .map((r, i) => ({
      ...r,
      items: (results[i]?.data?.items ?? [])
        .filter((s): s is SupplyItem & { state: keyof typeof ORDER } => s.state !== 'OK')
        .sort((a, b) => ORDER[a.state] - ORDER[b.state]),
    }))
    .filter((g) => g.items.length > 0);
  if (groups.length === 0) return null;
  const counts = (Object.keys(ORDER) as (keyof typeof ORDER)[])
    .map((state) => ({ state, n: groups.reduce((n, g) => n + g.items.filter((i) => i.state === state).length, 0) }))
    .filter((c) => c.n > 0);
  return (
    <section aria-labelledby="rail-supplies" className={railCard}>
      <RailHeading
        id="rail-supplies"
        icon={ShoppingBasket}
        tint="bg-amber-tint text-amber-deep"
        title="Check on your next visit"
        detail="Top these up, or check them, when you’re there."
      />
      <ul aria-label="Supplies to check" className="mt-3 flex flex-wrap gap-1.5">
        {counts.map(({ state, n }) => (
          <li
            key={state}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              STATE[state].chip,
            )}
          >
            <span aria-hidden className={cx('size-1.5 rounded-full', STATE[state].dot)} />
            {n} {STATE[state].label.toLowerCase()}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-3">
        {groups.map(({ property: p, next, items }) => (
          <div key={p.id} className="rounded-inner bg-ground/70 px-3 pt-2.5 pb-1 ring-1 ring-line-soft ring-inset">
            <div className="flex items-center justify-between gap-3">
              <Link
                to="/cleaner/properties/$propertyId"
                params={{ propertyId: p.id }}
                className="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-ink hover:underline"
              >
                <span aria-hidden className={cx('size-2.5 shrink-0 rounded-full', colors.get(p.id) ?? 'bg-line')} />
                <span className="truncate">{p.name}</span>
              </Link>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
                <CalendarDays aria-hidden className="size-3.5" />
                {dayLabel(next.scheduledDate)}
              </span>
            </div>
            <ul aria-label={`${p.name} supplies`} className="mt-1 divide-y divide-line-soft">
              {items.slice(0, SHOWN).map((s) => (
                <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{s.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {s.lastCheckedAt
                        ? `${levelText(s.levelPct)} · ${checkedAgo(new Date(s.lastCheckedAt)).toLowerCase()}`
                        : 'Not checked yet'}
                    </span>
                  </span>
                  <span className="flex w-20 flex-col items-end gap-1">
                    <span className={cx('text-xs font-bold', STATE[s.state].text)}>{STATE[s.state].label}</span>
                    <SupplyBar
                      name={s.name}
                      levelPct={s.levelPct}
                      state={s.state}
                      thresholdPct={s.thresholdPct}
                      size="sm"
                      className="w-full"
                    />
                  </span>
                </li>
              ))}
            </ul>
            {items.length > SHOWN && (
              <Link
                to="/cleaner/properties/$propertyId"
                params={{ propertyId: p.id }}
                className="mb-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
              >
                {items.length - SHOWN} more <ChevronRight aria-hidden className="size-3.5" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** The last few cleans done. */
export function RailRecent({ cleans, colors }: { cleans: CleanSummary[]; colors: Map<string, string> }) {
  if (cleans.length === 0) return null;
  return (
    <section aria-labelledby="rail-recent" className={railCard}>
      <RailHeading
        id="rail-recent"
        icon={CircleCheck}
        tint="bg-blue-tint text-blue-deep"
        title="Recently done"
        detail="Your last cleans."
      />
      <ul className="-mx-2 mt-2 divide-y divide-line-soft">
        {cleans.slice(0, 3).map((c) => (
          <CleanRow key={c.id} clean={c} color={colors.get(c.property.id)} />
        ))}
      </ul>
    </section>
  );
}
