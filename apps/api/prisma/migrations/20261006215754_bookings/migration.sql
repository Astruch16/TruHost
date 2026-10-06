-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('MANUAL', 'ICAL', 'PMS');

-- CreateEnum
CREATE TYPE "BookingChannel" AS ENUM ('AIRBNB', 'VRBO', 'BOOKING_COM', 'DIRECT', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingKind" AS ENUM ('GUEST', 'OWNER_STAY', 'BLOCK');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "source" "BookingSource" NOT NULL,
    "channel" "BookingChannel" NOT NULL,
    "kind" "BookingKind" NOT NULL DEFAULT 'GUEST',
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "externalId" TEXT,
    "checkInDate" DATE NOT NULL,
    "checkOutDate" DATE NOT NULL,
    "checkInTimeOverride" TEXT,
    "checkOutTimeOverride" TEXT,
    "guestName" TEXT,
    "guestCount" INTEGER,
    "payoutCents" INTEGER,
    "guestCleaningFeeCents" INTEGER,
    "taxesCollectedCents" INTEGER,
    "cancelledAt" TIMESTAMPTZ,
    "cancellationNote" TEXT,
    "notes" TEXT,
    "enteredById" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_propertyId_checkInDate_idx" ON "Booking"("propertyId", "checkInDate");

-- CreateIndex
CREATE INDEX "Booking_propertyId_checkOutDate_idx" ON "Booking"("propertyId", "checkOutDate");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_propertyId_source_externalId_key" ON "Booking"("propertyId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────── Hand-written (docs/spec.md "Booking overlap rules") ─────────────

ALTER TABLE "Booking" ADD CONSTRAINT booking_dates_order CHECK ("checkOutDate" > "checkInDate");
ALTER TABLE "Booking" ADD CONSTRAINT booking_money_nonnegative CHECK (
  ("payoutCents" IS NULL OR "payoutCents" >= 0)
  AND ("guestCleaningFeeCents" IS NULL OR "guestCleaningFeeCents" >= 0)
  AND ("taxesCollectedCents" IS NULL OR "taxesCollectedCents" >= 0)
);
-- Owner gross (payout − cleaning fee) can never go negative.
ALTER TABLE "Booking" ADD CONSTRAINT booking_fee_within_payout CHECK (
  "payoutCents" IS NULL OR "guestCleaningFeeCents" IS NULL OR "guestCleaningFeeCents" <= "payoutCents"
);
-- Only guest stays carry money.
ALTER TABLE "Booking" ADD CONSTRAINT booking_money_guest_only CHECK (
  kind = 'GUEST' OR ("payoutCents" IS NULL AND "guestCleaningFeeCents" IS NULL AND "taxesCollectedCents" IS NULL)
);
ALTER TABLE "Booking" ADD CONSTRAINT booking_times_hhmm CHECK (
  ("checkInTimeOverride" IS NULL OR "checkInTimeOverride" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  AND ("checkOutTimeOverride" IS NULL OR "checkOutTimeOverride" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
ALTER TABLE "Booking" ADD CONSTRAINT booking_guest_count_positive CHECK ("guestCount" IS NULL OR "guestCount" > 0);
ALTER TABLE "Booking" ADD CONSTRAINT booking_cancel_consistent CHECK (
  (status = 'CANCELLED') = ("cancelledAt" IS NOT NULL)
);

-- No two CONFIRMED bookings on a property may share a night. Half-open '[)' ranges allow same-day turnover;
-- cancelled bookings are ignored. All kinds take part (a guest can't overlap an owner stay or a block).
ALTER TABLE "Booking" ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "propertyId" WITH =,
    daterange("checkInDate", "checkOutDate", '[)') WITH &&
  ) WHERE (status = 'CONFIRMED');
