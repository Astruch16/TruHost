import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { RestockItem } from '@truhost/shared';
import { cx } from '../../lib/cx';
import { groupByProperty, inCategories, levelText, restockSummary, URGENCY_LABELS } from '../../lib/supplies';
import { AllClearIllustration } from '../illustrations/all-clear';
import { CategoryHeading, CategoryIcon } from '../supplies/category-heading';
import { SupplyBar } from '../supplies/supply-bar';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';

/** The most one room's column lists (one property); the Supplies page has the rest. */
const PER_AREA = 6;
/** The most one property's column lists (all properties): its most urgent. */
const PER_PROPERTY = 8;

/** The level beside an item's name, coloured by where it stands: out (red), running low (amber), low soon (muted). */
const LEVEL: Record<RestockItem['urgency'], string> = {
  OUT: 'text-danger-deep',
  LOW: 'text-amber-deep',
  SOON: 'text-muted',
};

/** A column: a thin line on its left (see Columns), and the gutter on each side. */
const COLUMN = 'min-w-0 border-l border-line-soft px-6';

/**
 * Dashboard: supplies that need restocking now, or soon. For one property, a column per room (the Supplies page's
 * areas, in its order); across all properties, a column per property (the one with the most urgent item first, as the
 * API orders them) with its items under each room. Most urgent first throughout. "See all" opens Supplies.
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
        <Columns>
          {showProperty
            ? groupByProperty(items).map((group) => (
                <PropertyColumn key={group.property.id} property={group.property} items={group.items} />
              ))
            : inCategories(items).map((group) => (
                <RoomColumn key={group.category} category={group.category} label={group.label} items={group.items} />
              ))}
        </Columns>
      )}
    </Card>
  );
}

/**
 * Columns that share the card's width (as many as fit, stretched to fill it), a thin line between them; on a phone
 * they stack. Every column has a line on its left: the grid starts a gutter and a pixel early and the wrapper clips
 * it, so the first column in each row has none.
 */
function Columns({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden">
      <div className="-mr-6 ml-[calc(-1.5rem-1px)] grid grid-cols-[repeat(auto-fit,minmax(min(100%,14.5rem),1fr))] gap-y-6">
        {children}
      </div>
    </div>
  );
}

/** One property's room: its heading (icon, name, count) and items. */
function RoomColumn({
  category,
  label,
  items,
}: {
  category: RestockItem['category'];
  label: string;
  items: RestockItem[];
}) {
  const shown = items.slice(0, PER_AREA);
  return (
    <section aria-label={label} className={COLUMN}>
      <CategoryHeading category={category} label={label} count={items.length} />
      <SupplyLines items={shown} />
      <More count={items.length - shown.length} />
    </section>
  );
}

/** One property: its name (linking to it) and count, then its most urgent items under each room. */
function PropertyColumn({ property, items }: { property: RestockItem['property']; items: RestockItem[] }) {
  const shown = items.slice(0, PER_PROPERTY);
  return (
    <section aria-label={property.name} className={COLUMN}>
      <h3 className="mb-3 flex flex-wrap items-baseline gap-x-2.5 text-base font-bold text-ink">
        <Link
          to="/admin/properties/$propertyId"
          params={{ propertyId: property.id }}
          className="min-w-0 underline-offset-4 hover:underline"
        >
          {property.name}
        </Link>{' '}
        <span className="figure text-sm font-medium text-muted">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </h3>
      <div className="flex flex-col gap-4">
        {inCategories(shown).map((room) => (
          <div key={room.category}>
            <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              <CategoryIcon category={room.category} size={20} />
              {room.label}
            </h4>
            <SupplyLines items={room.items} />
          </div>
        ))}
      </div>
      <More count={items.length - shown.length} />
    </section>
  );
}

function SupplyLines({ items }: { items: RestockItem[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line-soft">
      {items.map((item) => (
        <SupplyLine key={item.id} item={item} />
      ))}
    </ul>
  );
}

/** "+2 more on Supplies", under a column that couldn't list everything. */
function More({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p className="mt-2 text-xs text-muted">
      +{count} more on{' '}
      <Link to="/admin/supplies" className="font-semibold text-primary hover:underline">
        Supplies
      </Link>
    </p>
  );
}

/** One item: its name and level, and a slim bar. */
function SupplyLine({ item }: { item: RestockItem }) {
  return (
    <li className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm font-semibold text-pretty text-ink">
          {item.name}
          <span className="sr-only">: {URGENCY_LABELS[item.urgency]}</span>
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
    </li>
  );
}
