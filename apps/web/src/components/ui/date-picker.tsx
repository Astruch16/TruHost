import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cx } from '../../lib/cx';
import {
  addMonthsToDate,
  calendarDays,
  clampDate,
  formatDate,
  formatDateLong,
  monthOf,
  moveFocus,
  nightsBetween,
  todayIso,
} from '../../lib/dates';
import { useFieldContext } from '../../lib/field-context';
import { monthLabel } from '../../lib/months';
import { controlStyles, menuSurfaceStyles } from '../../lib/styles';

const WEEKDAYS = [
  ['S', 'Sunday'],
  ['M', 'Monday'],
  ['T', 'Tuesday'],
  ['W', 'Wednesday'],
  ['T', 'Thursday'],
  ['F', 'Friday'],
  ['S', 'Saturday'],
] as const;

const navButton =
  'grid size-8 place-items-center rounded-full text-ink transition-colors hover:bg-sage-tint/60 disabled:opacity-30 disabled:hover:bg-transparent';

/**
 * Date field with our own calendar (native date pickers can't be styled and look different in every browser).
 * The button shows the date in words; the panel shows a month at a time, marks today, and, with `rangeStart`
 * (check-out after check-in), shades the stay and counts its nights. Keyboard: arrows move by day and week,
 * Page Up/Down by month (with Shift, by year), Home/End to the week's ends, Enter picks. Inside a <Field> it picks
 * up the label, description and error wiring.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  rangeStart,
  placeholder = 'Choose a date',
  clearable = false,
  disabled,
  'aria-label': ariaLabel,
}: {
  /** "YYYY-MM-DD", or "" for none. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  /** Shade the days from this date to the value (a stay), and count nights. */
  rangeStart?: string;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const field = useFieldContext();
  const [open, setOpen] = useState(false);
  const today = todayIso();
  const startAt = () => clampDate(value || (rangeStart && rangeStart > today ? rangeStart : today), min, max);
  const [focused, setFocused] = useState(startAt);
  const [month, setMonth] = useState(() => monthOf(startAt()));
  const [hovered, setHovered] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const focusOnRender = useRef(false);

  /** Move keyboard focus to the focused day, if one is waiting to be focused and it is on screen. */
  const focusPending = () => {
    if (!focusOnRender.current) return;
    const day = grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`);
    if (!day) return;
    focusOnRender.current = false;
    day.focus();
  };
  // After keyboard moves (this component re-renders) ...
  useEffect(focusPending);
  // ... and when the panel first appears (it renders in a portal, which doesn't re-render this component).
  const gridRef = (el: HTMLDivElement | null) => {
    grid.current = el;
    focusPending();
  };

  const openWith = (next: boolean) => {
    if (next) {
      const at = startAt();
      setFocused(at);
      setMonth(monthOf(at));
      focusOnRender.current = true;
    }
    setHovered(null);
    setOpen(next);
  };
  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };
  const outOfBounds = (iso: string) => (min !== undefined && iso < min) || (max !== undefined && iso > max);
  const focus = (iso: string) => {
    const at = clampDate(iso, min, max);
    setFocused(at);
    setMonth(monthOf(at));
    focusOnRender.current = true;
  };
  const onGridKey = (e: KeyboardEvent) => {
    const next = moveFocus(focused, e.key, e.shiftKey);
    if (!next) return;
    e.preventDefault();
    focus(next);
  };
  /** Prev/next buttons: show another month, carrying the keyboard position along (same day, within bounds). */
  const showMonth = (delta: number) => {
    setMonth(monthOf(addMonthsToDate(`${month}-01`, delta)));
    setFocused(clampDate(addMonthsToDate(focused, delta), min, max));
  };

  // The stay to shade: from rangeStart to the chosen (or hovered) check-out.
  const rangeEnd = hovered && rangeStart && hovered > rangeStart ? hovered : value;
  const inRange = (iso: string) => Boolean(rangeStart && rangeEnd && iso > rangeStart && iso < rangeEnd);
  const nights = rangeStart && rangeEnd && rangeEnd > rangeStart ? nightsBetween(rangeStart, rangeEnd) : null;
  const days = calendarDays(month);
  // One day in view is reachable with Tab (roving focus): the focused one, else the first that can be picked.
  const tabStop =
    monthOf(focused) === month && !outOfBounds(focused)
      ? focused
      : days.find((d) => monthOf(d) === month && !outOfBounds(d));
  const prevDisabled = min !== undefined && `${month}-01` <= min;
  const nextDisabled = max !== undefined && addMonthsToDate(`${month}-01`, 1) > max;

  return (
    <Popover.Root open={open} onOpenChange={openWith}>
      <div className="relative">
        <Popover.Trigger
          id={field?.id}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-describedby={field?.describedBy}
          aria-invalid={field?.invalid || undefined}
          aria-haspopup="dialog"
          className={cx(
            controlStyles,
            'flex items-center gap-2.5 text-left data-[state=open]:border-blue-deep data-[state=open]:ring-3 data-[state=open]:ring-blue-tint',
            clearable && value && 'pr-10',
          )}
        >
          <CalendarDays aria-hidden className="size-4 shrink-0 text-muted" />
          <span className={cx('min-w-0 flex-1 truncate', !value && 'text-muted/80')}>
            {value ? formatDate(value) : placeholder}
          </span>
        </Popover.Trigger>
        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear date"
            className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-line-soft hover:text-ink"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        )}
      </div>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          onOpenAutoFocus={(e) => e.preventDefault()}
          aria-label="Choose a date"
          className={cx(menuSurfaceStyles, 'w-[19.5rem] p-3 focus:outline-none')}
        >
          <div className="mb-2 flex items-center justify-between gap-2 pl-1.5">
            <p aria-live="polite" className="text-sm font-semibold text-ink">
              {monthLabel(month)}
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Previous month"
                disabled={prevDisabled}
                onClick={() => showMonth(-1)}
                className={navButton}
              >
                <ChevronLeft aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                disabled={nextDisabled}
                onClick={() => showMonth(1)}
                className={navButton}
              >
                <ChevronRight aria-hidden className="size-4" />
              </button>
            </div>
          </div>

          <div
            role="grid"
            aria-label={monthLabel(month)}
            ref={gridRef}
            onKeyDown={onGridKey}
            onMouseLeave={() => setHovered(null)}
          >
            <div role="row" className="grid grid-cols-7">
              {WEEKDAYS.map(([short, long]) => (
                <span
                  key={long}
                  role="columnheader"
                  aria-label={long}
                  className="py-1 text-center text-xs font-semibold text-muted"
                >
                  {short}
                </span>
              ))}
            </div>
            {[0, 1, 2, 3, 4, 5].map((week) => (
              <div key={week} role="row" className="grid grid-cols-7">
                {days.slice(week * 7, week * 7 + 7).map((iso) => {
                  const selected = iso === value;
                  const isToday = iso === today;
                  const outside = monthOf(iso) !== month;
                  const blocked = outOfBounds(iso);
                  const isStart = iso === rangeStart;
                  const shaded = inRange(iso);
                  return (
                    <div
                      key={iso}
                      role="gridcell"
                      aria-selected={selected}
                      className={cx(
                        'flex justify-center py-0.5',
                        shaded && 'bg-sage-tint/70',
                        isStart &&
                          rangeEnd &&
                          rangeEnd > iso &&
                          'rounded-l-full bg-gradient-to-r from-transparent from-50% to-sage-tint/70 to-50%',
                        selected &&
                          rangeStart &&
                          iso > rangeStart &&
                          'bg-gradient-to-r from-sage-tint/70 from-50% to-transparent to-50%',
                      )}
                    >
                      <button
                        type="button"
                        data-date={iso}
                        tabIndex={iso === tabStop ? 0 : -1}
                        disabled={blocked}
                        aria-label={`${formatDateLong(iso)}${isToday ? ', today' : ''}${isStart ? ', check-in' : ''}`}
                        aria-current={isToday ? 'date' : undefined}
                        onClick={() => pick(iso)}
                        onMouseEnter={() => setHovered(iso)}
                        onFocus={() => setFocused(iso)}
                        className={cx(
                          'figure grid size-9 place-items-center rounded-full text-sm transition-colors duration-100 outline-none',
                          'hover:bg-sage-tint focus-visible:ring-2 focus-visible:ring-blue-deep',
                          outside ? 'text-muted/60' : 'text-ink',
                          isToday && !selected && 'font-bold text-sage-deep ring-1 ring-sage-deep/40',
                          (selected || isStart) && 'bg-primary font-semibold text-white hover:bg-primary-hover',
                          blocked && 'cursor-not-allowed text-muted/35 hover:bg-transparent',
                        )}
                      >
                        {Number(iso.slice(8))}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line-soft pt-2.5">
            <span className="pl-1.5 text-xs text-muted">
              {nights !== null
                ? `${nights} night${nights === 1 ? '' : 's'}`
                : value
                  ? formatDate(value)
                  : 'No date yet'}
            </span>
            <span className="flex gap-1">
              {clearable && value && (
                <button
                  type="button"
                  onClick={() => pick('')}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:bg-line-soft hover:text-ink"
                >
                  Clear
                </button>
              )}
              {!outOfBounds(today) && (
                <button
                  type="button"
                  onClick={() => pick(today)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-sage-deep hover:bg-sage-tint/60"
                >
                  Today
                </button>
              )}
            </span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
