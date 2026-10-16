import { useState } from 'react';
import type { OwnerSupplies } from '@truhost/shared';
import { suppliesLine } from '../../lib/owner';
import { checkedAgo, levelText } from '../../lib/supplies';
import { SuppliesIllustration } from '../illustrations/supplies';
import { SupplyBar, UrgencyPill } from '../supplies/supply-bar';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';

/** Items shown before "Show all": everything that needs restocking, then enough to fill this many rows. */
const SHOWN = 6;

/**
 * The owner's stock count: each item at their properties with its level (as the cleaners last reported it), those
 * to restock first. With several properties, one group each.
 */
export function OwnerSuppliesCard({ data }: { data: OwnerSupplies }) {
  const many = data.properties.length > 1;
  const total = data.properties.reduce((n, p) => n + p.items.length, 0);
  return (
    <Card title="Supplies" description="How stocked your property is, from the cleaners’ last check">
      {total === 0 ? (
        <EmptyState size="compact" illustration={<SuppliesIllustration />} title="No supplies tracked yet">
          TruHost will list the supplies kept at your property here, with how full each one is.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {data.properties
            .filter((p) => p.items.length > 0)
            .map((p) => (
              <PropertySupplies key={p.property.id} group={p} showName={many} />
            ))}
        </div>
      )}
    </Card>
  );
}

function PropertySupplies({ group, showName }: { group: OwnerSupplies['properties'][number]; showName: boolean }) {
  const [all, setAll] = useState(false);
  const urgent = group.items.filter((i) => i.urgency !== null).length;
  const shown = all ? group.items : group.items.slice(0, Math.max(SHOWN, urgent));
  const hidden = group.items.length - shown.length;
  const listId = `supplies-${group.property.id}`;
  return (
    // With several properties, each sits in its own panel, evenly spaced, so it's clear where one ends.
    <section
      aria-label={showName ? `Supplies at ${group.property.name}` : undefined}
      className={showName ? 'rounded-inner border border-line p-4 @2xl/content:p-5' : undefined}
    >
      {showName && <h3 className="text-base font-semibold text-ink">{group.property.name}</h3>}
      <p className={showName ? 'mt-0.5 text-xs text-muted' : 'text-xs text-muted'}>
        {suppliesLine(group.counts)}
        {group.lastCheckedAt ? ` · ${checkedAgo(new Date(group.lastCheckedAt))}` : ''}
      </p>
      <ul id={listId} className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-x-6 gap-y-3">
        {shown.map((item) => (
          <li key={item.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-ink">{item.name}</span>
              {item.urgency ? (
                <UrgencyPill urgency={item.urgency} />
              ) : (
                <span className="shrink-0 text-xs text-muted">{levelText(item.levelPct)}</span>
              )}
            </div>
            <SupplyBar
              name={item.name}
              levelPct={item.levelPct}
              state={item.state}
              thresholdPct={item.thresholdPct}
              size="sm"
            />
          </li>
        ))}
      </ul>
      {(hidden > 0 || all) && (
        <button
          type="button"
          aria-expanded={all}
          aria-controls={listId}
          onClick={() => setAll(!all)}
          className="mt-4 text-sm font-semibold text-primary hover:underline"
        >
          {all ? 'Show fewer' : `Show all ${group.items.length} items`}
        </button>
      )}
    </section>
  );
}
