import { z } from 'zod';

/** Money is always integer cents (CAD). Never use floats for money. */
export const cents = z.number().int().safe();
export type Cents = z.infer<typeof cents>;

/** Non-negative cents, for amounts entered by admins. */
export const nonNegativeCents = cents.min(0);
