import type { Booking } from '../../lib/api-types';
import { BOOKING_FILTERS, FILTER_LABELS, initial, type BookingFilter } from '../../lib/bookings';
import { stayStyle } from '../../lib/calendar';
import { cx } from '../../lib/cx';
import { Pill } from '../ui/pill';

const MONTH = new Intl.DateTimeFormat('en-CA', { month: 'short', timeZone: 'UTC' });

/** A small calendar leaf for the check-in date: a deep-green month band ("OCT") over the day ("10"). */
export function DateBadge({ date }: { date: string }) {
  return (
    <span
      aria-hidden
      className="grid w-12 shrink-0 overflow-hidden rounded-xl border border-line bg-surface text-center shadow-[0_1px_2px_rgb(0_0_0/0.06)]"
    >
      <span className="bg-primary py-[3px] text-[9.5px] leading-none font-bold tracking-[0.12em] text-primary-ink uppercase">
        {MONTH.format(new Date(`${date}T00:00:00Z`))}
      </span>
      <span className="figure py-1 text-lg leading-none font-bold text-ink">{Number(date.slice(8))}</span>
    </span>
  );
}

/** The guest's initial in their channel's colours (as on the calendar); owner stays and blocks get theirs. */
export function GuestAvatar({ booking }: { booking: Pick<Booking, 'kind' | 'channel' | 'guestName'> }) {
  const letter = booking.kind === 'GUEST' ? initial(booking.guestName) : booking.kind === 'OWNER_STAY' ? 'O' : '–';
  return (
    <span
      aria-hidden
      className={cx('grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold', stayStyle(booking).bar)}
    >
      {letter}
    </span>
  );
}

/** Where the guest booked, in the calendar's colours. */
export function ChannelPill({ booking }: { booking: Pick<Booking, 'kind' | 'channel'> }) {
  const style = stayStyle(booking);
  return <Pill tone={style.tone}>{style.label}</Pill>;
}

/** The quick filters, with how many each would show. Empty ones (other than All and the current one) are left out. */
export function FilterChips({
  value,
  counts,
  onChange,
}: {
  value: BookingFilter;
  counts: Record<BookingFilter, number>;
  onChange: (filter: BookingFilter) => void;
}) {
  return (
    <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
      {BOOKING_FILTERS.filter((f) => f === 'ALL' || f === value || counts[f] > 0).map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={value === f}
          onClick={() => onChange(f)}
          className={cx(
            'inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
            value === f
              ? 'border-primary bg-primary text-primary-ink'
              : 'border-line bg-surface text-ink hover:bg-ground',
          )}
        >
          {FILTER_LABELS[f]}
          <span
            className={cx(
              'figure rounded-full px-1.5 text-xs font-semibold',
              value === f ? 'bg-white/20 text-primary-ink' : 'bg-ground text-muted',
            )}
          >
            {counts[f]}
          </span>
        </button>
      ))}
    </div>
  );
}
