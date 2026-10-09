import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { Property, PropertyDeletion } from '@truhost/shared';
import { useApi } from '../lib/api-context';
import { ErrorAlert } from './ui/alert';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Field } from './ui/field';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Deleting a property. Only one with no bookings, expenses or receipts can be deleted, completely; the dialog
 * checks first and, for any other, explains why and offers Archive instead. Deleting asks for the name, since it
 * can't be undone.
 */
export function DeletePropertyDialog({
  property,
  open,
  onOpenChange,
  onArchive,
  onDeleted,
  preview,
}: {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Offered when the property can't be deleted (and isn't archived already). */
  onArchive: () => void;
  onDeleted: () => void;
  /** Dev preview only: show this answer instead of asking the API. */
  preview?: PropertyDeletion;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const [typed, setTyped] = useState('');
  const check = useQuery({
    queryKey: ['properties', property.id, 'deletion'],
    queryFn: () => unwrap(api.GET('/v1/properties/{id}/deletion', { params: { path: { id: property.id } } })),
    enabled: open && !preview,
    staleTime: 0,
  });
  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/v1/properties/{id}', { params: { path: { id: property.id } } })),
    onSuccess: async () => {
      qc.removeQueries({ queryKey: ['properties', property.id] });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['properties'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      onDeleted();
    },
  });
  const close = (next: boolean) => {
    if (remove.isPending) return;
    if (!next) {
      setTyped('');
      remove.reset();
    }
    onOpenChange(next);
  };
  const d = preview ?? check.data;
  const matches = typed.trim() === property.name.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      size="md"
      title={d && !d.allowed ? `${property.name} can’t be deleted` : `Delete ${property.name}?`}
      footer={
        d && !d.allowed ? (
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Close
            </Button>
            {!property.archivedAt && (
              <Button
                onClick={() => {
                  close(false);
                  onArchive();
                }}
              >
                Archive instead
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => close(false)} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              disabled={!d || !matches}
              onClick={() => remove.mutate()}
            >
              Delete property
            </Button>
          </>
        )
      }
    >
      {check.error && !preview ? (
        <ErrorAlert error={check.error} />
      ) : !d ? (
        <div role="status" aria-label="Checking" className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : !d.allowed ? (
        <div className="flex flex-col gap-3 text-sm text-ink">
          <p>
            It has{' '}
            {[
              d.bookings && plural(d.bookings, 'booking', 'bookings'),
              d.expenses && plural(d.expenses, 'expense', 'expenses'),
              d.receipts && plural(d.receipts, 'receipt', 'receipts'),
            ]
              .filter(Boolean)
              .join(', ')
              .replace(/, ([^,]*)$/, ' and $1')}
            . Financial records are kept (for your books and tax records), so a property with any can’t be deleted.
          </p>
          <p className="text-muted">
            {property.archivedAt
              ? 'It’s already archived: hidden from lists, with its history kept.'
              : 'Archive it instead: it disappears from lists and the dashboard, and its history stays available.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 text-sm text-ink">
          <p>
            This permanently deletes the property with its rooms, owner and cleaner access, plan history and photos. It
            can’t be undone.
          </p>
          <Field label={`Type “${property.name}” to confirm`}>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </Field>
          <ErrorAlert error={remove.error} />
        </div>
      )}
    </Dialog>
  );
}
