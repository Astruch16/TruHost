-- CreateEnum
CREATE TYPE "MotionPreference" AS ENUM ('SYSTEM', 'REDUCED');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SUPPLY_ALERTS', 'INVITE_ACCEPTED', 'WEEKLY_SUMMARY', 'STATEMENT_RELEASED', 'CLEAN_ASSIGNED', 'PAYMENT_RECORDED');

-- AlterEnum
ALTER TYPE "FilePurpose" ADD VALUE 'AVATAR';

-- AlterTable
ALTER TABLE "StoredFile" ALTER COLUMN "propertyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarFileId" UUID,
ADD COLUMN     "motion" "MotionPreference" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "weekStartsOn" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "NotificationSetting" (
    "userId" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "email" BOOLEAN NOT NULL,
    "inApp" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("userId","category")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_avatarFileId_key" ON "User"("avatarFileId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarFileId_fkey" FOREIGN KEY ("avatarFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSetting" ADD CONSTRAINT "NotificationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────── Raw SQL ─────────
-- (The new AVATAR value can't be used as an enum literal in the transaction that adds it, so compare as text.)

-- Every file belongs to a property, except avatars, which belong to a user.
ALTER TABLE "StoredFile" ADD CONSTRAINT stored_file_scope CHECK ((purpose::text = 'AVATAR') = ("propertyId" IS NULL));

ALTER TABLE "User" ADD CONSTRAINT user_week_starts_on CHECK ("weekStartsOn" IN (0, 1));

-- Avatars are not evidence: they are deleted outright when replaced or removed. Everything else stays as before.
CREATE OR REPLACE FUNCTION stored_file_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'VERIFIED' AND OLD.purpose::text <> 'AVATAR'
       AND coalesce(current_setting('truhost.deleting_property', true), '') <> coalesce(OLD."propertyId"::text, '') THEN
      RAISE EXCEPTION 'StoredFile % is verified evidence and cannot be deleted', OLD.id USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW."objectKey" IS DISTINCT FROM OLD."objectKey" OR NEW.sha256 IS DISTINCT FROM OLD.sha256
     OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes" OR NEW."uploadedById" IS DISTINCT FROM OLD."uploadedById"
     OR NEW."propertyId" IS DISTINCT FROM OLD."propertyId" OR NEW.purpose IS DISTINCT FROM OLD.purpose
     OR NEW."contentType" IS DISTINCT FROM OLD."contentType" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'StoredFile % identity fields are immutable', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.status = 'VERIFIED' AND (NEW.status <> 'VERIFIED' OR NEW."verifiedAt" IS DISTINCT FROM OLD."verifiedAt") THEN
    RAISE EXCEPTION 'StoredFile % is already verified', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
