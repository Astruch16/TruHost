import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
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
