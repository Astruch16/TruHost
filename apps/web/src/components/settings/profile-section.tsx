import { useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { Me } from '@truhost/shared';
import { Building2, Mail, Sparkles } from 'lucide-react';
import { AvatarCard } from './avatar-card';
import { SettingRow } from './setting-row';
import { ErrorAlert, LoadError } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Confirmation } from '../ui/confirmation';
import { Field } from '../ui/field';
import { Input } from '../ui/input';
import { Pill } from '../ui/pill';
import { Skeleton } from '../ui/skeleton';
import { useApi } from '../../lib/api-context';
import { fieldErrors } from '../../lib/errors';
import { queries } from '../../lib/queries';

export function ProfileSettings() {
  const me = useQuery(queries.me(useApi()));
  if (me.error) return <LoadError what="your profile" onRetry={() => void me.refetch()} retrying={me.isFetching} />;
  if (!me.data) return <Skeleton className="h-72 rounded-card" />;
  return (
    <>
      <AvatarCard me={me.data} />
      <ProfileForm key={me.data.id} initial={me.data} />
      <AccessCard me={me.data} />
    </>
  );
}

function ProfileForm({ initial }: { initial: Me }) {
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
  const changed =
    form.firstName !== initial.firstName || form.lastName !== initial.lastName || form.phone !== (initial.phone ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Card title="Personal details" description="How the TruHost team and your properties’ contacts see you.">
      <form onSubmit={submit} noValidate className="grid gap-4 @xl/content:grid-cols-2">
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
        <Field label="Phone" error={errors.phone} hint="So TruHost can reach you about a stay or a clean.">
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            inputMode="tel"
            autoComplete="tel"
            placeholder="(604) 555-0123"
          />
        </Field>
        <Field
          label="Email"
          hint={
            <>
              You sign in with this address. To change it, ask TruHost. Password and two-step are in{' '}
              <Link to="/account/security" className="font-semibold text-sage-deep underline-offset-2 hover:underline">
                Security
              </Link>
              .
            </>
          }
        >
          <div className="relative">
            <Mail
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
            />
            <Input value={initial.email} readOnly disabled className="pl-10" />
          </div>
        </Field>
        <div className="flex flex-col gap-3 border-t border-line-soft pt-4 @xl/content:col-span-2">
          <ErrorAlert error={Object.keys(errors).length ? null : save.error} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={save.isPending} disabled={!changed && !save.isPending}>
              Save changes
            </Button>
            {save.isSuccess && !changed && <Confirmation>Saved</Confirmation>}
          </div>
        </div>
      </form>
    </Card>
  );
}

const ROLE_LABEL = { OWNER: 'Owner', CLEANER: 'Cleaner' } as const;

/** What this person can see: staff access, and each property they own or clean. Read-only; TruHost manages it. */
function AccessCard({ me }: { me: Me }) {
  const isAdmin = me.staffRole === 'ADMIN';
  return (
    <Card title="Your access" description="Set by TruHost. Ask your TruHost contact if something’s missing.">
      <div>
        {isAdmin && (
          <SettingRow
            icon={<Sparkles />}
            title="TruHost staff"
            status={<Pill tone="dark">Admin</Pill>}
            description="Every property, booking, expense and team member."
          />
        )}
        {me.memberships.map((m) => (
          <SettingRow
            key={m.id}
            icon={<Building2 />}
            title={m.property.name}
            status={<Pill tone={m.role === 'OWNER' ? 'blue' : 'lavender'}>{ROLE_LABEL[m.role]}</Pill>}
            description={
              m.role === 'OWNER'
                ? 'Stays, earnings and statements for this property.'
                : 'The property’s address and rooms. Your cleaning schedule arrives here later.'
            }
          />
        ))}
        {!isAdmin && me.memberships.length === 0 && (
          <p className="text-sm text-muted">You don’t have access to any properties yet.</p>
        )}
      </div>
    </Card>
  );
}
