-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'CLEAN_COMPLETED';

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'CLEAN_COMPLETED';

-- AlterTable
ALTER TABLE "Clean" ADD COLUMN     "damageFound" BOOLEAN;

-- AlterTable
ALTER TABLE "DamageReport" ADD COLUMN     "cleanId" UUID;

-- AlterTable
ALTER TABLE "SupplyStatus" ADD COLUMN     "cleanId" UUID;

-- CreateIndex
CREATE INDEX "DamageReport_cleanId_idx" ON "DamageReport"("cleanId");

-- CreateIndex
CREATE INDEX "SupplyStatus_cleanId_idx" ON "SupplyStatus"("cleanId");

-- AddForeignKey
ALTER TABLE "SupplyStatus" ADD CONSTRAINT "SupplyStatus_cleanId_fkey" FOREIGN KEY ("cleanId") REFERENCES "Clean"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_propertyId_cleanId_fkey" FOREIGN KEY ("propertyId", "cleanId") REFERENCES "Clean"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────── The clean's checklist (docs/spec.md, Cleans) ─────────────
-- In order: a BEFORE photo of every active room; the damage question answered (yes needs a sent report from this
-- clean); every active supply counted on this clean; then AFTER photos; then complete.

-- Everything before the AFTER photos is done.
CREATE OR REPLACE FUNCTION clean_prep_done(c "Clean") RETURNS boolean AS $$
  SELECT NOT EXISTS (
           SELECT 1 FROM "Room" r
           WHERE r."propertyId" = c."propertyId" AND r."archivedAt" IS NULL
             AND NOT EXISTS (SELECT 1 FROM "CleanPhoto" p WHERE p."cleanId" = c.id AND p."roomId" = r.id AND p."phase" = 'BEFORE'))
     AND c."damageFound" IS NOT NULL
     AND (NOT c."damageFound" OR EXISTS (
           SELECT 1 FROM "DamageReport" d WHERE d."cleanId" = c.id AND d."status" <> 'DRAFT'))
     AND NOT EXISTS (
           SELECT 1 FROM "SupplyItem" s
           WHERE s."propertyId" = c."propertyId" AND s."archivedAt" IS NULL
             AND NOT EXISTS (SELECT 1 FROM "SupplyStatus" st WHERE st."supplyItemId" = s.id AND st."cleanId" = c.id));
$$ LANGUAGE sql STABLE;

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
    OR NEW."damageFound" IS DISTINCT FROM OLD."damageFound"
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
  IF NEW."damageFound" IS DISTINCT FROM OLD."damageFound" AND NEW."status" <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'Clean % is not in progress', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."status" = 'COMPLETE' AND OLD."status" <> 'COMPLETE' THEN
    IF EXISTS (
      SELECT 1 FROM "Room" r
      WHERE r."propertyId" = NEW."propertyId" AND r."archivedAt" IS NULL
        AND (NOT EXISTS (SELECT 1 FROM "CleanPhoto" p WHERE p."cleanId" = NEW.id AND p."roomId" = r.id AND p."phase" = 'BEFORE')
          OR NOT EXISTS (SELECT 1 FROM "CleanPhoto" p WHERE p."cleanId" = NEW.id AND p."roomId" = r.id AND p."phase" = 'AFTER'))
    ) THEN
      RAISE EXCEPTION 'Clean % is missing photos', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    IF NOT clean_prep_done(NEW) THEN
      RAISE EXCEPTION 'Clean % checklist is not done', OLD.id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Clean photos: evidence (never changed or removed), added only while the clean is under way, and AFTER photos only
-- once everything before them on the checklist is done.
CREATE OR REPLACE FUNCTION clean_photo_guard() RETURNS trigger AS $$
DECLARE
  c "Clean";
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'CleanPhoto % cannot be changed or deleted', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO c FROM "Clean" WHERE id = NEW."cleanId";
  IF c.id IS NULL OR c."status" <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'Photos are added only while the clean is in progress' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."phase" = 'AFTER' AND NOT clean_prep_done(c) THEN
    RAISE EXCEPTION 'After photos come once the checklist before them is done' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- A reading counted on a clean: that clean is under way, at the item's property.
CREATE OR REPLACE FUNCTION supply_status_clean_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."cleanId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Clean" c JOIN "SupplyItem" s ON s.id = NEW."supplyItemId"
    WHERE c.id = NEW."cleanId" AND c."status" = 'IN_PROGRESS' AND c."propertyId" = s."propertyId"
  ) THEN
    RAISE EXCEPTION 'A stock count is taken on a clean in progress at the item''s property'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supply_status_clean_guard
  BEFORE INSERT ON "SupplyStatus"
  FOR EACH ROW EXECUTE FUNCTION supply_status_clean_guard();

-- A damage report's clean is fixed once it's made (alongside its property and reporter).
CREATE OR REPLACE FUNCTION damage_report_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DamageReport % cannot be deleted', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."propertyId" <> OLD."propertyId" OR NEW."reportedById" <> OLD."reportedById"
     OR NEW."cleanId" IS DISTINCT FROM OLD."cleanId" THEN
    RAISE EXCEPTION 'DamageReport % property, reporter and clean are fixed', OLD.id USING ERRCODE = 'insufficient_privilege';
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
