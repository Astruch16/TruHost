-- CreateEnum
CREATE TYPE "DamageSeverity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "DamageStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'CLAIM_FILED', 'RESOLVED');

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'DAMAGE_REPORTS';

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'DAMAGE_REPORTED';

-- CreateTable
CREATE TABLE "DamageReport" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "bookingId" UUID,
    "roomId" UUID,
    "reportedById" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "DamageSeverity" NOT NULL,
    "status" "DamageStatus" NOT NULL DEFAULT 'DRAFT',
    "discoveredOn" DATE NOT NULL,
    "estimatedCostCents" INTEGER,
    "claimReference" TEXT,
    "resolutionNote" TEXT,
    "submittedAt" TIMESTAMPTZ,
    "acknowledgedAt" TIMESTAMPTZ,
    "claimFiledAt" TIMESTAMPTZ,
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DamageReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DamagePhoto" (
    "id" UUID NOT NULL,
    "damageReportId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "thumbFileId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DamagePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DamageReport_propertyId_status_idx" ON "DamageReport"("propertyId", "status");

-- CreateIndex
CREATE INDEX "DamageReport_status_submittedAt_idx" ON "DamageReport"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DamagePhoto_fileId_key" ON "DamagePhoto"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "DamagePhoto_thumbFileId_key" ON "DamagePhoto"("thumbFileId");

-- CreateIndex
CREATE INDEX "DamagePhoto_damageReportId_createdAt_idx" ON "DamagePhoto"("damageReportId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_propertyId_id_key" ON "Booking"("propertyId", "id");

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_propertyId_bookingId_fkey" FOREIGN KEY ("propertyId", "bookingId") REFERENCES "Booking"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_propertyId_roomId_fkey" FOREIGN KEY ("propertyId", "roomId") REFERENCES "Room"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamagePhoto" ADD CONSTRAINT "DamagePhoto_damageReportId_fkey" FOREIGN KEY ("damageReportId") REFERENCES "DamageReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamagePhoto" ADD CONSTRAINT "DamagePhoto_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamagePhoto" ADD CONSTRAINT "DamagePhoto_thumbFileId_fkey" FOREIGN KEY ("thumbFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamagePhoto" ADD CONSTRAINT "DamagePhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ───────────── Hand-written: checks and evidence guards ─────────────

ALTER TABLE "DamageReport"
  ADD CONSTRAINT damage_report_title_tidy
    CHECK (title = btrim(title) AND title <> '' AND char_length(title) <= 120),
  ADD CONSTRAINT damage_report_description_present
    CHECK (btrim(description) <> '' AND char_length(description) <= 4000),
  ADD CONSTRAINT damage_report_cost_not_negative
    CHECK ("estimatedCostCents" >= 0),
  -- Submitted exactly when it has left DRAFT; resolved exactly when RESOLVED.
  ADD CONSTRAINT damage_report_submitted_when_sent
    CHECK (("status" = 'DRAFT') = ("submittedAt" IS NULL)),
  ADD CONSTRAINT damage_report_resolved_when_resolved
    CHECK (("status" = 'RESOLVED') = ("resolvedAt" IS NOT NULL));

-- Damage reports are evidence for a claim: never deleted; once submitted, what was reported (what, where, when, which
-- stay, by whom) can't change; and the status only moves forward (enum order is the workflow order).
CREATE OR REPLACE FUNCTION damage_report_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DamageReport % cannot be deleted', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."propertyId" <> OLD."propertyId" OR NEW."reportedById" <> OLD."reportedById" THEN
    RAISE EXCEPTION 'DamageReport % property and reporter are fixed', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."status" < OLD."status" THEN
    RAISE EXCEPTION 'DamageReport % status only moves forward', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD."status" <> 'DRAFT' AND (
       NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.severity IS DISTINCT FROM OLD.severity
    OR NEW."discoveredOn" IS DISTINCT FROM OLD."discoveredOn"
    OR NEW."bookingId" IS DISTINCT FROM OLD."bookingId"
    OR NEW."roomId" IS DISTINCT FROM OLD."roomId"
    OR NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt"
  ) THEN
    RAISE EXCEPTION 'DamageReport % details are locked once submitted', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER damage_report_guard
  BEFORE UPDATE OR DELETE ON "DamageReport"
  FOR EACH ROW EXECUTE FUNCTION damage_report_guard();

-- Damage photos are evidence: no update or delete, ever.
CREATE OR REPLACE FUNCTION damage_photo_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'DamagePhoto % cannot be changed or deleted', OLD.id USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER damage_photo_immutable
  BEFORE UPDATE OR DELETE ON "DamagePhoto"
  FOR EACH ROW EXECUTE FUNCTION damage_photo_immutable();
