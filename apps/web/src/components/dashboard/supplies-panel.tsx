import { Link } from '@tanstack/react-router';
import type { RestockItem } from '@truhost/shared';
import { cx } from '../../lib/cx';
import { levelText, restockSummary } from '../../lib/supplies';
import { AllClearIllustration } from '../illustrations/all-clear';
import { SupplyBar, UrgencyPill } from '../supplies/supply-bar';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';

/** The most this card lists (two rows of four on a wide screen); the Supplies page has the rest. */
const SHOWN = 8;

const TILE: Record<RestockItem['urgency'], string> = {
  OUT: 'bg-danger-tint/45',
  LOW: 'bg-amber-tint/50',
  SOON: 'bg-ground/80',
};

/**
 * Dashboard: supplies that need restocking now, or soon, as tiles across the main column, most urgent first (as the API
 * orders them). Across several properties each tile says which, linking to it; "See all" opens Supplies.
 */
export function SuppliesPanel({ items, showProperty }: { items: RestockItem[]; showProperty: boolean }) {
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
        <div className="flex flex-col gap-3">
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-3">
            {shown.map((item) => (
              <li key={item.id} className={cx('flex flex-col gap-2 rounded-inner p-3.5', TILE[item.urgency])}>
                {showProperty && (
                  <Link
                    to="/admin/properties/$propertyId"
                    params={{ propertyId: item.property.id }}
                    className="truncate text-[11px] font-semibold tracking-[0.08em] text-muted uppercase underline-offset-4 hover:text-ink hover:underline"
                  >
                    {item.property.name}
                  </Link>
                )}
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 pt-0.5 text-sm font-semibold text-pretty text-ink">{item.name}</span>
                  <UrgencyPill urgency={item.urgency} />
                </span>
                {/* mt-auto keeps bars level in a row where one name wraps. */}
                <span className="mt-auto flex items-center gap-3">
                  <SupplyBar
                    name={item.name}
                    levelPct={item.levelPct}
                    state={item.state}
                    thresholdPct={item.thresholdPct}
                    size="sm"
                    className="min-w-0 flex-1"
                  />
                  <span className="shrink-0 text-xs font-medium text-ink tabular-nums">{levelText(item.levelPct)}</span>
                </span>
              </li>
            ))}
          </ul>
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
