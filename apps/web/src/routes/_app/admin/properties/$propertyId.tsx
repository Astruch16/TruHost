import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { PropertyForm } from '../../../../components/property-form';
import type { PropertyFormValues } from '../../../../lib/property-values';
import { Badge, Button, Card, ErrorBanner, Field, Input, Loading, PageHeader, Select } from '../../../../components/ui';
import { useApi } from '../../../../lib/api-context';
import { formatBps, ROOM_TYPES, titleCase } from '../../../../lib/format';
import { queries } from '../../../../lib/queries';

export const Route = createFileRoute('/_app/admin/properties/$propertyId')({
  component: AdminProperty,
});

function AdminProperty() {
  const { propertyId } = Route.useParams();
  const api = useApi();
  const qc = useQueryClient();
  const property = useQuery(queries.property(api, propertyId));
  const update = useMutation({
    mutationFn: (body: PropertyFormValues) =>
      unwrap(api.PATCH('/v1/properties/{id}', { params: { path: { id: propertyId } }, body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
  const archive = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/properties/{id}/archive', { params: { path: { id: propertyId } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });

  if (property.error) return <ErrorBanner error={property.error} />;
  if (!property.data) return <Loading />;
  const p = property.data;

  return (
    <>
      <PageHeader
        title={p.name}
        actions={
          p.archivedAt ? (
            <Badge tone="amber">Archived</Badge>
          ) : (
            <Button
              variant="danger"
              disabled={archive.isPending}
              onClick={() => confirm(`Archive ${p.name}? It will be hidden from lists.`) && archive.mutate()}
            >
              Archive
            </Button>
          )
        }
      />
      <div className="grid gap-4">
        <Card title="Details">
          <PropertyForm
            key={p.id}
            initial={{
              ...p,
              accessInstructions: p.accessInstructions ?? null,
              defaultCleanerPayCents: p.defaultCleanerPayCents ?? 0,
            }}
            submitLabel={update.isSuccess && !update.isPending ? 'Saved' : 'Save changes'}
            pending={update.isPending}
            error={update.error}
            onSubmit={(v) => update.mutate(v)}
          />
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <RoomsCard propertyId={propertyId} />
          <PlanCard propertyId={propertyId} />
        </div>
        <MembersCard propertyId={propertyId} />
      </div>
    </>
  );
}

function RoomsCard({ propertyId }: { propertyId: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const rooms = useQuery(queries.rooms(api, propertyId));
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof ROOM_TYPES)[number]>('BEDROOM');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['properties', propertyId, 'rooms'] });

  const add = useMutation({
    mutationFn: () =>
      unwrap(api.POST('/v1/properties/{id}/rooms', { params: { path: { id: propertyId } }, body: { name, type } })),
    onSuccess: () => {
      setName('');
      return invalidate();
    },
  });
  const reorder = useMutation({
    mutationFn: (roomIds: string[]) =>
      unwrap(api.PUT('/v1/properties/{id}/rooms/order', { params: { path: { id: propertyId } }, body: { roomIds } })),
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/v1/rooms/{id}/archive', { params: { path: { id } } })),
    onSuccess: invalidate,
  });

  const items = rooms.data?.items ?? [];
  const move = (index: number, delta: number) => {
    const ids = items.map((r) => r.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved!);
    reorder.mutate(ids);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };

  return (
    <Card title="Rooms (photo checklist order)">
      <ErrorBanner error={add.error ?? reorder.error ?? archive.error} />
      <ol className="mb-3 divide-y divide-slate-100">
        {items.map((r, i) => (
          <li key={r.id} className="flex items-center gap-2 py-2 text-sm">
            <span className="flex-1">
              {r.name} <span className="text-slate-500">· {titleCase(r.type)}</span>
            </span>
            <Button variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </Button>
            <Button variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              ↓
            </Button>
            <Button variant="ghost" onClick={() => confirm(`Archive ${r.name}?`) && archive.mutate(r.id)}>
              Archive
            </Button>
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <Field label="Room">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ensuite" required />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary" disabled={add.isPending}>
          Add room
        </Button>
      </form>
    </Card>
  );
}

function nextMonthStart(): string {
  const d = new Date();
  const next = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

function PlanCard({ propertyId }: { propertyId: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const current = useQuery(queries.propertyPlan(api, propertyId));
  const plans = useQuery(queries.plans(api));
  const [planId, setPlanId] = useState('');
  const [month, setMonth] = useState(nextMonthStart().slice(0, 7));
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
    <Card title="Management plan">
      {current.data?.current ? (
        <p className="mb-3 text-sm">
          <strong>{current.data.current.plan.name}</strong> ({formatBps(current.data.current.plan.managementFeeBps)})
          since {current.data.current.effectiveFrom}
        </p>
      ) : (
        <p className="mb-3 text-sm text-slate-600">No plan assigned.</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          assign.mutate();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <Field label="Plan">
          <Select value={planId} onChange={(e) => setPlanId(e.target.value)} required>
            <option value="">Choose…</option>
            {plans.data?.items
              .filter((p) => !p.archivedAt)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatBps(p.managementFeeBps)})
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Starting month">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
        </Field>
        <Button type="submit" variant="secondary" disabled={assign.isPending}>
          Assign
        </Button>
      </form>
      <div className="mt-2">
        <ErrorBanner error={assign.error} />
      </div>
      {current.data && current.data.history.length > 1 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-slate-600">History</summary>
          <ul className="mt-1">
            {current.data.history.map((h) => (
              <li key={h.id}>
                {h.plan.name} · {h.effectiveFrom} → {h.effectiveTo ?? 'now'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function MembersCard({ propertyId }: { propertyId: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const members = useQuery(queries.memberships(api, propertyId));
  const users = useQuery(queries.users(api));
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'OWNER' | 'CLEANER'>('CLEANER');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['properties', propertyId, 'memberships'] });
  const add = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/properties/{id}/memberships', { params: { path: { id: propertyId } }, body: { userId, role } }),
      ),
    onSuccess: invalidate,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/v1/memberships/{id}/revoke', { params: { path: { id } } })),
    onSuccess: invalidate,
  });

  return (
    <Card title="Owners & cleaners">
      <ErrorBanner error={add.error ?? revoke.error} />
      <ul className="mb-3 divide-y divide-slate-100">
        {members.data?.items.map((m) => (
          <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
            <span className="flex-1">
              {m.user.firstName} {m.user.lastName} <span className="text-slate-500">· {m.user.email}</span>
            </span>
            <Badge tone={m.role === 'OWNER' ? 'green' : 'slate'}>{titleCase(m.role)}</Badge>
            <Button
              variant="ghost"
              onClick={() =>
                confirm(`Remove ${m.user.firstName}'s ${m.role.toLowerCase()} access?`) && revoke.mutate(m.id)
              }
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <Field label="Person" hint="Invite new people from Team">
          <Select value={userId} onChange={(e) => setUserId(e.target.value)} required>
            <option value="">Choose…</option>
            {users.data?.items
              .filter((u) => u.status !== 'DEACTIVATED')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.email})
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="CLEANER">Cleaner</option>
            <option value="OWNER">Owner</option>
          </Select>
        </Field>
        <Button type="submit" variant="secondary" disabled={add.isPending}>
          Add
        </Button>
      </form>
    </Card>
  );
}
