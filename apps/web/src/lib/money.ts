/**
 * Display and input helpers for integer cents. Parsing works on the digit string, never through
 * floating point, so "0.29" is exactly 29 cents.
 */
const formatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

export function formatCents(cents: number): string {
  return formatter.format(cents / 100);
}

/** "$2,856.00" → { whole: "$2,856", cents: ".00" }, for figures that show the cents smaller. */
export function splitCents(cents: number): { whole: string; cents: string } {
  const text = formatCents(cents);
  const dot = text.lastIndexOf('.');
  return dot === -1 ? { whole: text, cents: '' } : { whole: text.slice(0, dot), cents: text.slice(dot) };
}

/** "$142" for whole dollars, "$142.50" otherwise: for small labels where ".00" is noise. */
export function formatCentsShort(cents: number): string {
  return cents % 100 === 0 ? formatCents(cents).replace(/\.00$/, '') : formatCents(cents);
}

/** "90", "90.5", "90.50", "$1,234.56" → cents. Returns null for anything else. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, '');
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const dollars = Number(match[1]);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return dollars * 100 + Number(fraction);
}

/** Cents → plain "1234.56" for an input field. */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
