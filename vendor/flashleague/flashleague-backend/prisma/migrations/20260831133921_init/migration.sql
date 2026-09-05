-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "googleId" TEXT,
    "facebookId" TEXT,
    "avatarUrl" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
    "emailVerifiedAt" TIMESTAMP(3),
    "emailVerifyCodeHash" TEXT,
    "emailVerifyExpiresAt" TIMESTAMP(3),
    "emailVerifySentAt" TIMESTAMP(3),
    "emailVerifyAttempts" INTEGER NOT NULL DEFAULT 0,
    "passwordResetCodeHash" TEXT,
    "passwordResetExpiresAt" TIMESTAMP(3),
    "passwordResetSentAt" TIMESTAMP(3),
    "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "position" TEXT,
    "nationality" TEXT,
    "teamId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "energy" INTEGER NOT NULL DEFAULT 100,
    "lastEnergyRegenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDailyBonusAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDailyGiftAt" TIMESTAMP(3),
    "starterPackClaimedAt" TIMESTAMP(3),
    "tutorialSeenAt" TIMESTAMP(3),
    "managerElectedAt" TIMESTAMP(3),
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
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "bannedAt" TIMESTAMP(3),
    "bannedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT 'JOINED',

    CONSTRAINT "TeamHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "colorHex" TEXT NOT NULL DEFAULT '#1F6F4A',
    "logoUrl" TEXT,
    "leagueId" TEXT,
    "budget" INTEGER NOT NULL DEFAULT 100000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lineup" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "formation" TEXT NOT NULL,
    "slotsJson" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT 'ECHILIBRAT',
    "marking" TEXT NOT NULL DEFAULT 'ZONAL',
    "pressing" TEXT NOT NULL DEFAULT 'MEDIU',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LIGA',
    "season" TEXT NOT NULL DEFAULT '2026/27',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "flag" TEXT,
    "startDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "seasonId" TEXT,
    "seasonNumber" INTEGER,
    "winnerTeamId" TEXT,
    "matchDayStartHour" INTEGER NOT NULL DEFAULT 16,
    "matchDayEndHour" INTEGER NOT NULL DEFAULT 22,
    "daysBetweenRounds" INTEGER NOT NULL DEFAULT 1,
    "doubleRoundRobin" BOOLEAN NOT NULL DEFAULT true,
    "qualifyChampionsSlots" INTEGER NOT NULL DEFAULT 2,
    "qualifyInternationalSlots" INTEGER NOT NULL DEFAULT 2,
    "parentLeagueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "homeGoals" INTEGER,
    "awayGoals" INTEGER,
    "homeAvgLevel" INTEGER,
    "awayAvgLevel" INTEGER,
    "homeTotalLevel" INTEGER,
    "awayTotalLevel" INTEGER,
    "homeInfluence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "awayInfluence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bracketRound" TEXT,
    "nextMatchId" TEXT,
    "nextMatchSlot" TEXT,
    "penaltyScore" TEXT,
    "winnerTeamId" TEXT,
    "simulatedAt" TIMESTAMP(3),

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "stake" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'PENDING',
    "payout" INTEGER,
    "superMultiplier" INTEGER,
    "settledAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "eligibleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedAt" TIMESTAMP(3),

    CONSTRAINT "PredictionReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "minute" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GOAL',
    "teamId" TEXT NOT NULL,
    "scorerId" TEXT,
    "assistId" TEXT,

    CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "authorId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "trophyId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "competitionType" TEXT NOT NULL,
    "cash" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "isMvp" BOOLEAN NOT NULL DEFAULT false,
    "influence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedAt" TIMESTAMP(3),

    CONSTRAINT "MatchReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelUpReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "cash" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedAt" TIMESTAMP(3),

    CONSTRAINT "LevelUpReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonInfluenceReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "leagueId" TEXT NOT NULL,
    "leagueName" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "influence" DOUBLE PRECISION NOT NULL,
    "cash" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedAt" TIMESTAMP(3),

    CONSTRAINT "SeasonInfluenceReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Choreography" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "cols" INTEGER NOT NULL DEFAULT 10,
    "cellsJson" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "influence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Choreography_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trophy" (
    "id" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "competitionType" TEXT NOT NULL,
    "competitionName" TEXT NOT NULL,
    "tier" INTEGER,
    "countryCode" TEXT,
    "teamId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trophy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrophyPlayer" (
    "id" TEXT NOT NULL,
    "trophyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TrophyPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamSeasonRecord" (
    "id" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "leagueId" TEXT NOT NULL,
    "leagueName" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "finalPosition" INTEGER,
    "totalInfluence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "starPlayerId" TEXT,
    "starPlayerName" TEXT,
    "cupResult" TEXT,
    "points" INTEGER,
    "wins" INTEGER,
    "draws" INTEGER,
    "losses" INTEGER,
    "goalsFor" INTEGER,
    "goalsAgainst" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamSeasonRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "leagueWinnerTeamPrize" INTEGER NOT NULL DEFAULT 100000,
    "championsQualifyTeamPrize" INTEGER NOT NULL DEFAULT 50000,
    "internationalQualifyTeamPrize" INTEGER NOT NULL DEFAULT 25000,
    "leagueWinnerPlayerBonus" INTEGER NOT NULL DEFAULT 500,
    "leaguePlayerMaxCash" INTEGER NOT NULL DEFAULT 1000,
    "leaguePlayerMinCash" INTEGER NOT NULL DEFAULT 50,
    "cupWinnerTeamPrize" INTEGER NOT NULL DEFAULT 50000,
    "cupFinalistTeamPrize" INTEGER NOT NULL DEFAULT 25000,
    "cupSemifinalistTeamPrize" INTEGER NOT NULL DEFAULT 10000,
    "cupQuarterfinalistTeamPrize" INTEGER NOT NULL DEFAULT 3000,
    "cupWinnerPlayerBonus" INTEGER NOT NULL DEFAULT 500,
    "cupFinalistPlayerPrize" INTEGER NOT NULL DEFAULT 500,
    "cupSemifinalistPlayerPrize" INTEGER NOT NULL DEFAULT 200,
    "cupQuarterfinalistPlayerPrize" INTEGER NOT NULL DEFAULT 100,
    "championsCupWinnerTeamPrize" INTEGER NOT NULL DEFAULT 75000,
    "championsCupWinnerPlayerBonus" INTEGER NOT NULL DEFAULT 750,
    "internationalCupWinnerTeamPrize" INTEGER NOT NULL DEFAULT 40000,
    "internationalCupWinnerPlayerBonus" INTEGER NOT NULL DEFAULT 400,
    "nationalSupercupWinnerTeamPrize" INTEGER NOT NULL DEFAULT 30000,
    "nationalSupercupWinnerPlayerBonus" INTEGER NOT NULL DEFAULT 300,
    "internationalSupercupWinnerTeamPrize" INTEGER NOT NULL DEFAULT 50000,
    "internationalSupercupWinnerPlayerBonus" INTEGER NOT NULL DEFAULT 500,
    "supercupDay" INTEGER NOT NULL DEFAULT 2,
    "nationalCupStartRound" INTEGER NOT NULL DEFAULT 5,
    "continentalCupStartRound" INTEGER NOT NULL DEFAULT 13,
    "cupMatchDayStartHour" INTEGER NOT NULL DEFAULT 18,
    "cupMatchDayEndHour" INTEGER NOT NULL DEFAULT 22,
    "defaultMatchDayStartHour" INTEGER NOT NULL DEFAULT 16,
    "defaultMatchDayEndHour" INTEGER NOT NULL DEFAULT 22,
    "defaultDaysBetweenRounds" INTEGER NOT NULL DEFAULT 1,
    "defaultDoubleRoundRobin" BOOLEAN NOT NULL DEFAULT true,
    "defaultQualifyChampionsSlots" INTEGER NOT NULL DEFAULT 2,
    "defaultQualifyInternationalSlots" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonArchive" (
    "id" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "leagueId" TEXT NOT NULL,
    "leagueName" TEXT NOT NULL,
    "leagueType" TEXT NOT NULL,
    "championTeamId" TEXT,
    "championTeamName" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonArchive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonArchiveStanding" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "played" INTEGER,
    "wins" INTEGER,
    "draws" INTEGER,
    "losses" INTEGER,
    "goalsFor" INTEGER,
    "goalsAgainst" INTEGER,
    "points" INTEGER,

    CONSTRAINT "SeasonArchiveStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonArchiveScorer" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "userId" TEXT,
    "playerName" TEXT NOT NULL,
    "teamId" TEXT,
    "teamName" TEXT NOT NULL,
    "goals" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,

    CONSTRAINT "SeasonArchiveScorer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferListing" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fromTeamId" TEXT NOT NULL,
    "listedByManagerId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LISTED',
    "toTeamId" TEXT,
    "soldPrice" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),

    CONSTRAINT "TransferListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferOffer" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "toTeamId" TEXT NOT NULL,
    "fromTeamId" TEXT,
    "fromManagerId" TEXT NOT NULL,
    "listingId" TEXT,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "TransferOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fromTeamId" TEXT,
    "toTeamId" TEXT NOT NULL,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'MARKET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerPoll" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ManagerPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerPollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerPollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEventClaim" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEventClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'GENERAL',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangelogEntry" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "releaseDate" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortKey" INTEGER NOT NULL DEFAULT 0,
    "translations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangelogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_facebookId_key" ON "User"("facebookId");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "TeamHistory_userId_idx" ON "TeamHistory"("userId");

-- CreateIndex
CREATE INDEX "TeamHistory_teamId_idx" ON "TeamHistory"("teamId");

-- CreateIndex
CREATE INDEX "Team_leagueId_idx" ON "Team"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "Lineup_teamId_key" ON "Lineup"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_number_key" ON "Season"("number");

-- CreateIndex
CREATE INDEX "Match_leagueId_round_idx" ON "Match"("leagueId", "round");

-- CreateIndex
CREATE INDEX "Match_status_scheduledAt_idx" ON "Match"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Prediction_userId_idx" ON "Prediction"("userId");

-- CreateIndex
CREATE INDEX "Prediction_matchId_idx" ON "Prediction"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_userId_matchId_key" ON "Prediction"("userId", "matchId");

-- CreateIndex
CREATE INDEX "PredictionReward_userId_idx" ON "PredictionReward"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionReward_userId_leagueId_day_key" ON "PredictionReward"("userId", "leagueId", "day");

-- CreateIndex
CREATE INDEX "MatchEvent_matchId_idx" ON "MatchEvent"("matchId");

-- CreateIndex
CREATE INDEX "Post_teamId_idx" ON "Post"("teamId");

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

-- CreateIndex
CREATE INDEX "SeasonInfluenceReward_userId_collectedAt_idx" ON "SeasonInfluenceReward"("userId", "collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonInfluenceReward_userId_seasonNumber_leagueId_key" ON "SeasonInfluenceReward"("userId", "seasonNumber", "leagueId");

-- CreateIndex
CREATE INDEX "Choreography_matchId_teamId_idx" ON "Choreography"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "Choreography_matchId_authorId_idx" ON "Choreography"("matchId", "authorId");

-- CreateIndex
CREATE INDEX "Trophy_teamId_idx" ON "Trophy"("teamId");

-- CreateIndex
CREATE INDEX "TrophyPlayer_userId_idx" ON "TrophyPlayer"("userId");

-- CreateIndex
CREATE INDEX "TrophyPlayer_trophyId_idx" ON "TrophyPlayer"("trophyId");

-- CreateIndex
CREATE INDEX "TeamSeasonRecord_teamId_idx" ON "TeamSeasonRecord"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSeasonRecord_seasonNumber_teamId_key" ON "TeamSeasonRecord"("seasonNumber", "teamId");

-- CreateIndex
CREATE INDEX "SeasonArchive_seasonNumber_idx" ON "SeasonArchive"("seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonArchive_seasonNumber_leagueId_key" ON "SeasonArchive"("seasonNumber", "leagueId");

-- CreateIndex
CREATE INDEX "SeasonArchiveStanding_archiveId_idx" ON "SeasonArchiveStanding"("archiveId");

-- CreateIndex
CREATE INDEX "SeasonArchiveScorer_archiveId_idx" ON "SeasonArchiveScorer"("archiveId");

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

-- CreateIndex
CREATE INDEX "ManagerPoll_teamId_status_idx" ON "ManagerPoll"("teamId", "status");

-- CreateIndex
CREATE INDEX "ManagerPoll_status_closesAt_idx" ON "ManagerPoll"("status", "closesAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerPollVote_pollId_voterId_key" ON "ManagerPollVote"("pollId", "voterId");

-- CreateIndex
CREATE INDEX "GameEvent_status_endsAt_idx" ON "GameEvent"("status", "endsAt");

-- CreateIndex
CREATE INDEX "GameEvent_type_status_idx" ON "GameEvent"("type", "status");

-- CreateIndex
CREATE INDEX "GameEventClaim_eventId_userId_kind_idx" ON "GameEventClaim"("eventId", "userId", "kind");

-- CreateIndex
CREATE INDEX "GameEventClaim_userId_kind_idx" ON "GameEventClaim"("userId", "kind");

-- CreateIndex
CREATE INDEX "ContactMessage_status_createdAt_idx" ON "ContactMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_userId_idx" ON "ContactMessage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangelogEntry_version_key" ON "ChangelogEntry"("version");

-- CreateIndex
CREATE INDEX "ChangelogEntry_published_sortKey_idx" ON "ChangelogEntry"("published", "sortKey");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamHistory" ADD CONSTRAINT "TeamHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamHistory" ADD CONSTRAINT "TeamHistory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_parentLeagueId_fkey" FOREIGN KEY ("parentLeagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_nextMatchId_fkey" FOREIGN KEY ("nextMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionReward" ADD CONSTRAINT "PredictionReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionReward" ADD CONSTRAINT "PredictionReward_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_scorerId_fkey" FOREIGN KEY ("scorerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_assistId_fkey" FOREIGN KEY ("assistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_trophyId_fkey" FOREIGN KEY ("trophyId") REFERENCES "Trophy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchReward" ADD CONSTRAINT "MatchReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchReward" ADD CONSTRAINT "MatchReward_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelUpReward" ADD CONSTRAINT "LevelUpReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonInfluenceReward" ADD CONSTRAINT "SeasonInfluenceReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Choreography" ADD CONSTRAINT "Choreography_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Choreography" ADD CONSTRAINT "Choreography_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Choreography" ADD CONSTRAINT "Choreography_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trophy" ADD CONSTRAINT "Trophy_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrophyPlayer" ADD CONSTRAINT "TrophyPlayer_trophyId_fkey" FOREIGN KEY ("trophyId") REFERENCES "Trophy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrophyPlayer" ADD CONSTRAINT "TrophyPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSeasonRecord" ADD CONSTRAINT "TeamSeasonRecord_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonArchiveStanding" ADD CONSTRAINT "SeasonArchiveStanding_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "SeasonArchive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonArchiveScorer" ADD CONSTRAINT "SeasonArchiveScorer_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "SeasonArchive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferListing" ADD CONSTRAINT "TransferListing_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferListing" ADD CONSTRAINT "TransferListing_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferListing" ADD CONSTRAINT "TransferListing_listedByManagerId_fkey" FOREIGN KEY ("listedByManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferListing" ADD CONSTRAINT "TransferListing_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferOffer" ADD CONSTRAINT "TransferOffer_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferOffer" ADD CONSTRAINT "TransferOffer_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferOffer" ADD CONSTRAINT "TransferOffer_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferOffer" ADD CONSTRAINT "TransferOffer_fromManagerId_fkey" FOREIGN KEY ("fromManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferOffer" ADD CONSTRAINT "TransferOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "TransferListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerPoll" ADD CONSTRAINT "ManagerPoll_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerPoll" ADD CONSTRAINT "ManagerPoll_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerPoll" ADD CONSTRAINT "ManagerPoll_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerPollVote" ADD CONSTRAINT "ManagerPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ManagerPoll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerPollVote" ADD CONSTRAINT "ManagerPollVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEventClaim" ADD CONSTRAINT "GameEventClaim_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GameEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEventClaim" ADD CONSTRAINT "GameEventClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
