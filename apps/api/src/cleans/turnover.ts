import type { Tx } from '../prisma/prisma.service.js';

/**
 * Keeps a stay's turnover clean in step with the stay, inside the booking's own transaction (docs/spec.md: "Bookings
 * produce cleans"). Guest and owner stays get one clean on their check-out day, for the property's default cleaner at
 * its default pay. Moving the stay moves a clean that hasn't started; cancelling it (or making it a block) cancels
 * one; restoring it brings the clean back. A clean under way or done is left alone: the work happened, and an admin
 * decides what follows.
 */
export async function syncTurnover(tx: Tx, bookingId: string): Promise<void> {
  const stay = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { id: true, propertyId: true, kind: true, status: true, checkOutDate: true },
  });
  const wanted = stay.status === 'CONFIRMED' && stay.kind !== 'BLOCK';
  const clean = await tx.clean.findUnique({ where: { bookingId } });

  if (!clean) {
    if (!wanted) return;
    const property = await tx.property.findUniqueOrThrow({
      where: { id: stay.propertyId },
      select: { defaultCleanerId: true, defaultCleanerPayCents: true },
    });
    await tx.clean.create({
      data: {
        propertyId: stay.propertyId,
        kind: 'TURNOVER',
        bookingId,
        scheduledDate: stay.checkOutDate,
        assignedCleanerId: property.defaultCleanerId,
        cleanerPayCents: property.defaultCleanerPayCents,
      },
    });
    return;
  }

  if (wanted) {
    if (clean.status === 'CANCELLED') {
      await tx.clean.update({
        where: { id: clean.id },
        data: {
          status: 'SCHEDULED',
          scheduledDate: stay.checkOutDate,
          cancelledAt: null,
          cancelReason: null,
          version: { increment: 1 },
        },
      });
    } else if (clean.status === 'SCHEDULED' && clean.scheduledDate.getTime() !== stay.checkOutDate.getTime()) {
      await tx.clean.update({
        where: { id: clean.id },
        data: { scheduledDate: stay.checkOutDate, version: { increment: 1 } },
      });
    }
    return;
  }

  if (clean.status === 'SCHEDULED') {
    await tx.clean.update({
      where: { id: clean.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: stay.status === 'CANCELLED' ? 'The stay was cancelled.' : 'The stay became blocked dates.',
        version: { increment: 1 },
      },
    });
  }
}
