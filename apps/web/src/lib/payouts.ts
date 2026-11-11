/** The bookings API takes ranges of at most this many days (MAX_RANGE_DAYS in packages/shared). */
const MAX_DAYS = 400;

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * The bookings to load for "stays waiting on payout": from the earliest such check-in through today (the range's end
 * is exclusive, so tomorrow). Kept within the API's range limit; anything older is still on the Bookings page.
 */
export function payoutRange(earliest: string, today: string): { from: string; to: string } {
  const oldest = shift(today, -(MAX_DAYS - 2));
  return { from: earliest < oldest ? oldest : earliest, to: shift(today, 1) };
}
