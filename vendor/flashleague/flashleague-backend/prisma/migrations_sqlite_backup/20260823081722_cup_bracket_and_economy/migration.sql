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
    "matchDayStartHour" INTEGER NOT NULL DEFAULT 16,
    "matchDayEndHour" INTEGER NOT NULL DEFAULT 22,
    "daysBetweenRounds" INTEGER NOT NULL DEFAULT 1,
    "doubleRoundRobin" BOOLEAN NOT NULL DEFAULT true,
    "qualifyChampionsSlots" INTEGER NOT NULL DEFAULT 2,
    "qualifyInternationalSlots" INTEGER NOT NULL DEFAULT 2,
    "parentLeagueId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "League_parentLeagueId_fkey" FOREIGN KEY ("parentLeagueId") REFERENCES "League" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_League" ("createdAt", "daysBetweenRounds", "doubleRoundRobin", "id", "matchDayEndHour", "matchDayStartHour", "name", "qualifyChampionsSlots", "qualifyInternationalSlots", "season", "startDate", "status", "type", "updatedAt") SELECT "createdAt", "daysBetweenRounds", "doubleRoundRobin", "id", "matchDayEndHour", "matchDayStartHour", "name", "qualifyChampionsSlots", "qualifyInternationalSlots", "season", "startDate", "status", "type", "updatedAt" FROM "League";
DROP TABLE "League";
ALTER TABLE "new_League" RENAME TO "League";
CREATE TABLE "new_Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "homeGoals" INTEGER,
    "awayGoals" INTEGER,
    "homeAvgLevel" INTEGER,
    "awayAvgLevel" INTEGER,
    "bracketRound" TEXT,
    "nextMatchId" TEXT,
    "nextMatchSlot" TEXT,
    "penaltyScore" TEXT,
    "simulatedAt" DATETIME,
    CONSTRAINT "Match_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_nextMatchId_fkey" FOREIGN KEY ("nextMatchId") REFERENCES "Match" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("awayAvgLevel", "awayGoals", "awayTeamId", "homeAvgLevel", "homeGoals", "homeTeamId", "id", "leagueId", "round", "scheduledAt", "simulatedAt", "status") SELECT "awayAvgLevel", "awayGoals", "awayTeamId", "homeAvgLevel", "homeGoals", "homeTeamId", "id", "leagueId", "round", "scheduledAt", "simulatedAt", "status" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
CREATE INDEX "Match_leagueId_round_idx" ON "Match"("leagueId", "round");
CREATE INDEX "Match_status_scheduledAt_idx" ON "Match"("status", "scheduledAt");
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
INSERT INTO "new_User" ("attrAttack", "attrDefense", "attrPhysical", "attrSpeed", "attrTechnique", "bannedAt", "bannedReason", "createdAt", "email", "energy", "firstName", "id", "lastLoginAt", "lastName", "level", "passwordHash", "position", "registeredAt", "role", "status", "teamId", "totalAssists", "totalGoals", "totalMatches", "updatedAt", "xp") SELECT "attrAttack", "attrDefense", "attrPhysical", "attrSpeed", "attrTechnique", "bannedAt", "bannedReason", "createdAt", "email", "energy", "firstName", "id", "lastLoginAt", "lastName", "level", "passwordHash", "position", "registeredAt", "role", "status", "teamId", "totalAssists", "totalGoals", "totalMatches", "updatedAt", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_teamId_idx" ON "User"("teamId");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
