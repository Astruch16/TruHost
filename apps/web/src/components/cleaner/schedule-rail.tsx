import { Link } from '@tanstack/react-router';
import { useQueries } from '@tanstack/react-query';
import type { CleanSummary, SupplyItem, SupplyState } from '@truhost/shared';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { queries } from '../../lib/queries';
import { checkedAgo, levelText } from '../../lib/supplies';
import { SuppliesIcon } from '../illustrations/category-icons';
import type { IconProps } from '../illustrations/defs';
import { CleanDoneIcon } from '../illustrations/list-icons';
import { OwnPropertyIcon } from '../illustrations/statement-icons';
import { SupplyBar } from '../supplies/supply-bar';
import { Skeleton } from '../ui/skeleton';
import { CleanRow } from './clean-row';
import { Pill } from '../ui/pill';
import type { PillTone } from '../../lib/styles';

// Each card fills its cell of the schedule's grid, so cards side by side end on the same line.
const railCard = 'flex min-w-0 flex-col rounded-card border border-line-soft bg-surface p-4 @2xl/content:p-5';

/** What a card says when it has nothing to list, so the card (and the grid) keeps its place. */
function RailEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex flex-1 items-center justify-center rounded-inner border border-dashed border-line-soft px-4 py-6 text-center text-sm text-muted">
      {children}
    </p>
  );
}

/** A side card's heading: its illustrated icon (as in the owner's portal), the title and a line under it. */
function RailHeading({
  id,
  icon: Icon,
  title,
  detail,
}: {
  id: string;
  icon: (props: IconProps) => React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="shrink-0" />
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
  className,
}: {
  rows: { property: CleanSummary['property']; next: CleanSummary; upcoming: number }[];
  colors: Map<string, string>;
  className?: string;
}) {
  return (
    <section aria-labelledby="rail-properties" className={cx(railCard, className)}>
      <RailHeading
        id="rail-properties"
        icon={OwnPropertyIcon}
        title="Your properties"
        detail="Where you’re cleaning next."
      />
      {rows.length === 0 && <RailEmpty>No cleans booked ahead yet.</RailEmpty>}
      <ul className="-mx-2 mt-3 flex flex-col empty:hidden">
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

const STATE: Record<Exclude<SupplyState, 'OK'>, { label: string; text: string; tone: PillTone }> = {
  OUT: { label: 'Out', text: 'text-danger-deep', tone: 'danger' },
  LOW: { label: 'Low', text: 'text-amber-deep', tone: 'amber' },
  UNKNOWN: { label: 'Not checked', text: 'text-muted', tone: 'neutral' },
};
const ORDER: Record<Exclude<SupplyState, 'OK'>, number> = { OUT: 0, LOW: 1, UNKNOWN: 2 };
const SHOWN = 4;

/**
 * Supplies to look at on the next visit: items out, running low or never checked at the properties the cleaner has
 * cleans ahead at, worst first. A count of each up top; then each property (in its colour, with when the cleaner is
 * next there) and its items, each with its level bar and when it was last checked. When nothing is low, it says so.
 */
export function RailSupplies({
  rows,
  colors,
  className,
}: {
  rows: { property: CleanSummary['property']; next: CleanSummary }[];
  colors: Map<string, string>;
  className?: string;
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
  const loading = results.some((r) => r.isPending);
  const counts = (Object.keys(ORDER) as (keyof typeof ORDER)[])
    .map((state) => ({ state, n: groups.reduce((n, g) => n + g.items.filter((i) => i.state === state).length, 0) }))
    .filter((c) => c.n > 0);
  return (
    <section aria-labelledby="rail-supplies" className={cx(railCard, '@container/supplies', className)}>
      <RailHeading
        id="rail-supplies"
        icon={SuppliesIcon}
        title="Check on your next visit"
        detail="Top these up, or check them, when you’re there."
      />
      {loading ? (
        <Skeleton className="mt-4 h-32 rounded-inner" />
      ) : (
        groups.length === 0 && (
          <RailEmpty>
            {rows.length > 0
              ? 'Everything’s stocked at the places you’re cleaning next.'
              : 'Nothing to check until you have cleans booked.'}
          </RailEmpty>
        )
      )}
      <ul aria-label="Supplies to check" className="mt-3 flex flex-wrap gap-1.5 empty:hidden">
        {counts.map(({ state, n }) => (
          <li key={state}>
            <Pill tone={STATE[state].tone}>
              {n} {STATE[state].label.toLowerCase()}
            </Pill>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid items-start gap-3 empty:hidden @xl/supplies:grid-cols-2">
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
export function RailRecent({
  cleans,
  colors,
  className,
}: {
  cleans: CleanSummary[];
  colors: Map<string, string>;
  className?: string;
}) {
  return (
    <section aria-labelledby="rail-recent" className={cx(railCard, className)}>
      <RailHeading id="rail-recent" icon={CleanDoneIcon} title="Recently done" detail="Your last cleans." />
      {cleans.length === 0 && <RailEmpty>Cleans you complete will show here.</RailEmpty>}
      <ul className="-mx-2 mt-2 divide-y divide-line-soft empty:hidden">
        {cleans.slice(0, 3).map((c) => (
          <CleanRow key={c.id} clean={c} color={colors.get(c.property.id)} />
        ))}
      </ul>
    </section>
  );
}
