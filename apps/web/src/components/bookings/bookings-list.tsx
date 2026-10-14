import { useState } from 'react';
import { Pencil, Plus, XCircle } from 'lucide-react';
import type { Booking } from '../../lib/api-types';
import {
  FILTER_LABELS,
  filterCounts,
  matchesFilter,
  PHASE_LABELS,
  stayPhase,
  type BookingFilter,
} from '../../lib/bookings';
import { kindLabel } from '../../lib/format';
import { formatCents } from '../../lib/money';
import { monthLabel, shortDate } from '../../lib/months';
import { updatingStyles, type PillTone } from '../../lib/styles';
import { Button } from '../ui/button';
import { Pill } from '../ui/pill';
import { Table, TableState, TBody, Td, Th, THead, Tr } from '../ui/table';
import { ChannelPill, DateBadge, FilterChips, GuestAvatar } from './booking-parts';

const money = (cents: number | null | undefined) => (cents == null ? '—' : formatCents(cents));
const PHASE_TONE = { UPCOMING: 'blue', IN_HOUSE: 'sage', CHECKED_OUT: 'neutral' } as const satisfies Record<
  string,
  PillTone
>;

/**
 * The month's bookings: quick filters with counts, then each stay with its dates, guest and channel, money (a missing
 * payout is a button to add it) and where it stands (upcoming, in house, checked out; payout pending; cancelled).
 */
export function BookingsList({
  month,
  items,
  loading,
  error,
  updating,
  today,
  propertyName,
  onEdit,
  onCancel,
}: {
  month: string;
  items: Booking[];
  loading: boolean;
  error: unknown;
  /** The list is still the previous month's while this one loads: shown dimmed. */
  updating: boolean;
  today: string;
  /** Shows a Property column (several properties in view). */
  propertyName?: (propertyId: string) => string;
  onEdit: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
}) {
  const [filter, setFilter] = useState<BookingFilter>('ALL');
  const counts = filterCounts(items, today);
  const shown = items.filter((b) => matchesFilter(b, filter, today));
  return (
    <div className="flex flex-col gap-4">
      {!loading && !error && <FilterChips value={filter} counts={counts} onChange={setFilter} />}
      <Table aria-busy={updating || undefined} className={updatingStyles(updating)}>
        <THead>
          <tr>
            <Th>Dates</Th>
            <Th>Guest</Th>
            {propertyName && <Th>Property</Th>}
            <Th align="right">Payout</Th>
            <Th align="right">Cleaning fee</Th>
            <Th align="right">Owner gross</Th>
            <Th>Status</Th>
            <Th align="right">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </THead>
        <TBody>
          <TableState
            columns={propertyName ? 8 : 7}
            loading={loading}
            error={error}
            empty={!loading && !error && shown.length === 0}
            emptyMessage={`No bookings under “${FILTER_LABELS[filter]}” in ${monthLabel(month)}.`}
          />
          {shown.map((b) => {
            const cancelled = b.status !== 'CONFIRMED';
            const phase = stayPhase(b, today);
            const needsPayout = !cancelled && b.kind === 'GUEST' && b.payoutCents == null;
            return (
              <Tr key={b.id} interactive className={cancelled ? 'text-muted' : undefined}>
                <Td className="whitespace-nowrap">
                  <span className="flex items-center gap-3">
                    <DateBadge date={b.checkInDate} />
                    <span>
                      <span className={cancelled ? 'font-medium line-through' : 'font-medium'}>
                        {shortDate(b.checkInDate)} → {shortDate(b.checkOutDate)}
                      </span>
                      <span className="block text-xs text-muted">
                        {b.nights} night{b.nights === 1 ? '' : 's'}
                      </span>
                    </span>
                  </span>
                </Td>
                <Td>
                  <span className="flex items-center gap-3">
                    <GuestAvatar booking={b} />
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {b.kind === 'GUEST' ? (b.guestName ?? 'Guest') : kindLabel(b.kind)}
                      </span>
                      {b.kind === 'GUEST' && <ChannelPill booking={b} />}
                    </span>
                  </span>
                </Td>
                {propertyName && <Td>{propertyName(b.propertyId)}</Td>}
                <Td align="right" className="figure">
                  {needsPayout ? (
                    <Button variant="quiet" size="sm" onClick={() => onEdit(b)} className="text-primary">
                      <Plus aria-hidden className="size-3.5" /> Add payout
                    </Button>
                  ) : (
                    money(b.payoutCents)
                  )}
                </Td>
                <Td align="right" className="figure">
                  {money(b.guestCleaningFeeCents)}
                </Td>
                <Td align="right" className="figure font-semibold">
                  {money(b.ownerGrossCents)}
                </Td>
                <Td>
                  <span className="flex flex-wrap gap-1.5">
                    {cancelled ? (
                      <Pill tone="neutral">Cancelled</Pill>
                    ) : (
                      <Pill tone={PHASE_TONE[phase]}>{PHASE_LABELS[phase]}</Pill>
                    )}
                    {!cancelled && b.kind === 'GUEST' && !b.complete && <Pill tone="amber">Payout pending</Pill>}
                  </span>
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => onEdit(b)}
                      aria-label={`Edit booking ${b.checkInDate}`}
                      title="Edit"
                    >
                      <Pencil aria-hidden className="size-4" />
                    </Button>
                    {!cancelled && (
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => onCancel(b)}
                        aria-label={`Cancel booking ${b.checkInDate}`}
                        title="Cancel booking"
                      >
                        <XCircle aria-hidden className="size-4" />
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
