import { Link } from '@tanstack/react-router';
import type { RestockItem } from '@truhost/shared';
import { groupByProperty, levelText, restockSummary } from '../../lib/supplies';
import { AllClearIllustration } from '../illustrations/all-clear';
import { SupplyBar, UrgencyPill } from '../supplies/supply-bar';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';

/** The most this card lists; the Supplies page has the rest. */
const SHOWN = 6;

/**
 * Dashboard: supplies that need restocking now, or soon, grouped by property (most urgent first, as the API orders
 * them). Each property links to its page; "See all" opens Supplies.
 */
export function SuppliesPanel({ items }: { items: RestockItem[] }) {
  const shown = items.slice(0, SHOWN);
  const link = (
    <Link to="/admin/supplies" className="rounded-control-sm text-sm font-semibold text-primary hover:underline">
      See all
    </Link>
  );
  return (
    <Card title="Supplies" description={restockSummary(items) || undefined} actions={link}>
      {items.length === 0 ? (
        <EmptyState size="compact" illustration={<AllClearIllustration />} title="All stocked">
          Nothing is at or near its restock point. Low supplies will show up here.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {groupByProperty(shown).map(({ property, items: list }) => (
            <section key={property.id} aria-label={property.name}>
              <Link
                to="/admin/properties/$propertyId"
                params={{ propertyId: property.id }}
                className="text-xs font-semibold tracking-[0.08em] text-muted uppercase underline-offset-4 hover:text-ink hover:underline"
              >
                {property.name}
              </Link>
              <ul className="mt-1 flex flex-col">
                {list.map((item) => (
                  <li key={item.id} className="flex flex-col gap-1.5 border-b border-line-soft py-2.5 last:border-b-0">
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{item.name}</span>
                        <UrgencyPill urgency={item.urgency} />
                      </span>
                      <span className="shrink-0 text-xs text-muted">{levelText(item.levelPct)}</span>
                    </span>
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
            </section>
          ))}
          {items.length > shown.length && (
            <p className="text-sm text-muted">
              +{items.length - shown.length} more on{' '}
              <Link to="/admin/supplies" className="font-semibold text-primary hover:underline">
                Supplies
              </Link>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
