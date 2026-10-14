import type { RestockItem } from '@truhost/shared';
import { KpiCard } from '../dashboard/kpi-card';

/** The most marks a strip draws; beyond that it's a full strip. */
const MAX_MARKS = 24;

/**
 * Supplies at a glance, above the list: how many items are out, running low, and low soon (each as a count and a
 * strip with one mark per item), in the states the API gave them.
 */
export function RestockSummary({ items }: { items: RestockItem[] }) {
  const count = (u: RestockItem['urgency']) => items.filter((i) => i.urgency === u).length;
  const properties = (u: RestockItem['urgency']) =>
    new Set(items.filter((i) => i.urgency === u).map((i) => i.property.id)).size;
  const where = (u: RestockItem['urgency']) => {
    const n = properties(u);
    return n > 1 ? `Across ${n} properties` : null;
  };
  const out = count('OUT');
  const low = count('LOW');
  const soon = count('SOON');
  return (
    <div className="grid grid-cols-1 gap-3 @xl/content:grid-cols-3 @2xl/content:gap-4">
      <KpiCard
        label="Out"
        value={out}
        support={where('OUT') ?? (out ? 'Restock these first' : 'Nothing has run out')}
        chart={<Marks n={out} color="var(--color-danger-mid)" />}
      />
      <KpiCard
        label="Running low"
        value={low}
        support={where('LOW') ?? (low ? 'At or below their restock point' : 'Nothing at its restock point')}
        chart={<Marks n={low} color="var(--color-amber-mid)" />}
      />
      <KpiCard
        label="Low soon"
        value={soon}
        support={where('SOON') ?? (soon ? 'Within a quarter of their restock point' : 'Nothing close yet')}
        chart={<Marks n={soon} color="var(--color-blue-deep)" />}
      />
    </div>
  );
}

/** One mark per item, so the tiles compare at a glance (as the dashboard's strips do for days). */
function Marks({ n, color }: { n: number; color: string }) {
  return (
    <span aria-hidden className="flex gap-0.5">
      {Array.from({ length: MAX_MARKS }, (_, i) => (
        <span
          key={i}
          className="h-1.5 flex-1 rounded-[2px]"
          style={{ background: i < n ? color : 'var(--color-line-soft)' }}
        />
      ))}
    </span>
  );
}
