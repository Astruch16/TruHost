-- AlterEnum
ALTER TYPE "FilePurpose" ADD VALUE 'PROPERTY_PHOTO';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "coverPhotoId" UUID;

-- CreateTable
CREATE TABLE "PropertyPhoto" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "thumbFileId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyPhoto_fileId_key" ON "PropertyPhoto"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyPhoto_thumbFileId_key" ON "PropertyPhoto"("thumbFileId");

-- CreateIndex
CREATE INDEX "PropertyPhoto_propertyId_idx" ON "PropertyPhoto"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_coverPhotoId_key" ON "Property"("coverPhotoId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_coverPhotoId_fkey" FOREIGN KEY ("coverPhotoId") REFERENCES "PropertyPhoto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyPhoto" ADD CONSTRAINT "PropertyPhoto_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyPhoto" ADD CONSTRAINT "PropertyPhoto_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyPhoto" ADD CONSTRAINT "PropertyPhoto_thumbFileId_fkey" FOREIGN KEY ("thumbFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyPhoto" ADD CONSTRAINT "PropertyPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────── Raw SQL guards (not expressible in Prisma) ─────────

-- The two renditions are different files.
ALTER TABLE "PropertyPhoto" ADD CONSTRAINT property_photo_distinct_files CHECK ("fileId" <> "thumbFileId");

-- Both files are verified PROPERTY_PHOTO uploads for the same property as the photo.
CREATE FUNCTION property_photo_files_match() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM "StoredFile" f
      WHERE f.id IN (NEW."fileId", NEW."thumbFileId")
        AND f.purpose = 'PROPERTY_PHOTO' AND f."propertyId" = NEW."propertyId" AND f.status = 'VERIFIED') <> 2 THEN
    RAISE EXCEPTION 'PropertyPhoto % must use two verified property photos of its property', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_photo_files_match
  BEFORE INSERT ON "PropertyPhoto"
  FOR EACH ROW EXECUTE FUNCTION property_photo_files_match();

-- Photos are history: never changed or deleted. A new cover is a new row.
CREATE FUNCTION property_photo_guard() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PropertyPhoto % cannot be changed or deleted', OLD.id USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_photo_guard
  BEFORE UPDATE OR DELETE ON "PropertyPhoto"
  FOR EACH ROW EXECUTE FUNCTION property_photo_guard();

-- A property's cover must be one of its own photos.
CREATE FUNCTION property_cover_same_property() RETURNS trigger AS $$
BEGIN
  IF NEW."coverPhotoId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PropertyPhoto" p WHERE p.id = NEW."coverPhotoId" AND p."propertyId" = NEW.id
  ) THEN
    RAISE EXCEPTION 'Cover photo % does not belong to property %', NEW."coverPhotoId", NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_cover_same_property
  BEFORE INSERT OR UPDATE OF "coverPhotoId" ON "Property"
  FOR EACH ROW EXECUTE FUNCTION property_cover_same_property();
