-- Supplies (health bar + restock threshold) and notifications (supply alerts).


CREATE TYPE "SupplyCategory" AS ENUM ('BATHROOM', 'KITCHEN', 'LAUNDRY', 'CLEANING', 'OTHER');

CREATE TYPE "NotificationKind" AS ENUM ('SUPPLY_LOW', 'SUPPLY_OUT');


CREATE TABLE "SupplyItem" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SupplyCategory" NOT NULL DEFAULT 'OTHER',
    "thresholdPct" INTEGER NOT NULL DEFAULT 25,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplyStatus" (
    "id" UUID NOT NULL,
    "supplyItemId" UUID NOT NULL,
    "levelPct" INTEGER NOT NULL,
    "note" TEXT,
    "reportedById" UUID NOT NULL,
    "reportedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyStatus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "propertyId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "readAt" TIMESTAMPTZ,
    "emailSentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplyItem_propertyId_position_idx" ON "SupplyItem"("propertyId", "position");

CREATE INDEX "SupplyStatus_supplyItemId_reportedAt_idx" ON "SupplyStatus"("supplyItemId", "reportedAt" DESC);

CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

CREATE UNIQUE INDEX "Notification_userId_sourceId_key" ON "Notification"("userId", "sourceId");

ALTER TABLE "SupplyItem" ADD CONSTRAINT "SupplyItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplyStatus" ADD CONSTRAINT "SupplyStatus_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "SupplyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplyStatus" ADD CONSTRAINT "SupplyStatus_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- An item's name is tidy and at most 60 characters; its restock point is 5–95% of full.
ALTER TABLE "SupplyItem" ADD CONSTRAINT supply_item_name_tidy
  CHECK (name = btrim(name) AND name <> '' AND char_length(name) <= 60);
ALTER TABLE "SupplyItem" ADD CONSTRAINT supply_item_threshold_range CHECK ("thresholdPct" BETWEEN 5 AND 95);
-- No two active items of a property share a name (ignoring case).
CREATE UNIQUE INDEX supply_item_name_unique ON "SupplyItem" ("propertyId", lower(name)) WHERE "archivedAt" IS NULL;

-- A reading is a percent of full.
ALTER TABLE "SupplyStatus" ADD CONSTRAINT supply_status_level_range CHECK ("levelPct" BETWEEN 0 AND 100);

-- Readings are a record of what was seen: never changed, never deleted, except along with their property when an
-- empty property is deleted (that transaction sets truhost.deleting_property to its id).
CREATE FUNCTION supply_status_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND coalesce(current_setting('truhost.deleting_property', true), '') =
         (SELECT "propertyId"::text FROM "SupplyItem" WHERE id = OLD."supplyItemId") THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Supply readings are append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supply_status_append_only
  BEFORE UPDATE OR DELETE ON "SupplyStatus"
  FOR EACH ROW EXECUTE FUNCTION supply_status_append_only();
