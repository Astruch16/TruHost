import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { bookingIssues, type AllBookingsQuery, type BookingRangeQuery, type UpdateBooking } from '@truhost/shared';
import type { createBooking } from '@truhost/shared';
import type { z } from 'zod';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../auth/actor.js';
import { fromIsoDate, toIsoDate } from '../common/dates.js';
import { PG, pgErrorCode } from '../common/pg-errors.js';
import { conflict, notFound, ProblemException } from '../common/problem.js';
import { ENV, type Env } from '../config/env.js';
import type { Booking } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { isComplete, nightsBetween, ownerGrossCents } from '../reporting/booking-money.js';

type CreateInput = z.output<typeof createBooking>;

/** Fields an admin may write; everything else (source, status, version…) is managed by the service. */
const WRITABLE = [
  'channel',
  'kind',
  'checkInDate',
  'checkOutDate',
  'externalId',
  'checkInTimeOverride',
  'checkOutTimeOverride',
  'guestName',
  'guestCount',
  'payoutCents',
  'guestCleaningFeeCents',
  'taxesCollectedCents',
  'notes',
] as const;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Cross-property list for admins. */
  async listAll(actor: Actor, q: AllBookingsQuery) {
    this.access.assert(actor, 'booking:write');
    const rows = await this.prisma.booking.findMany({
      where: { ...this.rangeWhere(q), ...(q.propertyId ? { propertyId: q.propertyId } : {}) },
      orderBy: [{ checkInDate: 'asc' }, { id: 'asc' }],
    });
    return { items: rows.map((b) => this.present(actor, b)) };
  }

  async listForProperty(actor: Actor, propertyId: string, q: BookingRangeQuery) {
    this.access.assert(actor, 'booking:read', propertyId, 'Property');
    await this.assertPropertyExists(propertyId);
    const rows = await this.prisma.booking.findMany({
      where: { propertyId, ...this.rangeWhere(q) },
      orderBy: [{ checkInDate: 'asc' }, { id: 'asc' }],
    });
    return { items: rows.map((b) => this.present(actor, b)) };
  }

  async get(actor: Actor, id: string) {
    const row = await this.prisma.booking.findUnique({ where: { id } });
    if (!row || !this.access.can(actor, 'booking:read', row.propertyId)) throw notFound('Booking');
    return this.present(actor, row);
  }

  async create(actor: Actor, propertyId: string, input: CreateInput) {
    this.access.assert(actor, 'booking:write', propertyId, 'Property');
    this.assertTaxFields(input);
    return this.write(async (tx) => {
      await this.lockProperty(tx, propertyId);
      const data = {
        ...input,
        checkInDate: fromIsoDate(input.checkInDate),
        checkOutDate: fromIsoDate(input.checkOutDate),
      };
      await this.assertNoOverlap(tx, propertyId, data.checkInDate, data.checkOutDate);
      const row = await tx.booking.create({
        data: { ...data, propertyId, source: 'MANUAL', enteredById: actor.userId },
      });
      await this.audit.record(tx, actor, {
        action: 'booking.create',
        entityType: 'Booking',
        entityId: row.id,
        propertyId,
        after: auditView(row),
      });
      return this.present(actor, row);
    });
  }

  async update(actor: Actor, id: string, input: UpdateBooking) {
    const existing = await this.prisma.booking.findUnique({ where: { id } });
    if (!existing || !this.access.can(actor, 'booking:write', existing.propertyId)) throw notFound('Booking');
    this.assertTaxFields(input);

    return this.write(async (tx) => {
      await this.lockProperty(tx, existing.propertyId);
      const before = await tx.booking.findUniqueOrThrow({ where: { id } });
      this.assertVersion(before, input.version);

      const changes: Record<string, unknown> = {};
      for (const key of WRITABLE) if (input[key] !== undefined) changes[key] = input[key];
      if (typeof changes.checkInDate === 'string') changes.checkInDate = fromIsoDate(changes.checkInDate);
      if (typeof changes.checkOutDate === 'string') changes.checkOutDate = fromIsoDate(changes.checkOutDate);
      const merged = { ...before, ...changes } as Booking;

      const issues = bookingIssues({
        kind: merged.kind,
        checkInDate: toIsoDate(merged.checkInDate),
        checkOutDate: toIsoDate(merged.checkOutDate),
        payoutCents: merged.payoutCents,
        guestCleaningFeeCents: merged.guestCleaningFeeCents,
        taxesCollectedCents: merged.taxesCollectedCents,
      });
      if (issues.length) throw validation(issues);
      if (merged.status === 'CONFIRMED') {
        await this.assertNoOverlap(tx, merged.propertyId, merged.checkInDate, merged.checkOutDate, id);
      }

      // TODO(phase 2b): reject with 409 PERIOD_LOCKED when any night (before or after) is in a finalized month.
      const { count } = await tx.booking.updateMany({
        where: { id, version: input.version },
        data: { ...changes, version: { increment: 1 } },
      });
      if (count !== 1) throw staleVersion();
      const after = await tx.booking.findUniqueOrThrow({ where: { id } });
      await this.audit.recordUpdate(
        tx,
        actor,
        { action: 'booking.update', entityType: 'Booking', entityId: id, propertyId: after.propertyId },
        auditView(before),
        auditView(after),
      );
      return this.present(actor, after);
    });
  }

  /** Cancelling frees the dates. A payout that still arrives is entered afterwards with PATCH (decision N3). */
  async cancel(actor: Actor, id: string, input: { version: number; note: string | null }) {
    const existing = await this.prisma.booking.findUnique({ where: { id } });
    if (!existing || !this.access.can(actor, 'booking:write', existing.propertyId)) throw notFound('Booking');

    return this.write(async (tx) => {
      const before = await tx.booking.findUniqueOrThrow({ where: { id } });
      this.assertVersion(before, input.version);
      if (before.status === 'CANCELLED')
        throw conflict('BOOKING_ALREADY_CANCELLED', 'This booking is already cancelled');
      const { count } = await tx.booking.updateMany({
        where: { id, version: input.version, status: 'CONFIRMED' },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationNote: input.note,
          version: { increment: 1 },
        },
      });
      if (count !== 1) throw staleVersion();
      const after = await tx.booking.findUniqueOrThrow({ where: { id } });
      await this.audit.record(tx, actor, {
        action: 'booking.cancel',
        entityType: 'Booking',
        entityId: id,
        propertyId: after.propertyId,
        before: { status: 'CONFIRMED' },
        after: { status: 'CANCELLED', cancellationNote: input.note },
      });
      return this.present(actor, after);
    });
  }

  // ── helpers ──

  /** Bookings overlapping [from, to): they start before `to` and end after `from`. */
  private rangeWhere(q: BookingRangeQuery) {
    return {
      checkInDate: { lt: fromIsoDate(q.to) },
      checkOutDate: { gt: fromIsoDate(q.from) },
      ...(q.status ? { status: q.status } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
    };
  }

  /** Serialises booking writes per property, so the friendly overlap check below can't race. */
  private async lockProperty(tx: Tx, propertyId: string) {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Property" WHERE id = ${propertyId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw notFound('Property');
  }

  private async assertNoOverlap(tx: Tx, propertyId: string, checkIn: Date, checkOut: Date, excludeId?: string) {
    const clash = await tx.booking.findFirst({
      where: {
        propertyId,
        status: 'CONFIRMED',
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, checkInDate: true, checkOutDate: true },
    });
    if (clash) throw overlap(clash);
  }

  private assertVersion(row: Booking, version: number) {
    if (row.version !== version) throw staleVersion();
  }

  private assertTaxFields(input: { taxesCollectedCents?: number | null }) {
    if (!this.env.TAX_FIELDS_ENABLED && input.taxesCollectedCents != null) {
      throw validation([['taxesCollectedCents', 'Tax fields are disabled']]);
    }
  }

  /** Runs a write; the overlap constraint is the backstop if two writes slip past the friendly check. */
  private async write<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn);
    } catch (e) {
      if (pgErrorCode(e) === PG.exclusionViolation) throw overlap(null);
      throw e;
    }
  }

  private async assertPropertyExists(id: string) {
    if (!(await this.prisma.property.count({ where: { id } }))) throw notFound('Property');
  }

  private present(actor: Actor, b: Booking) {
    const base = {
      id: b.id,
      propertyId: b.propertyId,
      source: b.source,
      channel: b.channel,
      kind: b.kind,
      status: b.status,
      checkInDate: toIsoDate(b.checkInDate),
      checkOutDate: toIsoDate(b.checkOutDate),
      nights: nightsBetween(b.checkInDate, b.checkOutDate),
      ownerGrossCents: ownerGrossCents(b),
      complete: isComplete(b),
      cancelledAt: b.cancelledAt,
    };
    if (!this.access.can(actor, 'booking:readAdminFields', b.propertyId)) return base;
    return {
      ...base,
      externalId: b.externalId,
      checkInTimeOverride: b.checkInTimeOverride,
      checkOutTimeOverride: b.checkOutTimeOverride,
      guestName: b.guestName,
      guestCount: b.guestCount,
      payoutCents: b.payoutCents,
      guestCleaningFeeCents: b.guestCleaningFeeCents,
      taxesCollectedCents: b.taxesCollectedCents,
      cancellationNote: b.cancellationNote,
      notes: b.notes,
      version: b.version,
      createdAt: b.createdAt,
    };
  }
}

