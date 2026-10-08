import type { ReactNode } from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cx } from '../../lib/cx';
import { useFieldContext } from '../../lib/field-context';
import { controlStyles, menuItemStyles, menuSurfaceStyles } from '../../lib/styles';

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

/** Radix reserves "" for "no selection"; options like "All properties" use "" in our forms. */
const EMPTY = '__empty__';
const toRadix = (v: string) => (v === '' ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? '' : v);

/**
 * Dropdown select styled to match the app (native <select> menus can't be styled). Built on Radix Select:
 * keyboard navigation, type-ahead and screen-reader semantics come with it. Inside a <Field> it picks up the label,
 * description and error wiring.
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Choose…',
  disabled,
  required,
  className,
  'aria-label': ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const field = useFieldContext();
  const hasEmptyOption = options.some((o) => o.value === '');
  return (
    <RadixSelect.Root
      value={value === '' && !hasEmptyOption ? undefined : toRadix(value)}
      onValueChange={(v) => onValueChange(fromRadix(v))}
      disabled={disabled}
      required={required ?? field?.required}
    >
      <RadixSelect.Trigger
        id={field?.id}
        aria-label={ariaLabel}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={cx(
          controlStyles,
          'flex items-center justify-between gap-2 text-left',
          'data-[placeholder]:text-muted/80 data-[state=open]:border-blue-deep',
          className,
        )}
      >
        <span className="min-w-0 truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon asChild>
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-muted transition-transform duration-150 [[data-state=open]_&]:rotate-180"
          />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className={cx(
            menuSurfaceStyles,
            'max-h-[min(22rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-44',
          )}
        >
          <RadixSelect.Viewport className="flex flex-col gap-0.5">
            {options.map((o) => (
              <RadixSelect.Item
                key={o.value}
                value={toRadix(o.value)}
                disabled={o.disabled}
                className={cx(menuItemStyles, 'pr-9')}
              >
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-3 inline-flex">
                  <Check aria-hidden className="size-4 text-sage-deep" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
