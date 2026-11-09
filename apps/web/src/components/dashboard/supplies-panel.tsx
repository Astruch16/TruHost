import { Link } from '@tanstack/react-router';
import type { RestockItem } from '@truhost/shared';
import { cx } from '../../lib/cx';
import { inCategories, levelText, restockSummary, URGENCY_LABELS } from '../../lib/supplies';
import { AllClearIllustration } from '../illustrations/all-clear';
import { CategoryHeading } from '../supplies/category-heading';
import { SupplyBar } from '../supplies/supply-bar';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';

/** The most one room's column lists; the Supplies page has the rest. */
const PER_AREA = 6;

/** Where an item stands, as the Supplies page's pills colour it: out (red), running low (amber), low soon (blue). */
const DOT: Record<RestockItem['urgency'], string> = {
  OUT: 'bg-danger-mid',
  LOW: 'bg-amber-mid',
  SOON: 'bg-blue-mid',
};
const LEVEL: Record<RestockItem['urgency'], string> = {
  OUT: 'text-danger-deep',
  LOW: 'text-amber-deep',
  SOON: 'text-muted',
};

/**
 * Dashboard: supplies that need restocking now, or soon, in a column per room (the Supplies page's areas, in its
 * order), most urgent first in each (as the API orders them). Across several properties each line says which, linking
 * to it; "See all" opens Supplies.
 */
export function SuppliesPanel({ items, showProperty }: { items: RestockItem[]; showProperty: boolean }) {
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
        // As many columns as fit; on a phone they stack.
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12.5rem),1fr))] gap-x-6 gap-y-6">
          {inCategories(items).map((group) => {
            const shown = group.items.slice(0, PER_AREA);
            const more = group.items.length - shown.length;
            return (
              <section key={group.category} aria-label={group.label} className="min-w-0">
                <CategoryHeading category={group.category} label={group.label} count={group.items.length} />
                <ul className="flex flex-col divide-y divide-line-soft">
                  {shown.map((item) => (
                    <SupplyLine key={item.id} item={item} showProperty={showProperty} />
                  ))}
                </ul>
                {more > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    +{more} more on{' '}
                    <Link to="/admin/supplies" className="font-semibold text-primary hover:underline">
                      Supplies
                    </Link>
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/** One item: a dot for where it stands, its name and level, and a slim bar. */
function SupplyLine({ item, showProperty }: { item: RestockItem; showProperty: boolean }) {
  return (
    <li className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
      <span className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            aria-hidden
            title={URGENCY_LABELS[item.urgency]}
            className={cx('size-2 shrink-0 -translate-y-px self-center rounded-full', DOT[item.urgency])}
          />
          <span className="min-w-0 text-sm font-semibold text-pretty text-ink">
            {item.name}
            <span className="sr-only">: {URGENCY_LABELS[item.urgency]}</span>
          </span>
        </span>
        <span className={cx('shrink-0 text-xs font-medium tabular-nums', LEVEL[item.urgency])}>
          {levelText(item.levelPct)}
        </span>
      </span>
      <SupplyBar
        name={item.name}
        levelPct={item.levelPct}
        state={item.state}
        thresholdPct={item.thresholdPct}
        size="sm"
      />
      {showProperty && (
        <Link
          to="/admin/properties/$propertyId"
          params={{ propertyId: item.property.id }}
          className="self-start text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          {item.property.name}
        </Link>
      )}
    </li>
  );
}
