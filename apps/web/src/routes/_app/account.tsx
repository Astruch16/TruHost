import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { CircleCheck } from 'lucide-react';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { PageHeader } from '../../components/ui/page-header';
import { LoadingBlock } from '../../components/ui/skeleton';
import { useApi } from '../../lib/api-context';
import { fieldErrors } from '../../lib/errors';
import { queries } from '../../lib/queries';

export const Route = createFileRoute('/_app/account')({
  component: Account,
});

function Account() {
  const me = useQuery(queries.me(useApi()));
  return (
    <>
      <PageHeader title="Settings" description="Your profile and sign-in." />
      {me.error ? <ErrorAlert error={me.error} /> : !me.data ? <LoadingBlock /> : <ProfileForm initial={me.data} />}
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
    <Card title="Profile" className="max-w-2xl">
      <form onSubmit={submit} noValidate className="grid gap-4 @xl/content:grid-cols-2">
        <Field
          label="Email"
          hint="Change your email or password from Sign-in & security in the profile menu (top right)."
          className="@xl/content:col-span-2"
        >
          <Input value={initial.email} disabled />
        </Field>
        <Field label="First name" error={errors.firstName} required>
          <Input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Last name" error={errors.lastName} required>
          <Input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            autoComplete="family-name"
          />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            inputMode="tel"
            autoComplete="tel"
          />
        </Field>
        <div className="flex flex-col gap-3 @xl/content:col-span-2">
          <ErrorAlert error={Object.keys(errors).length ? null : save.error} />
          <div className="flex items-center gap-3">
            <Button type="submit" loading={save.isPending}>
              Save changes
            </Button>
            {save.isSuccess && (
              <span role="status" className="flex items-center gap-1.5 text-sm text-sage-deep">
                <CircleCheck aria-hidden className="size-4" /> Saved
              </span>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}
