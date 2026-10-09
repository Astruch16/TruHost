import { cx } from '../../lib/cx';

/** On/off toggle (role="switch"). Label it with `aria-label` or `aria-labelledby`. */
export function Switch({
  checked,
  onChange,
  disabled,
  className,
  ...aria
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      {...aria}
      className={cx(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-deep disabled:opacity-45',
        checked ? 'border-primary bg-primary' : 'border-line bg-line-soft hover:bg-line',
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          'absolute top-0.5 size-[1.375rem] rounded-full bg-white shadow-sm transition-transform duration-150 ease-out',
          checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
