/**
 * Local test accounts (`pnpm --filter @truhost/api seed:dev`): an owner and a cleaner who can sign in to the dev
 * Clerk instance, two sample properties they hold, and stays and expenses so the owner's pages have figures.
 * Idempotent: rows have fixed ids or natural keys, so running it again changes nothing that is already there and
 * only fills in months that are new since the last run.
 *
 * With the running API's services (the CLI passes them), it also attaches a sample receipt to each seeded expense
 * and issues last month's statement for both properties through the real lifecycle (draft, finalize, release), so
 * the owner has statements with PDFs. Cleans (Phase 3) don't exist yet; seed them here when they land.
 */
import { createHash } from 'node:crypto';
import type { Actor } from '../auth/actor.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { currentMonthStart, fromIsoDate, toIsoDate } from '../common/dates.js';
import { uuidv7 } from '../common/uuid.js';
import type { FileStorage } from '../files/storage.js';
import type { StatementsService } from '../statements/statements.service.js';
import { sampleReceiptPdf } from './sample-receipt.js';

/**
 * The two sign-in accounts. Their addresses and password come from each developer's own apps/api/.env
 * (SEED_OWNER_EMAIL, SEED_CLEANER_EMAIL, SEED_TEST_PASSWORD) and are never written in the repository.
 */
export interface TestAccount {
  email: string;
  firstName: string;
  lastName: string;
}
export interface TestAccounts {
  owner: TestAccount;
  cleaner: TestAccount;
}

/** The accounts named in the environment (assertSafeToSeed has checked they're set). */
export function testAccountsFrom(env: { SEED_OWNER_EMAIL?: string; SEED_CLEANER_EMAIL?: string }): TestAccounts {
  return {
    owner: { email: env.SEED_OWNER_EMAIL!.trim().toLowerCase(), firstName: 'Test', lastName: 'Owner' },
    cleaner: { email: env.SEED_CLEANER_EMAIL!.trim().toLowerCase(), firstName: 'Test', lastName: 'Cleaner' },
  };
}

/** The shortest SEED_TEST_PASSWORD accepted. */
export const MIN_TEST_PASSWORD_LENGTH = 12;

/** Fixed ids, so the seed finds its own properties again and never touches anyone else's. */
export const SEED_PROPERTIES = [
  {
    id: '0192f5e0-5eed-7000-8000-00000000a001',
    key: 'seaside',
    name: 'Seaside Loft (test)',
    description: 'Sample property from the dev seed.',
    addressLine1: '1200 Beach Ave',
    city: 'Vancouver',
    postalCode: 'V6E 1V3',
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 3,
    standardCleaningFeeCents: 9_000,
  },
  {
    id: '0192f5e0-5eed-7000-8000-00000000a002',
    key: 'cedar',
    name: 'Cedar Cabin (test)',
    description: 'Sample property from the dev seed.',
    addressLine1: '45 Alpine Way',
    city: 'Whistler',
    postalCode: 'V8E 0A1',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    standardCleaningFeeCents: 15_000,
  },
] as const;

/** Supplies per property, with the level the cleaner last reported (null: not checked yet). */
const SUPPLIES: Record<
  (typeof SEED_PROPERTIES)[number]['key'],
  { name: string; category: 'BATHROOM' | 'KITCHEN' | 'LAUNDRY' | 'CLEANING'; level: number | null }[]
> = {
  seaside: [
    { name: 'Toilet paper', category: 'BATHROOM', level: 25 },
    { name: 'Shampoo', category: 'BATHROOM', level: 75 },
    { name: 'Body wash', category: 'BATHROOM', level: 50 },
    { name: 'Coffee pods', category: 'KITCHEN', level: 0 },
    { name: 'Dish soap', category: 'KITCHEN', level: 100 },
    { name: 'Laundry detergent', category: 'LAUNDRY', level: null },
  ],
  cedar: [
    { name: 'Toilet paper', category: 'BATHROOM', level: 75 },
    { name: 'Hand soap', category: 'BATHROOM', level: 50 },
    { name: 'Conditioner', category: 'BATHROOM', level: 25 },
    { name: 'Paper towels', category: 'KITCHEN', level: 50 },
    { name: 'Condiments', category: 'KITCHEN', level: 100 },
    { name: 'Dryer sheets', category: 'LAUNDRY', level: 75 },
    { name: 'Cleaning spray', category: 'CLEANING', level: 100 },
  ],
};

