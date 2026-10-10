import { useId, useRef } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { cx } from '../../lib/cx';
import { formatBytes, splitName } from '../../lib/format';
import { useFieldContext } from '../../lib/field-context';
import { buttonStyles } from '../../lib/styles';

/**
 * File field: a "Choose file" button with the chosen file's name and size beside it, and a button to remove it.
 * Replaces the browser's own file input, whose button and "No file chosen" text run together and can't be styled.
 * The real input stays in the page (visually hidden) so the keyboard, screen readers and a <Field>'s label, hint and
 * error work as usual.
 */
export function FilePicker({
  file,
  onChange,
  accept,
  disabled,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
}) {
  const field = useFieldContext();
  const fallbackId = useId();
  const id = field?.id ?? fallbackId;
  const input = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cx(
        'flex min-h-11 w-full min-w-0 items-center gap-3 rounded-control border border-line bg-surface py-1 pr-1.5 pl-1',
        field?.invalid && 'border-danger-line',
        disabled && 'opacity-50',
      )}
    >
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        aria-hidden
        className={cx(
          buttonStyles({ variant: 'secondary', size: 'sm' }),
          'shrink-0 cursor-pointer bg-ground',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-deep',
          disabled && 'pointer-events-none',
        )}
      >
        <Upload aria-hidden className="size-4" />
        {file ? (
          <span>
            Change<span className="hidden sm:inline"> file</span>
          </span>
        ) : (
          'Choose file'
        )}
      </label>
      {file ? (
        <>
          <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink" aria-live="polite">
            <FileText aria-hidden className="size-4 shrink-0 text-muted" />
            <span className="flex min-w-0 font-medium" title={file.name}>
              {/* Truncate the name, never the extension: "costco-rece….pdf". */}
              <span className="truncate">{splitName(file.name)[0]}</span>
              <span className="shrink-0">{splitName(file.name)[1]}</span>
            </span>
            <span className="figure hidden shrink-0 text-muted sm:inline">{formatBytes(file.size)}</span>
          </span>
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            disabled={disabled}
            onClick={() => {
              onChange(null);
              if (input.current) input.current.value = '';
            }}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-line-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-deep"
          >
            <X aria-hidden className="size-4" />
          </button>
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm text-muted/80">No file chosen</span>
      )}
    </div>
  );
}
