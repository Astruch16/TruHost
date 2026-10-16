import { Injectable } from '@nestjs/common';
import {
  AIRCOVER_CLAIM_DAYS,
  MAX_DAMAGE_PHOTOS,
  roomDisplayNames,
  type AddDamagePhoto,
  type SetDamageStatus,
  type UpdateDamageReport,
} from '@truhost/shared';
import type { createDamageReport, damageReportQuery } from '@truhost/shared';
import type { z } from 'zod';
import { AccessService } from '../access/access.service.js';
import type { Actor } from '../auth/actor.js';
import { AuditService } from '../audit/audit.service.js';
import { addIsoDays, fromIsoDate, toIsoDate, todayIn } from '../common/dates.js';
import { conflict, notFound, unprocessable } from '../common/problem.js';
import { FilesService } from '../files/files.service.js';
import type { DamageStatus, Prisma } from '../generated/prisma/client.js';
import { NotificationsService, type PendingEmail } from '../notifications/notifications.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

type CreateInput = z.output<typeof createDamageReport>;
type ListQuery = z.output<typeof damageReportQuery>;

const FILE = { select: { objectKey: true, contentType: true } } as const;
const BASE = {
  property: { select: { id: true, name: true, timeZone: true } },
  booking: { select: { id: true, guestName: true, checkInDate: true, checkOutDate: true, channel: true } },
  room: { select: { id: true, type: true, label: true, number: true } },
  reportedBy: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { photos: true } },
} satisfies Prisma.DamageReportInclude;
/** Lists: the first photo's thumbnail. */
const LIST = {
  ...BASE,
  photos: { orderBy: { createdAt: 'asc' }, take: 1, include: { file: FILE, thumbFile: FILE } },
} satisfies Prisma.DamageReportInclude;
/** One report: every photo, oldest first, with who added it. */
const DETAIL = {
  ...BASE,
  photos: {
    orderBy: { createdAt: 'asc' },
    include: { file: FILE, thumbFile: FILE, uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
  },
} satisfies Prisma.DamageReportInclude;

type ListRow = Prisma.DamageReportGetPayload<{ include: typeof LIST }>;
type DetailRow = Prisma.DamageReportGetPayload<{ include: typeof DETAIL }>;
type Visible = { propertyId: string; status: DamageStatus; reportedById: string };

/** How far back (from the day it was found) a stay can be blamed. */
const STAY_LOOKBACK_DAYS = 30;

/**
 * Damage reports: what was found at a property, when, where and after which stay, with photos as evidence, for a
 * claim with the channel (e.g. Airbnb's AirCover). A report is written as a DRAFT (its reporter and admins see it),
 * then sent with at least one photo, which locks the details and tells the admins and the property's owners. Admins
 * then move it on: acknowledged, claim filed, resolved (forward only). Photos can be added until it's resolved and
 * are never changed or removed. The database backs every rule (damage_report_guard, damage_photo_immutable).
 */
@Injectable()
export class DamageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly files: FilesService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Admins: reports across properties (or one), open ones first. */
  async listAll(actor: Actor, query: ListQuery) {
    this.access.assert(actor, 'damage:manage');
    const rows = await this.prisma.damageReport.findMany({
      where: {
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(query.status === 'OPEN'
          ? { status: { not: 'RESOLVED' } }
          : query.status === 'RESOLVED'
            ? { status: 'RESOLVED' }
            : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      include: LIST,
    });
    return { items: await this.toReports(actor, rows) };
  }

  /** A property's reports the caller may see (owners: sent ones; cleaners: sent ones and their own drafts). */
  async listForProperty(actor: Actor, propertyId: string) {
    this.access.assert(actor, 'damage:read', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    const rows = await this.prisma.damageReport.findMany({
      where: { propertyId, ...this.visibleWhere(actor, propertyId) },
      orderBy: [{ createdAt: 'desc' }],
      include: LIST,
    });
    return { items: await this.toReports(actor, rows) };
  }

  /**
   * The owner portal: sent reports at `propertyIds` (the caller's owned properties, decided by OwnerService), newest
   * first, shaped as any owner sees them (no guest names, nothing to act on), even for an admin who owns the property.
   */
  async listForOwner(actor: Actor, propertyIds: string[]) {
    const rows = await this.prisma.damageReport.findMany({
      where: { propertyId: { in: propertyIds }, status: { not: 'DRAFT' } },
      orderBy: [{ discoveredOn: 'desc' }, { createdAt: 'desc' }],
      include: LIST,
    });
    return { items: await this.toReports(actor, rows, true) };
  }

  /** One sent report at a property the caller owns, as an owner sees it (with photos); anything else is 404. */
  async getForOwner(actor: Actor, id: string) {
    const row = await this.prisma.damageReport.findUnique({ where: { id }, include: DETAIL });
    if (!row || row.status === 'DRAFT' || !this.access.can(actor, 'owner:portal', row.propertyId)) {
      throw notFound('Damage report');
    }
    return this.toDetail(actor, row, true);
  }

  async get(actor: Actor, id: string) {
    const row = await this.prisma.damageReport.findUnique({ where: { id }, include: DETAIL });
    if (!row || !this.visible(actor, row)) throw notFound('Damage report');
    return this.toDetail(actor, row);
  }

  /** A new report, as a DRAFT. */
  async create(actor: Actor, propertyId: string, input: CreateInput) {
    this.access.assert(actor, 'damage:report', propertyId, 'Property');
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw notFound('Property');
    await this.checkDetails(this.prisma, property, input);
    const row = await this.prisma.damageReport.create({
      data: {
        propertyId,
        reportedById: actor.userId,
        title: input.title,
        description: input.description,
        severity: input.severity,
        discoveredOn: fromIsoDate(input.discoveredOn),
        bookingId: input.bookingId,
        roomId: input.roomId,
        estimatedCostCents: input.estimatedCostCents,
      },
      include: DETAIL,
    });
    return this.toDetail(actor, row);
  }

  /** A draft's details (its reporter or an admin). Once sent, they're locked. */
  async update(actor: Actor, id: string, input: UpdateDamageReport) {
    const report = await this.findActionable(actor, id);
    if (report.status !== 'DRAFT') throw this.locked();
    const property = await this.prisma.property.findUniqueOrThrow({ where: { id: report.propertyId } });
    await this.checkDetails(this.prisma, property, input);
    // Conditional: a report sent meanwhile isn't changed.
    const { count } = await this.prisma.damageReport.updateMany({
      where: { id, status: 'DRAFT' },
      data: {
        title: input.title,
        description: input.description,
        severity: input.severity,
        discoveredOn: input.discoveredOn === undefined ? undefined : fromIsoDate(input.discoveredOn),
        bookingId: input.bookingId,
        roomId: input.roomId,
        estimatedCostCents: input.estimatedCostCents,
      },
    });
    if (count === 0) throw this.locked();
    return this.get(actor, id);
  }

  /** Attaches an uploaded photo (both renditions). Until the report is resolved; photos are never removed. */
  async addPhoto(actor: Actor, id: string, input: AddDamagePhoto) {
    const report = await this.findActionable(actor, id);
    if (report.status === 'RESOLVED') {
      throw conflict('DAMAGE_REPORT_CLOSED', 'This report is resolved, so photos can’t be added any more.');
    }
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const count = await tx.damagePhoto.count({ where: { damageReportId: id } });
      if (count >= MAX_DAMAGE_PHOTOS) {
        throw unprocessable('TOO_MANY_DAMAGE_PHOTOS', `A report can hold at most ${MAX_DAMAGE_PHOTOS} photos.`);
      }
      const expect = { propertyId: report.propertyId, purpose: 'DAMAGE_PHOTO' as const };
      await this.files.verifyForAttach(tx, actor, input.fileId, expect);
      await this.files.verifyForAttach(tx, actor, input.thumbFileId, expect);
      const photo = await tx.damagePhoto.create({
        data: {
          damageReportId: id,
          fileId: input.fileId,
          thumbFileId: input.thumbFileId,
          uploadedById: actor.userId,
        },
      });
      if (report.status !== 'DRAFT') {
        // Evidence added to a sent report.
        await this.audit.record(tx, actor, {
          action: 'damage.photo.add',
          entityType: 'DamageReport',
          entityId: id,
          propertyId: report.propertyId,
          after: { photoId: photo.id, fileId: input.fileId },
        });
      }
    });
    return this.get(actor, id);
  }

  /** Sends a draft: it needs a photo. Locks the details and tells the admins and the property's owners. */
  async submit(actor: Actor, id: string) {
    const report = await this.findActionable(actor, id);
    let emails: PendingEmail[] = [];
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const current = await tx.damageReport.findUniqueOrThrow({
        where: { id },
        include: { ...BASE, property: { select: { id: true, name: true } } },
      });
      if (current.status !== 'DRAFT') {
        throw conflict('DAMAGE_REPORT_ALREADY_SENT', 'This report has already been sent.');
      }
      if (current._count.photos === 0) {
        throw unprocessable('DAMAGE_REPORT_NO_PHOTOS', 'Add at least one photo of the damage before sending.');
      }
      const now = new Date();
      await tx.damageReport.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: now } });
      await this.audit.record(tx, actor, {
        action: 'damage.submit',
        entityType: 'DamageReport',
        entityId: id,
        propertyId: report.propertyId,
        after: { status: 'SUBMITTED', photos: current._count.photos },
      });
      emails = await this.notifications.damageReported(tx, {
        property: current.property,
        report: {
          id,
          title: current.title,
          severity: current.severity,
          discoveredOn: toIsoDate(current.discoveredOn),
          photoCount: current._count.photos,
        },
        reporter: current.reportedBy,
      });
    });
    await this.notifications.sendAfterCommit(emails);
    return this.get(actor, id);
  }

  /** Admins move a sent report on (never back), with the claim's reference, a resolution note or the cost. */
  async setStatus(actor: Actor, id: string, input: SetDamageStatus) {
    const found = await this.prisma.damageReport.findUnique({ where: { id } });
    if (!found || !this.access.can(actor, 'damage:manage', found.propertyId)) throw notFound('Damage report');
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const before = await tx.damageReport.findUniqueOrThrow({ where: { id } });
      if (before.status === 'DRAFT') {
        throw conflict('DAMAGE_REPORT_NOT_SENT', 'This report is still a draft: send it first.');
      }
      const order = ['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'CLAIM_FILED', 'RESOLVED'] as const;
      const from = order.indexOf(before.status);
      const to = order.indexOf(input.status);
      if (to < from) throw conflict('DAMAGE_STATUS_BACKWARDS', 'A report’s status only moves forward.');
      const now = new Date();
      const data = {
        status: input.status,
        // Each stage reached gets its time (skipping ahead fills the ones passed over).
        acknowledgedAt: to >= order.indexOf('ACKNOWLEDGED') ? (before.acknowledgedAt ?? now) : before.acknowledgedAt,
        claimFiledAt: to >= order.indexOf('CLAIM_FILED') ? (before.claimFiledAt ?? now) : before.claimFiledAt,
        resolvedAt: to >= order.indexOf('RESOLVED') ? (before.resolvedAt ?? now) : before.resolvedAt,
        claimReference: input.claimReference === undefined ? before.claimReference : input.claimReference,
        resolutionNote: input.resolutionNote === undefined ? before.resolutionNote : input.resolutionNote,
        estimatedCostCents:
          input.estimatedCostCents === undefined ? before.estimatedCostCents : input.estimatedCostCents,
      };
      const after = await tx.damageReport.update({ where: { id }, data });
      await this.audit.recordUpdate(
        tx,
        actor,
        { action: 'damage.status', entityType: 'DamageReport', entityId: id, propertyId: before.propertyId },
        pick(before),
        pick(after),
      );
    });
    return this.get(actor, id);
  }

  /** Stays a report could blame: guest stays under way on the day, or that ended up to 30 days before. */
  async stays(actor: Actor, propertyId: string, on: string) {
    this.access.assert(actor, 'damage:report', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    const day = fromIsoDate(on);
    const rows = await this.prisma.booking.findMany({
      where: {
        propertyId,
        kind: 'GUEST',
        status: 'CONFIRMED',
        checkInDate: { lte: day },
        checkOutDate: { gte: fromIsoDate(addIsoDays(on, -STAY_LOOKBACK_DAYS)) },
      },
      orderBy: [{ checkOutDate: 'desc' }],
      take: 10,
      select: { id: true, guestName: true, checkInDate: true, checkOutDate: true, channel: true },
    });
    return { items: rows.map((b) => this.toStay(b)) };
  }

  // ── helpers ──

  /** A report the caller may act on (its reporter, while they may still report at the property, or an admin). */
  private async findActionable(actor: Actor, id: string) {
    const report = await this.prisma.damageReport.findUnique({ where: { id } });
    if (!report || !this.visible(actor, report) || !this.actionable(actor, report)) throw notFound('Damage report');
    return report;
  }

  private visible(actor: Actor, r: Visible): boolean {
    if (this.access.can(actor, 'damage:manage', r.propertyId)) return true;
    if (!this.access.can(actor, 'damage:read', r.propertyId)) return false;
    return r.status !== 'DRAFT' || r.reportedById === actor.userId;
  }

  private actionable(actor: Actor, r: Visible): boolean {
    if (this.access.can(actor, 'damage:manage', r.propertyId)) return true;
    return r.reportedById === actor.userId && this.access.can(actor, 'damage:report', r.propertyId);
  }

  private visibleWhere(actor: Actor, propertyId: string): Prisma.DamageReportWhereInput {
    if (this.access.can(actor, 'damage:manage', propertyId)) return {};
    return { OR: [{ status: { not: 'DRAFT' } }, { reportedById: actor.userId }] };
  }

  /** The stay and room must be at the property (the database checks too), the room active, the day not ahead. */
  private async checkDetails(
    db: PrismaService | Tx,
    property: { id: string; timeZone: string },
    input: Partial<Pick<CreateInput, 'bookingId' | 'roomId' | 'discoveredOn'>>,
  ) {
    if (input.discoveredOn && input.discoveredOn > todayIn(property.timeZone)) {
      throw unprocessable('DAMAGE_DATE_AHEAD', 'The day it was found can’t be in the future.');
    }
    if (input.bookingId && !(await db.booking.count({ where: { id: input.bookingId, propertyId: property.id } }))) {
      throw unprocessable('UNKNOWN_BOOKING', 'That stay isn’t at this property.');
    }
    if (
      input.roomId &&
      !(await db.room.count({ where: { id: input.roomId, propertyId: property.id, archivedAt: null } }))
    ) {
      throw unprocessable('UNKNOWN_ROOM', 'That room isn’t at this property.');
    }
  }

  private async lock(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT 1 FROM "DamageReport" WHERE id = ${id}::uuid FOR UPDATE`;
  }

  private locked() {
    return conflict('DAMAGE_REPORT_LOCKED', 'This report has been sent, so its details can’t change.');
  }

  private async assertPropertyExists(id: string) {
    if (!(await this.prisma.property.count({ where: { id } }))) throw notFound('Property');
  }

  private toStay(b: { id: string; guestName: string | null; checkInDate: Date; checkOutDate: Date; channel: string }) {
    return {
      id: b.id,
      guestName: b.guestName,
      checkInDate: toIsoDate(b.checkInDate),
      checkOutDate: toIsoDate(b.checkOutDate),
      channel: b.channel as 'AIRBNB',
    };
  }

  /** Room names as the property shows them (numbered among its active rooms). */
  private async roomNames(propertyIds: string[]) {
    if (propertyIds.length === 0) return new Map<string, string>();
    const rooms = await this.prisma.room.findMany({ where: { propertyId: { in: propertyIds } } });
    const names = new Map<string, string>();
    for (const id of new Set(propertyIds)) {
      const active = rooms.filter((r) => r.propertyId === id && !r.archivedAt);
      for (const [roomId, name] of roomDisplayNames(active)) names.set(roomId, name);
    }
    for (const r of rooms) if (!names.has(r.id)) names.set(r.id, roomDisplayNames([r]).get(r.id)!);
    return names;
  }

  private async toReports(actor: Actor, rows: ListRow[], ownerView = false) {
    const names = await this.roomNames(rows.map((r) => r.propertyId));
    return Promise.all(
      rows.map(async (r) => {
        const first = r.photos[0];
        const cover = first ? await this.files.photoLinks(first) : null;
        return this.shape(actor, r, names, cover?.thumbUrl ?? null, ownerView);
      }),
    );
  }

  private async toDetail(actor: Actor, row: DetailRow, ownerView = false) {
    const names = await this.roomNames([row.propertyId]);
    const photos = await Promise.all(
      row.photos.map(async (p) => ({
        ...(await this.files.photoLinks(p)),
        uploadedBy: p.uploadedBy,
        createdAt: p.createdAt,
      })),
    );
    return { ...this.shape(actor, row, names, photos[0]?.thumbUrl ?? null, ownerView), photos };
  }

  /** `ownerView`: as any owner sees it, whatever else the caller may be (the owner portal). */
  private shape(
    actor: Actor,
    r: ListRow | DetailRow,
    roomNames: Map<string, string>,
    coverThumbUrl: string | null,
    ownerView = false,
  ) {
    const manage = !ownerView && this.access.can(actor, 'damage:manage', r.propertyId);
    const act = !ownerView && this.actionable(actor, r);
    // Guest names are for TruHost and the reporter's side (cleaners), as on bookings; owners see the dates only.
    const seesGuest =
      !ownerView &&
      (this.access.can(actor, 'booking:readAdminFields', r.propertyId) ||
        this.access.can(actor, 'damage:report', r.propertyId));
    const stay = r.booking ? this.toStay(r.booking) : null;
    return {
      id: r.id,
      property: { id: r.property.id, name: r.property.name },
      title: r.title,
      description: r.description,
      severity: r.severity,
      status: r.status,
      discoveredOn: toIsoDate(r.discoveredOn),
      estimatedCostCents: r.estimatedCostCents,
      claimReference: r.claimReference,
      resolutionNote: r.resolutionNote,
      booking: stay && { ...stay, guestName: seesGuest ? stay.guestName : null },
      room: r.room ? { id: r.room.id, displayName: roomNames.get(r.room.id) ?? '' } : null,
      reportedBy: r.reportedBy,
      submittedAt: r.submittedAt,
      acknowledgedAt: r.acknowledgedAt,
      claimFiledAt: r.claimFiledAt,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
      photoCount: r._count.photos,
      coverThumbUrl,
      claimDeadline: stay && stay.channel === 'AIRBNB' ? addIsoDays(stay.checkOutDate, AIRCOVER_CLAIM_DAYS) : null,
      can: {
        edit: act && r.status === 'DRAFT',
        addPhotos: act && r.status !== 'RESOLVED',
        submit: act && r.status === 'DRAFT',
        manage,
      },
    };
  }
}

/** The fields an admin's status change can touch, for the audit diff. */
function pick(r: {
  status: DamageStatus;
  claimReference: string | null;
  resolutionNote: string | null;
  estimatedCostCents: number | null;
}) {
  return {
    status: r.status,
    claimReference: r.claimReference,
    resolutionNote: r.resolutionNote,
    estimatedCostCents: r.estimatedCostCents,
  };
}
