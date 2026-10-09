import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { Me } from '@truhost/shared';
import { Camera, Trash2 } from 'lucide-react';
import { useApi } from '../../lib/api-context';
import { AVATAR_INPUT_ACCEPT, uploadAvatar } from '../../lib/avatar';
import { initials, roleLabel } from '../../lib/nav';
import { queries } from '../../lib/queries';
import { ErrorAlert } from '../ui/alert';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { Confirmation } from '../ui/confirmation';
import { Pill } from '../ui/pill';

/**
 * The profile header: photo (upload, replace, remove), name, role and email. The photo is cropped square and shrunk
 * in the browser before upload (lib/avatar.ts).
 */
export function AvatarCard({ me }: { me: Me }) {
  const api = useApi();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [done, setDone] = useState<string | null>(null);
  const onSaved = (data: Me) => qc.setQueryData(queries.me(api).queryKey, data);
  const upload = useMutation({
    mutationFn: (file: File) => uploadAvatar(api, file),
    onSuccess: (data) => {
      onSaved(data);
      setDone('Photo updated');
    },
  });
  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/v1/me/avatar')),
    onSuccess: (data) => {
      onSaved(data);
      setDone('Photo removed');
    },
  });
  const busy = upload.isPending || remove.isPending;
  const name = `${me.firstName} ${me.lastName}`;

  const pick = (file: File | undefined) => {
    if (!file) return;
    setDone(null);
    remove.reset();
    upload.mutate(file);
  };

  return (
    <section
      aria-label="Profile photo"
      className="relative overflow-hidden rounded-card border border-line-soft bg-surface"
    >
      <div aria-hidden className="h-20 bg-gradient-to-r from-sage-tint via-blue-tint/80 to-lavender-tint" />
      <div className="-mt-11 flex flex-col gap-4 px-5 pb-5 @xl/content:flex-row @xl/content:items-end @xl/content:gap-5 @2xl/content:px-6 @2xl/content:pb-6">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={me.avatar ? 'Change your photo' : 'Add a photo'}
          className="group relative size-24 shrink-0 rounded-full ring-4 ring-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-deep"
        >
          <Avatar url={me.avatar?.url} initials={initials(me.firstName, me.lastName)} className="size-24 text-2xl" />
          <span
            aria-hidden
            className="absolute inset-0 grid place-items-center rounded-full bg-ink/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-disabled:opacity-100"
          >
            {busy ? (
              <span className="size-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Camera className="size-6" />
            )}
          </span>
        </button>
        <div className="min-w-0 flex-1 @xl/content:pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-bold tracking-tight text-ink">{name}</h2>
            <Pill tone="sage">{roleLabel(me)}</Pill>
          </div>
          <p className="truncate text-sm text-muted">{me.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 @xl/content:pb-1">
          <Button variant="secondary" size="sm" onClick={() => input.current?.click()} loading={upload.isPending}>
            <Camera aria-hidden className="size-4" /> {me.avatar ? 'Change photo' : 'Add photo'}
          </Button>
          {me.avatar && (
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                setDone(null);
                upload.reset();
                remove.mutate();
              }}
              loading={remove.isPending}
              disabled={upload.isPending}
            >
              <Trash2 aria-hidden className="size-4" /> Remove
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={AVATAR_INPUT_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {(upload.error || remove.error || done) && (
        <div className="flex flex-col gap-2 border-t border-line-soft px-5 py-3 @2xl/content:px-6">
          <ErrorAlert error={upload.error ?? remove.error} />
          {done && !busy && <Confirmation>{done}</Confirmation>}
        </div>
      )}
    </section>
  );
}
