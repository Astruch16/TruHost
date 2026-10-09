import { forwardRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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

/** Password input with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  function PasswordInput({ className, ...props }, ref) {
    const [shown, setShown] = useState(false);
    const Icon = shown ? EyeOff : Eye;
    return (
      <div className="relative">
        <input
          ref={ref}
          type={shown ? 'text' : 'password'}
          {...props}
          {...useControlProps(props)}
          className={cx(controlStyles, 'pr-12', className)}
        />
        <button
          type="button"
          onClick={() => setShown(!shown)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-control-sm text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-deep"
        >
          <Icon aria-hidden className="size-4" />
        </button>
      </div>
    );
  },
);
