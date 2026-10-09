import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cx } from '../../lib/cx';

/**
 * A choice between a few options, each a card with a small preview (a radio group: arrow keys move between them,
 * picking is immediate).
 */
export function ChoiceCards<T extends string | number>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; title: string; description: string; preview: ReactNode }[];
  disabled?: boolean;
}) {
  const id = useId();
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const at = options.findIndex((o) => o.value === value);
    const next = options[(at + step + options.length) % options.length]!;
    onChange(next.value);
    document.getElementById(`${id}-${String(next.value)}`)?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className="grid gap-3 @xl/content:grid-cols-2">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            id={`${id}-${String(o.value)}`}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative flex flex-col gap-3 rounded-inner border p-3.5 text-left transition-[border-color,box-shadow] duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-deep',
              selected
                ? 'border-sage-deep/60 bg-sage-tint/30 shadow-[0_0_0_3px_rgba(35,68,47,0.08)]'
                : 'border-line hover:border-ink/25',
            )}
          >
            <span className="block overflow-hidden rounded-[10px] border border-line-soft bg-surface">{o.preview}</span>
            <span className="flex items-start gap-2.5">
              <span
                aria-hidden
                className={cx(
                  'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
                  selected ? 'border-sage-deep bg-sage-deep text-white' : 'border-line bg-surface',
                )}
              >
                {selected && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span>
                <span className="block font-semibold text-ink">{o.title}</span>
                <span className="block text-sm text-muted">{o.description}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
