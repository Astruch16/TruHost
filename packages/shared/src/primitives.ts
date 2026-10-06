import { z } from 'zod';

export const id = z.uuid();

/** Calendar date in property-local time, "YYYY-MM-DD". */
export const isoDate = z.iso.date();

/** First day of a month, "YYYY-MM-01". */
export const monthStart = z.iso
  .date()
  .refine((d) => d.endsWith('-01'), { message: 'Must be the first day of a month' });

/** UTC instant, ISO 8601. */
export const isoDateTime = z.iso.datetime({ offset: true });

/** "HH:mm", 24h. */
export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');

/** Trimmed, non-empty single-line text. */
export const text = (max = 200) => z.string().trim().min(1).max(max);

export const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** Basis points, 0..10000. */
export const bps = z.number().int().min(0).max(10_000);

export const pageQuery = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type PageQuery = z.infer<typeof pageQuery>;

export const page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.uuid().nullable() });
