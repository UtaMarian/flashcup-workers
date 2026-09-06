-- CreateTable
CREATE TABLE "ManagerPoll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closesAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    CONSTRAINT "ManagerPoll_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ManagerPoll_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ManagerPoll_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManagerPollVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pollId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManagerPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ManagerPoll" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ManagerPollVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ManagerPoll_teamId_status_idx" ON "ManagerPoll"("teamId", "status");

-- CreateIndex
CREATE INDEX "ManagerPoll_status_closesAt_idx" ON "ManagerPoll"("status", "closesAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerPollVote_pollId_voterId_key" ON "ManagerPollVote"("pollId", "voterId");
