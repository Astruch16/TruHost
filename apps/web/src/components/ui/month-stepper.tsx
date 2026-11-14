import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, monthLabel } from '../../lib/months';
import { MonthPopover } from './month-picker';

/**
 * "‹ October 2026 ›": a white pill that floats off its card, the month in a sage chip with a calendar icon so it reads
 * as a control rather than part of the card. The arrows step a month; the month itself opens a year of months to jump
 * to any of them.
 */
export function MonthStepper({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const [open, setOpen] = useState(false);
  const button =
    'grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-deep';
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_8px_20px_-14px_rgb(23_63_58/0.5)] ring-1 ring-line">
      <button
        type="button"
        aria-label="Previous month"
        className={button}
        onClick={() => onChange(addMonths(month, -1))}
      >
        <ChevronLeft aria-hidden className="size-4" />
      </button>
      <MonthPopover
        open={open}
        onOpenChange={setOpen}
        value={month}
        onPick={(m) => {
          onChange(m);
          setOpen(false);
        }}
      >
        <Popover.Trigger
          aria-label={`${monthLabel(month)}. Choose a month`}
          className="figure group inline-flex min-h-9 min-w-36 items-center justify-center gap-2 rounded-full bg-sage-tint px-3.5 font-semibold text-sage-deep transition-[filter,box-shadow] hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-blue-deep data-[state=open]:ring-2 data-[state=open]:ring-sage-mid/40"
        >
          <CalendarDays aria-hidden className="size-4 shrink-0" />
          <span aria-live="polite">{monthLabel(month)}</span>
          <ChevronDown
            aria-hidden
            className="size-3.5 transition-transform duration-150 group-data-[state=open]:rotate-180"
          />
        </Popover.Trigger>
      </MonthPopover>
      <button type="button" aria-label="Next month" className={button} onClick={() => onChange(addMonths(month, 1))}>
        <ChevronRight aria-hidden className="size-4" />
      </button>
    </div>
  );
}
