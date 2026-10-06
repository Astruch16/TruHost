import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { PropertyForm } from '../../../../components/property-form';
import { emptyProperty, type PropertyFormValues } from '../../../../lib/property-values';
import { Badge, Button, Card, ErrorBanner, Loading, PageHeader } from '../../../../components/ui';
import { useApi } from '../../../../lib/api-context';
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
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Button>
            <Button onClick={() => setCreating(!creating)}>{creating ? 'Cancel' : 'New property'}</Button>
          </div>
        }
      />
      {creating && (
        <div className="mb-4">
          <Card title="New property">
            <PropertyForm
              initial={emptyProperty}
              submitLabel="Create property"
              pending={create.isPending}
              error={create.error}
              onSubmit={(v) => create.mutate(v)}
            />
          </Card>
        </div>
      )}
      <ErrorBanner error={list.error} />
      {!list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <p className="text-sm text-slate-600">No properties yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {list.data.items.map((p) => (
            <li key={p.id}>
              <Link
                to="/admin/properties/$propertyId"
                params={{ propertyId: p.id }}
                className="flex items-center justify-between gap-2 p-4 hover:bg-slate-50"
              >
                <span>
                  <span className="font-medium">{p.name}</span>
                  <span className="block text-sm text-slate-500">
                    {p.addressLine1}, {p.city}
                  </span>
                </span>
                {p.archivedAt && <Badge tone="amber">Archived</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
