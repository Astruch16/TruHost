-- CreateEnum
CREATE TYPE "StatementStatus" AS ENUM ('DRAFT', 'FINALIZED', 'RELEASED');

-- CreateEnum
CREATE TYPE "StatementLineKind" AS ENUM ('STAY', 'EXPENSE', 'OWNER_STAY_CLEANING', 'ADJUSTMENT');

-- AlterEnum
ALTER TYPE "FilePurpose" ADD VALUE 'STATEMENT_PDF';

-- CreateTable
CREATE TABLE "OwnerStatement" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "periodMonth" DATE NOT NULL,
    "status" "StatementStatus" NOT NULL DEFAULT 'DRAFT',
    "managementFeeBps" INTEGER,
    "planName" TEXT,
    "nightsBooked" INTEGER,
    "grossCents" INTEGER,
    "managementFeeCents" INTEGER,
    "expensesCents" INTEGER,
    "ownerStayCleaningCents" INTEGER,
    "adjustmentsCents" INTEGER,
    "netCents" INTEGER,
    "calcVersion" INTEGER,
    "createdById" UUID NOT NULL,
    "finalizedAt" TIMESTAMPTZ,
    "finalizedById" UUID,
    "releasedOn" DATE,
    "releasedAt" TIMESTAMPTZ,
    "releasedById" UUID,
    "paymentReference" TEXT,
    "pdfFileId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "OwnerStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerStatementLine" (
    "id" UUID NOT NULL,
    "statementId" UUID NOT NULL,
    "kind" "StatementLineKind" NOT NULL,
    "bookingId" UUID,
    "expenseId" UUID,
    "adjustmentId" UUID,
    "date" DATE NOT NULL,
    "endDate" DATE,
    "channel" "BookingChannel",
    "category" "ExpenseCategory",
    "description" TEXT NOT NULL,
    "detail" TEXT,
    "nights" INTEGER,
    "totalNights" INTEGER,
    "stayGrossCents" INTEGER,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "payoutPending" BOOLEAN NOT NULL DEFAULT false,
    "amountCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "OwnerStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementAdjustment" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "statementId" UUID NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "correctsStatementId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMPTZ,
    "voidedById" UUID,
    "voidReason" TEXT,

    CONSTRAINT "StatementAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerStatement_pdfFileId_key" ON "OwnerStatement"("pdfFileId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerStatement_propertyId_periodMonth_key" ON "OwnerStatement"("propertyId", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerStatement_propertyId_id_key" ON "OwnerStatement"("propertyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerStatementLine_adjustmentId_key" ON "OwnerStatementLine"("adjustmentId");

-- CreateIndex
CREATE INDEX "OwnerStatementLine_statementId_sortOrder_idx" ON "OwnerStatementLine"("statementId", "sortOrder");

-- CreateIndex
CREATE INDEX "StatementAdjustment_statementId_idx" ON "StatementAdjustment"("statementId");

-- AddForeignKey
ALTER TABLE "OwnerStatement" ADD CONSTRAINT "OwnerStatement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatement" ADD CONSTRAINT "OwnerStatement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatement" ADD CONSTRAINT "OwnerStatement_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatement" ADD CONSTRAINT "OwnerStatement_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatement" ADD CONSTRAINT "OwnerStatement_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatementLine" ADD CONSTRAINT "OwnerStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "OwnerStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatementLine" ADD CONSTRAINT "OwnerStatementLine_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatementLine" ADD CONSTRAINT "OwnerStatementLine_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatementLine" ADD CONSTRAINT "OwnerStatementLine_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "StatementAdjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementAdjustment" ADD CONSTRAINT "StatementAdjustment_propertyId_statementId_fkey" FOREIGN KEY ("propertyId", "statementId") REFERENCES "OwnerStatement"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementAdjustment" ADD CONSTRAINT "StatementAdjustment_propertyId_correctsStatementId_fkey" FOREIGN KEY ("propertyId", "correctsStatementId") REFERENCES "OwnerStatement"("propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementAdjustment" ADD CONSTRAINT "StatementAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementAdjustment" ADD CONSTRAINT "StatementAdjustment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────────────────── Raw SQL (docs/spec.md "Constraints added as raw SQL") ─────────────────────────

-- Statements: one month each; the copy exists exactly when finalized; release fields exactly when released.
ALTER TABLE "OwnerStatement" ADD CONSTRAINT owner_statement_month_start CHECK (EXTRACT(day FROM "periodMonth") = 1);
ALTER TABLE "OwnerStatement" ADD CONSTRAINT owner_statement_copy CHECK (
  (status = 'DRAFT'
    AND "managementFeeBps" IS NULL AND "planName" IS NULL AND "nightsBooked" IS NULL AND "grossCents" IS NULL
    AND "managementFeeCents" IS NULL AND "expensesCents" IS NULL AND "ownerStayCleaningCents" IS NULL
    AND "adjustmentsCents" IS NULL AND "netCents" IS NULL AND "calcVersion" IS NULL
    AND "finalizedAt" IS NULL AND "finalizedById" IS NULL)
  OR
  (status <> 'DRAFT'
    AND "managementFeeBps" IS NOT NULL AND "planName" IS NOT NULL AND "nightsBooked" IS NOT NULL
    AND "grossCents" IS NOT NULL AND "managementFeeCents" IS NOT NULL AND "expensesCents" IS NOT NULL
    AND "ownerStayCleaningCents" IS NOT NULL AND "adjustmentsCents" IS NOT NULL AND "netCents" IS NOT NULL
    AND "calcVersion" IS NOT NULL AND "finalizedAt" IS NOT NULL AND "finalizedById" IS NOT NULL)
);
ALTER TABLE "OwnerStatement" ADD CONSTRAINT owner_statement_release CHECK (
  (status = 'RELEASED'
    AND "releasedOn" IS NOT NULL AND "releasedAt" IS NOT NULL AND "releasedById" IS NOT NULL AND "pdfFileId" IS NOT NULL)
  OR
  (status <> 'RELEASED'
    AND "releasedOn" IS NULL AND "releasedAt" IS NULL AND "releasedById" IS NULL AND "pdfFileId" IS NULL
    AND "paymentReference" IS NULL)
);
-- Until the owner-owes flow exists (spec §9 N5), a negative month can't be released.
ALTER TABLE "OwnerStatement" ADD CONSTRAINT owner_statement_release_not_negative
  CHECK (status <> 'RELEASED' OR "netCents" >= 0);

-- Status only moves forward; the copy is fixed once finalized; a released statement never changes; only drafts
-- can be deleted.
CREATE OR REPLACE FUNCTION owner_statement_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'OwnerStatement % is % and cannot be deleted', OLD.id, OLD.status USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'RELEASED' THEN
    RAISE EXCEPTION 'OwnerStatement % is released and cannot change', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."propertyId" IS DISTINCT FROM OLD."propertyId" OR NEW."periodMonth" IS DISTINCT FROM OLD."periodMonth"
     OR NEW."createdById" IS DISTINCT FROM OLD."createdById" THEN
    RAISE EXCEPTION 'OwnerStatement % property and month are fixed', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT ((OLD.status = NEW.status) OR (OLD.status = 'DRAFT' AND NEW.status = 'FINALIZED')
          OR (OLD.status = 'FINALIZED' AND NEW.status = 'RELEASED')) THEN
    RAISE EXCEPTION 'OwnerStatement % cannot go from % to %', OLD.id, OLD.status, NEW.status USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.status = 'FINALIZED' AND (
       NEW."managementFeeBps" IS DISTINCT FROM OLD."managementFeeBps" OR NEW."planName" IS DISTINCT FROM OLD."planName"
       OR NEW."nightsBooked" IS DISTINCT FROM OLD."nightsBooked" OR NEW."grossCents" IS DISTINCT FROM OLD."grossCents"
       OR NEW."managementFeeCents" IS DISTINCT FROM OLD."managementFeeCents"
       OR NEW."expensesCents" IS DISTINCT FROM OLD."expensesCents"
       OR NEW."ownerStayCleaningCents" IS DISTINCT FROM OLD."ownerStayCleaningCents"
       OR NEW."adjustmentsCents" IS DISTINCT FROM OLD."adjustmentsCents" OR NEW."netCents" IS DISTINCT FROM OLD."netCents"
       OR NEW."calcVersion" IS DISTINCT FROM OLD."calcVersion" OR NEW."finalizedAt" IS DISTINCT FROM OLD."finalizedAt"
       OR NEW."finalizedById" IS DISTINCT FROM OLD."finalizedById") THEN
    RAISE EXCEPTION 'OwnerStatement % is finalized: its figures are fixed', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER owner_statement_guard
  BEFORE UPDATE OR DELETE ON "OwnerStatement"
  FOR EACH ROW EXECUTE FUNCTION owner_statement_guard();

-- Lines are the issued document: written once, while their statement is still a draft (in the finalize
-- transaction), never changed or removed.
CREATE OR REPLACE FUNCTION owner_statement_line_guard() RETURNS trigger AS $$
DECLARE
  st "StatementStatus";
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'OwnerStatementLine % cannot be changed or deleted', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT status INTO st FROM "OwnerStatement" WHERE id = NEW."statementId";
  IF st IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'Lines can only be written while finalizing a draft' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER owner_statement_line_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "OwnerStatementLine"
  FOR EACH ROW EXECUTE FUNCTION owner_statement_line_guard();

-- Adjustments: a reason, a non-zero amount, a reason when voided; never on the statement they correct.
ALTER TABLE "StatementAdjustment" ADD CONSTRAINT statement_adjustment_reason
  CHECK (length(btrim(coalesce(reason, ''))) BETWEEN 1 AND 500);
ALTER TABLE "StatementAdjustment" ADD CONSTRAINT statement_adjustment_not_zero CHECK ("amountCents" <> 0);
ALTER TABLE "StatementAdjustment" ADD CONSTRAINT statement_adjustment_void CHECK (
  ("voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL)
  OR ("voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND length(btrim(coalesce("voidReason", ''))) > 0)
);
ALTER TABLE "StatementAdjustment" ADD CONSTRAINT statement_adjustment_not_self
  CHECK ("correctsStatementId" IS NULL OR "correctsStatementId" <> "statementId");

-- Adjustments change only while their statement is a draft, and then only by being voided. FOR SHARE on the
-- statement row waits for (or blocks) a concurrent finalize, which locks it FOR UPDATE before reading adjustments.
CREATE OR REPLACE FUNCTION statement_adjustment_guard() RETURNS trigger AS $$
DECLARE
  st "StatementStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'StatementAdjustment % cannot be deleted; void it instead', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT status INTO st FROM "OwnerStatement" WHERE id = NEW."statementId" FOR SHARE;
  IF st IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'Adjustments can only change while their statement is a draft' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'UPDATE' AND (
       NEW."propertyId" IS DISTINCT FROM OLD."propertyId" OR NEW."statementId" IS DISTINCT FROM OLD."statementId"
       OR NEW."amountCents" IS DISTINCT FROM OLD."amountCents" OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW."correctsStatementId" IS DISTINCT FROM OLD."correctsStatementId"
       OR NEW."createdById" IS DISTINCT FROM OLD."createdById" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
       OR OLD."voidedAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'StatementAdjustment % can only be voided', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER statement_adjustment_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "StatementAdjustment"
  FOR EACH ROW EXECUTE FUNCTION statement_adjustment_guard();

-- The period lock's backstop (the services check first and answer 409 PERIOD_LOCKED): a booking or owner-borne
-- expense can't be added, moved or changed in a way that alters a finalized month's figures. A booking's months run
-- from its check-in to its last night, or to its check-out for an owner stay (the cleaning charge lands there).
CREATE OR REPLACE FUNCTION period_locked(property uuid, from_day date, to_day date) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM "OwnerStatement"
    WHERE "propertyId" = property AND status <> 'DRAFT'
      AND "periodMonth" BETWEEN date_trunc('month', from_day)::date AND date_trunc('month', to_day)::date
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION booking_period_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND (TG_OP = 'DELETE'
       OR NEW."propertyId" IS DISTINCT FROM OLD."propertyId" OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.status IS DISTINCT FROM OLD.status OR NEW.channel IS DISTINCT FROM OLD.channel
       OR NEW."checkInDate" IS DISTINCT FROM OLD."checkInDate" OR NEW."checkOutDate" IS DISTINCT FROM OLD."checkOutDate"
       OR NEW."payoutCents" IS DISTINCT FROM OLD."payoutCents"
       OR NEW."guestCleaningFeeCents" IS DISTINCT FROM OLD."guestCleaningFeeCents"
       OR NEW."taxesCollectedCents" IS DISTINCT FROM OLD."taxesCollectedCents")
     AND period_locked(OLD."propertyId", OLD."checkInDate",
                       CASE WHEN OLD.kind = 'OWNER_STAY' THEN OLD."checkOutDate" ELSE OLD."checkOutDate" - 1 END) THEN
    RAISE EXCEPTION 'PERIOD_LOCKED: booking % is in a finalized month', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT'
       OR NEW."propertyId" IS DISTINCT FROM OLD."propertyId" OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.status IS DISTINCT FROM OLD.status OR NEW.channel IS DISTINCT FROM OLD.channel
       OR NEW."checkInDate" IS DISTINCT FROM OLD."checkInDate" OR NEW."checkOutDate" IS DISTINCT FROM OLD."checkOutDate"
       OR NEW."payoutCents" IS DISTINCT FROM OLD."payoutCents"
       OR NEW."guestCleaningFeeCents" IS DISTINCT FROM OLD."guestCleaningFeeCents"
       OR NEW."taxesCollectedCents" IS DISTINCT FROM OLD."taxesCollectedCents")
     AND period_locked(NEW."propertyId", NEW."checkInDate",
                       CASE WHEN NEW.kind = 'OWNER_STAY' THEN NEW."checkOutDate" ELSE NEW."checkOutDate" - 1 END) THEN
    RAISE EXCEPTION 'PERIOD_LOCKED: these dates are in a finalized month' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_period_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "Booking"
  FOR EACH ROW EXECUTE FUNCTION booking_period_guard();

CREATE OR REPLACE FUNCTION expense_period_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.bearer = 'OWNER' AND (TG_OP = 'DELETE'
       OR NEW."propertyId" IS DISTINCT FROM OLD."propertyId" OR NEW.bearer IS DISTINCT FROM OLD.bearer
       OR NEW."incurredOn" IS DISTINCT FROM OLD."incurredOn" OR NEW."amountCents" IS DISTINCT FROM OLD."amountCents"
       OR NEW.category IS DISTINCT FROM OLD.category OR NEW."voidedAt" IS DISTINCT FROM OLD."voidedAt")
     AND period_locked(OLD."propertyId", OLD."incurredOn", OLD."incurredOn") THEN
    RAISE EXCEPTION 'PERIOD_LOCKED: expense % is in a finalized month', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.bearer = 'OWNER' AND (TG_OP = 'INSERT'
       OR NEW."propertyId" IS DISTINCT FROM OLD."propertyId" OR NEW.bearer IS DISTINCT FROM OLD.bearer
       OR NEW."incurredOn" IS DISTINCT FROM OLD."incurredOn" OR NEW."amountCents" IS DISTINCT FROM OLD."amountCents"
       OR NEW.category IS DISTINCT FROM OLD.category OR NEW."voidedAt" IS DISTINCT FROM OLD."voidedAt")
     AND period_locked(NEW."propertyId", NEW."incurredOn", NEW."incurredOn") THEN
    RAISE EXCEPTION 'PERIOD_LOCKED: this date is in a finalized month' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expense_period_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "Expense"
  FOR EACH ROW EXECUTE FUNCTION expense_period_guard();
