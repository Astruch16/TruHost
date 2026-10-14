import { z } from 'zod';
import { NotificationKind, SupplyCategory } from '../enums.js';
import { id, isoDateTime } from '../primitives.js';

/** The levels screens offer, as percent of full: Full, ¾, ½, ¼, Empty. */
export const SUPPLY_LEVELS = [100, 75, 50, 25, 0] as const;

export const SUPPLY_CATEGORY_LABELS: Record<SupplyCategory, string> = {
  BATHROOM: 'Bathroom',
  KITCHEN: 'Kitchen',
  LAUNDRY: 'Laundry',
  CLEANING: 'Cleaning',
  OTHER: 'Other',
};

/** A starter list for a property with no supplies yet (admins pick from it). */
export const COMMON_SUPPLIES: readonly { name: string; category: SupplyCategory }[] = [
  { name: 'Toilet paper', category: 'BATHROOM' },
  { name: 'Hand soap', category: 'BATHROOM' },
  { name: 'Shampoo', category: 'BATHROOM' },
  { name: 'Conditioner', category: 'BATHROOM' },
  { name: 'Body wash', category: 'BATHROOM' },
  { name: 'Paper towels', category: 'KITCHEN' },
  { name: 'Coffee pods', category: 'KITCHEN' },
  { name: 'Dish soap', category: 'KITCHEN' },
  { name: 'Dishwasher tablets', category: 'KITCHEN' },
  { name: 'Condiments', category: 'KITCHEN' },
  { name: 'Garbage bags', category: 'KITCHEN' },
  { name: 'Laundry detergent', category: 'LAUNDRY' },
  { name: 'Dryer sheets', category: 'LAUNDRY' },
  { name: 'Cleaning spray', category: 'CLEANING' },
];

/**
 * Where an item stands: UNKNOWN (never checked), OK, LOW (at or below its restock point) or OUT (empty). Computed by
 * the API from the latest reading.
 */
export const SupplyState = z.enum(['UNKNOWN', 'OK', 'LOW', 'OUT']);
export type SupplyState = z.infer<typeof SupplyState>;

const supplyName = z
  .string()
  .transform((v) => v.replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(1, 'Give it a name').max(60));
const threshold = z.number().int().min(5).max(95);
const level = z.number().int().min(0).max(100);

export const supplyItem = z.object({
  id,
  propertyId: id,
  name: z.string(),
  category: SupplyCategory,
  /** Restock point, percent of full. */
  thresholdPct: z.number().int(),
  position: z.number().int(),
  /** Latest reading, or null if never checked. */
  levelPct: z.number().int().nullable(),
  state: SupplyState,
  lastCheckedAt: isoDateTime.nullable(),
  archivedAt: isoDateTime.nullable(),
});
export type SupplyItem = z.infer<typeof supplyItem>;

export const supplyList = z.object({ items: z.array(supplyItem) });
export type SupplyList = z.infer<typeof supplyList>;

export const createSupplyItem = z.object({
  name: supplyName,
  category: SupplyCategory.default('OTHER'),
  thresholdPct: threshold.default(25),
});
export type CreateSupplyItem = z.infer<typeof createSupplyItem>;

/** Several at once (e.g. from the starter list), added at the end in this order. */
export const createSupplyItems = z.object({ items: z.array(createSupplyItem).min(1).max(60) });
export type CreateSupplyItems = z.infer<typeof createSupplyItems>;

/** No defaults (update schemas never carry .default()). */
export const updateSupplyItem = z
  .object({ name: supplyName, category: SupplyCategory, thresholdPct: threshold })
  .partial();
export type UpdateSupplyItem = z.infer<typeof updateSupplyItem>;

/** Readings from a check (one or many items). Append-only. */
export const recordSupplyLevels = z.object({
  readings: z
    .array(z.object({ supplyItemId: id, levelPct: level, note: z.string().trim().max(500).nullable().default(null) }))
    .min(1)
    .max(100),
});
export type RecordSupplyLevels = z.infer<typeof recordSupplyLevels>;

export const supplyReading = z.object({
  id,
  levelPct: z.number().int(),
  note: z.string().nullable(),
  reportedAt: isoDateTime,
  reportedBy: z.object({ firstName: z.string(), lastName: z.string() }),
});
export const supplyHistory = z.object({ items: z.array(supplyReading) });
export type SupplyHistory = z.infer<typeof supplyHistory>;

/** Admins' restock list: every LOW or OUT item across active properties, emptiest first. */
export const restockItem = supplyItem.extend({ property: z.object({ id, name: z.string() }) });
export const restockList = z.object({ items: z.array(restockItem) });
export type RestockList = z.infer<typeof restockList>;

// ── Notifications ──

export const notification = z.object({
  id,
  kind: NotificationKind,
  title: z.string(),
  body: z.string().nullable(),
  property: z.object({ id, name: z.string() }),
  entityType: z.string(),
  entityId: id,
  readAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
});
export type Notification = z.infer<typeof notification>;

export const notificationList = z.object({ items: z.array(notification), unread: z.number().int() });
export type NotificationList = z.infer<typeof notificationList>;

export const notificationQuery = z.object({
  unread: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(false),
});

/** Mark some (or all) of your notifications read. */
export const markNotificationsRead = z.union([
  z.object({ ids: z.array(id).min(1).max(100) }),
  z.object({ all: z.literal(true) }),
]);
export type MarkNotificationsRead = z.infer<typeof markNotificationsRead>;
