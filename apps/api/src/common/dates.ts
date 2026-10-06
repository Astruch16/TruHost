/** Prisma returns @db.Date columns as UTC-midnight Dates; the API speaks "YYYY-MM-DD". */
export function toIsoDate(d: Date): string;
export function toIsoDate(d: Date | null): string | null;
export function toIsoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function fromIsoDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

/** First day of the month containing `now` in the given IANA zone, as "YYYY-MM-01". */
export function currentMonthStart(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  return `${year}-${month}-01`;
}
