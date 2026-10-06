-- The void-reason CHECKs passed when voidReason was NULL: length(trim(NULL)) > 0 is NULL, and a CHECK treats
-- NULL as satisfied. COALESCE makes a missing reason fail.
ALTER TABLE "Expense" DROP CONSTRAINT expense_void_reason;
ALTER TABLE "Expense" ADD CONSTRAINT expense_void_reason CHECK (
  ("voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL)
  OR ("voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND length(trim(coalesce("voidReason", ''))) > 0)
);
ALTER TABLE "Receipt" DROP CONSTRAINT receipt_void_reason;
ALTER TABLE "Receipt" ADD CONSTRAINT receipt_void_reason CHECK (
  ("voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL)
  OR ("voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND length(trim(coalesce("voidReason", ''))) > 0)
);
