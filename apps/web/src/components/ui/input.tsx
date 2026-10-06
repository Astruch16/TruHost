import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { useFieldContext } from '../../lib/field-context';
import { controlStyles } from '../../lib/styles';
import { cx } from '../../lib/cx';

function useControlProps(props: {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: unknown;
  required?: boolean;
}) {
  const field = useFieldContext();
  return {
    id: props.id ?? field?.id,
    'aria-describedby': props['aria-describedby'] ?? field?.describedBy,
    'aria-invalid': (props['aria-invalid'] as boolean | undefined) ?? (field?.invalid || undefined),
    required: props.required ?? field?.required,
  };
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} {...props} {...useControlProps(props)} className={cx(controlStyles, className)} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...props}
      {...useControlProps(props)}
      className={cx(controlStyles, 'py-2.5 leading-relaxed', className)}
    />
  );
});

/** Native select (best on phones and for screen readers), styled to match the inputs. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        {...props}
        {...useControlProps(props)}
        className={cx(controlStyles, 'cursor-pointer appearance-none pr-10', className)}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
});
