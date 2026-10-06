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

  return {
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
