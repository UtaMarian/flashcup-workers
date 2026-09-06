-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "googleId" TEXT,
    "facebookId" TEXT,
    "avatarUrl" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
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
    "lastDailyGiftAt" DATETIME,
    "starterPackClaimedAt" DATETIME,
    "tutorialSeenAt" DATETIME,
    "managerElectedAt" DATETIME,
    "pageTipsSeenJson" TEXT NOT NULL DEFAULT '[]',
    "attrSpeed" INTEGER NOT NULL DEFAULT 30,
    "attrTechnique" INTEGER NOT NULL DEFAULT 30,
    "attrPassing" INTEGER NOT NULL DEFAULT 30,
    "attrPhysical" INTEGER NOT NULL DEFAULT 30,
    "attrDefense" INTEGER NOT NULL DEFAULT 30,
    "attrAttack" INTEGER NOT NULL DEFAULT 30,
    "totalGoals" INTEGER NOT NULL DEFAULT 0,
    "totalAssists" INTEGER NOT NULL DEFAULT 0,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "mvpCount" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_User" ("attrAttack", "attrDefense", "attrPassing", "attrPhysical", "attrSpeed", "attrTechnique", "bannedAt", "bannedReason", "cash", "createdAt", "email", "energy", "firstName", "id", "isBot", "lastDailyBonusAt", "lastDailyGiftAt", "lastEnergyRegenAt", "lastLoginAt", "lastName", "level", "managerElectedAt", "mvpCount", "nationality", "pageTipsSeenJson", "passwordHash", "position", "registeredAt", "role", "starterPackClaimedAt", "status", "teamId", "tokens", "totalAssists", "totalGoals", "totalMatches", "tutorialSeenAt", "updatedAt", "xp") SELECT "attrAttack", "attrDefense", "attrPassing", "attrPhysical", "attrSpeed", "attrTechnique", "bannedAt", "bannedReason", "cash", "createdAt", "email", "energy", "firstName", "id", "isBot", "lastDailyBonusAt", "lastDailyGiftAt", "lastEnergyRegenAt", "lastLoginAt", "lastName", "level", "managerElectedAt", "mvpCount", "nationality", "pageTipsSeenJson", "passwordHash", "position", "registeredAt", "role", "starterPackClaimedAt", "status", "teamId", "tokens", "totalAssists", "totalGoals", "totalMatches", "tutorialSeenAt", "updatedAt", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_facebookId_key" ON "User"("facebookId");
CREATE INDEX "User_teamId_idx" ON "User"("teamId");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
