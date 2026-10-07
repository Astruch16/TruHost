import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { Send } from 'lucide-react';
import { ErrorAlert } from '../../../components/ui/alert';
import { Confirmation } from '../../../components/ui/confirmation';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { ConfirmDialog } from '../../../components/ui/dialog';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { PageHeader } from '../../../components/ui/page-header';
import { Pill } from '../../../components/ui/pill';
import { Table, TableState, TBody, Td, Th, THead, Tr } from '../../../components/ui/table';
import { useApi } from '../../../lib/api-context';
import { fieldErrors } from '../../../lib/errors';
import { titleCase } from '../../../lib/format';
import { queries } from '../../../lib/queries';
import type { PillTone } from '../../../lib/styles';

export const Route = createFileRoute('/_app/admin/team')({
  component: Team,
});

type Role = 'ADMIN' | 'OWNER' | 'CLEANER';
type Pending = { kind: 'deactivate' | 'revoke'; id: string; label: string } | null;

const statusTone: Record<string, PillTone> = { ACTIVE: 'sage', INVITED: 'lavender', DEACTIVATED: 'neutral' };
const inviteTone: Record<string, PillTone> = { PENDING: 'lavender', ACCEPTED: 'sage', REVOKED: 'neutral' };

function Team() {
  const api = useApi();
  const qc = useQueryClient();
  const me = useQuery(queries.me(api));
  const users = useQuery(queries.users(api));
  const invites = useQuery(queries.invites(api));
  const [pending, setPending] = useState<Pending>(null);
  const refresh = () =>
    Promise.all([qc.invalidateQueries({ queryKey: ['users'] }), qc.invalidateQueries({ queryKey: ['invites'] })]);

  const deactivate = useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/v1/users/{id}/deactivate', { params: { path: { id } } })),
    onSuccess: async () => {
      await refresh();
      setPending(null);
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/v1/invites/{id}/revoke', { params: { path: { id } } })),
    onSuccess: async () => {
      await refresh();
      setPending(null);
    },
  });
  const resend = useMutation({
    mutationFn: (id: string) => unwrap(api.POST('/v1/invites/{id}/resend', { params: { path: { id } } })),
    onSuccess: refresh,
  });
  const action = pending?.kind === 'deactivate' ? deactivate : revoke;

  return (
    <>
      <PageHeader title="Team" description="Admins, owners and cleaners. TruHost is invite-only." />
      <div className="flex flex-col gap-6">
        <InviteForm onDone={refresh} />
        <Card title="People">
          <Table>
            <THead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              <TableState
                columns={4}
                loading={users.isPending}
                error={users.error}
                empty={users.data?.items.length === 0}
              />
              {users.data?.items.map((u) => (
                <Tr key={u.id} interactive>
                  <Td className="font-medium">
                    {u.firstName} {u.lastName}
                    {u.staffRole && (
                      <span className="ml-2">
                        <Pill tone="dark">Admin</Pill>
                      </span>
                    )}
                  </Td>
                  <Td className="text-muted">{u.email}</Td>
                  <Td>
                    <Pill tone={statusTone[u.status] ?? 'neutral'}>{titleCase(u.status)}</Pill>
                  </Td>
                  <Td align="right">
                    {u.status !== 'DEACTIVATED' && u.id !== me.data?.id && (
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() =>
                          setPending({ kind: 'deactivate', id: u.id, label: `${u.firstName} ${u.lastName}` })
                        }
                      >
                        Deactivate
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
        <Card title="Invites">
          <ErrorAlert error={resend.error} />
          <Table>
            <THead>
              <tr>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              <TableState
                columns={3}
                loading={invites.isPending}
                error={invites.error}
                empty={invites.data?.items.length === 0}
                emptyMessage="No invites sent yet."
              />
              {invites.data?.items.map((i) => (
                <Tr key={i.id} interactive>
                  <Td>
                    {i.user.email}
                    {!i.emailSent && <span className="ml-2 text-xs text-muted">(email not sent)</span>}
                  </Td>
                  <Td>
                    <Pill tone={inviteTone[i.status] ?? 'neutral'}>{titleCase(i.status)}</Pill>
                  </Td>
                  <Td align="right">
                    {i.status === 'PENDING' && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="quiet"
                          size="sm"
                          loading={resend.isPending && resend.variables === i.id}
                          onClick={() => resend.mutate(i.id)}
                        >
                          Resend
                        </Button>
                        <Button
                          variant="quiet"
                          size="sm"
                          onClick={() => setPending({ kind: 'revoke', id: i.id, label: i.user.email })}
                        >
                          Revoke
                        </Button>
                      </div>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
            action.reset();
          }
        }}
        title={pending?.kind === 'deactivate' ? `Deactivate ${pending.label}?` : 'Revoke this invite?'}
        description={
          pending?.kind === 'deactivate'
            ? 'They are signed out everywhere and can no longer sign in. Their history is kept.'
            : `The invite link for ${pending?.label ?? 'this person'} stops working.`
        }
        confirmLabel={pending?.kind === 'deactivate' ? 'Deactivate' : 'Revoke invite'}
        destructive
        pending={action.isPending}
        error={action.error}
        onConfirm={() => pending && action.mutate(pending.id)}
      />
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
    <Card title="Invite someone" description="They’ll get an email with a link to create their account.">
      <form
        onSubmit={submit}
        noValidate
        className="grid max-w-5xl gap-4 @xl/content:grid-cols-2 @4xl/content:grid-cols-3"
      >
        <Field label="Email" error={errors.email} required>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="off"
          />
        </Field>
        <Field label="First name" error={errors.firstName} required>
          <Input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            autoComplete="off"
          />
        </Field>
        <Field label="Last name" error={errors.lastName} required>
          <Input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            autoComplete="off"
          />
        </Field>
        <Field label="Role">
          <Select
            value={form.role}
            onValueChange={(value) => setForm({ ...form, role: value as Role })}
            options={[
              { value: 'CLEANER', label: 'Cleaner' },
              { value: 'OWNER', label: 'Owner' },
              { value: 'ADMIN', label: 'Admin (TruHost staff)' },
            ]}
          />
        </Field>
        {form.role !== 'ADMIN' && (
          <Field label="Property" required>
            <Select
              value={form.propertyId}
              onValueChange={(value) => setForm({ ...form, propertyId: value })}
              placeholder="Choose a property"
              options={(properties.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
        )}
        <div className="flex flex-col gap-3 @xl/content:col-span-2 @4xl/content:col-span-3">
          <ErrorAlert error={Object.keys(errors).length ? null : invite.error} />
          <div className="flex items-center gap-3">
            <Button type="submit" loading={invite.isPending}>
              <Send aria-hidden className="size-4" /> Send invite
            </Button>
            {invite.isSuccess && (
              <Confirmation>
                {invite.data.emailSent
                  ? `Invite sent to ${invite.data.user.email}`
                  : `Invite created. Email isn’t set up here, so nothing was sent.`}
              </Confirmation>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}
