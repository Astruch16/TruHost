-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('CLEANING', 'SUPPLIES', 'REPAIRS_MAINTENANCE', 'FURNISHINGS', 'UTILITIES', 'INTERNET', 'LICENSING_PERMITS', 'INSURANCE', 'STRATA', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseBearer" AS ENUM ('OWNER', 'TRUHOST');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('RECEIPT', 'CLEAN_PHOTO', 'DAMAGE_PHOTO');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'VERIFIED');

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "bearer" "ExpenseBearer" NOT NULL DEFAULT 'OWNER',
    "incurredOn" DATE NOT NULL,
    "vendor" TEXT,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "gstCents" INTEGER,
    "pstCents" INTEGER,
    "enteredById" UUID NOT NULL,
    "voidedAt" TIMESTAMPTZ,
    "voidedById" UUID,
    "voidReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "expenseId" UUID,
    "fileId" UUID NOT NULL,
    "receiptDate" DATE NOT NULL,
    "description" TEXT,
    "uploadedById" UUID NOT NULL,
    "voidedAt" TIMESTAMPTZ,
    "voidedById" UUID,
    "voidReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" UUID NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "propertyId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMPTZ,
    "originalFilename" TEXT,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_propertyId_incurredOn_idx" ON "Expense"("propertyId", "incurredOn");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_propertyId_id_key" ON "Expense"("propertyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_fileId_key" ON "Receipt"("fileId");

-- CreateIndex
CREATE INDEX "Receipt_propertyId_receiptDate_idx" ON "Receipt"("propertyId", "receiptDate");

-- CreateIndex
CREATE INDEX "Receipt_expenseId_idx" ON "Receipt"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_objectKey_key" ON "StoredFile"("objectKey");

-- CreateIndex
CREATE INDEX "StoredFile_status_createdAt_idx" ON "StoredFile"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────── Hand-written ─────────────

ALTER TABLE "Expense" ADD CONSTRAINT expense_money_nonnegative CHECK (
  "amountCents" >= 0 AND ("gstCents" IS NULL OR "gstCents" >= 0) AND ("pstCents" IS NULL OR "pstCents" >= 0)
);
ALTER TABLE "Expense" ADD CONSTRAINT expense_void_reason CHECK (
  ("voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL)
  OR ("voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND length(trim("voidReason")) > 0)
);
ALTER TABLE "Receipt" ADD CONSTRAINT receipt_void_reason CHECK (
  ("voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL)
  OR ("voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND length(trim("voidReason")) > 0)
);

-- A receipt can only be attached to an expense on the same property.
ALTER TABLE "Receipt" ADD CONSTRAINT receipt_expense_same_property
  FOREIGN KEY ("propertyId", "expenseId") REFERENCES "Expense" ("propertyId", "id") ON DELETE RESTRICT;

ALTER TABLE "StoredFile" ADD CONSTRAINT stored_file_size_positive CHECK ("sizeBytes" > 0);
ALTER TABLE "StoredFile" ADD CONSTRAINT stored_file_sha256_hex CHECK ("sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "StoredFile" ADD CONSTRAINT stored_file_verified_consistent CHECK (
  (status = 'VERIFIED') = ("verifiedAt" IS NOT NULL)
);

-- Files are evidence: identity fields never change, status only moves PENDING -> VERIFIED, rows are never deleted
-- once verified (pending rows may be purged).
CREATE FUNCTION stored_file_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'VERIFIED' THEN
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

CREATE TRIGGER stored_file_guard
  BEFORE UPDATE OR DELETE ON "StoredFile"
  FOR EACH ROW EXECUTE FUNCTION stored_file_guard();

-- Receipts are documents: never deleted (void instead), and their file/property never change.
CREATE FUNCTION receipt_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Receipt % cannot be deleted; void it instead', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."fileId" IS DISTINCT FROM OLD."fileId" OR NEW."propertyId" IS DISTINCT FROM OLD."propertyId"
     OR NEW."uploadedById" IS DISTINCT FROM OLD."uploadedById" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Receipt % file and ownership are immutable', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER receipt_guard
  BEFORE UPDATE OR DELETE ON "Receipt"
  FOR EACH ROW EXECUTE FUNCTION receipt_guard();

-- Expenses carry money: never deleted (void instead).
CREATE TRIGGER expense_no_delete
  BEFORE DELETE ON "Expense"
  FOR EACH ROW EXECUTE FUNCTION reject_update_delete();
