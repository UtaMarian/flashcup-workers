const prisma = require("../config/db");
const { MAX_LEVEL } = require("../utils/xp");

/**
 * Fixed post-match payout per competition, granted to every player who
 * contributed crowd influence to the match. The MVP (single biggest
 * contributor) additionally gets MVP_TOKEN_REWARD and a medal (mvpCount++).
 * Kept in one place so the client preview and the grant path agree.
 */
const MATCH_REWARDS = {
  LIGA: { cash: 100, energy: 30 },
  CUPA_INTERNA: { cash: 200, energy: 40 },
  CUPA_CAMPIONILOR: { cash: 500, energy: 100 },
  CUPA_INTERNATIONALA: { cash: 300, energy: 60 },
};
const MVP_TOKEN_REWARD = 1;

function matchRewardFor(competitionType) {
  return MATCH_REWARDS[competitionType] || MATCH_REWARDS.LIGA;
}

/**
 * Cash + tokens granted for *reaching* `level` (>= 2). Anchored at the spec
 * value — reaching level 2 pays 100 cash + 1 token — and scales up with the
 * level so the harder climbs pay more. Tunable here only.
 */
function levelUpRewardFor(level) {
  const cash = 100 * (level - 1);
  const tokens = Math.max(1, 1 + Math.floor((level - 2) / 5));
  return { cash, tokens };
}

/**
 * After a match is persisted: for every distinct player who added influence
 * (>= 1 choreography), create a pending MatchReward, and flag the single
 * biggest contributor as MVP. Idempotent via the (userId, matchId) unique.
 * `choreographies` items need { authorId, influence, createdAt }.
 * Runs inside the caller's transaction (`tx`).
 *
 * `opts` carries live-event effects (all optional):
 *   rewardMult      — multiplier on contributor cash/energy/tokens (DOUBLE_MATCH_REWARDS)
 *   goalAssistEvent — active DOUBLE_GOAL_ASSIST_REWARDS event ({ config }); when set,
 *                     scorers/assisters who didn't buy choreography also get a
 *                     (config × multiplier) MatchReward
 *   scorerIds / assistIds — Sets of user ids that scored / assisted in this match
 */
async function createMatchRewards(tx, match, choreographies, opts = {}) {
  const { rewardMult = 1, goalAssistEvent = null, scorerIds = new Set(), assistIds = new Set() } = opts;
  const hasChoreo = choreographies && choreographies.length > 0;
  if (!hasChoreo && !goalAssistEvent) return;

  const totalByUser = new Map();
  const firstAtByUser = new Map();
  for (const c of choreographies || []) {
    totalByUser.set(c.authorId, (totalByUser.get(c.authorId) || 0) + c.influence);
    if (!firstAtByUser.has(c.authorId)) firstAtByUser.set(c.authorId, new Date(c.createdAt).getTime());
  }

  // MVP = highest total influence; ties broken by the earliest first choreography.
  let mvpId = null;
  let mvpInfluence = -1;
  for (const [uid, inf] of totalByUser) {
    const better = inf > mvpInfluence || (inf === mvpInfluence && firstAtByUser.get(uid) < firstAtByUser.get(mvpId));
    if (better) { mvpId = uid; mvpInfluence = inf; }
  }

  const league = match.league || (match.leagueId ? await tx.league.findUnique({ where: { id: match.leagueId } }) : null);
  const competitionType = league?.type || "LIGA";
  const base = matchRewardFor(competitionType);

  for (const [uid, inf] of totalByUser) {
    const isMvp = uid === mvpId;
    await tx.matchReward.upsert({
      where: { userId_matchId: { userId: uid, matchId: match.id } },
      update: {},
      create: {
        userId: uid,
        matchId: match.id,
        competitionType,
        cash: base.cash * rewardMult,
        energy: base.energy * rewardMult,
        tokens: (isMvp ? MVP_TOKEN_REWARD : 0) * rewardMult,
        isMvp,
        influence: inf,
      },
    });
    if (isMvp) {
      await tx.user.update({ where: { id: uid }, data: { mvpCount: { increment: 1 } } });
    }
  }

  // DOUBLE_GOAL_ASSIST_REWARDS: scorers/assisters with no choreography reward
  // still collect a doubled flat payout.
  if (goalAssistEvent) {
    const cfg = goalAssistEvent.config || {};
    const gaMult = cfg.multiplier ?? 2;
    const contributors = new Set([...scorerIds, ...assistIds].filter(id => !totalByUser.has(id)));
    for (const uid of contributors) {
      await tx.matchReward.upsert({
        where: { userId_matchId: { userId: uid, matchId: match.id } },
        update: {},
        create: {
          userId: uid,
          matchId: match.id,
          competitionType,
          cash: (cfg.cash ?? 60) * gaMult,
          energy: (cfg.energy ?? 15) * gaMult,
          tokens: (cfg.tokens ?? 0) * gaMult,
          isMvp: false,
          influence: 0,
        },
      });
    }
  }
}

/**
 * Enqueue a pending LevelUpReward for every level crossed when a player's
 * derived level rises from `prevLevel` to `newLevel`. Idempotent via the
 * (userId, level) unique. Runs inside the caller's transaction (`tx`).
 */
async function enqueueLevelUps(tx, userId, prevLevel, newLevel) {
  if (!newLevel || newLevel <= prevLevel) return;
  for (let lvl = prevLevel + 1; lvl <= Math.min(newLevel, MAX_LEVEL); lvl++) {
    const { cash, tokens } = levelUpRewardFor(lvl);
    await tx.levelUpReward.upsert({
      where: { userId_level: { userId, level: lvl } },
      update: {},
      create: { userId, level: lvl, cash, tokens },
    });
  }
}

module.exports = {
  MATCH_REWARDS,
  MVP_TOKEN_REWARD,
  matchRewardFor,
  levelUpRewardFor,
  createMatchRewards,
  enqueueLevelUps,
};
