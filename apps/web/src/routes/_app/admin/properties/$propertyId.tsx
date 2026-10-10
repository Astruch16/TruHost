import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { Archive, Pencil, Plus, Trash2, UserMinus } from 'lucide-react';
import { CoverPhotoCard } from '../../../../components/cover-photo-card';
import { DeletePropertyDialog } from '../../../../components/delete-property-dialog';
import { PropertyDetailsCard } from '../../../../components/property-details-card';
import { PropertyDialog } from '../../../../components/property-dialog';
import { ErrorAlert } from '../../../../components/ui/alert';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { ConfirmDialog } from '../../../../components/ui/dialog';
import { Field } from '../../../../components/ui/field';
import { Select } from '../../../../components/ui/select';
import { MonthPicker } from '../../../../components/ui/month-picker';
import { PageHeader } from '../../../../components/ui/page-header';
import { Pill } from '../../../../components/ui/pill';
import { LoadingBlock } from '../../../../components/ui/skeleton';
import { Table, TableState, TBody, Td, Th, THead, Tr } from '../../../../components/ui/table';
import { useApi } from '../../../../lib/api-context';
import { formatBps, titleCase } from '../../../../lib/format';
import { RoomsCard } from '../../../../components/rooms/rooms-card';
import { queries } from '../../../../lib/queries';

export const Route = createFileRoute('/_app/admin/properties/$propertyId')({
  component: AdminProperty,
});

