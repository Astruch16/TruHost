import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { Badge, Button, Card, ErrorBanner, Field, Input, Loading, PageHeader } from '../../../components/ui';
import { fieldErrors } from '../../../lib/errors';
import { useApi } from '../../../lib/api-context';
import { formatBps } from '../../../lib/format';
import { queries } from '../../../lib/queries';

export const Route = createFileRoute('/_app/admin/plans')({
  component: Plans,
});

/** "22" or "12.5" (percent) → basis points, without floating point. */
function percentToBps(input: string): number | null {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const bps = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return bps <= 10_000 ? bps : null;
}

function Plans() {
  const api = useApi();
  const qc = useQueryClient();
  const plans = useQuery(queries.plans(api));
  const [form, setForm] = useState({ name: '', percent: '', description: '' });
  const [percentError, setPercentError] = useState<string>();
  const create = useMutation({
    mutationFn: (managementFeeBps: number) =>
      unwrap(
        api.POST('/v1/plans', {
          body: { name: form.name, managementFeeBps, description: form.description.trim() || null },
        }),
      ),
    onSuccess: () => {
      setForm({ name: '', percent: '', description: '' });
      return qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
  const errors = fieldErrors(create.error);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const bps = percentToBps(form.percent);
    if (bps === null) return setPercentError('Enter a percentage like 22 or 12.5');
    setPercentError(undefined);
    create.mutate(bps);
  };

  return (
    <>
      <PageHeader title="Plans" />
      <div className="grid gap-4">
        <Card title="Plans">
          <ErrorBanner error={plans.error} />
          {!plans.data ? (
            <Loading />
          ) : (
            <ul className="divide-y divide-slate-100">
              {plans.data.items.map((p) => (
                <li key={p.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="flex-1">
                    <strong>{p.name}</strong> · {formatBps(p.managementFeeBps)} of monthly owner gross
                    {p.description && <span className="block text-slate-500">{p.description}</span>}
                  </span>
                  {p.inUse && <Badge tone="green">In use (rate locked)</Badge>}
                  {p.archivedAt && <Badge tone="amber">Archived</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="New plan">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" error={errors.name}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Management fee (%)" error={percentError ?? errors.managementFeeBps}>
              <Input
                value={form.percent}
                onChange={(e) => setForm({ ...form, percent: e.target.value })}
                inputMode="decimal"
                required
              />
            </Field>
            <Field label="Description" error={errors.description}>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="sm:col-span-3">
              <ErrorBanner error={Object.keys(errors).length ? null : create.error} />
              <Button type="submit" disabled={create.isPending}>
                Create plan
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
