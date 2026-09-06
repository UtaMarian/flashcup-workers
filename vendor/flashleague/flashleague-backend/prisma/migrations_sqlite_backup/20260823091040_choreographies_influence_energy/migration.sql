-- CreateTable
CREATE TABLE "Choreography" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "cols" INTEGER NOT NULL DEFAULT 10,
    "cellsJson" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "influence" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Choreography_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Choreography_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Choreography_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "homeTotalLevel" INTEGER,
    "awayTotalLevel" INTEGER,
    "homeInfluence" REAL NOT NULL DEFAULT 0,
    "awayInfluence" REAL NOT NULL DEFAULT 0,
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
INSERT INTO "new_Match" ("awayAvgLevel", "awayGoals", "awayTeamId", "bracketRound", "homeAvgLevel", "homeGoals", "homeTeamId", "id", "leagueId", "nextMatchId", "nextMatchSlot", "penaltyScore", "round", "scheduledAt", "simulatedAt", "status") SELECT "awayAvgLevel", "awayGoals", "awayTeamId", "bracketRound", "homeAvgLevel", "homeGoals", "homeTeamId", "id", "leagueId", "nextMatchId", "nextMatchSlot", "penaltyScore", "round", "scheduledAt", "simulatedAt", "status" FROM "Match";
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
    "lastEnergyRegenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
INSERT INTO "new_User" ("attrAttack", "attrDefense", "attrPhysical", "attrSpeed", "attrTechnique", "bannedAt", "bannedReason", "cash", "createdAt", "email", "energy", "firstName", "id", "lastLoginAt", "lastName", "level", "passwordHash", "position", "registeredAt", "role", "status", "teamId", "tokens", "totalAssists", "totalGoals", "totalMatches", "updatedAt", "xp") SELECT "attrAttack", "attrDefense", "attrPhysical", "attrSpeed", "attrTechnique", "bannedAt", "bannedReason", "cash", "createdAt", "email", "energy", "firstName", "id", "lastLoginAt", "lastName", "level", "passwordHash", "position", "registeredAt", "role", "status", "teamId", "tokens", "totalAssists", "totalGoals", "totalMatches", "updatedAt", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_teamId_idx" ON "User"("teamId");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Choreography_matchId_teamId_idx" ON "Choreography"("matchId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Choreography_matchId_authorId_key" ON "Choreography"("matchId", "authorId");
