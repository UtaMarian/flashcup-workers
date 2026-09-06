-- AlterTable
ALTER TABLE "TeamSeasonRecord" ADD COLUMN "draws" INTEGER;
ALTER TABLE "TeamSeasonRecord" ADD COLUMN "goalsAgainst" INTEGER;
ALTER TABLE "TeamSeasonRecord" ADD COLUMN "goalsFor" INTEGER;
ALTER TABLE "TeamSeasonRecord" ADD COLUMN "losses" INTEGER;
ALTER TABLE "TeamSeasonRecord" ADD COLUMN "points" INTEGER;
ALTER TABLE "TeamSeasonRecord" ADD COLUMN "wins" INTEGER;

-- CreateTable
CREATE TABLE "GameSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "leagueWinnerTeamPrize" INTEGER NOT NULL DEFAULT 100000,
    "championsQualifyTeamPrize" INTEGER NOT NULL DEFAULT 50000,
    "internationalQualifyTeamPrize" INTEGER NOT NULL DEFAULT 25000,
    "leagueWinnerPlayerBonus" INTEGER NOT NULL DEFAULT 500,
    "leaguePlayerMaxCash" INTEGER NOT NULL DEFAULT 1000,
    "leaguePlayerMinCash" INTEGER NOT NULL DEFAULT 50,
    "cupWinnerTeamPrize" INTEGER NOT NULL DEFAULT 50000,
    "cupFinalistTeamPrize" INTEGER NOT NULL DEFAULT 25000,
    "cupSemifinalistTeamPrize" INTEGER NOT NULL DEFAULT 10000,
    "cupQuarterfinalistTeamPrize" INTEGER NOT NULL DEFAULT 3000,
    "cupWinnerPlayerBonus" INTEGER NOT NULL DEFAULT 500,
    "cupFinalistPlayerPrize" INTEGER NOT NULL DEFAULT 500,
    "cupSemifinalistPlayerPrize" INTEGER NOT NULL DEFAULT 200,
    "cupQuarterfinalistPlayerPrize" INTEGER NOT NULL DEFAULT 100,
    "championsCupWinnerTeamPrize" INTEGER NOT NULL DEFAULT 75000,
    "championsCupWinnerPlayerBonus" INTEGER NOT NULL DEFAULT 750,
    "internationalCupWinnerTeamPrize" INTEGER NOT NULL DEFAULT 40000,
    "internationalCupWinnerPlayerBonus" INTEGER NOT NULL DEFAULT 400,
    "defaultMatchDayStartHour" INTEGER NOT NULL DEFAULT 16,
    "defaultMatchDayEndHour" INTEGER NOT NULL DEFAULT 22,
    "defaultDaysBetweenRounds" INTEGER NOT NULL DEFAULT 1,
    "defaultDoubleRoundRobin" BOOLEAN NOT NULL DEFAULT true,
    "defaultQualifyChampionsSlots" INTEGER NOT NULL DEFAULT 2,
    "defaultQualifyInternationalSlots" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SeasonArchive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonNumber" INTEGER NOT NULL,
    "leagueId" TEXT NOT NULL,
    "leagueName" TEXT NOT NULL,
    "leagueType" TEXT NOT NULL,
    "championTeamId" TEXT,
    "championTeamName" TEXT,
    "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SeasonArchiveStanding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "archiveId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "played" INTEGER,
    "wins" INTEGER,
    "draws" INTEGER,
    "losses" INTEGER,
    "goalsFor" INTEGER,
    "goalsAgainst" INTEGER,
    "points" INTEGER,
    CONSTRAINT "SeasonArchiveStanding_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "SeasonArchive" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeasonArchiveScorer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "archiveId" TEXT NOT NULL,
    "userId" TEXT,
    "playerName" TEXT NOT NULL,
    "teamId" TEXT,
    "teamName" TEXT NOT NULL,
    "goals" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    CONSTRAINT "SeasonArchiveScorer_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "SeasonArchive" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SeasonArchive_seasonNumber_idx" ON "SeasonArchive"("seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonArchive_seasonNumber_leagueId_key" ON "SeasonArchive"("seasonNumber", "leagueId");

-- CreateIndex
CREATE INDEX "SeasonArchiveStanding_archiveId_idx" ON "SeasonArchiveStanding"("archiveId");

-- CreateIndex
CREATE INDEX "SeasonArchiveScorer_archiveId_idx" ON "SeasonArchiveScorer"("archiveId");
