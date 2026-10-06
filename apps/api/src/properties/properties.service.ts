import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import type { createProperty, updateProperty } from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../auth/actor.js';
import { notFound } from '../common/problem.js';
import type { Property } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type CreateInput = z.output<typeof createProperty>;
type UpdateInput = z.output<typeof updateProperty>;

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor, includeArchived: boolean) {
    const ids = this.access.propertyIds(actor, 'property:read');
    const rows = await this.prisma.property.findMany({
      where: {
        ...(ids === 'all' ? {} : { id: { in: ids } }),
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { name: 'asc' },
    });
    return { items: rows.map((p) => this.present(actor, p)), nextCursor: null };
  }

  async get(actor: Actor, id: string) {
    this.access.assert(actor, 'property:read', id, 'Property');
    const row = await this.prisma.property.findUnique({ where: { id } });
    if (!row) throw notFound('Property');
    return this.present(actor, row);
  }

  async create(actor: Actor, input: CreateInput) {
    this.access.assert(actor, 'property:write');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.property.create({ data: input });
      await this.audit.record(tx, actor, {
        action: 'property.create',
        entityType: 'Property',
        entityId: row.id,
        propertyId: row.id,
        after: input,
      });
      return this.present(actor, row);
    });
  }

  async update(actor: Actor, id: string, input: UpdateInput) {
    this.access.assert(actor, 'property:write', id, 'Property');
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.property.findUnique({ where: { id } });
      if (!before) throw notFound('Property');
      const row = await tx.property.update({ where: { id }, data: input });
      await this.audit.recordUpdate(
        tx,
        actor,
        { action: 'property.update', entityType: 'Property', entityId: id, propertyId: id },
        before,
        input,
      );
      return this.present(actor, row);
    });
  }

  async archive(actor: Actor, id: string) {
    this.access.assert(actor, 'property:write', id, 'Property');
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.property.findUnique({ where: { id } });
      if (!before) throw notFound('Property');
      if (before.archivedAt) return this.present(actor, before);
      const row = await tx.property.update({ where: { id }, data: { archivedAt: new Date() } });
      await this.audit.record(tx, actor, {
        action: 'property.archive',
        entityType: 'Property',
        entityId: id,
        propertyId: id,
        after: { archivedAt: row.archivedAt },
      });
      return this.present(actor, row);
    });
  }

  /** Role-dependent fields are omitted entirely (not nulled) when the caller may not see them. */
  private present(actor: Actor, p: Property) {
    return {
      id: p.id,
      name: p.name,
      addressLine1: p.addressLine1,
      addressLine2: p.addressLine2,
      city: p.city,
      province: p.province,
      postalCode: p.postalCode,
      country: p.country,
      timeZone: p.timeZone,
      checkInTime: p.checkInTime,
      checkOutTime: p.checkOutTime,
      provincialRegistrationNumber: p.provincialRegistrationNumber,
      businessLicenceNumber: p.businessLicenceNumber,
      archivedAt: p.archivedAt,
      ...(this.access.can(actor, 'property:readAccessInstructions', p.id)
        ? { accessInstructions: p.accessInstructions }
        : {}),
      ...(this.access.can(actor, 'property:readCleanerPay', p.id)
        ? { defaultCleanerPayCents: p.defaultCleanerPayCents }
        : {}),
    };
  }
}
