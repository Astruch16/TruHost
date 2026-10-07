/** Display helpers for dashboard figures. Everything here formats numbers the API computed; nothing calculates. */

/** Relative change in bps → "+12.5%" / "−8%" (one decimal under 10%). */
export function formatChange(bps: number): string {
  const sign = bps > 0 ? '+' : bps < 0 ? '−' : '±';
  const pct = Math.abs(bps) / 100;
  return `${sign}${pct < 10 ? pct.toFixed(1).replace(/\.0$/, '') : Math.round(pct)}%`;
}

/** Point change in bps → "+3.2 pts". */
export function formatPoints(bps: number): string {
  const sign = bps > 0 ? '+' : bps < 0 ? '−' : '±';
  return `${sign}${(Math.abs(bps) / 100).toFixed(1).replace(/\.0$/, '')} pts`;
}

export function greeting(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export function longDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** "2026-11-21" → "Sat, Nov 21". */
export function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Two-letter monogram for a property or person name. */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : words[0]!.slice(0, 2);
  return letters.toUpperCase();
}

export const TINTS = [
  { bg: 'bg-sage-tint', fg: 'text-sage-deep' },
  { bg: 'bg-blue-tint', fg: 'text-blue-deep' },
  { bg: 'bg-lavender-tint', fg: 'text-lavender-deep' },
] as const;
