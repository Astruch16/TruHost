/** 2200 → "22%", 1250 → "12.5%". Display only; never feed the result back into money math. */
export function formatBps(bps: number): string {
  return `${(bps / 100).toLocaleString('en-CA', { maximumFractionDigits: 2 })}%`;
}

export const ROOM_TYPES = [
  'BEDROOM',
  'BATHROOM',
  'KITCHEN',
  'LIVING',
  'DINING',
  'LAUNDRY',
  'OUTDOOR',
  'ENTRY',
  'OTHER',
] as const;

export const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

/** "22" or "12.5" (percent) → basis points, without floating point. Null if invalid or over 100%. */
export function percentToBps(input: string): number | null {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const bps = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return bps <= 10_000 ? bps : null;
}

export const CHANNELS = ['AIRBNB', 'VRBO', 'BOOKING_COM', 'DIRECT', 'OTHER'] as const;
export const channelLabel = (c: string) =>
  ({ AIRBNB: 'Airbnb', VRBO: 'Vrbo', BOOKING_COM: 'Booking.com', DIRECT: 'Direct', OTHER: 'Other' })[c] ?? c;
export const kindLabel = (k: string) => ({ GUEST: 'Guest stay', OWNER_STAY: 'Owner stay', BLOCK: 'Block' })[k] ?? k;

export const EXPENSE_CATEGORIES = [
  'SUPPLIES',
  'REPAIRS_MAINTENANCE',
  'FURNISHINGS',
  'UTILITIES',
  'INTERNET',
  'LICENSING_PERMITS',
  'INSURANCE',
  'STRATA',
  'CLEANING',
  'OTHER',
] as const;
export const categoryLabel = (c: string) =>
  ({
    SUPPLIES: 'Supplies',
    REPAIRS_MAINTENANCE: 'Repairs',
    FURNISHINGS: 'Furnishings',
    UTILITIES: 'Utilities',
    INTERNET: 'Internet',
    LICENSING_PERMITS: 'Licences & permits',
    INSURANCE: 'Insurance',
    STRATA: 'Strata',
    CLEANING: 'Cleaning',
    OTHER: 'Other',
  })[c] ?? c;
