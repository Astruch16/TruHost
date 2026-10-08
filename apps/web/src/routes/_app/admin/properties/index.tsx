import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { Plus } from 'lucide-react';
import { PropertyCard } from '../../../../components/property-card';
import { PropertyForm } from '../../../../components/property-form';
import { ErrorAlert, LoadError } from '../../../../components/ui/alert';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
import { Skeleton } from '../../../../components/ui/skeleton';
import { useApi } from '../../../../lib/api-context';
import { monthKey, monthLabel } from '../../../../lib/months';
import { emptyProperty, type PropertyFormValues } from '../../../../lib/property-values';
import { queries } from '../../../../lib/queries';

export const Route = createFileRoute('/_app/admin/properties/')({
  component: AdminProperties,
});

function AdminProperties() {
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const list = useQuery(queries.properties(api, showArchived));
  // This month's figures per property come from the reporting module, via the dashboard (archived properties
  // have none and show dashes).
  const month = monthKey();
  const figures = useQuery({ ...queries.dashboard(api, month, null), enabled: list.isSuccess });
  const figuresFor = (id: string) => {
    if (figures.isPending) return 'loading' as const;
    return figures.data?.properties.find((f) => f.id === id) ?? null;
  };
  const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4';
  const create = useMutation({
    mutationFn: (body: PropertyFormValues) => unwrap(api.POST('/v1/properties', { body })),
    onSuccess: async (p) => {
      await qc.invalidateQueries({ queryKey: ['properties'] });
      void navigate({ to: '/admin/properties/$propertyId', params: { propertyId: p.id } });
    },
  });

  return (
    <>
      <PageHeader
        title="Properties"
        description="Every property TruHost manages."
        actions={
          <>
            <Button variant="quiet" onClick={() => setShowArchived(!showArchived)} aria-pressed={showArchived}>
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Button>
            {!creating && (
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden className="size-4" /> New property
              </Button>
            )}
          </>
        }
      />
      {creating && (
        <div className="mb-6">
          <Card title="New property">
            <PropertyForm
              initial={emptyProperty}
              submitLabel="Create property"
              pending={create.isPending}
              error={create.error}
              onSubmit={(v) => create.mutate(v)}
              onCancel={() => setCreating(false)}
            />
          </Card>
        </div>
      )}
      {list.error ? (
        <ErrorAlert error={list.error} />
      ) : !list.data ? (
        <div className={GRID}>
          <Skeleton className="h-72 rounded-inner" />
          <Skeleton className="h-72 rounded-inner" />
        </div>
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title="No properties yet"
          action={
            !creating && (
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden className="size-4" /> New property
              </Button>
            )
          }
        >
          Add the first property to start tracking bookings and cleans.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {figures.error && (
            <LoadError
              what={`${monthLabel(month)}’s figures`}
              onRetry={() => void figures.refetch()}
              retrying={figures.isFetching}
            />
          )}
          <ul className={GRID}>
            {list.data.items.map((p, i) => {
              const f = figuresFor(p.id);
              return (
                <li key={p.id}>
                  <PropertyCard
                    property={{
                      id: p.id,
                      name: p.name,
                      location: `${p.addressLine1}, ${p.city}`,
                      archived: p.archivedAt !== null,
                      hasPlan: f && f !== 'loading' ? f.hasPlan : null,
                      photoUrl: p.coverPhoto?.thumbUrl ?? null,
                    }}
                    figures={figures.error ? null : f}
                    index={i}
                    revenueLabel={`Gross, ${monthLabel(month).split(' ')[0]!.slice(0, 3)}`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
