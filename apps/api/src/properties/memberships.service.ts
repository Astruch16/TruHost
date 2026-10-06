import { Injectable } from '@nestjs/common';
import type { CreateMembership } from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../auth/actor.js';
import { conflict, notFound, unprocessable } from '../common/problem.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const INCLUDE = { user: { select: { id: true, email: true, firstName: true, lastName: true } } } as const;

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor, propertyId: string, includeRevoked: boolean) {
    this.access.assert(actor, 'membership:manage', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    const items = await this.prisma.membership.findMany({
      where: { propertyId, ...(includeRevoked ? {} : { revokedAt: null }) },
      include: INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return { items, nextCursor: null };
  }

  async create(actor: Actor, propertyId: string, input: CreateMembership) {
    this.access.assert(actor, 'membership:manage', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw unprocessable('UNKNOWN_USER', 'User does not exist');
    if (user.status === 'DEACTIVATED') throw unprocessable('USER_DEACTIVATED', 'User is deactivated');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.membership.create({
          data: { propertyId, userId: input.userId, role: input.role, createdById: actor.userId },
          include: INCLUDE,
        });
        await this.audit.record(tx, actor, {
          action: 'membership.create',
          entityType: 'Membership',
          entityId: row.id,
          propertyId,
          after: { userId: input.userId, role: input.role },
        });
        return row;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw conflict('MEMBERSHIP_EXISTS', 'This user already has that role on this property');
      }
      throw e;
    }
  }

  async revoke(actor: Actor, id: string) {
    const existing = await this.prisma.membership.findUnique({ where: { id } });
    // Check access against the membership's property before revealing whether it exists.
    if (!existing || !this.access.can(actor, 'membership:manage', existing.propertyId)) {
      throw notFound('Membership');
    }
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.membership.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: actor.userId },
      });
      if (count === 1) {
        await this.audit.record(tx, actor, {
          action: 'membership.revoke',
          entityType: 'Membership',
          entityId: id,
          propertyId: existing.propertyId,
          before: { userId: existing.userId, role: existing.role },
        });
      }
      return tx.membership.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    });
  }

  private async assertPropertyExists(id: string) {
    const exists = await this.prisma.property.count({ where: { id } });
    if (!exists) throw notFound('Property');
  }
}
