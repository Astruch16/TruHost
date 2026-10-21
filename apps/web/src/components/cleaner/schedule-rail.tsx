import { Link } from '@tanstack/react-router';
import { useQueries } from '@tanstack/react-query';
import type { CleanSummary, SupplyState } from '@truhost/shared';
import { ChevronRight } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { dayLabel } from '../../lib/dashboard-format';
import { queries } from '../../lib/queries';
import { Pill } from '../ui/pill';
import { CleanRow } from './clean-row';

// Laid out in columns under the week, so each card keeps itself whole and spaces the next.
const railCard = 'mb-6 break-inside-avoid rounded-card border border-line-soft bg-surface p-4 @2xl/content:p-5';
const railTitle = 'text-base font-bold text-ink';

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
      <h2 id="rail-properties" className={railTitle}>
        Your properties
      </h2>
      <ul className="-mx-2 mt-2 flex flex-col">
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

const STATE: Record<Exclude<SupplyState, 'OK'>, { label: string; tone: 'danger' | 'amber' | 'neutral' }> = {
  OUT: { label: 'Out', tone: 'danger' },
  LOW: { label: 'Low', tone: 'amber' },
  UNKNOWN: { label: 'Not checked', tone: 'neutral' },
};
const ORDER: Record<Exclude<SupplyState, 'OK'>, number> = { OUT: 0, LOW: 1, UNKNOWN: 2 };

/**
 * Supplies to look at on the next visit: items out, running low or never checked at the properties the cleaner has
 * cleans ahead at, worst first. Nothing to show, nothing rendered.
 */
export function RailSupplies({ properties }: { properties: CleanSummary['property'][] }) {
  const api = useApi();
  const results = useQueries({ queries: properties.map((p) => queries.supplies(api, p.id)) });
  const groups = properties
    .map((p, i) => ({
      property: p,
      items: (results[i]?.data?.items ?? [])
        .filter((s) => s.state !== 'OK')
        .sort((a, b) => ORDER[a.state as keyof typeof ORDER] - ORDER[b.state as keyof typeof ORDER]),
    }))
    .filter((g) => g.items.length > 0);
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="rail-supplies" className={railCard}>
      <h2 id="rail-supplies" className={railTitle}>
        Check on your next visit
      </h2>
      <p className="mt-0.5 text-xs text-muted">Supplies running low or not checked yet.</p>
      <div className="mt-3 flex flex-col gap-3">
        {groups.map(({ property: p, items }) => (
          <div key={p.id}>
            <Link
              to="/cleaner/properties/$propertyId"
              params={{ propertyId: p.id }}
              className="text-xs font-semibold tracking-[0.06em] text-muted uppercase hover:text-ink"
            >
              {p.name}
            </Link>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {items.slice(0, 4).map((s) => {
                const state = STATE[s.state as keyof typeof STATE];
                return (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-ink">{s.name}</span>
                    <Pill tone={state.tone}>{state.label}</Pill>
                  </li>
                );
              })}
              {items.length > 4 && <li className="text-xs text-muted">and {items.length - 4} more</li>}
            </ul>
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
      <h2 id="rail-recent" className={railTitle}>
        Recently done
      </h2>
      <ul className="-mx-2 mt-1 divide-y divide-line-soft">
        {cleans.slice(0, 3).map((c) => (
          <CleanRow key={c.id} clean={c} color={colors.get(c.property.id)} />
        ))}
      </ul>
    </section>
  );
}
