import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { GuidePicker } from '../../components/guide/guide-picker';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { PageHeader } from '../../components/ui/page-header';
import { LoadingBlock } from '../../components/ui/skeleton';
import { Confirmation } from '../../components/ui/confirmation';
import { useApi } from '../../lib/api-context';
import { fieldErrors } from '../../lib/errors';
import { guideFromApi, guideToApi, type GuideCharacter } from '../../lib/guides';
import { queries } from '../../lib/queries';

export const Route = createFileRoute('/_app/account')({
  component: Account,
});

function Account() {
  const me = useQuery(queries.me(useApi()));
  return (
    <>
      <PageHeader title="Settings" description="Your profile, sign-in and guide." />
      {me.error ? (
        <ErrorAlert error={me.error} />
      ) : !me.data ? (
        <LoadingBlock />
      ) : (
        <div className="flex flex-col gap-6">
          <ProfileForm initial={me.data} />
          <GuideCard firstName={me.data.firstName} saved={guideFromApi(me.data.guide)} />
        </div>
      )}
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
            {save.isSuccess && <Confirmation>Saved</Confirmation>}
          </div>
        </div>
      </form>
    </Card>
  );
}

/** Picking a guide saves it straight away; the choice shows at once and rolls back if the save fails. */
function GuideCard({ firstName, saved }: { firstName: string; saved: GuideCharacter }) {
  const api = useApi();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<GuideCharacter | null>(null);
  const save = useMutation({
    mutationFn: (guide: GuideCharacter) => unwrap(api.PATCH('/v1/me', { body: { guide: guideToApi(guide) } })),
    onSuccess: (data) => qc.setQueryData(queries.me(api).queryKey, data),
    onSettled: () => setPicked(null),
  });
  const pick = (guide: GuideCharacter) => {
    setPicked(guide);
    save.mutate(guide);
  };

  return (
    <Card
      title="Your guide"
      description="Your guide keeps you company in empty pages and cheers when something goes well."
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        <GuidePicker value={picked ?? saved} onChange={pick} firstName={firstName} disabled={save.isPending} />
        <ErrorAlert error={save.error} />
      </div>
    </Card>
  );
}
