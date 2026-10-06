import { Injectable } from '@nestjs/common';
import type { AssignPlan, UpdatePlan } from '@truhost/shared';
import type { createPlan } from '@truhost/shared';
import type { z } from 'zod';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../auth/actor.js';
import { fromIsoDate, toIsoDate } from '../common/dates.js';
import { conflict, notFound, unprocessable } from '../common/problem.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type PlanRow = Prisma.PlanGetPayload<{ include: { _count: { select: { properties: true } } } }>;
const WITH_USAGE = { _count: { select: { properties: true } } } as const;

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor) {
    this.access.assert(actor, 'plan:manage');
    const rows = await this.prisma.plan.findMany({ include: WITH_USAGE, orderBy: { name: 'asc' } });
    return { items: rows.map(presentPlan), nextCursor: null };
  }

  async create(actor: Actor, input: z.output<typeof createPlan>) {
    this.access.assert(actor, 'plan:manage');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.plan.create({ data: input, include: WITH_USAGE });
        await this.audit.record(tx, actor, {
          action: 'plan.create',
          entityType: 'Plan',
          entityId: row.id,
          after: input,
        });
        return presentPlan(row);
      });
    } catch (e) {
      throw uniqueName(e);
    }
  }

  async update(actor: Actor, id: string, input: UpdatePlan) {
    this.access.assert(actor, 'plan:manage');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.plan.findUnique({ where: { id }, include: WITH_USAGE });
        if (!before) throw notFound('Plan');
        if (
          input.managementFeeBps !== undefined &&
          input.managementFeeBps !== before.managementFeeBps &&
          before._count.properties > 0
        ) {
          throw conflict('PLAN_RATE_LOCKED', 'This plan is in use; create a new plan to change the rate');
        }
        const row = await tx.plan.update({ where: { id }, data: input, include: WITH_USAGE });
        await this.audit.recordUpdate(
          tx,
          actor,
          { action: 'plan.update', entityType: 'Plan', entityId: id },
          before,
          input,
        );
        return presentPlan(row);
      });
    } catch (e) {
      throw uniqueName(e);
    }
  }

  async archive(actor: Actor, id: string) {
    this.access.assert(actor, 'plan:manage');
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.plan.findUnique({ where: { id } });
      if (!before) throw notFound('Plan');
      const row = await tx.plan.update({
        where: { id },
        data: { archivedAt: before.archivedAt ?? new Date() },
        include: WITH_USAGE,
      });
      if (!before.archivedAt) {
        await this.audit.record(tx, actor, { action: 'plan.archive', entityType: 'Plan', entityId: id });
      }
      return presentPlan(row);
    });
  }

  async propertyPlan(actor: Actor, propertyId: string) {
    this.access.assert(actor, 'propertyPlan:read', propertyId, 'Property');
    const exists = await this.prisma.property.count({ where: { id: propertyId } });
    if (!exists) throw notFound('Property');
    const periods = await this.prisma.propertyPlan.findMany({
      where: { propertyId },
      include: { plan: { select: { id: true, name: true, managementFeeBps: true } } },
      orderBy: { effectiveFrom: 'desc' },
    });
    const history = periods.map((p) => ({
      id: p.id,
      plan: p.plan,
      effectiveFrom: toIsoDate(p.effectiveFrom),
      effectiveTo: toIsoDate(p.effectiveTo),
    }));
    return { current: history.find((p) => p.effectiveTo === null) ?? null, history };
  }

  /**
   * Starts `planId` on `effectiveFrom` (1st of a month) and closes the open period. New periods
   * must start after the latest one, so history is never rewritten.
   * TODO(phase 2b): also reject months covered by a FINALIZED statement.
   */
  async assign(actor: Actor, propertyId: string, input: AssignPlan) {
    this.access.assert(actor, 'propertyPlan:assign', propertyId, 'Property');
    await this.prisma.$transaction(async (tx) => {
      const property = await tx.property.findUnique({ where: { id: propertyId } });
      if (!property) throw notFound('Property');
      const plan = await tx.plan.findUnique({ where: { id: input.planId } });
      if (!plan || plan.archivedAt) throw unprocessable('UNKNOWN_PLAN', 'Plan does not exist or is archived');

      // Serialise assignments per property.
      await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${propertyId}::uuid FOR UPDATE`;
      const from = fromIsoDate(input.effectiveFrom);
      const latest = await tx.propertyPlan.findFirst({ where: { propertyId }, orderBy: { effectiveFrom: 'desc' } });
      if (latest && latest.effectiveFrom >= from) {
        throw conflict(
          'PLAN_PERIOD_CONFLICT',
          `effectiveFrom must be after the latest plan period (${toIsoDate(latest.effectiveFrom)})`,
        );
      }
      if (latest && latest.effectiveTo === null) {
        await tx.propertyPlan.update({ where: { id: latest.id }, data: { effectiveTo: from } });
      }
      const created = await tx.propertyPlan.create({
        data: { propertyId, planId: plan.id, effectiveFrom: from, createdById: actor.userId },
      });
      await this.audit.record(tx, actor, {
        action: 'propertyPlan.assign',
        entityType: 'PropertyPlan',
        entityId: created.id,
        propertyId,
        before: latest ? { planId: latest.planId, effectiveFrom: toIsoDate(latest.effectiveFrom) } : null,
        after: { planId: plan.id, effectiveFrom: input.effectiveFrom },
      });
    });
    return this.propertyPlan(actor, propertyId);
  }
}

function presentPlan(p: PlanRow) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    managementFeeBps: p.managementFeeBps,
    inUse: p._count.properties > 0,
    archivedAt: p.archivedAt,
  };
}

function uniqueName(e: unknown): unknown {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return conflict('PLAN_NAME_TAKEN', 'A plan with this name already exists');
  }
  return e;
}
