/** Helpers for Settings → Security (wording and formatting only; Clerk does the work). */

/** "Active now", "5 minutes ago", "3 hours ago", "2 days ago", then the date. */
export function timeAgo(when: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - when.getTime()) / 60_000);
  if (minutes < 2) return 'Active now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return when.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Chrome on Macintosh", "Safari on iPhone", or a fallback when the browser didn't say. */
export function deviceLabel(activity: { browserName?: string; deviceType?: string; isMobile?: boolean }): string {
  const browser = activity.browserName?.trim();
  const device = activity.deviceType?.trim() || (activity.isMobile ? 'a phone' : undefined);
  if (browser && device) return `${browser} on ${device}`;
  return browser || device || 'Unknown device';
}

/** "Vancouver, CA" from what's known, or null. */
export function placeLabel(activity: { city?: string; country?: string }): string | null {
  return [activity.city, activity.country].filter(Boolean).join(', ') || null;
}

/** An authenticator secret in groups of four, easier to type by hand. */
export function formatSecret(secret: string): string {
  return (secret.replace(/\s/g, '').match(/.{1,4}/g) ?? []).join(' ');
}

/** The text file a user saves their backup codes in. */
export function backupCodesFile(codes: string[], email: string, created: Date = new Date()): string {
  return [
    'TruHost backup codes',
    `For ${email}, made ${created.toLocaleDateString('en-CA', { dateStyle: 'long' })}.`,
    '',
    'Each code works once, in place of a code from your authenticator app.',
    'Keep them somewhere safe. Making new codes stops these from working.',
    '',
    ...codes,
    '',
  ].join('\n');
}

/** A 6-digit authenticator code, as typed or pasted (spaces and dashes removed). */
export const cleanCode = (input: string) => input.replace(/[\s-]/g, '');
