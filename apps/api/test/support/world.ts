import type { PrismaService } from '../../src/prisma/prisma.service.js';
import type { MembershipRole, StaffRole } from '../../src/generated/prisma/enums.js';

/**
 * The standard authz fixture (docs/spec.md §5): two properties, each with its own owner and
 * cleaner, an admin who also owns property A (TruHost's own unit), and an outsider with no
 * memberships. Subjects (fake Clerk ids) equal the keys below.
 */
export const ACTORS = ['admin', 'ownerA', 'ownerB', 'cleanerA', 'cleanerB', 'outsider'] as const;
export type ActorKey = (typeof ACTORS)[number];

export interface World {
  propertyA: { id: string; roomIds: string[] };
  propertyB: { id: string; roomIds: string[] };
  users: Record<ActorKey, { id: string; subject: string }>;
  memberships: Record<'ownerA' | 'ownerB' | 'cleanerA' | 'cleanerB' | 'adminOwnsA', string>;
  planId: string;
  pendingInviteId: string;
  invitedUserId: string;
  /** A confirmed, complete guest stay on each property: 2026-11-10 → 2026-11-13. */
  bookings: { a: string; b: string };
  /** Owner-borne expense with one receipt on each property (2026-11-05), plus a TruHost-borne one on A. */
  expenses: { a: string; b: string; truhostA: string };
  receipts: { a: string; b: string; truhostA: string };
  /** File ids behind the receipts above. */
  files: { a: string; b: string; truhostA: string };
  /** A photo of property A (large and card files), not set as its cover. */
  photoA: { id: string; fileId: string; thumbFileId: string };
}

