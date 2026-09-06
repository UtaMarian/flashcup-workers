-- AlterTable
ALTER TABLE "Prediction" ADD COLUMN "superMultiplier" INTEGER;

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameEventClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameEventClaim_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GameEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameEventClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GameEvent_status_endsAt_idx" ON "GameEvent"("status", "endsAt");

-- CreateIndex
CREATE INDEX "GameEvent_type_status_idx" ON "GameEvent"("type", "status");

-- CreateIndex
CREATE INDEX "GameEventClaim_eventId_userId_kind_idx" ON "GameEventClaim"("eventId", "userId", "kind");

-- CreateIndex
CREATE INDEX "GameEventClaim_userId_kind_idx" ON "GameEventClaim"("userId", "kind");
