import { useRef } from 'react';
import { cx } from '../../lib/cx';
import { useSlidingHighlight } from '../../lib/motion';

/**
 * A row of pill options where one is chosen (figure tabs, a view switch). The chosen pill's background slides from
 * the old option to the new one instead of jumping, and the labels cross-fade their colour. `solid` fills the
 * chosen pill in the primary blue (white text) over pale pills; `switch` is a segmented control: a white pill
 * sliding along a grey track. Each option is a toggle button (aria-pressed) in a labelled group.
 */
export function PillTabs<K extends string>({
  label,
  options,
  value,
  onChange,
  variant = 'solid',
  className,
}: {
  label: string;
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  variant?: 'solid' | 'switch';
  className?: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const { style, ready } = useSlidingHighlight(group, value);
  const solid = variant === 'solid';
  return (
    <div
      ref={group}
      role="group"
      aria-label={label}
      className={cx(
        'relative isolate flex',
        solid ? 'flex-wrap gap-1.5' : 'rounded-full bg-ground p-0.5 ring-1 ring-line-soft',
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          'pointer-events-none absolute top-0 left-0 -z-10 rounded-full',
          solid ? 'bg-primary' : 'bg-surface shadow-sm',
          ready && 'transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        )}
        style={style}
      />
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          data-option={o.key}
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cx(
            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-300',
            solid
              ? value === o.key
                ? 'text-white'
                : 'bg-ground text-muted hover:bg-line-soft hover:text-ink'
              : value === o.key
                ? 'text-ink'
                : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
