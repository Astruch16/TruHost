import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { Upload } from 'lucide-react';
import { useApi } from '../lib/api-context';
import { uploadReceipt } from '../lib/upload';
import { Button } from './ui/button';

/** Attach a receipt file to an existing expense. */
export function ReceiptUploadButton({
  propertyId,
  expenseId,
  receiptDate,
  onError,
}: {
  propertyId: string;
  expenseId: string;
  receiptDate: string;
  onError: (error: unknown) => void;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fileId = await uploadReceipt(api, propertyId, file);
      return unwrap(
        api.POST('/v1/properties/{id}/receipts', {
          params: { path: { id: propertyId } },
          body: { fileId, expenseId, receiptDate },
        }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
    onError,
  });
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = '';
        }}
      />
      <Button variant="quiet" size="sm" loading={upload.isPending} onClick={() => input.current?.click()}>
        <Upload aria-hidden className="size-4" /> Receipt
      </Button>
    </>
  );
}
