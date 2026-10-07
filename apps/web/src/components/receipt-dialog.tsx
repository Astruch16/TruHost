import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { useApi } from '../lib/api-context';
import { fieldErrors } from '../lib/errors';
import { formatCents } from '../lib/money';
import { shortDate } from '../lib/months';
import { queries } from '../lib/queries';
import { uploadReceipt, UploadError } from '../lib/upload';
import { ErrorAlert } from './ui/alert';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Field } from './ui/field';
import { Input } from './ui/input';
import { Select } from './ui/select';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

/** Upload a receipt, optionally attaching it to an owner-borne expense that is still missing one. */
export function ReceiptDialog({
  onClose,
  properties,
  initialPropertyId,
}: {
  onClose: () => void;
  properties: { id: string; name: string }[];
  initialPropertyId?: string;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const [propertyId, setPropertyId] = useState(initialPropertyId ?? properties[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [receiptDate, setReceiptDate] = useState(today);
  const [expenseId, setExpenseId] = useState('');
  const recent = useQuery({
    ...queries.expenses(api, { from: daysAgo(120), to: daysAgo(-1) }, propertyId || undefined),
    enabled: Boolean(propertyId),
  });
  const missing = (recent.data?.items ?? []).filter((e) => e.missingReceipt);

  const save = useMutation({
    mutationFn: async () => {
      if (!file) throw new UploadError('Choose a file to upload.');
      const fileId = await uploadReceipt(api, propertyId, file);
      return unwrap(
        api.POST('/v1/properties/{id}/receipts', {
          params: { path: { id: propertyId } },
          body: { fileId, expenseId: expenseId || null, receiptDate },
        }),
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['expenses'] });
      onClose();
    },
  });
  const errors = fieldErrors(save.error);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !save.isPending && onClose()}
      title="Upload receipt"
      description="Attach it to an expense that’s missing one, or keep it on file for the property."
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {properties.length > 1 && (
          <Field label="Property" required>
            <Select
              value={propertyId}
              onValueChange={(value) => {
                setPropertyId(value);
                setExpenseId('');
              }}
              options={properties.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
        )}
        <Field label="File" hint="PDF or photo, up to 20 MB." required>
          <Input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="py-2"
          />
        </Field>
        <Field label="Receipt date" error={errors.receiptDate} required>
          <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
        </Field>
        <Field
          label="Expense"
          hint={
            missing.length
              ? 'Owner-borne expenses from the last four months without a receipt.'
              : 'No expenses are missing a receipt.'
          }
        >
          <Select
            value={expenseId}
            onValueChange={setExpenseId}
            disabled={missing.length === 0}
            options={[
              { value: '', label: 'Not linked to an expense' },
              ...missing.map((e) => ({
                value: e.id,
                label: `${shortDate(e.incurredOn)} · ${e.description} · ${formatCents(e.amountCents)}`,
              })),
            ]}
          />
        </Field>
        <ErrorAlert error={Object.keys(errors).length ? null : save.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={save.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!file}>
            Upload receipt
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
