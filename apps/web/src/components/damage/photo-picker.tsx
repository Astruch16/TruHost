import { useEffect, useId, useMemo, useRef } from 'react';
import { Camera, X } from 'lucide-react';
import { MAX_DAMAGE_PHOTOS } from '@truhost/shared';
import { DAMAGE_PHOTO_ACCEPT } from '../../lib/damage-photo';
import { cx } from '../../lib/cx';

/**
 * Photos chosen for a damage report (from the camera or the photo library), shown as previews that can be taken out
 * again before sending. `done` marks how many have already been uploaded (they can't be removed).
 */
export function PhotoPicker({
  files,
  onChange,
  done = 0,
  disabled = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  done?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  const room = MAX_DAMAGE_PHOTOS - files.length;

  return (
    <div className="flex flex-col gap-2">
      <ul aria-label="Photos to send" className="grid grid-cols-3 gap-2 @md/content:grid-cols-4">
        {files.map((file, i) => (
          <li key={`${file.name}-${i}`} className="relative aspect-square overflow-hidden rounded-inner bg-ground">
            <img src={previews[i]} alt={`Photo ${i + 1}`} className="size-full object-cover" />
            {i >= done && !disabled && (
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-ink/70 text-white hover:bg-ink"
              >
                <X aria-hidden className="size-4" />
              </button>
            )}
          </li>
        ))}
        {room > 0 && (
          <li>
            <label
              htmlFor={id}
              className={cx(
                'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-inner border-2 border-dashed border-line text-sm font-medium text-muted transition-colors hover:border-ink/30 hover:text-ink',
                disabled && 'pointer-events-none opacity-60',
              )}
            >
              <Camera aria-hidden className="size-6" />
              {files.length ? 'Add more' : 'Add photos'}
            </label>
            <input
              ref={input}
              id={id}
              type="file"
              accept={DAMAGE_PHOTO_ACCEPT}
              multiple
              disabled={disabled}
              className="sr-only"
              onChange={(e) => {
                const picked = [...(e.target.files ?? [])].slice(0, room);
                if (picked.length) onChange([...files, ...picked]);
                e.target.value = '';
              }}
            />
          </li>
        )}
      </ul>
    </div>
  );
}
