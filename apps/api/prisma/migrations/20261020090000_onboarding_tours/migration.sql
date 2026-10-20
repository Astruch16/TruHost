-- CreateEnum
CREATE TYPE "OnboardingRole" AS ENUM ('ADMIN', 'OWNER', 'CLEANER');

-- CreateEnum
CREATE TYPE "TourStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "userId" UUID NOT NULL,
    "role" "OnboardingRole" NOT NULL,
    "tourStatus" "TourStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "tourStep" INTEGER,
    "tourVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("userId","role")
);

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A step index is never negative (NULL: no step seen yet).
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_tourStep_check" CHECK ("tourStep" IS NULL OR "tourStep" >= 0);
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_tourVersion_check" CHECK ("tourVersion" >= 1);
