import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, monthLabel } from '../../lib/months';

/** "‹ October 2026 ›" pill from the mockup. */
export function MonthStepper({ month, onChange }: { month: string; onChange: (month: string) => void }) {
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
      <span aria-live="polite" className="figure min-w-36 text-center font-semibold text-ink">
        {monthLabel(month)}
      </span>
      <button type="button" aria-label="Next month" className={button} onClick={() => onChange(addMonths(month, 1))}>
        <ChevronRight aria-hidden className="size-4" />
      </button>
    </div>
  );
}
