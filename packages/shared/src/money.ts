import { z } from 'zod';

/** Money is always integer cents (CAD). Never use floats for money. */
export const cents = z.number().int().safe();
export type Cents = z.infer<typeof cents>;
