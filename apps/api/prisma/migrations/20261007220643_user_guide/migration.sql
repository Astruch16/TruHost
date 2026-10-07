-- The guide character each user picks in Settings (docs/design/Mascots.dc.html). Defaults to Sage.
CREATE TYPE "Guide" AS ENUM ('SAGE', 'JUNIPER', 'PIP');

ALTER TABLE "User" ADD COLUMN "guide" "Guide" NOT NULL DEFAULT 'SAGE';
