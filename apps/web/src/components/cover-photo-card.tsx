import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { Property } from '@truhost/shared';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useApi } from '../lib/api-context';
import { PHOTO_INPUT_ACCEPT, uploadCoverPhoto } from '../lib/property-photo';
import { queries } from '../lib/queries';
import { CoverImage } from './cover-image';
import { PropertyScene } from './illustrations/property-scene';
import { ErrorAlert } from './ui/alert';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Confirmation } from './ui/confirmation';
import { ConfirmDialog } from './ui/dialog';

/**
 * The property's cover photo, shown on property cards. Admins upload, replace or remove it here. Until there is a
 * photo it shows the same illustrated scene as the property's cards (`sceneIndex`, its place in the property list;
 * null while that list loads), and clicking it opens the file picker.
 */
export function CoverPhotoCard({ property, sceneIndex }: { property: Property; sceneIndex: number | null }) {
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
        <div className="aspect-[16/9] max-h-96 w-full overflow-hidden rounded-inner bg-sky-tint">
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
                className="group relative block size-full"
              >
                {sceneIndex !== null && <PropertyScene index={sceneIndex} className="absolute inset-0 size-full" />}
                <span
                  aria-hidden
                  className="absolute inset-0 bg-ink/0 transition-colors group-hover:bg-ink/10 group-disabled:bg-transparent"
                />
                <span className="absolute inset-x-3 top-3 flex justify-start">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-ink shadow-sm backdrop-blur-sm">
                    <ImagePlus aria-hidden className="size-4 shrink-0" />
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
        description="Cards will show an illustrated scene instead. You can upload a new photo at any time."
        confirmLabel="Remove photo"
        destructive
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate()}
      />
    </Card>
  );
}
