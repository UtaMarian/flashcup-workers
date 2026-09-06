-- CreateTable
CREATE TABLE "Lineup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "formation" TEXT NOT NULL,
    "slotsJson" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT 'ECHILIBRAT',
    "marking" TEXT NOT NULL DEFAULT 'ZONAL',
    "pressing" TEXT NOT NULL DEFAULT 'MEDIU',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "position" TEXT,
    "nationality" TEXT,
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
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME,
    "bannedAt" DATETIME,
    "bannedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("attrAttack", "attrDefense", "attrPhysical", "attrSpeed", "attrTechnique", "bannedAt", "bannedReason", "cash", "createdAt", "email", "energy", "firstName", "id", "lastDailyBonusAt", "lastEnergyRegenAt", "lastLoginAt", "lastName", "level", "nationality", "passwordHash", "position", "registeredAt", "role", "status", "teamId", "tokens", "totalAssists", "totalGoals", "totalMatches", "updatedAt", "xp") SELECT "attrAttack", "attrDefense", "attrPhysical", "attrSpeed", "attrTechnique", "bannedAt", "bannedReason", "cash", "createdAt", "email", "energy", "firstName", "id", "lastDailyBonusAt", "lastEnergyRegenAt", "lastLoginAt", "lastName", "level", "nationality", "passwordHash", "position", "registeredAt", "role", "status", "teamId", "tokens", "totalAssists", "totalGoals", "totalMatches", "updatedAt", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_teamId_idx" ON "User"("teamId");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Lineup_teamId_key" ON "Lineup"("teamId");
