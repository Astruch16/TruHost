import type { ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';

/** The small inline "done" note for routine actions (saved, updated, sent). Milestones use SuccessNotice. */
export function Confirmation({ children }: { children: ReactNode }) {
  return (
    <span role="status" className="flex items-center gap-1.5 text-sm text-sage-deep">
      <CircleCheck aria-hidden className="size-4 shrink-0" /> {children}
    </span>
  );
}
