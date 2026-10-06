-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'CLEANER');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('BEDROOM', 'BATHROOM', 'KITCHEN', 'LIVING', 'DINING', 'LAUNDRY', 'OUTDOOR', 'ENTRY', 'OTHER');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "clerkUserId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "staffRole" "StaffRole",
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "deactivatedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "clerkInvitationId" TEXT,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" UUID,
    "acceptedAt" TIMESTAMPTZ,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ,
    "revokedById" UUID,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL DEFAULT 'BC',
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'CA',
    "timeZone" TEXT NOT NULL DEFAULT 'America/Vancouver',
    "checkInTime" TEXT NOT NULL DEFAULT '16:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
    "provincialRegistrationNumber" TEXT,
    "businessLicenceNumber" TEXT,
    "accessInstructions" TEXT,
    "defaultCleanerPayCents" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "managementFeeBps" INTEGER NOT NULL,
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyPlan" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "propertyId" UUID,
    "before" JSONB,
    "after" JSONB,
    "requestId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "userId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("userId","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_clerkInvitationId_key" ON "Invite"("clerkInvitationId");

-- CreateIndex
CREATE INDEX "Invite_userId_status_idx" ON "Invite"("userId", "status");

-- CreateIndex
CREATE INDEX "Membership_userId_revokedAt_idx" ON "Membership"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Membership_propertyId_role_idx" ON "Membership"("propertyId", "role");

-- CreateIndex
CREATE INDEX "Room_propertyId_sortOrder_idx" ON "Room"("propertyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Room_propertyId_id_key" ON "Room"("propertyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE INDEX "PropertyPlan_propertyId_effectiveFrom_idx" ON "PropertyPlan"("propertyId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_propertyId_createdAt_idx" ON "AuditLog"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyPlan" ADD CONSTRAINT "PropertyPlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyPlan" ADD CONSTRAINT "PropertyPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyPlan" ADD CONSTRAINT "PropertyPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────────────────── Hand-written constraints (see docs/spec.md §3) ─────────────────────────

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Emails are stored lower-cased so the unique index is case-insensitive in practice.
ALTER TABLE "User" ADD CONSTRAINT user_email_lowercase CHECK ("email" = lower("email"));

-- One active grant per (user, property, role); revoked rows are kept as history.
CREATE UNIQUE INDEX membership_active_unique
  ON "Membership" ("userId", "propertyId", "role")
  WHERE "revokedAt" IS NULL;

ALTER TABLE "Property" ADD CONSTRAINT property_cleaner_pay_nonnegative
  CHECK ("defaultCleanerPayCents" >= 0);
ALTER TABLE "Property" ADD CONSTRAINT property_times_hhmm
  CHECK ("checkInTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "checkOutTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "Plan" ADD CONSTRAINT plan_fee_bps_range
  CHECK ("managementFeeBps" BETWEEN 0 AND 10000);

-- Plan periods start and end on the 1st so every statement month has exactly one rate, and never overlap.
ALTER TABLE "PropertyPlan" ADD CONSTRAINT property_plan_month_bounds
  CHECK (
    EXTRACT(DAY FROM "effectiveFrom") = 1
    AND ("effectiveTo" IS NULL OR (EXTRACT(DAY FROM "effectiveTo") = 1 AND "effectiveTo" > "effectiveFrom"))
  );
ALTER TABLE "PropertyPlan" ADD CONSTRAINT property_plan_no_overlap
  EXCLUDE USING gist (
    "propertyId" WITH =,
    daterange("effectiveFrom", "effectiveTo", '[)') WITH &&
  );

-- A plan's rate cannot change once any property has used it (historic statements must reproduce).
CREATE FUNCTION plan_rate_immutable_once_used() RETURNS trigger AS $$
BEGIN
  IF NEW."managementFeeBps" IS DISTINCT FROM OLD."managementFeeBps"
     AND EXISTS (SELECT 1 FROM "PropertyPlan" WHERE "planId" = OLD."id") THEN
    RAISE EXCEPTION 'Plan % rate is immutable once assigned to a property', OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plan_rate_immutable
  BEFORE UPDATE ON "Plan"
  FOR EACH ROW EXECUTE FUNCTION plan_rate_immutable_once_used();

-- Generic guard for append-only tables (audit log now; photos, statement lines, payments later).
CREATE FUNCTION reject_update_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % rejected', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete();
