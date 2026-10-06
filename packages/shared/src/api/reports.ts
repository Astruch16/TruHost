import { z } from 'zod';
import { cents, nonNegativeCents } from '../money.js';
import { bps, id, month } from '../primitives.js';

/** One property's figures for one month. Every number is computed by the API from records. */
export const monthFigures = z.object({
  propertyId: id,
  month,
  daysInMonth: z.number().int(),
  nightsBooked: z.number().int(),
  ownerStayNights: z.number().int(),
  blockNights: z.number().int(),
  availableNights: z.number().int(),
  occupancyBps: bps.nullable(),
  stays: z.number().int(),
  grossCents: nonNegativeCents,
  plan: z.object({ id, name: z.string() }).nullable(),
  managementFeeBps: bps.nullable(),
  managementFeeCents: nonNegativeCents,
  ownerExpensesCents: nonNegativeCents,
  netCents: cents,
  avgNightlyEarningsCents: nonNegativeCents.nullable(),
  incompleteBookings: z.number().int(),
  expensesMissingReceipt: z.number().int(),
  /** TruHost revenue: admin-only. */
  cleaningFeesCents: nonNegativeCents.optional(),
});
export type MonthFigures = z.infer<typeof monthFigures>;

export const monthQuery = z.object({ month });
export const yearQuery = z.object({ year: z.coerce.number().int().min(2020).max(2100) });

export const monthlySeries = z.object({ items: z.array(monthFigures) });

export const portfolioTotals = monthFigures
  .omit({ propertyId: true, month: true, plan: true, managementFeeBps: true, daysInMonth: true })
  .extend({ properties: z.number().int(), cleaningFeesCents: nonNegativeCents });

export const portfolioReport = z.object({
  month,
  totals: portfolioTotals,
  properties: z.array(monthFigures.extend({ name: z.string(), archived: z.boolean() })),
});
export type PortfolioReport = z.infer<typeof portfolioReport>;
