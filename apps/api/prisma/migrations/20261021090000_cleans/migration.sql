-- CreateEnum
CREATE TYPE "CleanKind" AS ENUM ('TURNOVER', 'ADHOC');

-- CreateEnum
CREATE TYPE "CleanStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PhotoPhase" AS ENUM ('BEFORE', 'AFTER');

-- CreateTable
CREATE TABLE "Clean" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "kind" "CleanKind" NOT NULL,
    "bookingId" UUID,
    "scheduledDate" DATE NOT NULL,
    "status" "CleanStatus" NOT NULL DEFAULT 'SCHEDULED',
    "assignedCleanerId" UUID,
    "startedAt" TIMESTAMPTZ,
    "startedById" UUID,
    "completedAt" TIMESTAMPTZ,
    "completedById" UUID,
    "cancelledAt" TIMESTAMPTZ,
    "cancelReason" TEXT,
    "notes" TEXT,
    "cleanerPayCents" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Clean_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanPhoto" (
    "id" UUID NOT NULL,
    "cleanId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "phase" "PhotoPhase" NOT NULL,
    "fileId" UUID NOT NULL,
    "thumbFileId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleanPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clean_bookingId_key" ON "Clean"("bookingId");

-- CreateIndex
CREATE INDEX "Clean_propertyId_scheduledDate_idx" ON "Clean"("propertyId", "scheduledDate");

-- CreateIndex
CREATE INDEX "Clean_assignedCleanerId_scheduledDate_idx" ON "Clean"("assignedCleanerId", "scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "Clean_propertyId_id_key" ON "Clean"("propertyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CleanPhoto_fileId_key" ON "CleanPhoto"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "CleanPhoto_thumbFileId_key" ON "CleanPhoto"("thumbFileId");

-- CreateIndex
CREATE INDEX "CleanPhoto_cleanId_roomId_phase_idx" ON "CleanPhoto"("cleanId", "roomId", "phase");

-- AddForeignKey
ALTER TABLE "Clean" ADD CONSTRAINT "Clean_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clean" ADD CONSTRAINT "Clean_propertyId_bookingId_fkey" FOREIGN KEY ("propertyId", "bookingId") REFERENCES "Booking"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clean" ADD CONSTRAINT "Clean_assignedCleanerId_fkey" FOREIGN KEY ("assignedCleanerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clean" ADD CONSTRAINT "Clean_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clean" ADD CONSTRAINT "Clean_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanPhoto" ADD CONSTRAINT "CleanPhoto_propertyId_cleanId_fkey" FOREIGN KEY ("propertyId", "cleanId") REFERENCES "Clean"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanPhoto" ADD CONSTRAINT "CleanPhoto_propertyId_roomId_fkey" FOREIGN KEY ("propertyId", "roomId") REFERENCES "Room"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanPhoto" ADD CONSTRAINT "CleanPhoto_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanPhoto" ADD CONSTRAINT "CleanPhoto_thumbFileId_fkey" FOREIGN KEY ("thumbFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanPhoto" ADD CONSTRAINT "CleanPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────── Hand-written: checks, the state machine and evidence guards ─────────────

ALTER TABLE "Clean"
  ADD CONSTRAINT clean_pay_not_negative CHECK ("cleanerPayCents" >= 0),
  -- A turnover follows exactly one stay; an ad-hoc clean follows none.
  ADD CONSTRAINT clean_turnover_has_booking CHECK (("kind" = 'TURNOVER') = ("bookingId" IS NOT NULL)),
  -- Each state carries its time: started once under way, completed exactly when COMPLETE, cancelled exactly when
  -- CANCELLED.
  ADD CONSTRAINT clean_started_when_under_way
    CHECK ("status" NOT IN ('IN_PROGRESS', 'COMPLETE') OR ("startedAt" IS NOT NULL AND "startedById" IS NOT NULL)),
  ADD CONSTRAINT clean_completed_when_complete
    CHECK (("status" = 'COMPLETE') = ("completedAt" IS NOT NULL AND "completedById" IS NOT NULL)),
  ADD CONSTRAINT clean_cancelled_when_cancelled CHECK (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL)),
  -- Someone must be assigned to work a clean.
  ADD CONSTRAINT clean_assigned_when_worked
    CHECK ("status" NOT IN ('IN_PROGRESS', 'COMPLETE') OR "assignedCleanerId" IS NOT NULL);

