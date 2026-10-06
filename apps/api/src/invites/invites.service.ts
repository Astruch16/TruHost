import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { PageQuery } from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../auth/actor.js';
import { IDENTITY_PROVIDER, type IdentityProvider } from '../auth/identity-provider.js';
import { cursorPage } from '../common/pagination.js';
import { conflict, notFound, ProblemException, unprocessable } from '../common/problem.js';
import { ENV, type Env } from '../config/env.js';
import { EMAIL_SENDER, type EmailSender } from '../email/email-sender.js';
import { inviteEmail } from '../email/templates.js';
import type { MembershipRole, StaffRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const INVITE_INCLUDE = {
  user: { select: { id: true, email: true, firstName: true, lastName: true, staffRole: true } },
} as const;

/** Parsed (output) shape of the shared `createInvite` schema. */
type InviteInput = {
  email: string;
  firstName: string;
  lastName: string;
  staffRole: StaffRole | null;
  memberships: { propertyId: string; role: MembershipRole }[];
};

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Creates a provider invitation (which sends nothing) and emails its link through our own sender. If the email
   * fails, the provider invitation is revoked so no live link exists that we never delivered.
   */
  private async issue(user: { email: string; firstName: string }) {
    const invitation = await this.identity.createInvitation(user.email, `${this.env.WEB_URL}/sign-up`);
    try {
      const sent = await this.email.send(inviteEmail(user, invitation.url));
      return { clerkInvitationId: invitation.id, emailMessageId: sent.id, lastSentAt: new Date() };
    } catch (e) {
      this.logger.error(`Invite email to ${user.email} failed: ${String(e)}`);
      await this.revokeQuietly(invitation.id);
      throw new ProblemException({
        status: HttpStatus.BAD_GATEWAY,
        code: 'EMAIL_FAILED',
        detail: 'The invite email could not be sent. Nothing was saved; please try again.',
      });
    }
  }

  /**
   * Creates (or re-invites) an INVITED user with their memberships, then asks the identity
   * provider to email them. The provider call runs inside the transaction so a failure leaves no
   * half-created user behind.
   */
  async create(actor: Actor, input: InviteInput) {
    this.access.assert(actor, 'invite:manage');

    const propertyIds = [...new Set(input.memberships.map((m) => m.propertyId))];
    const found = await this.prisma.property.count({ where: { id: { in: propertyIds }, archivedAt: null } });
    if (found !== propertyIds.length) {
      throw unprocessable('UNKNOWN_PROPERTY', 'One or more properties do not exist or are archived');
    }

    const invite = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.user.findUnique({ where: { email: input.email } });
        if (existing && (existing.clerkUserId || existing.status === 'ACTIVE')) {
          throw conflict('USER_EXISTS', 'A user with this email already exists');
        }
        if (existing) {
          await tx.invite.updateMany({
            where: { userId: existing.id, status: 'PENDING' },
            data: { status: 'REVOKED', revokedAt: new Date() },
          });
        }
        const user = existing
          ? await tx.user.update({
              where: { id: existing.id },
              data: {
                firstName: input.firstName,
                lastName: input.lastName,
                staffRole: input.staffRole,
                status: 'INVITED',
                deactivatedAt: null,
              },
            })
          : await tx.user.create({
              data: {
                email: input.email,
                firstName: input.firstName,
                lastName: input.lastName,
                staffRole: input.staffRole,
              },
            });

        for (const m of dedupe(input.memberships)) {
          const active = await tx.membership.findFirst({
            where: { userId: user.id, propertyId: m.propertyId, role: m.role, revokedAt: null },
          });
          if (!active) {
            await tx.membership.create({
              data: { userId: user.id, propertyId: m.propertyId, role: m.role, createdById: actor.userId },
            });
          }
        }

        const issued = await this.issue(user);
        const created = await tx.invite.create({
          data: { userId: user.id, invitedById: actor.userId, ...issued },
          include: INVITE_INCLUDE,
        });
        await this.audit.record(tx, actor, {
          action: 'invite.create',
          entityType: 'Invite',
          entityId: created.id,
          after: { email: user.email, staffRole: user.staffRole, memberships: input.memberships },
        });
        return created;
      },
      { timeout: 15_000 },
    );
    return present(invite);
  }

  async list(actor: Actor, query: PageQuery) {
    this.access.assert(actor, 'invite:manage');
    const page = cursorPage(query);
    const { items, nextCursor } = page.page(
      await this.prisma.invite.findMany({ ...page.args, include: INVITE_INCLUDE }),
    );
    return { items: items.map(present), nextCursor };
  }

  async resend(actor: Actor, id: string) {
    this.access.assert(actor, 'invite:manage');
    const invite = await this.prisma.invite.findUnique({ where: { id }, include: INVITE_INCLUDE });
    if (!invite) throw notFound('Invite');
    if (invite.status !== 'PENDING') throw conflict('INVITE_NOT_PENDING', 'Only pending invites can be resent');

    if (invite.clerkInvitationId) await this.revokeQuietly(invite.clerkInvitationId);
    const issued = await this.issue(invite.user);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.invite.update({
        where: { id },
        data: issued,
        include: INVITE_INCLUDE,
      });
      await this.audit.record(tx, actor, { action: 'invite.resend', entityType: 'Invite', entityId: id });
      return row;
    });
    return present(updated);
  }

  /** Revoking also deactivates the never-signed-in user, so they can no longer link on first sign-in. */
  async revoke(actor: Actor, id: string) {
    this.access.assert(actor, 'invite:manage');
    const revoked = await this.prisma.$transaction(async (tx) => {
      const invite = await tx.invite.findUnique({ where: { id } });
      if (!invite) throw notFound('Invite');
      if (invite.status !== 'PENDING') throw conflict('INVITE_NOT_PENDING', 'Only pending invites can be revoked');
      const row = await tx.invite.update({
        where: { id },
        data: { status: 'REVOKED', revokedAt: new Date() },
        include: INVITE_INCLUDE,
      });
      await tx.user.updateMany({
        where: { id: invite.userId, status: 'INVITED', clerkUserId: null },
        data: { status: 'DEACTIVATED', deactivatedAt: new Date() },
      });
      await this.audit.record(tx, actor, {
        action: 'invite.revoke',
        entityType: 'Invite',
        entityId: id,
        before: { status: 'PENDING' },
        after: { status: 'REVOKED' },
      });
      return row;
    });
    if (revoked.clerkInvitationId) await this.revokeQuietly(revoked.clerkInvitationId);
    return present(revoked);
  }

  private async revokeQuietly(clerkInvitationId: string) {
    try {
      await this.identity.revokeInvitation(clerkInvitationId);
    } catch (e) {
      // Already accepted/expired on the provider side; our own status is authoritative.
      this.logger.warn(`Could not revoke provider invitation ${clerkInvitationId}: ${String(e)}`);
    }
  }
}

function dedupe<T extends { propertyId: string; role: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((m) => {
    const key = `${m.propertyId}:${m.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function present(invite: {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  emailMessageId: string | null;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  user: { id: string; email: string; firstName: string; lastName: string; staffRole: StaffRole | null };
}) {
  return {
    id: invite.id,
    status: invite.status,
    user: invite.user,
    // Only true when the provider accepted it; locally (no Resend key) emails are logged, not sent.
    emailSent: invite.emailMessageId !== null,
    acceptedAt: invite.acceptedAt,
    revokedAt: invite.revokedAt,
    createdAt: invite.createdAt,
  };
}
