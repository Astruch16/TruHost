import { Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { RestockItem } from '@truhost/shared';
import { ArrowRight, Check } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { groupByProperty, inCategories, levelText, restockSummary } from '../../lib/supplies';
import { ErrorAlert } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { CategoryHeading } from './category-heading';
import { SupplyBar, SupplyMeta, UrgencyPill } from './supply-bar';

const TILE: Record<RestockItem['urgency'], string> = {
  OUT: 'bg-danger-tint/45',
  LOW: 'bg-amber-tint/50',
  SOON: 'bg-ground/80',
};

/**
 * What needs restocking now, and what's close to it: one full-width card per property (the property with the most
 * urgent item first, as the API orders them), its items as tiles grouped by area, the most urgent first in each.
 * "Restocked" marks an item full, which takes it off the list.
 */
export function RestockList({ items }: { items: RestockItem[] }) {
  const api = useApi();
  const qc = useQueryClient();
  const restocked = useMutation({
    mutationFn: (item: RestockItem) =>
      unwrap(
        api.POST('/v1/properties/{id}/supply-statuses', {
          params: { path: { id: item.property.id } },
          body: { readings: [{ supplyItemId: item.id, levelPct: 100, note: null }] },
        }),
      ),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['supplies'] }),
        qc.invalidateQueries({ queryKey: ['me', 'notifications'] }),
      ]),
  });

  return (
    <div className="flex flex-col gap-6">
      <ErrorAlert error={restocked.error} />
      {groupByProperty(items).map(({ property, items: list }) => (
        <Card
          key={property.id}
          title={property.name}
          description={restockSummary(list)}
          actions={
            <Link
              to="/admin/properties/$propertyId"
              params={{ propertyId: property.id }}
              className="inline-flex items-center gap-1 rounded-control-sm text-sm font-semibold text-primary hover:underline"
            >
              All supplies <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          }
        >
          <div className="flex flex-col gap-5">
            {inCategories(list).map((group) => (
              // Each area after the first sits below a thin line.
              <section
                key={group.category}
                aria-label={group.label}
                className="border-t border-line-soft pt-5 first-of-type:border-t-0 first-of-type:pt-0"
              >
                <CategoryHeading category={group.category} label={group.label} count={group.items.length} />
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-3">
                  {group.items.map((item) => (
                    <li key={item.id} className={cx('flex flex-col gap-2 rounded-inner p-3.5', TILE[item.urgency])}>
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 pt-0.5 font-semibold text-pretty text-ink">{item.name}</span>
                        <UrgencyPill urgency={item.urgency} />
                      </span>
                      {/* mt-auto keeps bars level in a row where one name wraps. */}
                      <span className="mt-auto flex items-center gap-3">
                        <SupplyBar
                          name={item.name}
                          levelPct={item.levelPct}
                          state={item.state}
                          thresholdPct={item.thresholdPct}
                          className="min-w-0 flex-1"
                        />
                        <span className="shrink-0 text-sm font-medium text-ink tabular-nums">
                          {levelText(item.levelPct)}
                        </span>
                      </span>
                      <SupplyMeta
                        levelPct={item.levelPct}
                        lastCheckedAt={item.lastCheckedAt}
                        thresholdPct={item.thresholdPct}
                        showLevel={false}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-1"
                        loading={restocked.isPending && restocked.variables.id === item.id}
                        disabled={restocked.isPending}
                        onClick={() => restocked.mutate(item)}
                      >
                        <Check aria-hidden className="size-4" /> Restocked
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