const ROOMS = [{ type: 'BEDROOM' }, { type: 'BATHROOM' }, { type: 'KITCHEN' }, { type: 'LIVING' }] as const;

type Channel = 'AIRBNB' | 'VRBO' | 'BOOKING_COM' | 'DIRECT';
interface StayPattern {
  checkIn: number;
  checkOut: number;
  channel: Channel;
  kind: 'GUEST' | 'OWNER_STAY';
  nightlyCents: number;
  cleaningFeeCents: number;
}

/** The same stays every month (days of the month), so a month's bookings never depend on when the seed ran. */
const STAYS: Record<(typeof SEED_PROPERTIES)[number]['key'], StayPattern[]> = {
  seaside: [
    { checkIn: 2, checkOut: 5, channel: 'AIRBNB', kind: 'GUEST', nightlyCents: 18_500, cleaningFeeCents: 9_000 },
    { checkIn: 7, checkOut: 12, channel: 'VRBO', kind: 'GUEST', nightlyCents: 17_250, cleaningFeeCents: 9_000 },
    { checkIn: 15, checkOut: 18, channel: 'AIRBNB', kind: 'GUEST', nightlyCents: 21_000, cleaningFeeCents: 9_000 },
    { checkIn: 21, checkOut: 26, channel: 'DIRECT', kind: 'GUEST', nightlyCents: 16_000, cleaningFeeCents: 9_000 },
  ],
  cedar: [
    { checkIn: 1, checkOut: 4, channel: 'AIRBNB', kind: 'GUEST', nightlyCents: 32_000, cleaningFeeCents: 15_000 },
    { checkIn: 9, checkOut: 11, channel: 'VRBO', kind: 'OWNER_STAY', nightlyCents: 0, cleaningFeeCents: 0 },
    {
      checkIn: 13,
      checkOut: 19,
      channel: 'BOOKING_COM',
      kind: 'GUEST',
      nightlyCents: 29_500,
      cleaningFeeCents: 15_000,
    },
    { checkIn: 23, checkOut: 27, channel: 'AIRBNB', kind: 'GUEST', nightlyCents: 34_000, cleaningFeeCents: 15_000 },
  ],
};

const EXPENSES: Record<
  (typeof SEED_PROPERTIES)[number]['key'],
  {
    day: number;
    category: 'SUPPLIES' | 'SUBSCRIPTIONS' | 'REPAIRS_MAINTENANCE';
    vendor: string;
    description: string;
    amountCents: number;
  }[]
> = {
  seaside: [
    {
      day: 6,
      category: 'SUPPLIES',
      vendor: 'Costco',
      description: 'Restock: paper towels, soap, coffee',
      amountCents: 6_420,
    },
    { day: 15, category: 'SUBSCRIPTIONS', vendor: 'Netflix', description: 'Netflix Standard', amountCents: 1_899 },
  ],
  cedar: [
    {
      day: 5,
      category: 'SUPPLIES',
      vendor: 'Canadian Tire',
      description: 'Restock: firewood, batteries',
      amountCents: 8_975,
    },
    {
      day: 20,
      category: 'REPAIRS_MAINTENANCE',
      vendor: 'Sea to Sky Plumbing',
      description: 'Fix kitchen tap',
      amountCents: 14_500,
    },
  ],
};

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM" months from `from` to `to` months away from the month containing `now` (Vancouver time). */
export function seedMonths(now: Date, from = -3, to = 1): string[] {
  const [y, m] = currentMonthStart('America/Vancouver', now).split('-').map(Number) as [number, number];
  const months: string[] = [];
  for (let offset = from; offset <= to; offset++) {
    const total = y * 12 + (m - 1) + offset;
    months.push(`${Math.floor(total / 12)}-${pad((total % 12) + 1)}`);
  }
  return months;
}

