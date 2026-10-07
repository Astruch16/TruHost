import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { ChevronRight, Plus } from 'lucide-react';
import { PropertyForm } from '../../../../components/property-form';
import { ErrorAlert } from '../../../../components/ui/alert';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
import { Pill } from '../../../../components/ui/pill';
import { Skeleton } from '../../../../components/ui/skeleton';
import { useApi } from '../../../../lib/api-context';
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4">
          <Skeleton className="h-28 rounded-card" />
          <Skeleton className="h-28 rounded-card" />
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
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4">
          {list.data.items.map((p) => (
            <li key={p.id}>
              <Link
                to="/admin/properties/$propertyId"
                params={{ propertyId: p.id }}
                className="group flex h-full min-h-28 items-start gap-4 rounded-card border border-line-soft bg-surface p-5 transition-[border-color,box-shadow] hover:border-line hover:shadow-sm"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-lg font-semibold text-ink">{p.name}</span>
                    <Pill tone={p.archivedAt ? 'neutral' : 'sage'}>{p.archivedAt ? 'Archived' : 'Active'}</Pill>
                  </span>
                  <span className="mt-1 block text-sm text-muted">
                    {p.addressLine1}, {p.city}
                  </span>
                </span>
                <ChevronRight aria-hidden className="mt-1 size-5 text-muted transition-colors group-hover:text-ink" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
