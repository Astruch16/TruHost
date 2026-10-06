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