/** The bookings for one property and month. Months after the current one have no payout yet ("pending"). */
export function plannedBookings(propertyKey: keyof typeof STAYS, month: string, paidOut: boolean) {
  return STAYS[propertyKey].map((s, i) => {
    const nights = s.checkOut - s.checkIn;
    const guest = s.kind === 'GUEST';
    return {
      externalId: `seed-${propertyKey}-${month}-${i + 1}`,
      checkInDate: `${month}-${pad(s.checkIn)}`,
      checkOutDate: `${month}-${pad(s.checkOut)}`,
      channel: s.channel,
      kind: s.kind,
      guestCount: guest ? 2 : null,
      payoutCents: guest && paidOut ? nights * s.nightlyCents + s.cleaningFeeCents : null,
      guestCleaningFeeCents: guest && paidOut ? s.cleaningFeeCents : null,
    };
  });
}

/**
 * Refuses anything but a local, dev-instance setup: production, a live Clerk key, or a missing key. Throws with
 * the reason.
 */
export function assertSafeToSeed(env: {
  NODE_ENV?: string;
  CLERK_SECRET_KEY?: string;
  DATABASE_URL?: string;
  SEED_OWNER_EMAIL?: string;
  SEED_CLEANER_EMAIL?: string;
  SEED_TEST_PASSWORD?: string;
}) {
  if (env.NODE_ENV === 'production') throw new Error('Refusing to seed: NODE_ENV is production.');
  const key = env.CLERK_SECRET_KEY ?? '';
  if (key.startsWith('sk_live_'))
    throw new Error('Refusing to seed: CLERK_SECRET_KEY is a live key. Use the dev instance.');
  if (!key.startsWith('sk_test_'))
    throw new Error('CLERK_SECRET_KEY must be set to the dev instance’s key (sk_test_…).');
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');
  // The accounts are each developer's own: set in apps/api/.env, never in the repository.
  for (const key of ['SEED_OWNER_EMAIL', 'SEED_CLEANER_EMAIL'] as const) {
    const value = env[key]?.trim() ?? '';
    if (!value)
      throw new Error(
        `${key} is not set (apps/api/.env): the address the test ${key === 'SEED_OWNER_EMAIL' ? 'owner' : 'cleaner'} signs in with.`,
      );
    // Clerk treats `+clerk_test` addresses as test addresses: no real email is sent to them.
    if (!/\+clerk_test@/i.test(value)) throw new Error(`${key} must be a Clerk test address (name+clerk_test@domain).`);
  }
  if ((env.SEED_TEST_PASSWORD ?? '').length < MIN_TEST_PASSWORD_LENGTH) {
    throw new Error(`SEED_TEST_PASSWORD must be set (apps/api/.env), at least ${MIN_TEST_PASSWORD_LENGTH} characters.`);
  }
}

/** What the seed needs from the running API to attach receipts and issue statements. */
export interface SeedServices {
  storage: FileStorage;
  statements: Pick<StatementsService, 'create' | 'finalize' | 'release'>;
}

/** Creates or finds the sign-in account; returns its id. The Clerk version lives in the CLI. */
export interface SeedIdentity {
  ensureUser(account: { email: string; firstName: string; lastName: string }): Promise<string>;
}

