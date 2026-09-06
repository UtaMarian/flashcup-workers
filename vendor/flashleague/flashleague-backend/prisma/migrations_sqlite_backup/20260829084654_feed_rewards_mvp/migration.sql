-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "competitionType" TEXT NOT NULL,
    "cash" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "isMvp" BOOLEAN NOT NULL DEFAULT false,
    "influence" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedAt" DATETIME,
    CONSTRAINT "MatchReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MatchReward_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LevelUpReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "cash" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedAt" DATETIME,
    CONSTRAINT "LevelUpReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
INSERT INTO "new_User" ("attrAttack", "attrDefense", "attrPhysical", "attrSpeed", "attrTechnique", "bannedAt", "bannedReason", "cash", "createdAt", "email", "energy", "firstName", "id", "isBot", "lastDailyBonusAt", "lastEnergyRegenAt", "lastLoginAt", "lastName", "level", "nationality", "passwordHash", "position", "registeredAt", "role", "status", "teamId", "tokens", "totalAssists", "totalGoals", "totalMatches", "updatedAt", "xp") SELECT "attrAttack", "attrDefense", "attrPhysical", "attrSpeed", "attrTechnique", "bannedAt", "bannedReason", "cash", "createdAt", "email", "energy", "firstName", "id", "isBot", "lastDailyBonusAt", "lastEnergyRegenAt", "lastLoginAt", "lastName", "level", "nationality", "passwordHash", "position", "registeredAt", "role", "status", "teamId", "tokens", "totalAssists", "totalGoals", "totalMatches", "updatedAt", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_teamId_idx" ON "User"("teamId");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Comment_postId_idx" ON "Comment"("postId");

-- CreateIndex
CREATE INDEX "PostReaction_postId_idx" ON "PostReaction"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostReaction_postId_userId_key" ON "PostReaction"("postId", "userId");

-- CreateIndex
CREATE INDEX "MatchReward_userId_collectedAt_idx" ON "MatchReward"("userId", "collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchReward_userId_matchId_key" ON "MatchReward"("userId", "matchId");

-- CreateIndex
CREATE INDEX "LevelUpReward_userId_collectedAt_idx" ON "LevelUpReward"("userId", "collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LevelUpReward_userId_level_key" ON "LevelUpReward"("userId", "level");
