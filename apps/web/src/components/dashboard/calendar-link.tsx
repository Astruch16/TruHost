import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { usePrefetchCalendar } from '../../lib/calendar-prefetch';

/**
 * A link to the full calendar. Pointing at it (or focusing it) loads the calendar's page and data, and following it
 * cross-fades to the calendar instead of cutting to it.
 */
export function CalendarLink({ className, children }: { className?: string; children: ReactNode }) {
  const prefetch = usePrefetchCalendar();
  return (
    <Link
      to="/admin/calendar"
      viewTransition
      className={className}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
    >
      {children}
    </Link>
  );
}
