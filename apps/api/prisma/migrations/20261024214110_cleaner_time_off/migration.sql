-- CreateEnum
CREATE TYPE "TimeOffReason" AS ENUM ('HOLIDAY', 'TIME_OFF', 'OTHER_WORK', 'OTHER');

-- CreateEnum
CREATE TYPE "TimeOffStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'TIME_OFF_REQUESTS';

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'TIME_OFF_REQUESTED';

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "propertyId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TimeOffRequest" (
    "id" UUID NOT NULL,
    "cleanerId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" "TimeOffReason" NOT NULL,
    "note" TEXT,
    "status" "TimeOffStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ,
    "decisionNote" TEXT,
    "cancelledAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TimeOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeOffRequest_cleanerId_startDate_idx" ON "TimeOffRequest"("cleanerId", "startDate");

-- CreateIndex
CREATE INDEX "TimeOffRequest_status_startDate_idx" ON "TimeOffRequest"("status", "startDate");

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_cleanerId_fkey" FOREIGN KEY ("cleanerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────── Cleaner time off (docs/spec.md, Cleaner time off) ─────────────

-- Inclusive dates, at most 90 days.
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT time_off_dates
  CHECK ("endDate" >= "startDate" AND "endDate" - "startDate" <= 89);
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT time_off_note_length
  CHECK ("note" IS NULL OR char_length("note") BETWEEN 1 AND 500);
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT time_off_decision_note_length
  CHECK ("decisionNote" IS NULL OR char_length("decisionNote") BETWEEN 1 AND 500);
-- Decided (who and when) exactly once approved or declined; a pending request has no decision. A cancelled one keeps
-- the decision it had, if any.
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT time_off_decided_when_decided
  CHECK (("status" NOT IN ('APPROVED', 'DECLINED') OR ("decidedAt" IS NOT NULL AND "decidedById" IS NOT NULL))
     AND ("status" <> 'PENDING' OR ("decidedAt" IS NULL AND "decidedById" IS NULL AND "decisionNote" IS NULL)));
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT time_off_cancelled_when_cancelled
  CHECK (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL));
-- A cleaner's pending and approved requests never overlap.
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT time_off_no_overlap
  EXCLUDE USING gist ("cleanerId" WITH =, daterange("startDate", "endDate", '[]') WITH &&)
  WHERE ("status" IN ('PENDING', 'APPROVED'));

-- Never deleted; what was asked for is fixed; the status only moves PENDING → APPROVED | DECLINED | CANCELLED and
-- APPROVED → CANCELLED.
CREATE OR REPLACE FUNCTION time_off_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'TimeOffRequest % cannot be deleted', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."cleanerId" <> OLD."cleanerId" OR NEW."startDate" <> OLD."startDate" OR NEW."endDate" <> OLD."endDate"
     OR NEW."reason" <> OLD."reason" OR NEW."note" IS DISTINCT FROM OLD."note" THEN
    RAISE EXCEPTION 'TimeOffRequest % is fixed once asked for', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'PENDING' AND NEW."status" IN ('APPROVED', 'DECLINED', 'CANCELLED'))
    OR (OLD."status" = 'APPROVED' AND NEW."status" = 'CANCELLED')
  ) THEN
    RAISE EXCEPTION 'TimeOffRequest % cannot go from % to %', OLD.id, OLD."status", NEW."status"
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD."status" <> 'PENDING' AND (
       NEW."decidedAt" IS DISTINCT FROM OLD."decidedAt"
    OR NEW."decidedById" IS DISTINCT FROM OLD."decidedById"
    OR NEW."decisionNote" IS DISTINCT FROM OLD."decisionNote"
  ) THEN
    RAISE EXCEPTION 'TimeOffRequest % decision is fixed', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER time_off_guard
  BEFORE UPDATE OR DELETE ON "TimeOffRequest"
  FOR EACH ROW EXECUTE FUNCTION time_off_guard();
