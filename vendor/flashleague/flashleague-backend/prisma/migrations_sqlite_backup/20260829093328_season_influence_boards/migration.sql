-- AlterTable
ALTER TABLE "Trophy" ADD COLUMN "tier" INTEGER;

-- CreateTable
CREATE TABLE "SeasonInfluenceReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "leagueId" TEXT NOT NULL,
    "leagueName" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "influence" REAL NOT NULL,
    "cash" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedAt" DATETIME,
    CONSTRAINT "SeasonInfluenceReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SeasonInfluenceReward_userId_collectedAt_idx" ON "SeasonInfluenceReward"("userId", "collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonInfluenceReward_userId_seasonNumber_leagueId_key" ON "SeasonInfluenceReward"("userId", "seasonNumber", "leagueId");