export async function seedWorld(prisma: PrismaService): Promise<World> {
  const property = (name: string) =>
    prisma.property.create({
      data: {
        name,
        addressLine1: `1 ${name} St`,
        city: 'Vancouver',
        postalCode: 'V6K 1A1',
        defaultCleanerPayCents: 9000,
        rooms: {
          create: [
            { name: 'Bedroom', type: 'BEDROOM', sortOrder: 0 },
            { name: 'Bathroom', type: 'BATHROOM', sortOrder: 1 },
          ],
        },
      },
      include: { rooms: { orderBy: { sortOrder: 'asc' } } },
    });
  const a = await property('Property A');
  const b = await property('Property B');

  const user = (key: ActorKey, staffRole: StaffRole | null = null) =>
    prisma.user.create({
      data: {
        email: `${key.toLowerCase()}@example.test`,
        firstName: key,
        lastName: 'Test',
        staffRole,
        status: 'ACTIVE',
        clerkUserId: key,
      },
    });
  const users = {
    admin: await user('admin', 'ADMIN'),
    ownerA: await user('ownerA'),
    ownerB: await user('ownerB'),
    cleanerA: await user('cleanerA'),
    cleanerB: await user('cleanerB'),
    outsider: await user('outsider'),
  };

  const member = async (userId: string, propertyId: string, role: MembershipRole) =>
    (await prisma.membership.create({ data: { userId, propertyId, role } })).id;

  const plan = await prisma.plan.create({ data: { name: 'TruPlan', managementFeeBps: 2200 } });
  await prisma.propertyPlan.create({
    data: { propertyId: a.id, planId: plan.id, effectiveFrom: new Date('2026-01-01T00:00:00Z') },
  });

  const invited = await prisma.user.create({
    data: { email: 'invited@example.test', firstName: 'Invited', lastName: 'Person' },
  });
  await prisma.membership.create({ data: { userId: invited.id, propertyId: a.id, role: 'CLEANER' } });
  const invite = await prisma.invite.create({ data: { userId: invited.id, clerkInvitationId: 'inv_seed' } });

  const guestStay = async (propertyId: string) =>
    (
      await prisma.booking.create({
        data: {
          propertyId,
          source: 'MANUAL',
          channel: 'AIRBNB',
          checkInDate: new Date('2026-11-10T00:00:00Z'),
          checkOutDate: new Date('2026-11-13T00:00:00Z'),
          guestName: 'Guest Person',
          payoutCents: 60_000,
          guestCleaningFeeCents: 9_000,
        },
      })
    ).id;
  const bookings = { a: await guestStay(a.id), b: await guestStay(b.id) };

  const expenseWithReceipt = async (propertyId: string, bearer: 'OWNER' | 'TRUHOST') => {
    const expense = await prisma.expense.create({
      data: {
        propertyId,
        bearer,
        category: 'SUPPLIES',
        incurredOn: new Date('2026-11-05T00:00:00Z'),
        vendor: 'Sample Supply Co',
        description: 'Paper towels and coffee',
        amountCents: 4_199,
        enteredById: users.admin.id,
      },
    });
    const fileId = crypto.randomUUID();
    await prisma.storedFile.create({
      data: {
        id: fileId,
        purpose: 'RECEIPT',
        propertyId,
        objectKey: `properties/${propertyId}/receipt/${fileId}`,
        contentType: 'application/pdf',
        sizeBytes: 1234,
        sha256: 'a'.repeat(64),
        status: 'VERIFIED',
        verifiedAt: new Date(),
        uploadedById: users.admin.id,
        originalFilename: 'receipt.pdf',
      },
    });
    const receipt = await prisma.receipt.create({
      data: {
        propertyId,
        expenseId: expense.id,
        fileId,
        receiptDate: new Date('2026-11-05T00:00:00Z'),
        uploadedById: users.admin.id,
      },
    });
    return { expense: expense.id, receipt: receipt.id, file: fileId };
  };
  const ea = await expenseWithReceipt(a.id, 'OWNER');
  const eb = await expenseWithReceipt(b.id, 'OWNER');
  const et = await expenseWithReceipt(a.id, 'TRUHOST');

  const photoFile = async (propertyId: string, sha: string) => {
    const id = crypto.randomUUID();
    await prisma.storedFile.create({
      data: {
        id,
        purpose: 'PROPERTY_PHOTO',
        propertyId,
        objectKey: `properties/${propertyId}/property_photo/${id}`,
        contentType: 'image/jpeg',
        sizeBytes: 2048,
        sha256: sha.repeat(64),
        status: 'VERIFIED',
        verifiedAt: new Date(),
        uploadedById: users.admin.id,
      },
    });
    return id;
  };
  const photoFileId = await photoFile(a.id, 'c');
  const photoThumbId = await photoFile(a.id, 'd');
  const photoA = await prisma.propertyPhoto.create({
    data: { propertyId: a.id, fileId: photoFileId, thumbFileId: photoThumbId, uploadedById: users.admin.id },
  });

  return {
    bookings,
    expenses: { a: ea.expense, b: eb.expense, truhostA: et.expense },
    receipts: { a: ea.receipt, b: eb.receipt, truhostA: et.receipt },
    files: { a: ea.file, b: eb.file, truhostA: et.file },
    photoA: { id: photoA.id, fileId: photoFileId, thumbFileId: photoThumbId },
    propertyA: { id: a.id, roomIds: a.rooms.map((r) => r.id) },
    propertyB: { id: b.id, roomIds: b.rooms.map((r) => r.id) },
    users: Object.fromEntries(Object.entries(users).map(([k, u]) => [k, { id: u.id, subject: k }])) as World['users'],
    memberships: {
      ownerA: await member(users.ownerA.id, a.id, 'OWNER'),
      ownerB: await member(users.ownerB.id, b.id, 'OWNER'),
      cleanerA: await member(users.cleanerA.id, a.id, 'CLEANER'),
      cleanerB: await member(users.cleanerB.id, b.id, 'CLEANER'),
      adminOwnsA: await member(users.admin.id, a.id, 'OWNER'),
    },
    planId: plan.id,
    pendingInviteId: invite.id,
    invitedUserId: invited.id,
  };
}
