import type { Booking } from './api-types';

type Row = Pick<Booking, 'kind' | 'status' | 'complete' | 'checkInDate' | 'checkOutDate'>;

/** Where a confirmed stay is relative to today: not started, under way (checks out later), or over. */
export type StayPhase = 'UPCOMING' | 'IN_HOUSE' | 'CHECKED_OUT';

export function stayPhase(b: Pick<Booking, 'checkInDate' | 'checkOutDate'>, today: string): StayPhase {
  if (today < b.checkInDate) return 'UPCOMING';
  if (today < b.checkOutDate) return 'IN_HOUSE';
  return 'CHECKED_OUT';
}

export const PHASE_LABELS: Record<StayPhase, string> = {
  UPCOMING: 'Upcoming',
  IN_HOUSE: 'In house',
  CHECKED_OUT: 'Checked out',
};

/** The quick filters above the bookings list, in order. */
export const BOOKING_FILTERS = ['ALL', 'PENDING', 'UPCOMING', 'IN_HOUSE', 'OWNER', 'CANCELLED'] as const;
export type BookingFilter = (typeof BOOKING_FILTERS)[number];

export const FILTER_LABELS: Record<BookingFilter, string> = {
  ALL: 'All',
  PENDING: 'Waiting on payout',
  UPCOMING: 'Upcoming',
  IN_HOUSE: 'In house',
  OWNER: 'Owner stays & blocks',
  CANCELLED: 'Cancelled',
};

/** Whether a booking belongs under a filter. "Waiting on payout" is a guest stay whose payout isn't in yet. */
export function matchesFilter(b: Row, filter: BookingFilter, today: string): boolean {
  const confirmed = b.status === 'CONFIRMED';
  switch (filter) {
    case 'ALL':
      return true;
    case 'PENDING':
      return confirmed && b.kind === 'GUEST' && !b.complete;
    case 'UPCOMING':
      return confirmed && stayPhase(b, today) === 'UPCOMING';
    case 'IN_HOUSE':
      return confirmed && stayPhase(b, today) === 'IN_HOUSE';
    case 'OWNER':
      return confirmed && b.kind !== 'GUEST';
    case 'CANCELLED':
      return !confirmed;
  }
}

/** How many bookings each filter would show. */
export function filterCounts(rows: readonly Row[], today: string): Record<BookingFilter, number> {
  return Object.fromEntries(
    BOOKING_FILTERS.map((f) => [f, rows.filter((b) => matchesFilter(b, f, today)).length]),
  ) as Record<BookingFilter, number>;
}

/** "A" for Andrew; "?" when there's no name. */
export const initial = (name: string | null | undefined) => name?.trim().charAt(0).toUpperCase() || '?';
