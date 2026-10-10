-- Room numbers are stored, not derived from the walkthrough order: reordering never renames a room ("Bedroom 2" and
-- "Bedroom 3" no longer swap), and a number never moves to a different room, so names in photo history stay true.

ALTER TABLE "Room" ADD COLUMN "number" INTEGER;

-- Once, from the current walkthrough order: per property and type, active rooms first in walkthrough order (so every
-- name shown today stays the same), then deleted (archived) rooms, which keep a number of their own.
WITH numbered AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY "propertyId", "type"
      ORDER BY ("archivedAt" IS NOT NULL), "position", "createdAt", id
    ) AS n
  FROM "Room"
)
UPDATE "Room" r SET "number" = numbered.n FROM numbered WHERE r.id = numbered.id;

ALTER TABLE "Room" ALTER COLUMN "number" SET NOT NULL;
ALTER TABLE "Room" ADD CONSTRAINT room_number_positive CHECK ("number" >= 1);
CREATE UNIQUE INDEX "Room_propertyId_type_number_key" ON "Room"("propertyId", "type", "number");
