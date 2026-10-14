import { Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { RestockList } from '@truhost/shared';
import { Check } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { groupByProperty, restockSummary } from '../../lib/supplies';
import { ErrorAlert } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { SupplyBar, SupplyMeta, UrgencyPill } from './supply-bar';

type Item = RestockList['items'][number];

/**
 * What needs restocking now, and what's close to it, one card per property (in the API's order: the property with the
 * most urgent item first). "Restocked" marks the item full, which takes it off the list.
 */
export function RestockList({ items }: { items: Item[] }) {
  const api = useApi();
  const qc = useQueryClient();
  const restocked = useMutation({
    mutationFn: (item: Item) =>
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
    <div className="flex flex-col gap-4">
      <ErrorAlert error={restocked.error} />
      <div className="grid grid-cols-1 items-start gap-6 @4xl/content:grid-cols-2">
        {groupByProperty(items).map(({ property, items: list }) => (
          <Card
            key={property.id}
            title={
              <Link
                to="/admin/properties/$propertyId"
                params={{ propertyId: property.id }}
                className="underline-offset-4 hover:underline"
              >
                {property.name}
              </Link>
            }
            description={restockSummary(list)}
          >
            <ul className="flex flex-col">
              {list.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 border-b border-line-soft py-3 last:border-b-0">
                  <div className="flex min-h-9 items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-semibold text-ink">{item.name}</span>
                      <UrgencyPill urgency={item.urgency} />
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={restocked.isPending && restocked.variables.id === item.id}
                      disabled={restocked.isPending}
                      onClick={() => restocked.mutate(item)}
                    >
                      <Check aria-hidden className="size-4" /> Restocked
                    </Button>
                  </div>
                  <SupplyBar
                    name={item.name}
                    levelPct={item.levelPct}
                    state={item.state}
                    thresholdPct={item.thresholdPct}
                  />
                  <SupplyMeta
                    levelPct={item.levelPct}
                    lastCheckedAt={item.lastCheckedAt}
                    thresholdPct={item.thresholdPct}
                  />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