-- Cleans are never deleted. Only these moves exist: SCHEDULED → IN_PROGRESS or CANCELLED, IN_PROGRESS → COMPLETE or
-- CANCELLED, CANCELLED → SCHEDULED (a stay restored). A COMPLETE clean is final, and who did it (who is owed the pay)
-- can't change. Completing needs a BEFORE and an AFTER photo of every active room of the property.
CREATE OR REPLACE FUNCTION clean_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Clean % cannot be deleted', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."propertyId" <> OLD."propertyId" OR NEW."kind" <> OLD."kind"
     OR NEW."bookingId" IS DISTINCT FROM OLD."bookingId" THEN
    RAISE EXCEPTION 'Clean % property, kind and stay are fixed', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD."status" = 'COMPLETE' AND (
       NEW."status" <> 'COMPLETE'
    OR NEW."assignedCleanerId" IS DISTINCT FROM OLD."assignedCleanerId"
    OR NEW."scheduledDate" <> OLD."scheduledDate"
    OR NEW."startedAt" IS DISTINCT FROM OLD."startedAt"
    OR NEW."completedAt" IS DISTINCT FROM OLD."completedAt"
    OR NEW."completedById" IS DISTINCT FROM OLD."completedById"
  ) THEN
    RAISE EXCEPTION 'Clean % is complete', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'SCHEDULED' AND NEW."status" IN ('IN_PROGRESS', 'CANCELLED'))
    OR (OLD."status" = 'IN_PROGRESS' AND NEW."status" IN ('COMPLETE', 'CANCELLED'))
    OR (OLD."status" = 'CANCELLED' AND NEW."status" = 'SCHEDULED')
  ) THEN
    RAISE EXCEPTION 'Clean % cannot go from % to %', OLD.id, OLD."status", NEW."status"
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."status" = 'COMPLETE' AND OLD."status" <> 'COMPLETE' AND EXISTS (
    SELECT 1 FROM "Room" r
    WHERE r."propertyId" = NEW."propertyId" AND r."archivedAt" IS NULL
      AND (NOT EXISTS (SELECT 1 FROM "CleanPhoto" p WHERE p."cleanId" = NEW.id AND p."roomId" = r.id AND p."phase" = 'BEFORE')
        OR NOT EXISTS (SELECT 1 FROM "CleanPhoto" p WHERE p."cleanId" = NEW.id AND p."roomId" = r.id AND p."phase" = 'AFTER'))
  ) THEN
    RAISE EXCEPTION 'Clean % is missing photos', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clean_guard
  BEFORE UPDATE OR DELETE ON "Clean"
  FOR EACH ROW EXECUTE FUNCTION clean_guard();

-- Clean photos are evidence: no update or delete, ever, and they're added only while the clean is under way.
CREATE OR REPLACE FUNCTION clean_photo_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'CleanPhoto % cannot be changed or deleted', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Clean" c WHERE c.id = NEW."cleanId" AND c."status" = 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'Photos are added only while the clean is in progress' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clean_photo_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "CleanPhoto"
  FOR EACH ROW EXECUTE FUNCTION clean_photo_guard();

-- Turnovers for stays already booked: every confirmed guest or owner stay checking out today or later gets its clean,
-- assigned to the property's default cleaner at its default pay (as new stays do from now on). Past stays had no
-- cleans in TruHost, so none are made up for them.
INSERT INTO "Clean" ("id", "propertyId", "kind", "bookingId", "scheduledDate", "assignedCleanerId", "cleanerPayCents", "updatedAt")
SELECT gen_random_uuid(), b."propertyId", 'TURNOVER', b.id, b."checkOutDate", p."defaultCleanerId", p."defaultCleanerPayCents", now()
FROM "Booking" b
JOIN "Property" p ON p.id = b."propertyId"
WHERE b."status" = 'CONFIRMED' AND b."kind" IN ('GUEST', 'OWNER_STAY') AND b."checkOutDate" >= CURRENT_DATE;
