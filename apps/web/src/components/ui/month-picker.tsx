import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../../lib/cx';
import { useFieldContext } from '../../lib/field-context';
import { monthKey, monthLabel } from '../../lib/months';
import { controlStyles, menuSurfaceStyles } from '../../lib/styles';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (m: number) => String(m).padStart(2, '0');
const navButton =
  'grid size-8 place-items-center rounded-full text-ink transition-colors hover:bg-sage-tint/60 disabled:opacity-30 disabled:hover:bg-transparent';

/**
 * A year of months to pick from (the panel inside MonthPicker and the month stepper). Arrow keys move by month
 * (up/down by a row of three), Page Up/Down by year, Enter picks.
 */
export function MonthGrid({
  value,
  onPick,
  min,
  max,
}: {
  /** "YYYY-MM". */
  value: string;
  onPick: (month: string) => void;
  min?: string;
  max?: string;
}) {
  const current = monthKey();
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const [focused, setFocused] = useState(value);
  const grid = useRef<HTMLDivElement>(null);
  const focusOnRender = useRef(true);
  useEffect(() => {
    if (!focusOnRender.current) return;
    const button = grid.current?.querySelector<HTMLButtonElement>(`[data-month="${focused}"]`);
    if (!button) return;
    focusOnRender.current = false;
    button.focus();
  });
  const blocked = (m: string) => (min !== undefined && m < min) || (max !== undefined && m > max);
  const shift = (m: string, months: number) => {
    const [y, mm] = m.split('-').map(Number) as [number, number];
    const total = y * 12 + (mm - 1) + months;
    return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
  };
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3, PageUp: -12, PageDown: 12 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = shift(focused, step);
    setFocused(next);
    setYear(Number(next.slice(0, 4)));
    focusOnRender.current = true;
  };
  const months = MONTHS.map((_, i) => `${year}-${pad(i + 1)}`);
  const tabStop = months.includes(focused) ? focused : months.find((m) => !blocked(m));

  return (
    <div className="w-[17rem]">
      <div className="mb-2 flex items-center justify-between gap-2 pl-1.5">
        <p aria-live="polite" className="figure text-sm font-semibold text-ink">
          {year}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous year"
            disabled={min !== undefined && `${year}-01` <= min}
            onClick={() => setYear(year - 1)}
            className={navButton}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next year"
            disabled={max !== undefined && `${year}-12` >= max}
            onClick={() => setYear(year + 1)}
            className={navButton}
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      <div
        ref={grid}
        role="group"
        aria-label={`Months of ${year}`}
        onKeyDown={onKey}
        className="grid grid-cols-3 gap-1.5"
      >
        {months.map((m, i) => {
          const selected = m === value;
          const isCurrent = m === current;
          return (
            <button
              key={m}
              type="button"
              data-month={m}
              tabIndex={m === tabStop ? 0 : -1}
              disabled={blocked(m)}
              aria-label={`${monthLabel(m)}${isCurrent ? ', this month' : ''}`}
              aria-pressed={selected}
              onClick={() => onPick(m)}
              onFocus={() => setFocused(m)}
              className={cx(
                'h-11 rounded-xl text-sm font-medium text-ink transition-colors duration-100 outline-none',
                'hover:bg-sage-tint focus-visible:ring-2 focus-visible:ring-blue-deep',
                isCurrent && !selected && 'font-bold text-sage-deep ring-1 ring-sage-deep/40',
                selected && 'bg-primary font-semibold text-white hover:bg-primary-hover',
                'disabled:text-muted/35 disabled:hover:bg-transparent',
              )}
            >
              {MONTHS[i]}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-end border-t border-line-soft pt-2.5">
        {!blocked(current) && (
          <button
            type="button"
            onClick={() => onPick(current)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-sage-deep hover:bg-sage-tint/60"
          >
            This month
          </button>
        )}
      </div>
    </div>
  );
}

/** Month field ("YYYY-MM"): the button shows "October 2026", the panel a year of months. */
export function MonthPicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'Choose a month',
  disabled,
}: {
  value: string;
  onChange: (month: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const field = useFieldContext();
  const [open, setOpen] = useState(false);
  return (
    <MonthPopover
      open={open}
      onOpenChange={setOpen}
      value={value || monthKey()}
      min={min}
      max={max}
      onPick={(m) => {
        onChange(m);
        setOpen(false);
      }}
    >
      <Popover.Trigger
        id={field?.id}
        disabled={disabled}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        aria-haspopup="dialog"
        className={cx(
          controlStyles,
          'flex items-center gap-2.5 text-left data-[state=open]:border-blue-deep data-[state=open]:ring-3 data-[state=open]:ring-blue-tint',
        )}
      >
        <CalendarRange aria-hidden className="size-4 shrink-0 text-muted" />
        <span className={cx('min-w-0 flex-1 truncate', !value && 'text-muted/80')}>
          {value ? monthLabel(value) : placeholder}
        </span>
      </Popover.Trigger>
    </MonthPopover>
  );
}

/** The popover around a MonthGrid, for any trigger (MonthPicker's field, the month stepper's label). */
export function MonthPopover({
  open,
  onOpenChange,
  value,
  onPick,
  min,
  max,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onPick: (month: string) => void;
  min?: string;
  max?: string;
  /** The trigger (a Popover.Trigger). */
  children: ReactNode;
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      {children}
      <Popover.Portal>
        <Popover.Content
          align="center"
          sideOffset={8}
          collisionPadding={16}
          onOpenAutoFocus={(e) => e.preventDefault()}
          aria-label="Choose a month"
          className={cx(menuSurfaceStyles, 'p-3 focus:outline-none')}
        >
          <MonthGrid key={value} value={value} onPick={onPick} min={min} max={max} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
