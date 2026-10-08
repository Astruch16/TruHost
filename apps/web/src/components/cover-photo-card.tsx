import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { Property } from '@truhost/shared';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useApi } from '../lib/api-context';
import { monogram } from '../lib/dashboard-format';
import { PHOTO_INPUT_ACCEPT, uploadCoverPhoto } from '../lib/property-photo';
import { queries } from '../lib/queries';
import { CoverImage } from './cover-image';
import { ErrorAlert } from './ui/alert';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Confirmation } from './ui/confirmation';
import { ConfirmDialog } from './ui/dialog';

/** The property's cover photo, shown on property cards. Admins upload, replace or remove it here. */
export function CoverPhotoCard({ property }: { property: Property }) {
  const api = useApi();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const saved = async (p: Property) => {
    qc.setQueryData(queries.property(api, p.id).queryKey, p);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['properties', { includeArchived: false }] }),
      qc.invalidateQueries({ queryKey: ['properties', { includeArchived: true }] }),
    ]);
  };
  const upload = useMutation({
    mutationFn: (file: File) => uploadCoverPhoto(api, property.id, file),
    onSuccess: saved,
  });
  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/v1/properties/{id}/cover-photo', { params: { path: { id: property.id } } })),
    onSuccess: async (p) => {
      await saved(p);
      setConfirmRemove(false);
    },
  });
  const photo = property.coverPhoto;

  return (
    <Card
      title="Cover photo"
      description="Shown on property cards. Landscape photos work best."
      actions={
        <div className="flex gap-2">
          {photo && (
            <Button variant="quiet" size="sm" onClick={() => setConfirmRemove(true)} disabled={upload.isPending}>
              <Trash2 aria-hidden className="size-4" /> Remove
            </Button>
          )}
          <Button variant="secondary" size="sm" loading={upload.isPending} onClick={() => input.current?.click()}>
            <ImagePlus aria-hidden className="size-4" /> {photo ? 'Replace photo' : 'Upload photo'}
          </Button>
        </div>
      }
    >
      <input
        ref={input}
        type="file"
        hidden
        accept={PHOTO_INPUT_ACCEPT}
        aria-label="Choose a cover photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = '';
        }}
      />
      <div className="flex flex-col gap-3">
        <div className="aspect-[16/9] max-h-96 w-full overflow-hidden rounded-inner bg-sage-tint">
          <CoverImage
            key={photo?.id ?? 'none'}
            url={photo?.url}
            alt={`Cover photo of ${property.name}`}
            eager
            className="size-full"
            fallback={
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={upload.isPending}
                className="grid size-full place-items-center text-sage-deep transition-colors hover:bg-sage-tint/70"
              >
                <span className="flex flex-col items-center gap-2">
                  <span aria-hidden className="text-5xl font-bold tracking-tight">
                    {monogram(property.name)}
                  </span>
                  <span className="text-sm font-semibold">
                    {upload.isPending ? 'Preparing photo…' : 'No cover photo yet. Upload one.'}
                  </span>
                </span>
              </button>
            }
          />
        </div>
        <ErrorAlert error={upload.error} />
        {upload.isSuccess && <Confirmation>Photo updated</Confirmation>}
        {remove.isSuccess && !photo && <Confirmation>Photo removed</Confirmation>}
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove the cover photo?"
        description="Cards will show the property's initials instead. You can upload a new photo at any time."
        confirmLabel="Remove photo"
        destructive
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate()}
      />
    </Card>
  );
}
