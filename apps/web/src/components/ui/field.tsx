import { useId, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { FieldContext } from '../../lib/field-context';
import { cx } from '../../lib/cx';

/**
 * Label + control + hint/error. The control inside picks up id, aria-describedby and aria-invalid
 * through context, so screen readers announce the label and the error.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required && (
          <span aria-hidden className="text-muted">
            {' '}
            *
          </span>
        )}
      </label>
      <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>
        {children}
      </FieldContext.Provider>
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-danger-deep">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
