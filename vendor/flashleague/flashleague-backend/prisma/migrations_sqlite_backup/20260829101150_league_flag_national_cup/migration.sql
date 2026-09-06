-- AlterTable
ALTER TABLE "League" ADD COLUMN "flag" TEXT;

-- AlterTable
ALTER TABLE "Trophy" ADD COLUMN "countryCode" TEXT;

-- Rename "Cupa Internă" -> "Cupa Națională" in all stored snapshots.
UPDATE "League"           SET "name" = REPLACE("name", 'Cupa Internă', 'Cupa Națională') WHERE "name" LIKE '%Cupa Internă%';
UPDATE "Trophy"           SET "competitionName" = REPLACE("competitionName", 'Cupa Internă', 'Cupa Națională') WHERE "competitionName" LIKE '%Cupa Internă%';
UPDATE "SeasonArchive"    SET "leagueName" = REPLACE("leagueName", 'Cupa Internă', 'Cupa Națională') WHERE "leagueName" LIKE '%Cupa Internă%';
UPDATE "TeamSeasonRecord" SET "leagueName" = REPLACE("leagueName", 'Cupa Internă', 'Cupa Națională') WHERE "leagueName" LIKE '%Cupa Internă%';
UPDATE "Post"             SET "text" = REPLACE("text", 'Cupa Internă', 'Cupa Națională') WHERE "type" = 'TROPHY' AND "text" LIKE '%Cupa Internă%';
