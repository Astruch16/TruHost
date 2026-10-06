/**
 * First-run setup (docs/spec.md §10, Phase 1). Idempotent: safe to run again.
 *
 *   pnpm --filter @truhost/api bootstrap -- \
 *     --admin-email you@truhost.ca --first-name Adam --last-name Struch \
 *     [--property-name "Kits 2BR" --address "1 Yew St" --city Vancouver --postal-code "V6K 3G1"]
 *
 * - Ensures the TruPlan plan exists (22%).
 * - Ensures the admin user exists (INVITED until their first Clerk sign-in) and sends a Clerk
 *   invitation when CLERK_SECRET_KEY is set.
 * - Optionally creates the first property with default rooms, the admin as its OWNER, and
 *   TruPlan from the current month: the single-property starting point.
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { createClerkClient } from '@clerk/backend';
import { createProperty, email as emailSchema } from '@truhost/shared';
import { PrismaClient } from '../generated/prisma/client.js';
import { currentMonthStart, fromIsoDate } from '../common/dates.js';
import { ResendEmailSender } from '../email/resend-email-sender.js';
import { inviteEmail } from '../email/templates.js';

const TRUPLAN = { name: 'TruPlan', managementFeeBps: 2200, description: '22% of the month’s owner gross revenue' };
const DEFAULT_ROOMS = [
  { name: 'Bedroom', type: 'BEDROOM' },
  { name: 'Bathroom', type: 'BATHROOM' },
  { name: 'Kitchen', type: 'KITCHEN' },
  { name: 'Living room', type: 'LIVING' },
] as const;

const { values: args } = parseArgs({
  options: {
    'admin-email': { type: 'string' },
    'first-name': { type: 'string' },
    'last-name': { type: 'string' },
    'property-name': { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string', default: 'Vancouver' },
    'postal-code': { type: 'string' },
    'no-invite': { type: 'boolean', default: false },
  },
});

function required(name: keyof typeof args): string {
  const v = args[name];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`--${name} is required`);
  return v.trim();
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const adminEmail = emailSchema.parse(required('admin-email'));
  const log = (msg: string) => console.log(`• ${msg}`);

  const plan =
    (await prisma.plan.findUnique({ where: { name: TRUPLAN.name } })) ??
    (await prisma.$transaction(async (tx) => {
      const created = await tx.plan.create({ data: TRUPLAN });
      await tx.auditLog.create({
        data: { actorType: 'SYSTEM', action: 'plan.create', entityType: 'Plan', entityId: created.id, after: TRUPLAN },
      });
      log(`created plan ${TRUPLAN.name} (${TRUPLAN.managementFeeBps / 100}%)`);
      return created;
    }));

  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        firstName: required('first-name'),
        lastName: required('last-name'),
        staffRole: 'ADMIN',
      },
    });
    await prisma.auditLog.create({
      data: { actorType: 'SYSTEM', action: 'user.bootstrapAdmin', entityType: 'User', entityId: admin.id },
    });
    log(`created admin ${adminEmail}`);
  } else if (admin.staffRole !== 'ADMIN') {
    admin = await prisma.user.update({ where: { id: admin.id }, data: { staffRole: 'ADMIN' } });
    log(`promoted ${adminEmail} to admin`);
  } else {
    log(`admin ${adminEmail} already exists`);
  }

  if (args['property-name']) {
    const name = args['property-name'].trim();
    const existing = await prisma.property.findFirst({ where: { name } });
    if (existing) {
      log(`property "${name}" already exists`);
    } else {
      const input = createProperty.parse({
        name,
        addressLine1: required('address'),
        city: args.city,
        postalCode: required('postal-code'),
      });
      await prisma.$transaction(async (tx) => {
        const p = await tx.property.create({
          data: { ...input, rooms: { create: DEFAULT_ROOMS.map((r, i) => ({ ...r, sortOrder: i })) } },
        });
        await tx.membership.create({ data: { userId: admin.id, propertyId: p.id, role: 'OWNER' } });
        await tx.propertyPlan.create({
          data: { propertyId: p.id, planId: plan.id, effectiveFrom: fromIsoDate(currentMonthStart(p.timeZone)) },
        });
        await tx.auditLog.create({
          data: {
            actorType: 'SYSTEM',
            action: 'property.create',
            entityType: 'Property',
            entityId: p.id,
            propertyId: p.id,
          },
        });
      });
      log(`created property "${name}" with ${DEFAULT_ROOMS.length} rooms, ${adminEmail} as owner, on ${plan.name}`);
    }
  }

  if (admin.status === 'INVITED' && !args['no-invite']) {
    const pending = await prisma.invite.findFirst({ where: { userId: admin.id, status: 'PENDING' } });
    if (pending?.lastSentAt) {
      log('admin invite already sent');
    } else if (!process.env.CLERK_SECRET_KEY) {
      if (!pending) await prisma.invite.create({ data: { userId: admin.id } });
      log('CLERK_SECRET_KEY not set: invite recorded, nothing sent. Sign up in Clerk with this email to link.');
    } else {
      // Same flow as POST /v1/invites: Clerk creates the invitation silently; we email its link via Resend.
      const webUrl = process.env.WEB_URL ?? 'http://localhost:3001';
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const invitation = await clerk.invitations.createInvitation({
        emailAddress: adminEmail,
        redirectUrl: `${webUrl}/sign-up`,
        notify: false,
        ignoreExisting: true,
      });
      if (!invitation.url) throw new Error('Clerk returned an invitation without a URL');
      const sender = process.env.RESEND_API_KEY
        ? new ResendEmailSender(
            process.env.RESEND_API_KEY,
            process.env.EMAIL_FROM ?? 'TruHost <no-reply@truhost.example>',
          )
        : null;
      const sent = sender ? await sender.send(inviteEmail(admin, invitation.url)) : { id: null };
      const data = { clerkInvitationId: invitation.id, emailMessageId: sent.id, lastSentAt: new Date() };
      if (pending) await prisma.invite.update({ where: { id: pending.id }, data });
      else await prisma.invite.create({ data: { userId: admin.id, ...data } });
      log(
        sender
          ? `emailed an invitation to ${adminEmail}`
          : `RESEND_API_KEY not set, so no email was sent. Open this link to create your account:\n  ${invitation.url}`,
      );
    }
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
