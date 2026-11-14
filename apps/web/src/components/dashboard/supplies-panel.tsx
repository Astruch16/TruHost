import { Link } from '@tanstack/react-router';
import type { RestockItem } from '@truhost/shared';
import { cx } from '../../lib/cx';
import { levelText, restockSummary, URGENCY_LABELS } from '../../lib/supplies';
import { AllClearIllustration } from '../illustrations/all-clear';
import { SupplyBar } from '../supplies/supply-bar';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';

/** The most this card lists; the Supplies page has the rest. */
const SHOWN = 5;

/** The level's colour by where the item stands: empty (muted rose), running low (gold), low soon (muted). */
const LEVEL: Record<RestockItem['urgency'], string> = {
  OUT: 'text-rose-deep',
  LOW: 'text-amber-deep',
  SOON: 'text-muted',
};

/**
 * Dashboard: a compact look at supplies. What needs restocking ("9 to restock · 8 low soon"), then the five most urgent
 * items (as the API orders them), each with its property and level. "See all" opens the Supplies page.
 */
export function SuppliesPanel({ items, showProperty }: { items: RestockItem[]; showProperty: boolean }) {
  const shown = items.slice(0, SHOWN);
  const more = items.length - shown.length;
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
        <>
          <ul aria-label="Most urgent" className="flex flex-col divide-y divide-line-soft">
            {shown.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    {item.name}
                    <span className="sr-only">: {URGENCY_LABELS[item.urgency]}</span>
                  </p>
                  {showProperty && <p className="truncate text-sm text-muted">{item.property.name}</p>}
                </div>
                <div className="flex w-24 shrink-0 flex-col items-end gap-1.5">
                  <span className={cx('text-xs font-semibold', LEVEL[item.urgency])}>{levelText(item.levelPct)}</span>
                  <SupplyBar
                    name={item.name}
                    levelPct={item.levelPct}
                    state={item.state}
                    thresholdPct={item.thresholdPct}
                    size="sm"
                    className="w-full"
                  />
                </div>
              </li>
            ))}
          </ul>
          {more > 0 && (
            <p className="mt-3 text-sm text-muted">
              +{more} more on{' '}
              <Link to="/admin/supplies" className="font-semibold text-primary hover:underline">
                Supplies
              </Link>
            </p>
          )}
        </>
      )}
    </Card>
  );
}
