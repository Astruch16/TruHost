import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { Badge, Button, Card, ErrorBanner, Field, Input, Loading, PageHeader, Select } from '../../../components/ui';
import { fieldErrors } from '../../../lib/errors';
import { useApi } from '../../../lib/api-context';
import { titleCase } from '../../../lib/format';
import { queries } from '../../../lib/queries';

export const Route = createFileRoute('/_app/admin/team')({
  component: Team,
});

type Role = 'ADMIN' | 'OWNER' | 'CLEANER';

function Team() {
  const api = useApi();
  const qc = useQueryClient();
  const me = useQuery(queries.me(api));
  const users = useQuery(queries.users(api));
  const invites = useQuery(queries.invites(api));
  const refresh = () =>
    Promise.all([qc.invalidateQueries({ queryKey: ['users'] }), qc.invalidateQueries({ queryKey: ['invites'] })]);

  const deactivate = useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/v1/users/{id}/deactivate', { params: { path: { id } } })),
    onSuccess: refresh,
  });
  const resend = useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/v1/invites/{id}/resend', { params: { path: { id } } })),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/v1/invites/{id}/revoke', { params: { path: { id } } })),
    onSuccess: refresh,
  });

  return (
    <>
      <PageHeader title="Team" />
      <div className="grid gap-4">
        <InviteForm onDone={refresh} />
        <Card title="People">
          <ErrorBanner error={users.error ?? deactivate.error} />
          {!users.data ? (
            <Loading />
          ) : (
            <ul className="divide-y divide-slate-100">
              {users.data.items.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="flex-1">
                    {u.firstName} {u.lastName} <span className="text-slate-500">· {u.email}</span>
                  </span>
                  {u.staffRole && <Badge tone="green">Admin</Badge>}
                  <Badge tone={u.status === 'ACTIVE' ? 'slate' : u.status === 'INVITED' ? 'amber' : 'red'}>
                    {titleCase(u.status)}
                  </Badge>
                  {u.status !== 'DEACTIVATED' && u.id !== me.data?.id && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        confirm(`Deactivate ${u.firstName}? They will be signed out.`) && deactivate.mutate(u.id)
                      }
                    >
                      Deactivate
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Invites">
          <ErrorBanner error={invites.error ?? resend.error ?? revoke.error} />
          <ul className="divide-y divide-slate-100">
            {invites.data?.items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="flex-1">
                  {i.user.email}
                  {!i.emailSent && <span className="text-amber-700"> · email not sent</span>}
                </span>
                <Badge tone={i.status === 'PENDING' ? 'amber' : i.status === 'ACCEPTED' ? 'green' : 'red'}>
                  {titleCase(i.status)}
                </Badge>
                {i.status === 'PENDING' && (
                  <>
                    <Button variant="ghost" onClick={() => resend.mutate(i.id)}>
                      Resend
                    </Button>
                    <Button variant="ghost" onClick={() => confirm('Revoke this invite?') && revoke.mutate(i.id)}>
                      Revoke
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function InviteForm({ onDone }: { onDone: () => Promise<unknown> }) {
  const api = useApi();
  const properties = useQuery(queries.properties(api));
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'CLEANER' as Role, propertyId: '' });
  const invite = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/invites', {
          body: {
            email: form.email,
            firstName: form.firstName,
            lastName: form.lastName,
            staffRole: form.role === 'ADMIN' ? 'ADMIN' : null,
            memberships:
              form.role !== 'ADMIN' && form.propertyId ? [{ propertyId: form.propertyId, role: form.role }] : [],
          },
        }),
      ),
    onSuccess: async () => {
      setForm({ ...form, email: '', firstName: '', lastName: '' });
      await onDone();
    },
  });
  const errors = fieldErrors(invite.error);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    invite.mutate();
  };

  return (
    <Card title="Invite someone">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </Field>
        <Field label="First name" error={errors.firstName}>
          <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="CLEANER">Cleaner</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin (TruHost staff)</option>
          </Select>
        </Field>
        {form.role !== 'ADMIN' && (
          <Field label="Property">
            <Select value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })} required>
              <option value="">Choose…</option>
              {properties.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="flex flex-col justify-end gap-2">
          <Button type="submit" disabled={invite.isPending}>
            Send invite
          </Button>
        </div>
        <div className="sm:col-span-3">
          <ErrorBanner error={Object.keys(errors).length ? null : invite.error} />
          {invite.isSuccess && <p className="text-sm text-green-700">Invite sent.</p>}
        </div>
      </form>
    </Card>
  );
}
