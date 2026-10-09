import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { Property } from '@truhost/shared';
import { Plus } from 'lucide-react';
import { PropertyCard } from '../../../../components/property-card';
import { PropertyDialog } from '../../../../components/property-dialog';
import { ErrorAlert, LoadError } from '../../../../components/ui/alert';
import { Button } from '../../../../components/ui/button';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
import { Skeleton } from '../../../../components/ui/skeleton';
import { useApi } from '../../../../lib/api-context';
import { monthKey, monthLabel } from '../../../../lib/months';
import { queries } from '../../../../lib/queries';

export const Route = createFileRoute('/_app/admin/properties/')({
  component: AdminProperties,
});

function AdminProperties() {
  const api = useApi();
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
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
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden className="size-4" /> New property
            </Button>
          </>
        }
      />
      <PropertyDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(p) => void navigate({ to: '/admin/properties/$propertyId', params: { propertyId: p.id } })}
      />
      <PropertyDialog property={editing} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
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
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden className="size-4" /> New property
            </Button>
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
                    onEdit={() => setEditing(p)}
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
