-- CreateTable
CREATE TABLE "Trophy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonNumber" INTEGER NOT NULL,
    "competitionType" TEXT NOT NULL,
    "competitionName" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "awardedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trophy_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrophyPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trophyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "TrophyPlayer_trophyId_fkey" FOREIGN KEY ("trophyId") REFERENCES "Trophy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrophyPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamSeasonRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonNumber" INTEGER NOT NULL,
    "leagueId" TEXT NOT NULL,
    "leagueName" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "finalPosition" INTEGER,
    "totalInfluence" REAL NOT NULL DEFAULT 0,
    "starPlayerId" TEXT,
    "starPlayerName" TEXT,
    "cupResult" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamSeasonRecord_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    CONSTRAINT "League_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "League_parentLeagueId_fkey" FOREIGN KEY ("parentLeagueId") REFERENCES "League" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_League" ("createdAt", "daysBetweenRounds", "doubleRoundRobin", "id", "matchDayEndHour", "matchDayStartHour", "name", "parentLeagueId", "qualifyChampionsSlots", "qualifyInternationalSlots", "season", "startDate", "status", "type", "updatedAt") SELECT "createdAt", "daysBetweenRounds", "doubleRoundRobin", "id", "matchDayEndHour", "matchDayStartHour", "name", "parentLeagueId", "qualifyChampionsSlots", "qualifyInternationalSlots", "season", "startDate", "status", "type", "updatedAt" FROM "League";
DROP TABLE "League";
ALTER TABLE "new_League" RENAME TO "League";
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "colorHex" TEXT NOT NULL DEFAULT '#1F6F4A',
    "logoUrl" TEXT,
    "leagueId" TEXT,
    "budget" INTEGER NOT NULL DEFAULT 100000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("city", "colorHex", "createdAt", "id", "leagueId", "logoUrl", "name") SELECT "city", "colorHex", "createdAt", "id", "leagueId", "logoUrl", "name" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE INDEX "Team_leagueId_idx" ON "Team"("leagueId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "position" TEXT,
    "teamId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "energy" INTEGER NOT NULL DEFAULT 100,
    "lastEnergyRegenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDailyBonusAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attrSpeed" INTEGER NOT NULL DEFAULT 30,
    "attrTechnique" INTEGER NOT NULL DEFAULT 30,
    "attrPhysical" INTEGER NOT NULL DEFAULT 30,
    "attrDefense" INTEGER NOT NULL DEFAULT 30,
    "attrAttack" INTEGER NOT NULL DEFAULT 30,
    "totalGoals" INTEGER NOT NULL DEFAULT 0,
    "totalAssists" INTEGER NOT NULL DEFAULT 0,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "cash" INTEGER NOT NULL DEFAULT 100,
    "tokens" INTEGER NOT NULL DEFAULT 10,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME,
    "bannedAt" DATETIME,
    "bannedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("attrAttack", "attrDefense", "attrPhysical", "attrSpeed", "attrTechnique", "bannedAt", "bannedReason", "cash", "createdAt", "email", "energy", "firstName", "id", "lastEnergyRegenAt", "lastLoginAt", "lastName", "level", "passwordHash", "position", "registeredAt", "role", "status", "teamId", "tokens", "totalAssists", "totalGoals", "totalMatches", "updatedAt", "xp") SELECT "attrAttack", "attrDefense", "attrPhysical", "attrSpeed", "attrTechnique", "bannedAt", "bannedReason", "cash", "createdAt", "email", "energy", "firstName", "id", "lastEnergyRegenAt", "lastLoginAt", "lastName", "level", "passwordHash", "position", "registeredAt", "role", "status", "teamId", "tokens", "totalAssists", "totalGoals", "totalMatches", "updatedAt", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_teamId_idx" ON "User"("teamId");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Trophy_teamId_idx" ON "Trophy"("teamId");

-- CreateIndex
CREATE INDEX "TrophyPlayer_userId_idx" ON "TrophyPlayer"("userId");

-- CreateIndex
CREATE INDEX "TrophyPlayer_trophyId_idx" ON "TrophyPlayer"("trophyId");

-- CreateIndex
CREATE INDEX "TeamSeasonRecord_teamId_idx" ON "TeamSeasonRecord"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSeasonRecord_seasonNumber_teamId_key" ON "TeamSeasonRecord"("seasonNumber", "teamId");