export async function seedTestAccounts(
  prisma: PrismaClient,
  identity: SeedIdentity,
  accounts: TestAccounts,
  now = new Date(),
  services?: SeedServices,
) {
  const log: string[] = [];

  const admin = await prisma.user.findFirst({ where: { staffRole: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  if (!admin) throw new Error('No admin user yet. Run `pnpm --filter @truhost/api bootstrap` first.');
  const plan =
    (await prisma.plan.findUnique({ where: { name: 'TruPlan' } })) ??
    (await prisma.plan.create({
      data: { name: 'TruPlan', managementFeeBps: 2200, description: '22% of the month’s owner gross revenue' },
    }));

  // Users: a sign-in account in Clerk, linked to our row directly (no invite needed).
  const users = {} as Record<keyof TestAccounts, { id: string }>;
  for (const [role, account] of Object.entries(accounts) as [keyof TestAccounts, TestAccount][]) {
    const clerkUserId = await identity.ensureUser(account);
    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    if (existing && existing.clerkUserId === clerkUserId && existing.status === 'ACTIVE') {
      users[role] = existing;
      log.push(`${role} ${account.email} already set up`);
      continue;
    }
    // A row still holding this Clerk id (e.g. the email changed) lets go of it first.
    await prisma.user.updateMany({
      where: { clerkUserId, email: { not: account.email } },
      data: { clerkUserId: null },
    });
    users[role] = await prisma.user.upsert({
      where: { email: account.email },
      create: { ...account, clerkUserId, status: 'ACTIVE' },
      update: { clerkUserId, status: 'ACTIVE', deactivatedAt: null },
    });
    log.push(`${role} ${account.email} linked to its sign-in account`);
  }

  const months = seedMonths(now);
  const thisMonth = seedMonths(now, 0, 0)[0]!;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver' }).format(now); // YYYY-MM-DD
  let bookings = 0;
  let expenses = 0;

  for (const p of SEED_PROPERTIES) {
    const { key, ...fields } = p;
    let property = await prisma.property.findUnique({ where: { id: p.id } });
    if (!property) {
      property = await prisma.property.create({
        data: { ...fields, rooms: { create: ROOMS.map((r, i) => ({ ...r, number: 1, position: i })) } },
      });
      await prisma.auditLog.create({
        data: {
          actorType: 'SYSTEM',
          action: 'property.create',
          entityType: 'Property',
          entityId: property.id,
          propertyId: property.id,
        },
      });
      log.push(`created property "${p.name}"`);
    }
    if (property.archivedAt) {
      property = await prisma.property.update({ where: { id: p.id }, data: { archivedAt: null } });
    }
    // Charged to the owner after each owner stay; set once, so an admin's later change sticks.
    if (property.standardCleaningFeeCents === 0) {
      property = await prisma.property.update({
        where: { id: p.id },
        data: { standardCleaningFeeCents: p.standardCleaningFeeCents },
      });
    }

    if (!(await prisma.propertyPlan.findFirst({ where: { propertyId: p.id } }))) {
      await prisma.propertyPlan.create({
        data: {
          propertyId: p.id,
          planId: plan.id,
          effectiveFrom: fromIsoDate(`${months[0]}-01`),
          createdById: admin.id,
        },
      });
    }

    for (const [role, user] of [
      ['OWNER', users.owner],
      ['CLEANER', users.cleaner],
    ] as const) {
      const active = await prisma.membership.findFirst({
        where: { userId: user.id, propertyId: p.id, revokedAt: null },
      });
      if (!active)
        await prisma.membership.create({ data: { userId: user.id, propertyId: p.id, role, createdById: admin.id } });
    }
    if (property.defaultCleanerId !== users.cleaner.id) {
      await prisma.property.update({ where: { id: p.id }, data: { defaultCleanerId: users.cleaner.id } });
    }

    // Supplies, once: a starting level from the cleaner's last check (seeded directly, so no alerts are sent).
    if ((await prisma.supplyItem.count({ where: { propertyId: p.id } })) === 0) {
      for (const [position, item] of SUPPLIES[key].entries()) {
        const created = await prisma.supplyItem.create({
          data: { propertyId: p.id, name: item.name, category: item.category, position },
        });
        if (item.level !== null) {
          await prisma.supplyStatus.create({
            data: { supplyItemId: created.id, levelPct: item.level, reportedById: users.cleaner.id },
          });
        }
      }
      log.push(`added ${SUPPLIES[key].length} supplies to "${p.name}"`);
    }

    for (const month of months) {
      for (const b of plannedBookings(key, month, month <= thisMonth)) {
        const found = await prisma.booking.findUnique({
          where: { propertyId_source_externalId: { propertyId: p.id, source: 'MANUAL', externalId: b.externalId } },
        });
        if (found) continue;
        await prisma.booking.create({
          data: {
            ...b,
            propertyId: p.id,
            source: 'MANUAL',
            checkInDate: fromIsoDate(b.checkInDate),
            checkOutDate: fromIsoDate(b.checkOutDate),
            enteredById: admin.id,
          },
        });
        bookings++;
      }
      if (month > thisMonth) continue;
      for (const e of EXPENSES[key]) {
        const date = `${month}-${pad(e.day)}`;
        if (date > today) continue; // not bought yet
        const incurredOn = fromIsoDate(date);
        const found = await prisma.expense.findFirst({
          where: { propertyId: p.id, description: e.description, incurredOn },
        });
        if (found) continue;
        const { day: _day, ...expense } = e;
        await prisma.expense.create({ data: { ...expense, propertyId: p.id, incurredOn, enteredById: admin.id } });
        expenses++;
      }
    }
  }

  log.push(`added ${bookings} bookings and ${expenses} expenses (${months[0]} to ${months.at(-1)})`);

  if (services) {
    const actor: Actor = { userId: admin.id, staffRole: 'ADMIN', memberships: [] };
    const receipts = await attachSampleReceipts(prisma, services.storage, admin.id);
    if (receipts > 0) log.push(`attached sample receipts to ${receipts} expenses`);
    const lastMonth = seedMonths(now, -1, -1)[0]!;
    // Paid on the 5th, or today if that's still ahead.
    const releasedOn = [`${thisMonth}-05`, today].sort()[0]!;
    for (const p of SEED_PROPERTIES) {
      log.push(await releaseStatement(prisma, services.statements, actor, p, lastMonth, releasedOn));
    }
  }
  return { log, users, months };
}

/** A sample receipt PDF for each seeded expense that has none, stored like an upload. Returns how many. */
async function attachSampleReceipts(prisma: PrismaClient, storage: FileStorage, adminId: string) {
  const missing = await prisma.expense.findMany({
    where: {
      propertyId: { in: SEED_PROPERTIES.map((p) => p.id) },
      voidedAt: null,
      receipts: { none: { voidedAt: null } },
    },
  });
  for (const e of missing) {
    const date = toIsoDate(e.incurredOn);
    const body = await sampleReceiptPdf({
      vendor: e.vendor ?? 'Receipt',
      description: e.description,
      amountCents: e.amountCents,
      date,
    });
    const sha256 = createHash('sha256').update(body).digest('hex');
    const id = uuidv7();
    const objectKey = `properties/${e.propertyId}/receipt/${id}`;
    await storage.put(objectKey, body, { contentType: 'application/pdf', sha256Hex: sha256 });
    await prisma.storedFile.create({
      data: {
        id,
        purpose: 'RECEIPT',
        propertyId: e.propertyId,
        objectKey,
        contentType: 'application/pdf',
        sizeBytes: body.length,
        sha256,
        status: 'VERIFIED',
        verifiedAt: new Date(),
        uploadedById: adminId,
        originalFilename: `receipt-${date}.pdf`,
      },
    });
    await prisma.receipt.create({
      data: { propertyId: e.propertyId, expenseId: e.id, fileId: id, receiptDate: e.incurredOn, uploadedById: adminId },
    });
  }
  return missing.length;
}

/** Takes one property's statement for `month` through draft, finalize and release, picking up wherever it stands. */
async function releaseStatement(
  prisma: PrismaClient,
  statements: SeedServices['statements'],
  actor: Actor,
  p: (typeof SEED_PROPERTIES)[number],
  month: string,
  releasedOn: string,
): Promise<string> {
  const existing = await prisma.ownerStatement.findUnique({
    where: { propertyId_periodMonth: { propertyId: p.id, periodMonth: fromIsoDate(`${month}-01`) } },
  });
  if (existing?.status === 'RELEASED') return `${month} statement for "${p.name}" already released`;
  try {
    let st = await statements.create(actor, p.id, month);
    if (st.status === 'DRAFT') st = await statements.finalize(actor, st.id, { confirmPendingPayouts: true });
    await statements.release(actor, st.id, { releasedOn, paymentReference: `SEED-${month}` });
    return `released the ${month} statement for "${p.name}" (paid ${releasedOn})`;
  } catch (e) {
    const detail = (e as { problem?: { detail?: string; extras?: { blockers?: { message: string }[] } } }).problem;
    const why = detail?.extras?.blockers?.map((b) => b.message).join(' ') ?? detail?.detail ?? (e as Error).message;
    return `couldn't release the ${month} statement for "${p.name}": ${why}`;
  }
}
