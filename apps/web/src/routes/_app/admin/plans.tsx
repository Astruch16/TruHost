import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { Lock, Plus } from 'lucide-react';
import { ErrorAlert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { PageHeader } from '../../../components/ui/page-header';
import { Pill } from '../../../components/ui/pill';
import { Table, TableState, TBody, Td, Th, THead, Tr } from '../../../components/ui/table';
import { useApi } from '../../../lib/api-context';
import { fieldErrors } from '../../../lib/errors';
import { formatBps, percentToBps } from '../../../lib/format';
import { queries } from '../../../lib/queries';

export const Route = createFileRoute('/_app/admin/plans')({
  component: Plans,
});

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
      <PageHeader title="Plans" description="Management plans. A plan’s rate is locked once a property uses it." />
      <div className="flex flex-col gap-6">
        <Card title="Plans">
          <Table>
            <THead>
              <tr>
                <Th>Plan</Th>
                <Th align="right">Fee</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              <TableState
                columns={3}
                loading={plans.isPending}
                error={plans.error}
                empty={plans.data?.items.length === 0}
              />
              {plans.data?.items.map((p) => (
                <Tr key={p.id} interactive>
                  <Td>
                    <span className="font-semibold">{p.name}</span>
                    {p.description && <span className="block text-sm text-muted">{p.description}</span>}
                  </Td>
                  <Td align="right" className="font-semibold">
                    {formatBps(p.managementFeeBps)}
                    <span className="block text-xs font-normal text-muted">of monthly gross</span>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {p.archivedAt ? <Pill tone="neutral">Archived</Pill> : <Pill tone="sage">Active</Pill>}
                      {p.inUse && (
                        <Pill tone="lavender">
                          <Lock aria-hidden className="size-3" /> Rate locked
                        </Pill>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
        <Card title="New plan">
          <form
            onSubmit={submit}
            noValidate
            className="grid max-w-4xl gap-4 @xl/content:grid-cols-[1fr_10rem] @4xl/content:grid-cols-[1fr_10rem_1.5fr]"
          >
            <Field label="Name" error={errors.name} required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Fee (%)" error={percentError ?? errors.managementFeeBps} required>
              <Input
                value={form.percent}
                onChange={(e) => setForm({ ...form, percent: e.target.value })}
                inputMode="decimal"
                className="figure"
              />
            </Field>
            <Field
              label="Description"
              error={errors.description}
              className="@xl/content:col-span-2 @4xl/content:col-span-1"
            >
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="flex flex-col gap-3 @xl/content:col-span-2 @4xl/content:col-span-3">
              <ErrorAlert error={Object.keys(errors).length ? null : create.error} />
              <div>
                <Button type="submit" loading={create.isPending}>
                  <Plus aria-hidden className="size-4" /> Create plan
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
