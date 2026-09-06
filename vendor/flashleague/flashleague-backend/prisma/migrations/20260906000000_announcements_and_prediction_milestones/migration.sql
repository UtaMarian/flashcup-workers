-- AlterTable: per-milestone prediction token rewards
ALTER TABLE "PredictionReward" ADD COLUMN "milestone" INTEGER NOT NULL DEFAULT 0;

-- DropIndex + recreate unique with milestone in the key
DROP INDEX "PredictionReward_userId_leagueId_day_key";
CREATE UNIQUE INDEX "PredictionReward_userId_leagueId_day_milestone_key" ON "PredictionReward"("userId", "leagueId", "day", "milestone");

-- CreateTable: game-wide admin announcements
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_active_createdAt_idx" ON "Announcement"("active", "createdAt");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
