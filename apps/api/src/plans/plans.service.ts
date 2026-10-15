import { Injectable } from '@nestjs/common';
import { OWN_PROPERTY_PLAN_ID, type AssignPlan, type CorrectPlan, type UpdatePlan } from '@truhost/shared';
import type { createPlan } from '@truhost/shared';
import type { z } from 'zod';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../auth/actor.js';
import { currentMonthStart, fromIsoDate, toIsoDate } from '../common/dates.js';
import { conflict, notFound, unprocessable } from '../common/problem.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { monthName } from '../reporting/statement.js';

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
    if (id === OWN_PROPERTY_PLAN_ID) {
      throw unprocessable(
        'PLAN_RESERVED',
        'The Own property plan is used for staff-owned properties and can’t be archived',
      );
    }
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

  /** Switches every month so far to `planId` (see correctPlanHistory). */
  async correct(actor: Actor, propertyId: string, input: CorrectPlan) {
    this.access.assert(actor, 'propertyPlan:assign', propertyId, 'Property');
    await this.prisma.$transaction(async (tx) => {
      const property = await tx.property.findUnique({ where: { id: propertyId } });
      if (!property) throw notFound('Property');
      const plan = await tx.plan.findUnique({ where: { id: input.planId } });
      if (!plan || plan.archivedAt) throw unprocessable('UNKNOWN_PLAN', 'Plan does not exist or is archived');
      await correctPlanHistory(tx, this.audit, actor, property, plan.id);
    });
    return this.propertyPlan(actor, propertyId);
  }

  /**
   * Starts `planId` on `effectiveFrom` (1st of a month) and closes the open period. New periods
   * must start after the latest one, so history is never rewritten, and after the latest finalized statement, whose
   * fee is already fixed.
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
      await assertPlanOpen(tx, propertyId, from);
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

/**
 * Correct a property's plan for every month so far: each plan period switches to `planId`, keeping its dates; with no
 * periods yet, one starts in the month the property was added. For a plan that was wrong from the start (e.g. an
 * admin's own property put on TruPlan). Audited with the periods before and after. Refused once any month has a
 * finalized statement: its fee is part of an issued document (correct it with an adjustment instead).
 */
export async function correctPlanHistory(
  tx: Prisma.TransactionClient,
  audit: AuditService,
  actor: Actor,
  property: { id: string; timeZone: string; createdAt: Date },
  planId: string,
) {
  await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${property.id}::uuid FOR UPDATE`;
  await assertPlanOpen(tx, property.id, null);
  const periods = await tx.propertyPlan.findMany({
    where: { propertyId: property.id },
    orderBy: { effectiveFrom: 'asc' },
  });
  const before = periods.map((p) => ({ planId: p.planId, effectiveFrom: toIsoDate(p.effectiveFrom) }));
  if (periods.length === 0) {
    const from = currentMonthStart(property.timeZone, property.createdAt);
    const created = await tx.propertyPlan.create({
      data: { propertyId: property.id, planId, effectiveFrom: fromIsoDate(from), createdById: actor.userId },
    });
    await audit.record(tx, actor, {
      action: 'propertyPlan.assign',
      entityType: 'PropertyPlan',
      entityId: created.id,
      propertyId: property.id,
      before: null,
      after: { planId, effectiveFrom: from },
    });
    return;
  }
  await tx.propertyPlan.updateMany({ where: { propertyId: property.id }, data: { planId } });
  await audit.record(tx, actor, {
    action: 'propertyPlan.correct',
    entityType: 'Property',
    entityId: property.id,
    propertyId: property.id,
    before: { periods: before },
    after: { periods: before.map((p) => ({ ...p, planId })) },
  });
}

/**
 * Refuses a plan change reaching a month whose statement is finalized (from `from` on; every month when null). The
 * caller holds the property row lock, which finalize also takes.
 */
async function assertPlanOpen(tx: Prisma.TransactionClient, propertyId: string, from: Date | null) {
  const locked = await tx.ownerStatement.findFirst({
    where: { propertyId, status: { not: 'DRAFT' }, ...(from ? { periodMonth: { gte: from } } : {}) },
    orderBy: { periodMonth: 'desc' },
    select: { periodMonth: true },
  });
  if (!locked) return;
  const month = monthName(toIsoDate(locked.periodMonth).slice(0, 7));
  throw conflict(
    'PERIOD_LOCKED',
    from
      ? `${month} already has a finalized statement for this property. A new plan can start after it.`
      : `${month} already has a finalized statement for this property, so its plan history can’t be corrected. Assign a new plan from next month instead, and record any fee correction as an adjustment.`,
  );
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
