-- Rooms: the type is the name; an optional label tells rooms of a type apart; `position` is the walkthrough order.
-- Display names are derived ("Kitchen", "Bedroom 2", "Bedroom · Primary"), never stored.

-- Room types: Outdoor becomes Patio/Deck; Half bath, Office, Hot tub and Garage are new. (Postgres can't reorder an
-- enum, so new values go next to their neighbours; screens use their own order.)
ALTER TYPE "RoomType" RENAME VALUE 'OUTDOOR' TO 'PATIO_DECK';
ALTER TYPE "RoomType" ADD VALUE 'HALF_BATH' AFTER 'BATHROOM';
ALTER TYPE "RoomType" ADD VALUE 'HOT_TUB' AFTER 'PATIO_DECK';
ALTER TYPE "RoomType" ADD VALUE 'GARAGE' AFTER 'HOT_TUB';
ALTER TYPE "RoomType" ADD VALUE 'OFFICE' AFTER 'ENTRY';

ALTER TABLE "Room" RENAME COLUMN "sortOrder" TO "position";
ALTER INDEX "Room_propertyId_sortOrder_idx" RENAME TO "Room_propertyId_position_idx";
ALTER TABLE "Room" RENAME COLUMN "name" TO "label";
ALTER TABLE "Room" ALTER COLUMN "label" DROP NOT NULL;

-- The label a room keeps from its old free-text name: none when the name only repeats the type, alone or with a
-- number, or only a number ("Bedroom", "bedroom 2", "Living room #1", "Outdoor", "1"), otherwise the name, tidied and
-- cut to 60 characters.
-- An Other room always keeps one. Kept (not dropped) so tests can check the rule; nothing else uses it.
CREATE FUNCTION room_label_from_name(room_type text, old_name text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN cleaned = '' THEN CASE WHEN room_type = 'OTHER' THEN 'Other' END
    WHEN pattern IS NOT NULL AND lower(cleaned) ~ ('^(' || pattern || ')(\s*#?\s*\d+)?$') THEN NULL
    WHEN pattern IS NOT NULL AND cleaned ~ '^#?\s*\d+$' THEN NULL
    ELSE btrim(left(cleaned, 60))
  END
  FROM (
    SELECT
      regexp_replace(btrim(coalesce(old_name, '')), '\s+', ' ', 'g') AS cleaned,
      CASE room_type
        WHEN 'BEDROOM' THEN 'bed ?room'
        WHEN 'BATHROOM' THEN 'bath ?room'
        WHEN 'HALF_BATH' THEN 'half[ -]?bath(room)?'
        WHEN 'KITCHEN' THEN 'kitchen'
        WHEN 'LIVING' THEN 'living( room)?'
        WHEN 'DINING' THEN 'dining( room)?'
        WHEN 'LAUNDRY' THEN 'laundry( room)?'
        WHEN 'ENTRY' THEN 'entry(way)?'
        WHEN 'OFFICE' THEN 'office'
        WHEN 'PATIO_DECK' THEN 'outdoor|patio|deck|patio ?/ ?deck'
        WHEN 'HOT_TUB' THEN 'hot ?tub'
        WHEN 'GARAGE' THEN 'garage'
      END AS pattern
  ) AS name_and_pattern
$$;

UPDATE "Room" SET "label" = room_label_from_name("type"::text, "label");

-- Two active rooms of a type with the same label would share a name: number the later ones ("Primary (2)").
WITH ranked AS (
  SELECT id, "label",
    row_number() OVER (PARTITION BY "propertyId", "type", lower("label") ORDER BY "position", "createdAt", id) AS n
  FROM "Room"
  WHERE "archivedAt" IS NULL AND "label" IS NOT NULL
)
UPDATE "Room" r
SET "label" = btrim(left(ranked."label", 54)) || ' (' || ranked.n || ')'
FROM ranked
WHERE r.id = ranked.id AND ranked.n > 1;

-- A label is tidy (no outer spaces, not empty, at most 60 characters); an Other room has one. (A CHECK passes on
-- NULL, so the second is written to fail when the label is missing.)
ALTER TABLE "Room" ADD CONSTRAINT room_label_tidy
  CHECK ("label" IS NULL OR ("label" = btrim("label") AND "label" <> '' AND char_length("label") <= 60));
ALTER TABLE "Room" ADD CONSTRAINT room_other_has_label
  CHECK ("type"::text <> 'OTHER' OR coalesce("label", '') <> '');

-- No two active rooms of a property share a name: unlabelled ones are numbered, so it comes down to type + label.
CREATE UNIQUE INDEX room_label_unique ON "Room" ("propertyId", "type", lower("label"))
  WHERE "archivedAt" IS NULL AND "label" IS NOT NULL;
