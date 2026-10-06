import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { Button, Card, ErrorBanner, Field, Input, Loading, PageHeader } from '../../components/ui';
import { fieldErrors } from '../../lib/errors';
import { useApi } from '../../lib/api-context';
import { queries } from '../../lib/queries';

export const Route = createFileRoute('/_app/account')({
  component: Account,
});

function Account() {
  const api = useApi();
  const me = useQuery(queries.me(api));
  if (!me.data) return <Loading />;
  return (
    <>
      <PageHeader title="Account" />
      <ProfileForm initial={me.data} />
    </>
  );
}

function ProfileForm({
  initial,
}: {
  initial: { firstName: string; lastName: string; phone: string | null; email: string };
}) {
  const api = useApi();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: initial.firstName,
    lastName: initial.lastName,
    phone: initial.phone ?? '',
  });
  const save = useMutation({
    mutationFn: () => unwrap(api.PATCH('/v1/me', { body: { ...form, phone: form.phone.trim() || null } })),
    onSuccess: (data) => qc.setQueryData(queries.me(api).queryKey, data),
  });
  const errors = fieldErrors(save.error);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Card title="Profile">
      <form onSubmit={submit} className="grid max-w-md gap-3">
        <Field label="Email" hint="Change your email from the account menu (top right).">
          <Input value={initial.email} disabled />
        </Field>
        <Field label="First name" error={errors.firstName}>
          <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" />
        </Field>
        <ErrorBanner error={Object.keys(errors).length ? null : save.error} />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={save.isPending}>
            Save
          </Button>
          {save.isSuccess && <span className="text-sm text-green-700">Saved</span>}
        </div>
      </form>
    </Card>
  );
}