function AdminProperty() {
  const { propertyId } = Route.useParams();
  const api = useApi();
  const qc = useQueryClient();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const property = useQuery(queries.property(api, propertyId));
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const archive = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/properties/{id}/archive', { params: { path: { id: propertyId } } })),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['properties'] });
      setConfirmArchive(false);
    },
  });

  if (property.error) return <ErrorAlert error={property.error} />;
  if (!property.data) return <LoadingBlock />;
  const p = property.data;

  return (
    <>
      <PageHeader
        eyebrow="Property details"
        title={p.name}
        description={`${p.addressLine1}, ${p.city}`}
        actions={
          <>
            {p.archivedAt && <Pill tone="neutral">Archived</Pill>}
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil aria-hidden className="size-4" /> Edit details
            </Button>
            {!p.archivedAt && (
              <Button variant="secondary" onClick={() => setConfirmArchive(true)}>
                <Archive aria-hidden className="size-4" /> Archive
              </Button>
            )}
            <Button variant="danger" onClick={() => setDeleting(true)}>
              <Trash2 aria-hidden className="size-4" /> Delete
            </Button>
          </>
        }
      />
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archive ${p.name}?`}
        description="It will be hidden from lists. Owners keep access to its history."
        confirmLabel="Archive property"
        destructive
        pending={archive.isPending}
        error={archive.error}
        onConfirm={() => archive.mutate()}
      />
      <PropertyDialog property={p} open={editing} onOpenChange={setEditing} />
      <DeletePropertyDialog
        property={p}
        open={deleting}
        onOpenChange={setDeleting}
        onArchive={() => setConfirmArchive(true)}
        onDeleted={() => void navigate({ to: '/admin/properties', replace: true })}
      />
      <div className="flex flex-col gap-6">
        <div className="grid items-start gap-6 @[68.75rem]/content:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <CoverPhotoCard property={p} />
          <PropertyDetailsCard property={p} onEdit={() => setEditing(true)} />
        </div>
        <div className="grid gap-6 @4xl/content:grid-cols-2">
          <RoomsCard propertyId={propertyId} layout={p} />
          <PlanCard propertyId={propertyId} />
        </div>
        <MembersCard propertyId={propertyId} defaultCleanerId={p.defaultCleanerId ?? null} />
      </div>
    </>
  );
}

function nextMonth(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)).toISOString().slice(0, 7);
}

function PlanCard({ propertyId }: { propertyId: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const current = useQuery(queries.propertyPlan(api, propertyId));
  const plans = useQuery(queries.plans(api));
  const [planId, setPlanId] = useState('');
  const [month, setMonth] = useState(nextMonth);
  const assign = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/properties/{id}/plan', {
          params: { path: { id: propertyId } },
          body: { planId, effectiveFrom: `${month}-01` },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties', propertyId, 'plan'] }),
  });

  return (
    <Card title="Plan" description="Changes take effect from the first of a month.">
      <div className="flex flex-col gap-4">
        <ErrorAlert error={current.error} />
        {current.data?.current ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Pill tone="lavender">{current.data.current.plan.name}</Pill>
            <span>
              <span className="figure font-semibold">{formatBps(current.data.current.plan.managementFeeBps)}</span>{' '}
              since <span className="figure">{current.data.current.effectiveFrom}</span>
            </span>
          </div>
        ) : (
          current.data && <p className="text-sm text-muted">No plan assigned.</p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            assign.mutate();
          }}
          className="grid gap-3 @xl/content:grid-cols-[1fr_auto_auto] @xl/content:items-end"
        >
          <Field label="Plan">
            <Select
              value={planId}
              onValueChange={setPlanId}
              required
              placeholder="Choose a plan"
              options={(plans.data?.items ?? [])
                .filter((p) => !p.archivedAt)
                .map((p) => ({ value: p.id, label: `${p.name} (${formatBps(p.managementFeeBps)})` }))}
            />
          </Field>
          <Field label="Starting month">
            <MonthPicker value={month} onChange={setMonth} />
          </Field>
          <Button type="submit" variant="secondary" loading={assign.isPending}>
            Assign
          </Button>
        </form>
        <ErrorAlert error={assign.error} />
        {current.data && current.data.history.length > 1 && (
          <details className="text-sm">
            <summary className="rounded-control-sm text-muted hover:text-ink">History</summary>
            <ul className="figure mt-2 flex flex-col gap-1">
              {current.data.history.map((h) => (
                <li key={h.id}>
                  {h.plan.name} · {h.effectiveFrom} → {h.effectiveTo ?? 'now'}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Card>
  );
}

function MembersCard({ propertyId, defaultCleanerId }: { propertyId: string; defaultCleanerId: string | null }) {
  const api = useApi();
  const qc = useQueryClient();
  const members = useQuery(queries.memberships(api, propertyId));
  const users = useQuery(queries.users(api));
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'OWNER' | 'CLEANER'>('CLEANER');
  const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['properties', propertyId, 'memberships'] });
  const add = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/properties/{id}/memberships', { params: { path: { id: propertyId } }, body: { userId, role } }),
      ),
    onSuccess: () => {
      setUserId('');
      return invalidate();
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/v1/memberships/{id}/revoke', { params: { path: { id } } })),
    onSuccess: async () => {
      await invalidate();
      setRemoving(null);
    },
  });
  const items = members.data?.items ?? [];
  const cleaners = items.filter((m) => m.role === 'CLEANER');
  const setDefault = useMutation({
    mutationFn: (cleanerId: string | null) =>
      unwrap(
        api.PATCH('/v1/properties/{id}', {
          params: { path: { id: propertyId } },
          body: { defaultCleanerId: cleanerId },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });

  return (
    <Card title="Owners and cleaners">
      <div className="flex flex-col gap-6">
        <Field
          label="Default cleaner"
          hint={
            cleaners.length
              ? 'New cleans are assigned to them. You can change it for any single clean.'
              : 'Add a cleaner below first.'
          }
          className="max-w-md"
        >
          <Select
            value={defaultCleanerId ?? ''}
            disabled={cleaners.length === 0 || setDefault.isPending}
            onValueChange={(value) => setDefault.mutate(value || null)}
            options={[
              { value: '', label: 'No default' },
              ...cleaners.map((m) => ({ value: m.user.id, label: `${m.user.firstName} ${m.user.lastName}` })),
            ]}
          />
        </Field>
        <ErrorAlert error={setDefault.error} />
        <Table>
          <THead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th align="right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            <TableState
              columns={4}
              loading={members.isPending}
              error={members.error}
              empty={items.length === 0}
              emptyMessage="No owners or cleaners yet."
            />
            {items.map((m) => (
              <Tr key={m.id} interactive>
                <Td className="font-medium">
                  {m.user.firstName} {m.user.lastName}
                </Td>
                <Td className="text-muted">{m.user.email}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1.5">
                    <Pill tone={m.role === 'OWNER' ? 'sage' : 'blue'}>{titleCase(m.role)}</Pill>
                    {m.role === 'CLEANER' && m.user.id === defaultCleanerId && <Pill tone="lavender">Default</Pill>}
                  </span>
                </Td>
                <Td align="right">
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() =>
                      setRemoving({ id: m.id, label: `${m.user.firstName}’s ${m.role.toLowerCase()} access` })
                    }
                  >
                    <UserMinus aria-hidden className="size-4" /> Remove
                  </Button>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
          className="grid gap-3 @xl/content:grid-cols-[1fr_auto_auto] @xl/content:items-end"
        >
          <Field label="Person" hint="Invite new people from Team.">
            <Select
              value={userId}
              onValueChange={setUserId}
              required
              placeholder="Choose a person"
              options={(users.data?.items ?? [])
                .filter((u) => u.status !== 'DEACTIVATED')
                .map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName} (${u.email})` }))}
            />
          </Field>
          <Field label="Role">
            <Select
              value={role}
              onValueChange={(value) => setRole(value as typeof role)}
              options={[
                { value: 'CLEANER', label: 'Cleaner' },
                { value: 'OWNER', label: 'Owner' },
              ]}
            />
          </Field>
          <Button type="submit" variant="secondary" loading={add.isPending} className="@xl/content:mb-[1.625rem]">
            <Plus aria-hidden className="size-4" /> Add
          </Button>
        </form>
        <ErrorAlert error={add.error} />
      </div>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove access?"
        description={`This removes ${removing?.label ?? 'their access'} immediately. Their history is kept. If they are the default cleaner, the default is cleared.`}
        confirmLabel="Remove access"
        destructive
        pending={revoke.isPending}
        error={revoke.error}
        onConfirm={() => removing && revoke.mutate(removing.id)}
      />
    </Card>
  );
}
