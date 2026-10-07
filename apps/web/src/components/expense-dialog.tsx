import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { useApi } from '../lib/api-context';
import type { Expense } from '../lib/api-types';
import { fieldErrors } from '../lib/errors';
import { categoryLabel, EXPENSE_CATEGORIES } from '../lib/format';
import { centsToInput, parseDollarsToCents } from '../lib/money';
import { uploadReceipt } from '../lib/upload';
import { ErrorAlert } from './ui/alert';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Field } from './ui/field';
import { Input } from './ui/input';
import { Select } from './ui/select';

/**
 * Add or edit an expense. When adding, a receipt file can be attached in the same step:
 * upload → create expense → attach receipt.
 */
export function ExpenseDialog({
  onClose,
  properties,
  initialPropertyId,
  expense,
}: {
  onClose: () => void;
  properties: { id: string; name: string }[];
  initialPropertyId?: string;
  expense?: Expense;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const editing = Boolean(expense);
  const today = new Date().toISOString().slice(0, 10);
  const [v, setV] = useState({
    propertyId: expense?.propertyId ?? initialPropertyId ?? properties[0]?.id ?? '',
    category: expense?.category ?? ('SUPPLIES' as (typeof EXPENSE_CATEGORIES)[number]),
    bearer: expense?.bearer ?? ('OWNER' as 'OWNER' | 'TRUHOST'),
    incurredOn: expense?.incurredOn ?? today,
    vendor: expense?.vendor ?? '',
    description: expense?.description ?? '',
    amount: expense ? centsToInput(expense.amountCents) : '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [amountError, setAmountError] = useState<string>();
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [key]: e.target.value });
  const pick = (key: keyof typeof v) => (value: string) => setV({ ...v, [key]: value });

  const save = useMutation({
    mutationFn: async (amountCents: number) => {
      const body = {
        category: v.category,
        bearer: v.bearer,
        incurredOn: v.incurredOn,
        vendor: v.vendor.trim() || null,
        description: v.description,
        amountCents,
      };
      if (editing) {
        return unwrap(
          api.PATCH('/v1/expenses/{id}', {
            params: { path: { id: expense!.id } },
            body: { ...body, version: expense!.version ?? 0 },
          }),
        );
      }
      // Upload first so a failed upload doesn't leave an expense behind.
      const fileId = file ? await uploadReceipt(api, v.propertyId, file) : null;
      const created = await unwrap(
        api.POST('/v1/properties/{id}/expenses', { params: { path: { id: v.propertyId } }, body }),
      );
      if (fileId) {
        await unwrap(
          api.POST('/v1/properties/{id}/receipts', {
            params: { path: { id: v.propertyId } },
            body: { fileId, expenseId: created.id, receiptDate: v.incurredOn },
          }),
        );
      }
      return created;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['expenses'] });
      onClose();
    },
  });
  const errors = fieldErrors(save.error);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseDollarsToCents(v.amount);
    setAmountError(cents === null ? 'Enter an amount like 41.99' : undefined);
    if (cents !== null) save.mutate(cents);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !save.isPending && onClose()}
      title={editing ? 'Edit expense' : 'Add expense'}
      description="Owner-borne expenses are deducted on the owner’s statement and need a receipt."
      size="lg"
    >
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {!editing && properties.length > 1 && (
          <Field label="Property" className="sm:col-span-2" required>
            <Select
              value={v.propertyId}
              onValueChange={pick('propertyId')}
              options={properties.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
        )}
        <Field label="Purchase date" error={errors.incurredOn} hint="The date on the receipt." required>
          <Input type="date" value={v.incurredOn} onChange={set('incurredOn')} />
        </Field>
        <Field label="Amount ($)" error={amountError ?? errors.amountCents} hint="Total paid, including tax." required>
          <Input value={v.amount} onChange={set('amount')} inputMode="decimal" className="figure" />
        </Field>
        <Field label="Description" error={errors.description} className="sm:col-span-2" required>
          <Input value={v.description} onChange={set('description')} placeholder="e.g. Paper towels and coffee" />
        </Field>
        <Field label="Vendor" error={errors.vendor}>
          <Input value={v.vendor} onChange={set('vendor')} />
        </Field>
        <Field label="Category" error={errors.category}>
          <Select
            value={v.category}
            onValueChange={pick('category')}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))}
          />
        </Field>
        <Field label="Paid by" error={errors.bearer} className="sm:col-span-2">
          <Select
            value={v.bearer}
            onValueChange={pick('bearer')}
            options={[
              { value: 'OWNER', label: 'Owner (deducted on their statement)' },
              { value: 'TRUHOST', label: 'TruHost (our own cost, not shown to owners)' },
            ]}
          />
        </Field>
        {!editing && (
          <Field label="Receipt" hint="PDF or photo, up to 20 MB. You can also add it later." className="sm:col-span-2">
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="py-2"
            />
          </Field>
        )}
        <div className="flex flex-col gap-3 sm:col-span-2">
          <ErrorAlert error={Object.keys(errors).length ? null : save.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={save.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {editing ? 'Save changes' : 'Add expense'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
