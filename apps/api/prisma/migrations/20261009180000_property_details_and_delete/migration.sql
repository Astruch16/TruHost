-- Property details: description, layout and listing links.
ALTER TABLE "Property" ADD COLUMN "description" TEXT,
ADD COLUMN "bedrooms" INTEGER,
ADD COLUMN "bathrooms" INTEGER,
ADD COLUMN "halfBathrooms" INTEGER,
ADD COLUMN "maxGuests" INTEGER,
ADD COLUMN "airbnbUrl" TEXT,
ADD COLUMN "vrboUrl" TEXT,
ADD COLUMN "bookingComUrl" TEXT;

ALTER TABLE "Property" ADD CONSTRAINT property_layout_sane CHECK (
  coalesce("bedrooms", 0) BETWEEN 0 AND 50
  AND coalesce("bathrooms", 0) BETWEEN 0 AND 50
  AND coalesce("halfBathrooms", 0) BETWEEN 0 AND 20
  AND coalesce("maxGuests", 1) BETWEEN 1 AND 100
);
ALTER TABLE "Property" ADD CONSTRAINT property_description_length CHECK (char_length(coalesce("description", '')) <= 1000);

-- Deleting a property (only one with no bookings, expenses or receipts: checked in the API) removes its photos and
-- their files too. Those rows are otherwise protected; the guards let a delete through only inside the delete
-- transaction for that same property, which sets truhost.deleting_property (transaction-local) to its id.
CREATE OR REPLACE FUNCTION stored_file_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'VERIFIED'
       AND coalesce(current_setting('truhost.deleting_property', true), '') <> OLD."propertyId"::text THEN
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

CREATE OR REPLACE FUNCTION property_photo_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND coalesce(current_setting('truhost.deleting_property', true), '') = OLD."propertyId"::text THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'PropertyPhoto % cannot be changed or deleted', OLD.id USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
