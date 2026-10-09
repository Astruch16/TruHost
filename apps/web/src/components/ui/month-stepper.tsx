import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, monthLabel } from '../../lib/months';
import { MonthPopover } from './month-picker';

/**
 * "‹ October 2026 ›" pill from the mockup. The arrows step a month; the month itself opens a year of months to
 * jump to any of them.
 */
export function MonthStepper({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const [open, setOpen] = useState(false);
  const button =
    'grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-blue-deep';
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-ground p-1">
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
          className="figure group inline-flex min-h-9 min-w-36 items-center justify-center gap-1.5 rounded-full px-3 font-semibold text-ink transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-blue-deep data-[state=open]:bg-surface data-[state=open]:shadow-sm"
        >
          <span aria-live="polite">{monthLabel(month)}</span>
          <ChevronDown
            aria-hidden
            className="size-3.5 text-muted transition-transform duration-150 group-data-[state=open]:rotate-180"
          />
        </Popover.Trigger>
      </MonthPopover>
      <button type="button" aria-label="Next month" className={button} onClick={() => onChange(addMonths(month, 1))}>
        <ChevronRight aria-hidden className="size-4" />
      </button>
    </div>
  );
}
