-- DropIndex
DROP INDEX "Choreography_matchId_authorId_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "nationality" TEXT;

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_League" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LIGA',
    "season" TEXT NOT NULL DEFAULT '2026/27',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" DATETIME,
    "closedAt" DATETIME,
    "seasonId" TEXT,
    "seasonNumber" INTEGER,
    "winnerTeamId" TEXT,
    "matchDayStartHour" INTEGER NOT NULL DEFAULT 16,
    "matchDayEndHour" INTEGER NOT NULL DEFAULT 22,
    "daysBetweenRounds" INTEGER NOT NULL DEFAULT 1,
    "doubleRoundRobin" BOOLEAN NOT NULL DEFAULT true,
    "qualifyChampionsSlots" INTEGER NOT NULL DEFAULT 2,
    "qualifyInternationalSlots" INTEGER NOT NULL DEFAULT 2,
    "parentLeagueId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "League_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "League_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "League_parentLeagueId_fkey" FOREIGN KEY ("parentLeagueId") REFERENCES "League" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_League" ("closedAt", "createdAt", "daysBetweenRounds", "doubleRoundRobin", "id", "matchDayEndHour", "matchDayStartHour", "name", "parentLeagueId", "qualifyChampionsSlots", "qualifyInternationalSlots", "season", "seasonNumber", "startDate", "status", "type", "updatedAt", "winnerTeamId") SELECT "closedAt", "createdAt", "daysBetweenRounds", "doubleRoundRobin", "id", "matchDayEndHour", "matchDayStartHour", "name", "parentLeagueId", "qualifyChampionsSlots", "qualifyInternationalSlots", "season", "seasonNumber", "startDate", "status", "type", "updatedAt", "winnerTeamId" FROM "League";
DROP TABLE "League";
ALTER TABLE "new_League" RENAME TO "League";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Season_number_key" ON "Season"("number");

-- CreateIndex
CREATE INDEX "Choreography_matchId_authorId_idx" ON "Choreography"("matchId", "authorId");
