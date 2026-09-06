/*
  Warnings:

  - You are about to drop the column `awardedAt` on the `PredictionReward` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Prediction" ADD COLUMN "collectedAt" DATETIME;
ALTER TABLE "Prediction" ADD COLUMN "payout" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PredictionReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "day" DATETIME NOT NULL,
    "eligibleAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedAt" DATETIME,
    CONSTRAINT "PredictionReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PredictionReward_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PredictionReward" ("day", "id", "leagueId", "userId") SELECT "day", "id", "leagueId", "userId" FROM "PredictionReward";
DROP TABLE "PredictionReward";
ALTER TABLE "new_PredictionReward" RENAME TO "PredictionReward";
CREATE INDEX "PredictionReward_userId_idx" ON "PredictionReward"("userId");
CREATE UNIQUE INDEX "PredictionReward_userId_leagueId_day_key" ON "PredictionReward"("userId", "leagueId", "day");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
