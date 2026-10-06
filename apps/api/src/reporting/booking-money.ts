/**
 * Per-booking money (docs/spec.md §4). The only place owner gross is defined; the web app never recomputes it.
 *
 * ownerGross = payout − guest cleaning fee, for GUEST bookings with both amounts entered.
 * Owners absorb the channel's fee on the cleaning fee: the full fee is subtracted (decision N4).
 */
export interface BookingMoney {
  kind: 'GUEST' | 'OWNER_STAY' | 'BLOCK';
  payoutCents: number | null;
  guestCleaningFeeCents: number | null;
}

export function ownerGrossCents(b: BookingMoney): number | null {
  if (b.kind !== 'GUEST' || b.payoutCents === null || b.guestCleaningFeeCents === null) return null;
  return b.payoutCents - b.guestCleaningFeeCents;
}

/** A guest stay is incomplete until both its payout and cleaning fee are entered. */
export function isComplete(b: BookingMoney): boolean {
  return b.kind !== 'GUEST' || (b.payoutCents !== null && b.guestCleaningFeeCents !== null);
}

/** Nights between two @db.Date values (UTC midnight). */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
}
