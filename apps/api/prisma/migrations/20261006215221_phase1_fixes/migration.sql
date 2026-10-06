/*
  Warnings:

  - You are about to drop the column `accessInstructions` on the `Property` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "emailMessageId" TEXT,
ADD COLUMN     "lastSentAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "accessInstructions",
ADD COLUMN     "defaultCleanerId" UUID,
ADD COLUMN     "standardCleaningFeeCents" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_defaultCleanerId_fkey" FOREIGN KEY ("defaultCleanerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────── Hand-written ─────────────
ALTER TABLE "Property" ADD CONSTRAINT property_cleaning_fee_nonnegative
  CHECK ("standardCleaningFeeCents" >= 0);
