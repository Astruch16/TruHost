import type { ReactNode } from 'react';
import type { Booking } from '../../lib/api-types';
import { cx } from '../../lib/cx';
import { formatDate } from '../../lib/dates';
import { formatCents } from '../../lib/money';
import { Pill } from '../ui/pill';
import { ChannelPill } from './booking-parts';

/**
 * A stay at a glance, read-only (the calendar's stay dialog, beside its Edit view): when it is, who's coming, and for
 * a guest stay what it earned. The amounts are the booking's own: the payout entered, the cleaning fee charged (TruHost
 * revenue) and the owner gross the API works out from them (payout − cleaning fee). The management fee and the owner's
 * net are worked out on the month's statement, not per stay, so they aren't shown here.
 */
export function StayDetails({ booking: b, propertyName }: { booking: Booking; propertyName?: string }) {
  const guest = b.kind === 'GUEST';
  const perNight = b.ownerGrossCents !== null ? Math.round(b.ownerGrossCents / b.nights) : null;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <ChannelPill booking={b} />
        {propertyName && <Pill dot={false}>{propertyName}</Pill>}
        {guest && !b.complete && <Pill tone="amber">Payout not entered</Pill>}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Fact label="Check-in" value={formatDate(b.checkInDate)} />
        <Fact label="Check-out" value={formatDate(b.checkOutDate)} />
        <Fact label="Nights" value={String(b.nights)} figure />
        {guest && b.guestCount != null && <Fact label="Guests" value={String(b.guestCount)} figure />}
        {b.externalId && <Fact label="Confirmation" value={b.externalId} />}
      </dl>

      {guest ? (
        <section aria-label="Revenue" className="rounded-inner bg-ground px-4 py-1">
          <dl>
            <Line label="Payout received" note="After the channel’s fee" cents={b.payoutCents ?? null} />
            <Line
              label="Cleaning fee"
              note="Charged to the guest · TruHost revenue"
              cents={b.guestCleaningFeeCents ?? null}
              minus
            />
            <Line
              label="Owner gross"
              note="Payout less the cleaning fee"
              cents={b.ownerGrossCents}
              missing="Needs both amounts"
              strong
            />
            <Line
              label="Per night"
              note={`Owner gross over ${b.nights} night${b.nights === 1 ? '' : 's'}`}
              cents={perNight}
              missing="—"
            />
          </dl>
          <p className="border-t border-line py-3 text-xs text-muted">
            The management fee and the owner’s net are worked out on the month’s statement.
          </p>
        </section>
      ) : (
        <p className="rounded-inner bg-ground px-4 py-3 text-sm text-muted">
          {b.kind === 'OWNER_STAY'
            ? 'An owner stay earns nothing; its cleaning is charged to the owner on the statement.'
            : 'Blocked nights earn nothing and aren’t counted as available.'}
        </p>
      )}

      {b.notes && (
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Notes</p>
          <p className="mt-1 text-sm whitespace-pre-line text-ink">{b.notes}</p>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value, figure = false }: { label: string; value: string; figure?: boolean }) {
  return (
    <div className="min-w-0 rounded-inner border border-line-soft px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cx('font-semibold break-words text-ink', figure && 'figure')}>{value}</dd>
    </div>
  );
}

function Line({
  label,
  note,
  cents,
  minus = false,
  strong = false,
  missing = 'Not entered',
}: {
  label: string;
  note: ReactNode;
  cents: number | null;
  minus?: boolean;
  strong?: boolean;
  /** What shows when there's no amount yet. */
  missing?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <dt className={cx('text-ink', strong ? 'font-semibold' : 'font-medium')}>{label}</dt>
        <p className="text-xs text-muted">{note}</p>
      </div>
      <dd className={cx('figure shrink-0 text-ink', strong ? 'text-lg font-bold' : 'font-semibold')}>
        {cents === null ? (
          <span className="text-sm font-medium text-muted">{missing}</span>
        ) : (
          `${minus && cents > 0 ? '−' : ''}${formatCents(cents)}`
        )}
      </dd>
    </div>
  );
}
