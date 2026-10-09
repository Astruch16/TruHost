import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { FileText, Pencil, ReceiptText, Trash2 } from 'lucide-react';
import { ExpenseDialog } from '../../../components/expense-dialog';
import { ReceiptUploadButton } from '../../../components/receipt-upload-button';
import { ErrorAlert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Dialog } from '../../../components/ui/dialog';
import { EmptyState } from '../../../components/ui/empty-state';
import { Field } from '../../../components/ui/field';
import { Input } from '../../../components/ui/input';
import { MonthStepper } from '../../../components/ui/month-stepper';
import { PageHeader } from '../../../components/ui/page-header';
import { Pill } from '../../../components/ui/pill';
import { Table, TableState, TBody, Td, Th, THead, Tr } from '../../../components/ui/table';
import { useApi } from '../../../lib/api-context';
import type { Expense } from '../../../lib/api-types';
import { categoryLabel } from '../../../lib/format';
import { formatCents } from '../../../lib/money';
import { monthKey, monthLabel, monthRange, shortDate } from '../../../lib/months';
import { queries } from '../../../lib/queries';
import { usePrefetchAdjacentMonths } from '../../../lib/month-prefetch';
import { updatingStyles } from '../../../lib/styles';
import { monthSearch, useScope } from '../../../lib/scope';
import { openFile } from '../../../lib/upload';

export const Route = createFileRoute('/_app/admin/expenses')({
  validateSearch: monthSearch,
  component: Expenses,
});

function Expenses() {
  const api = useApi();
  const navigate = Route.useNavigate();
  const month = Route.useSearch().month ?? monthKey();
  const setMonth = (m: string) => void navigate({ search: { month: m } });
  const { propertyId: scopedId } = useScope();
  const propertyId = scopedId ?? '';
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [voiding, setVoiding] = useState<Expense | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const properties = useQuery(queries.properties(api));
  const expenses = useQuery(queries.expenses(api, monthRange(month), propertyId || undefined));
  usePrefetchAdjacentMonths(
    month,
    (m) => queries.expenses(api, monthRange(m), propertyId || undefined),
    expenses.isSuccess,
  );
  const propertyList = properties.data?.items ?? [];
  const nameOf = (id: string) => propertyList.find((p) => p.id === id)?.name ?? '';
  const items = expenses.data?.items ?? [];
  const noProperties = properties.isSuccess && propertyList.length === 0;
  const view = (fileId: string) => openFile(api, fileId).catch(setActionError);

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Purchases for each property, dated by receipt. Owner-borne ones are deducted on statements."
        actions={
          <Button onClick={() => setEditing('new')} disabled={noProperties}>
            <ReceiptText aria-hidden className="size-4" /> Add expense
          </Button>
        }
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <MonthStepper month={month} onChange={setMonth} />
        </div>
        <div className="mb-3">
          <ErrorAlert error={actionError} />
        </div>
        {noProperties ? (
          <EmptyState title="Add a property first">
            Expenses belong to a property. Create one under Properties, then come back here.
          </EmptyState>
        ) : expenses.isSuccess && !expenses.isPlaceholderData && items.length === 0 ? (
          <EmptyState
            title={`No expenses in ${monthLabel(month)}`}
            action={<Button onClick={() => setEditing('new')}>Add expense</Button>}
          >
            Record each purchase with its receipt. Supply restocks are owner-borne.
          </EmptyState>
        ) : (
          <Table
            aria-busy={expenses.isPlaceholderData || undefined}
            className={updatingStyles(expenses.isPlaceholderData)}
          >
            <THead>
              <tr>
                <Th>Date</Th>
                {propertyList.length > 1 && <Th>Property</Th>}
                <Th>Expense</Th>
                <Th>Category</Th>
                <Th align="right">Amount</Th>
                <Th>Receipt</Th>
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              <TableState columns={7} loading={expenses.isPending} error={expenses.error} empty={false} />
              {items.map((e) => (
                <Tr key={e.id} interactive className={e.voidedAt ? 'text-muted' : undefined}>
                  <Td className="whitespace-nowrap">{shortDate(e.incurredOn)}</Td>
                  {propertyList.length > 1 && <Td>{nameOf(e.propertyId)}</Td>}
                  <Td>
                    <span className={e.voidedAt ? 'line-through' : 'font-medium'}>{e.description}</span>
                    <span className="block text-xs text-muted">
                      {[e.vendor, e.bearer === 'TRUHOST' ? 'TruHost cost' : null].filter(Boolean).join(' · ')}
                    </span>
                  </Td>
                  <Td>
                    <Pill tone="lavender">{categoryLabel(e.category)}</Pill>
                  </Td>
                  <Td align="right" className="font-semibold">
                    {formatCents(e.amountCents)}
                  </Td>
                  <Td>
                    {e.voidedAt ? (
                      <Pill tone="neutral">Voided</Pill>
                    ) : (
                      <span className="flex flex-wrap items-center gap-1">
                        {e.receipts.map((r) => (
                          <Button key={r.id} variant="quiet" size="sm" onClick={() => void view(r.fileId)}>
                            <FileText aria-hidden className="size-4" />
                            <span className="sr-only">View receipt</span>
                            {r.filename ? <span className="max-w-28 truncate">{r.filename}</span> : 'View'}
                          </Button>
                        ))}
                        {e.missingReceipt && <Pill tone="lavender">Missing receipt</Pill>}
                        <ReceiptUploadButton
                          propertyId={e.propertyId}
                          expenseId={e.id}
                          receiptDate={e.incurredOn}
                          onError={setActionError}
                        />
                      </span>
                    )}
                  </Td>
                  <Td align="right">
                    {!e.voidedAt && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="quiet"
                          size="sm"
                          onClick={() => setEditing(e)}
                          aria-label={`Edit ${e.description}`}
                        >
                          <Pencil aria-hidden className="size-4" />
                        </Button>
                        <Button
                          variant="quiet"
                          size="sm"
                          onClick={() => setVoiding(e)}
                          aria-label={`Void ${e.description}`}
                        >
                          <Trash2 aria-hidden className="size-4" />
                        </Button>
                      </div>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      {editing && (
        <ExpenseDialog
          key={editing === 'new' ? 'new' : editing.id}
          onClose={() => setEditing(null)}
          properties={propertyList}
          initialPropertyId={propertyId || undefined}
          expense={editing === 'new' ? undefined : editing}
        />
      )}
      {voiding && <VoidDialog expense={voiding} onClose={() => setVoiding(null)} />}
    </>
  );
}

function VoidDialog({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const voidIt = useMutation({
    mutationFn: () =>
      unwrap(api.POST('/v1/expenses/{id}/void', { params: { path: { id: expense.id } }, body: { reason } })),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['expenses'] });
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !voidIt.isPending && onClose()}
      title="Void this expense?"
      description={`${expense.description}, ${formatCents(expense.amountCents)}. It stays on record, marked void, and is no longer deducted.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" disabled={voidIt.isPending} onClick={onClose}>
            Keep expense
          </Button>
          <Button
            variant="danger-solid"
            loading={voidIt.isPending}
            disabled={!reason.trim()}
            onClick={() => voidIt.mutate()}
          >
            Void expense
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Reason" hint="Required, e.g. “Entered twice”." required>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
        <ErrorAlert error={voidIt.error} />
      </div>
    </Dialog>
  );
}
