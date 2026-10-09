import { z } from 'zod';
import { Guide, MembershipRole, MotionPreference, NotificationCategory, StaffRole, UserStatus } from '../enums.js';
import { id, isoDateTime, text } from '../primitives.js';

export const meMembership = z.object({
  id,
  role: MembershipRole,
  property: z.object({ id, name: z.string() }),
});

export const me = z.object({
  id,
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  staffRole: StaffRole.nullable(),
  status: UserStatus,
  /** The guide character shown in empty states and success messages. */
  guide: Guide,
  /** Profile photo (a short-lived signed link, stable within its window), or null. */
  avatar: z.object({ url: z.string(), expiresAt: isoDateTime }).nullable(),
  /** First day of the week in calendars: 0 = Sunday, 1 = Monday. */
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  motion: MotionPreference,
  memberships: z.array(meMembership),
});
export type Me = z.infer<typeof me>;

export const updateMe = z
  .object({
    firstName: text(100),
    lastName: text(100),
    phone: text(40).nullable(),
    guide: Guide,
    weekStartsOn: z.union([z.literal(0), z.literal(1)]),
    motion: MotionPreference,
  })
  .partial();
export type UpdateMe = z.infer<typeof updateMe>;

export const appConfig = z.object({
  taxFieldsEnabled: z.boolean(),
});
export type AppConfig = z.infer<typeof appConfig>;

/** Make an uploaded AVATAR file the caller's profile photo (replacing any earlier one). */
export const setAvatar = z.object({ fileId: id });
export type SetAvatar = z.infer<typeof setAvatar>;

export type NotificationRole = 'ADMIN' | 'OWNER' | 'CLEANER';
export type NotificationChannel = 'email' | 'inApp';

/**
 * Every notification a user can choose to get, who it's for, how it's sent and its default. `live` is false until
 * the feature that sends it exists, so Settings can say so rather than promise it.
 */
export const NOTIFICATION_CATALOGUE: readonly {
  category: NotificationCategory;
  label: string;
  description: string;
  roles: readonly NotificationRole[];
  channels: readonly NotificationChannel[];
  defaults: { email: boolean; inApp: boolean };
  live: boolean;
  /** When it starts, while not live. */
  startsWith?: string;
}[] = [
  {
    category: 'SUPPLY_ALERTS',
    label: 'Supplies running low',
    description: 'When a cleaner marks an item low or out at one of your properties.',
    roles: ['ADMIN', 'OWNER'],
    channels: ['email', 'inApp'],
    defaults: { email: true, inApp: true },
    live: false,
    startsWith: 'cleaning schedules',
  },
  {
    category: 'INVITE_ACCEPTED',
    label: 'Invites accepted',
    description: 'When someone you invited signs in for the first time.',
    roles: ['ADMIN'],
    channels: ['email', 'inApp'],
    defaults: { email: false, inApp: true },
    live: false,
    startsWith: 'in-app notifications',
  },
  {
    category: 'WEEKLY_SUMMARY',
    label: 'Weekly summary',
    description: 'A Monday email with last week’s stays, earnings and anything that needs you.',
    roles: ['ADMIN', 'OWNER'],
    channels: ['email'],
    defaults: { email: true, inApp: false },
    live: false,
    startsWith: 'owner statements',
  },
  {
    category: 'STATEMENT_RELEASED',
    label: 'Monthly statement ready',
    description: 'When your statement for the month is released.',
    roles: ['OWNER'],
    channels: ['email', 'inApp'],
    defaults: { email: true, inApp: true },
    live: false,
    startsWith: 'owner statements',
  },
  {
    category: 'CLEAN_ASSIGNED',
    label: 'Cleans assigned to you',
    description: 'When you’re given a clean, or its date changes.',
    roles: ['CLEANER'],
    channels: ['email', 'inApp'],
    defaults: { email: true, inApp: true },
    live: false,
    startsWith: 'cleaning schedules',
  },
  {
    category: 'PAYMENT_RECORDED',
    label: 'Payments',
    description: 'When TruHost records a payment to you.',
    roles: ['CLEANER'],
    channels: ['email', 'inApp'],
    defaults: { email: true, inApp: true },
    live: false,
    startsWith: 'cleaner pay',
  },
];

export const notificationSetting = z.object({
  category: NotificationCategory,
  email: z.boolean(),
  inApp: z.boolean(),
});
export type NotificationSetting = z.infer<typeof notificationSetting>;

/** The caller's settings for the categories that apply to their roles, defaults filled in. */
export const notificationSettings = z.object({ items: z.array(notificationSetting) });
export type NotificationSettings = z.infer<typeof notificationSettings>;

export const updateNotificationSettings = z.object({ items: z.array(notificationSetting).max(20) });
export type UpdateNotificationSettings = z.infer<typeof updateNotificationSettings>;