/** What the audit log keeps for a booking: dates as calendar strings, money and status. */
function auditView(b: Booking) {
  return {
    channel: b.channel,
    kind: b.kind,
    status: b.status,
    checkInDate: toIsoDate(b.checkInDate),
    checkOutDate: toIsoDate(b.checkOutDate),
    externalId: b.externalId,
    payoutCents: b.payoutCents,
    guestCleaningFeeCents: b.guestCleaningFeeCents,
    taxesCollectedCents: b.taxesCollectedCents,
    guestCount: b.guestCount,
  };
}

function overlap(clash: { id: string; checkInDate: Date; checkOutDate: Date } | null) {
  return new ProblemException({
    status: HttpStatus.CONFLICT,
    code: 'BOOKING_OVERLAP',
    detail: clash
      ? `These dates overlap another booking (${toIsoDate(clash.checkInDate)} to ${toIsoDate(clash.checkOutDate)})`
      : 'These dates overlap another booking',
    extras: clash ? { conflictingBookingId: clash.id } : undefined,
  });
}

function staleVersion() {
  return conflict('STALE_VERSION', 'This booking was changed by someone else. Reload and try again.');
}

function validation(issues: [string, string][]) {
  return new ProblemException({
    status: HttpStatus.BAD_REQUEST,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    extras: { errors: issues.map(([path, message]) => ({ path, message })) },
  });
}
