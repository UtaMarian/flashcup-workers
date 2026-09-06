const prisma = require("../config/db");
const { truncateToDay, payoutForStake } = require("../utils/predictions");

const DAY_MS = 24 * 60 * 60 * 1000;
const MILESTONE_STEP = 5; // +1 token per 5 WON picks in a LIGA (campionat) group

async function createRewardIfNew(userId, leagueId, day, milestone) {
  try {
    await prisma.predictionReward.create({ data: { userId, leagueId, day, milestone } });
  } catch (err) {
    if (err.code !== "P2002") throw err; // already eligible — race-safe no-op
  }
}

/**
 * Makes the milestone:0 "all-in" token reward for one (league, calendar day)
 * group eligible — the first time every match a user predicted in that group
 * has been played and every one of those predictions came out WON. Applies to
 * every competition type. Does NOT credit the token itself; the user claims it
 * via POST /api/predictions/rewards/:id/collect. Safe to call repeatedly.
 */
async function maybeMakeGroupRewardEligible(userId, leagueId, day) {
  const dayStart = day;
  const dayEnd = new Date(day.getTime() + DAY_MS);

  const matches = await prisma.match.findMany({
    where: { leagueId, scheduledAt: { gte: dayStart, lt: dayEnd } },
    select: { id: true, status: true },
  });
  if (!matches.length || matches.some(m => m.status !== "PLAYED")) return;

  const matchIds = matches.map(m => m.id);
  const predictions = await prisma.prediction.findMany({
    where: { userId, matchId: { in: matchIds } },
    select: { outcome: true },
  });
  if (predictions.length !== matches.length) return; // didn't predict every match in the group
  if (predictions.some(p => p.outcome !== "WON")) return;

  await createRewardIfNew(userId, leagueId, dayStart, 0);
}

/**
 * LIGA (campionat) only: +1 claimable token for every MILESTONE_STEP WON picks
 * a user has in one (league, calendar day) group — independent of whether they
 * predicted every match. One PredictionReward row per crossed threshold
 * (milestone = 5, 10, 15…). Idempotent.
 */
async function maybeMakeMilestoneRewardsEligible(userId, leagueId, day) {
  const dayStart = day;
  const dayEnd = new Date(day.getTime() + DAY_MS);

  const matches = await prisma.match.findMany({
    where: { leagueId, scheduledAt: { gte: dayStart, lt: dayEnd } },
    select: { id: true },
  });
  if (!matches.length) return;

  const won = await prisma.prediction.count({
    where: { userId, outcome: "WON", matchId: { in: matches.map(m => m.id) } },
  });

  for (let threshold = MILESTONE_STEP; threshold <= won; threshold += MILESTONE_STEP) {
    await createRewardIfNew(userId, leagueId, dayStart, threshold);
  }
}

/**
 * Settles every PENDING prediction placed on a just-played match (WON gets
 * a collectible payout, LOST gets none), then re-checks the token rewards for
 * each involved user's (league, day) group. Called from
 * matchService.simulateAndPersistMatch right after a match is marked PLAYED.
 */
async function settlePredictionsForMatch({ id: matchId, leagueId, leagueType, scheduledAt, homeGoals, awayGoals }) {
  const actual = homeGoals > awayGoals ? "1" : homeGoals < awayGoals ? "2" : "X";

  const predictions = await prisma.prediction.findMany({
    where: { matchId, outcome: "PENDING" },
    select: { id: true, userId: true, choice: true, stake: true, superMultiplier: true },
  });
  if (!predictions.length) return;

  await prisma.$transaction(
    predictions.map(p => {
      const won = p.choice === actual;
      // A SUPERBET grant applied to this prediction multiplies the WON payout.
      const payout = won ? payoutForStake(p.stake) * (p.superMultiplier || 1) : null;
      return prisma.prediction.update({
        where: { id: p.id },
        data: { outcome: won ? "WON" : "LOST", payout, settledAt: new Date() },
      });
    })
  );

  const day = truncateToDay(scheduledAt);
  const userIds = [...new Set(predictions.map(p => p.userId))];
  for (const userId of userIds) {
    await maybeMakeGroupRewardEligible(userId, leagueId, day);
    if (leagueType === "LIGA") {
      await maybeMakeMilestoneRewardsEligible(userId, leagueId, day);
    }
  }
}

module.exports = {
  settlePredictionsForMatch,
  maybeMakeGroupRewardEligible,
  maybeMakeMilestoneRewardsEligible,
};
