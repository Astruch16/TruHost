import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import type { createProperty, SetCoverPhoto, updateProperty } from '@truhost/shared';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../auth/actor.js';
import { notFound, ProblemException, unprocessable } from '../common/problem.js';
import { FilesService } from '../files/files.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type CreateInput = z.output<typeof createProperty>;
type UpdateInput = z.output<typeof updateProperty>;

/** Loads the cover photo's two files with every property we return. */
const file = { select: { objectKey: true, contentType: true } } as const;
export const withCoverPhoto = {
  coverPhoto: { select: { id: true, file, thumbFile: file } },
} satisfies Prisma.PropertyInclude;
type PropertyRow = Prisma.PropertyGetPayload<{ include: typeof withCoverPhoto }>;

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly files: FilesService,
  ) {}

  async list(actor: Actor, includeArchived: boolean) {
    const ids = this.access.propertyIds(actor, 'property:read');
    const rows = await this.prisma.property.findMany({
      where: {
        ...(ids === 'all' ? {} : { id: { in: ids } }),
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { name: 'asc' },
      include: withCoverPhoto,
    });
    return { items: await Promise.all(rows.map((p) => this.present(actor, p))), nextCursor: null };
  }

  async get(actor: Actor, id: string) {
    this.access.assert(actor, 'property:read', id, 'Property');
    const row = await this.prisma.property.findUnique({ where: { id }, include: withCoverPhoto });
    if (!row) throw notFound('Property');
    return this.present(actor, row);
  }

  async create(actor: Actor, input: CreateInput) {
    this.access.assert(actor, 'property:write');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.property.create({ data: input, include: withCoverPhoto });
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
      // Lock the row so a concurrent membership revoke can't leave a stale default cleaner.
      await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${id}::uuid FOR UPDATE`;
      const before = await tx.property.findUnique({ where: { id } });
      if (!before) throw notFound('Property');
      if (input.defaultCleanerId) {
        const cleaner = await tx.membership.findFirst({
          where: {
            propertyId: id,
            userId: input.defaultCleanerId,
            role: 'CLEANER',
            revokedAt: null,
            user: { status: { not: 'DEACTIVATED' } },
          },
        });
        if (!cleaner) {
          throw unprocessable(
            'DEFAULT_CLEANER_NOT_MEMBER',
            'The default cleaner must be an active cleaner of this property',
          );
        }
      }
      const row = await tx.property.update({ where: { id }, data: input, include: withCoverPhoto });
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
      if (before.archivedAt)
        return this.present(actor, await tx.property.findUniqueOrThrow({ where: { id }, include: withCoverPhoto }));
      const row = await tx.property.update({
        where: { id },
        data: { archivedAt: new Date() },
        include: withCoverPhoto,
      });
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

  /** What stands in the way of deleting a property: its financial records (any, even cancelled or voided). */
  async deletion(actor: Actor, id: string) {
    this.access.assert(actor, 'property:write', id, 'Property');
    if (!(await this.prisma.property.count({ where: { id } }))) throw notFound('Property');
    return this.blockers(this.prisma, id);
  }

  /**
   * Deletes a property that has no financial records, with everything that belongs to it: rooms, memberships,
   * plan history, photos and their stored files. A property with bookings, expenses or receipts can't be deleted
   * (it is archived instead, so the records are kept). The audit log keeps a record of the deletion.
   */
  async delete(actor: Actor, id: string) {
    this.access.assert(actor, 'property:write', id, 'Property');
    const objectKeys = await this.prisma.$transaction(async (tx) => {
      // Lock the property so no booking or expense can be added to it while it is being deleted.
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Property" WHERE id = ${id}::uuid FOR UPDATE`;
      if (locked.length === 0) throw notFound('Property');
      const blockers = await this.blockers(tx, id);
      if (!blockers.allowed) {
        throw new ProblemException({
          status: 409,
          code: 'PROPERTY_HAS_RECORDS',
          detail:
            'This property has bookings, expenses or receipts, which must be kept. Archive it instead to hide it everywhere.',
        });
      }
      const before = await tx.property.findUniqueOrThrow({ where: { id } });
      const files = await tx.storedFile.findMany({ where: { propertyId: id }, select: { objectKey: true } });

      // Photos and their files are protected rows; the guards let this transaction remove this property's only.
      await tx.$executeRaw`SELECT set_config('truhost.deleting_property', ${id}, true)`;
      await tx.property.update({ where: { id }, data: { coverPhotoId: null, defaultCleanerId: null } });
      await tx.propertyPhoto.deleteMany({ where: { propertyId: id } });
      await tx.storedFile.deleteMany({ where: { propertyId: id } });
      await tx.room.deleteMany({ where: { propertyId: id } });
      await tx.membership.deleteMany({ where: { propertyId: id } });
      await tx.propertyPlan.deleteMany({ where: { propertyId: id } });
      await tx.property.delete({ where: { id } });

      await this.audit.record(tx, actor, {
        action: 'property.delete',
        entityType: 'Property',
        entityId: id,
        propertyId: id,
        before: {
          name: before.name,
          addressLine1: before.addressLine1,
          city: before.city,
          postalCode: before.postalCode,
          files: files.length,
        },
        after: null,
      });
      return files.map((f) => f.objectKey);
    });
    // Rows first, then storage: if removing a file fails, nothing points at it any more.
    await this.files.deleteObjects(objectKeys);
  }

  private async blockers(db: Pick<PrismaService, 'booking' | 'expense' | 'receipt'>, id: string) {
    const [bookings, expenses, receipts] = await Promise.all([
      db.booking.count({ where: { propertyId: id } }),
      db.expense.count({ where: { propertyId: id } }),
      db.receipt.count({ where: { propertyId: id } }),
    ]);
    return { allowed: bookings + expenses + receipts === 0, bookings, expenses, receipts };
  }

  /**
   * Makes two fresh uploads (large and card renditions) the property's cover. The previous photo stays as history;
   * both files are verified against storage in the same transaction.
   */
  async setCoverPhoto(actor: Actor, id: string, input: SetCoverPhoto) {
    this.access.assert(actor, 'property:write', id, 'Property');
    if (input.fileId === input.thumbFileId) {
      throw unprocessable('SAME_FILE', 'The large and card versions must be separate uploads');
    }
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.property.findUnique({ where: { id }, select: { coverPhotoId: true } });
      if (!before) throw notFound('Property');
      const expect = { propertyId: id, purpose: 'PROPERTY_PHOTO' } as const;
      await this.files.verifyForAttach(tx, actor, input.fileId, expect);
      await this.files.verifyForAttach(tx, actor, input.thumbFileId, expect);
      const photo = await tx.propertyPhoto.create({
        data: { propertyId: id, fileId: input.fileId, thumbFileId: input.thumbFileId, uploadedById: actor.userId },
      });
      const row = await tx.property.update({
        where: { id },
        data: { coverPhotoId: photo.id },
        include: withCoverPhoto,
      });
      await this.audit.record(tx, actor, {
        action: 'property.coverPhoto.set',
        entityType: 'Property',
        entityId: id,
        propertyId: id,
        before: { coverPhotoId: before.coverPhotoId },
        after: { coverPhotoId: photo.id, fileId: input.fileId, thumbFileId: input.thumbFileId },
      });
      return this.present(actor, row);
    });
  }

  /** Removes the cover. The photo itself is kept as history. */
  async removeCoverPhoto(actor: Actor, id: string) {
    this.access.assert(actor, 'property:write', id, 'Property');
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.property.findUnique({ where: { id }, select: { coverPhotoId: true } });
      if (!before) throw notFound('Property');
      const row = await tx.property.update({ where: { id }, data: { coverPhotoId: null }, include: withCoverPhoto });
      if (before.coverPhotoId) {
        await this.audit.record(tx, actor, {
          action: 'property.coverPhoto.remove',
          entityType: 'Property',
          entityId: id,
          propertyId: id,
          before: { coverPhotoId: before.coverPhotoId },
          after: { coverPhotoId: null },
        });
      }
      return this.present(actor, row);
    });
  }

  /** Role-dependent fields are omitted entirely (not nulled) when the caller may not see them. */
  private async present(actor: Actor, p: PropertyRow) {
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
      description: p.description,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      halfBathrooms: p.halfBathrooms,
      maxGuests: p.maxGuests,
      airbnbUrl: p.airbnbUrl,
      vrboUrl: p.vrboUrl,
      bookingComUrl: p.bookingComUrl,
      archivedAt: p.archivedAt,
      coverPhoto: p.coverPhoto ? await this.files.photoLinks(p.coverPhoto) : null,
      ...(this.access.can(actor, 'property:readAdminFields', p.id)
        ? {
            defaultCleanerId: p.defaultCleanerId,
            defaultCleanerPayCents: p.defaultCleanerPayCents,
            standardCleaningFeeCents: p.standardCleaningFeeCents,
          }
        : {}),
    };
  }
}
