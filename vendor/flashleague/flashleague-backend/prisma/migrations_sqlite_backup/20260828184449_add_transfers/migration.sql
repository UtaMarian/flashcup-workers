-- CreateTable
CREATE TABLE "TransferListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "fromTeamId" TEXT NOT NULL,
    "listedByManagerId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LISTED',
    "toTeamId" TEXT,
    "soldPrice" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" DATETIME,
    CONSTRAINT "TransferListing_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferListing_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferListing_listedByManagerId_fkey" FOREIGN KEY ("listedByManagerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferListing_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "toTeamId" TEXT NOT NULL,
    "fromTeamId" TEXT,
    "fromManagerId" TEXT NOT NULL,
    "listingId" TEXT,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "TransferOffer_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferOffer_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferOffer_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransferOffer_fromManagerId_fkey" FOREIGN KEY ("fromManagerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "TransferListing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "fromTeamId" TEXT,
    "toTeamId" TEXT NOT NULL,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'MARKET',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transfer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transfer_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transfer_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TransferListing_status_idx" ON "TransferListing"("status");

-- CreateIndex
CREATE INDEX "TransferListing_fromTeamId_idx" ON "TransferListing"("fromTeamId");

-- CreateIndex
CREATE INDEX "TransferOffer_targetUserId_status_idx" ON "TransferOffer"("targetUserId", "status");

-- CreateIndex
CREATE INDEX "TransferOffer_toTeamId_status_idx" ON "TransferOffer"("toTeamId", "status");

-- CreateIndex
CREATE INDEX "Transfer_playerId_idx" ON "Transfer"("playerId");

-- CreateIndex
CREATE INDEX "Transfer_createdAt_idx" ON "Transfer"("createdAt");
