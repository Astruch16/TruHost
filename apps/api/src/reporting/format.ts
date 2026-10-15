/**
 * Display text for documents the API writes itself (statement PDFs, emails). Formatting only: amounts are split
 * into dollars and cents with integer operations, never computed.
 */

/** 123456 → "$1,234.56"; −2500 → "−$25.00". */
export function formatCad(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const rest = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '−' : ''}$${dollars}.${rest}`;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-28" → "Sep 28, 2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return `${SHORT_MONTHS[m - 1]} ${d}, ${y}`;
}

/** "2026-09-28" → "Sep 28". */
export function formatDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number) as [number, number, number];
  return `${SHORT_MONTHS[m - 1]} ${d}`;
}

/** 2200 → "22%"; 1850 → "18.5%". */
export function formatBps(bps: number): string {
  const whole = Math.floor(bps / 100);
  const frac = bps % 100;
  return frac === 0 ? `${whole}%` : `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}%`;
}
