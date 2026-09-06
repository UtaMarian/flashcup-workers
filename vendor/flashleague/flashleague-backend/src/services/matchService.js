const prisma = require("../config/db");
const { simulateMatch } = require("../utils/matchSim");
const { levelFromTotalXp } = require("../utils/xp");
const { tacticModifiers } = require("../utils/tactics");
const { settlePredictionsForMatch } = require("./predictionService");
const { awardCupTrophyAtFinal, CUP_TYPES } = require("./seasonService");
const { createMatchRewards, enqueueLevelUps } = require("./rewardService");
const { multiplierFor, getActiveEvent } = require("./eventsService");

const GOAL_XP = 120;
const ASSIST_XP = 70;
const APPEARANCE_XP = 25;
const OUT_OF_POSITION_PENALTY = 0.9; // 10% level penalty for a starter fielded outside their slot's position

/**
 * Resolves the squad simulateMatch() should actually use for one team: the
 * 11 starters from its saved Lineup (if it has one, and every slot still
 * resolves to a player who's on the team and ACTIVE), with tactic
 * modifiers and a small out-of-position level penalty applied. Falls back
 * to the full active roster with neutral (1x) modifiers otherwise — the
 * safety net that keeps teams without a complete lineup playing exactly as
 * before.
 */
async function buildMatchSquad(teamId, activePlayers) {
  const lineup = await prisma.lineup.findUnique({ where: { teamId } });
  if (!lineup) return { squad: activePlayers, attackMod: 1, defenseMod: 1 };

  const slots = JSON.parse(lineup.slotsJson);
  const byId = new Map(activePlayers.map(p => [p.id, p]));
  const starters = slots.map(s => (s.playerId ? byId.get(s.playerId) : null));

  if (starters.some(p => !p)) return { squad: activePlayers, attackMod: 1, defenseMod: 1 };

  const squad = starters.map((player, i) => ({
    id: player.id,
    level: Math.round(player.level * (slots[i].position === player.position ? 1 : OUT_OF_POSITION_PENALTY)),
    position: slots[i].position,
  }));

  const { attackMod, defenseMod } = tacticModifiers(lineup);
  return { squad, attackMod, defenseMod };
}

/**
 * Simulates a single scheduled match, persists the result + goal/assist
 * events, updates career stats (goals/assists/matches) for every involved
 * player, and grants XP (recalculating level via the exponential curve).
 */
async function simulateAndPersistMatch(matchId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
      league: true,
      choreographies: { select: { authorId: true, influence: true, createdAt: true } },
    },
  });

  if (!match) throw Object.assign(new Error("Meciul nu există."), { status: 404 });
  if (match.status === "PLAYED") throw Object.assign(new Error("Meciul a fost deja simulat."), { status: 409 });
  if (!match.homeTeamId || !match.awayTeamId) {
    throw Object.assign(new Error("Echipele nu sunt încă stabilite — se așteaptă rezultatul rundei anterioare."), { status: 409 });
  }

  const activeHome = match.homeTeam.players.filter(p => p.status === "ACTIVE");
  const activeAway = match.awayTeam.players.filter(p => p.status === "ACTIVE");

  const homeMatchSquad = await buildMatchSquad(match.homeTeamId, activeHome);
  const awayMatchSquad = await buildMatchSquad(match.awayTeamId, activeAway);

  const result = simulateMatch(homeMatchSquad.squad, awayMatchSquad.squad, match.homeTeamId, match.awayTeamId, {
    homeInfluence: match.homeInfluence,
    awayInfluence: match.awayInfluence,
    homeAttackMod: homeMatchSquad.attackMod,
    homeDefenseMod: homeMatchSquad.defenseMod,
    awayAttackMod: awayMatchSquad.attackMod,
    awayDefenseMod: awayMatchSquad.defenseMod,
  });

  // Knockout matches can't end in a draw — resolve ties on penalties,
  // biased slightly toward the stronger squad, same as regulation time.
  // (Round-robin LIGA matches can legitimately end in a draw: winnerTeamId
  // stays null there.)
  let winnerTeamId = null;
  let penaltyScore = null;
  if (result.homeGoals > result.awayGoals) winnerTeamId = match.homeTeamId;
  else if (result.awayGoals > result.homeGoals) winnerTeamId = match.awayTeamId;
  else if (match.bracketRound) {
    const totalAvg = (result.homeAvg + result.awayAvg) || 1;
    const homeWins = Math.random() < result.homeAvg / totalAvg;
    winnerTeamId = homeWins ? match.homeTeamId : match.awayTeamId;
    const winnerPens = 3 + Math.floor(Math.random() * 3);
    const loserPens = Math.max(0, winnerPens - 1 - Math.floor(Math.random() * 2));
    penaltyScore = homeWins ? `${winnerPens}-${loserPens}` : `${loserPens}-${winnerPens}`;
  }

  // Live events that affect this match's payouts / XP (resolved once).
  const [matchXpMult, rewardMult, goalAssistEvent] = await Promise.all([
    multiplierFor("DOUBLE_MATCH_XP"),
    multiplierFor("DOUBLE_MATCH_REWARDS"),
    getActiveEvent("DOUBLE_GOAL_ASSIST_REWARDS"),
  ]);
  // Only GOAL events carry a scoring/assisting player — SHOT/CHANCE/CORNER/CARD
  // events also stamp `scorerId` (whoever's "involved"), so this must stay
  // scoped to goals or every shot-taker would wrongly count as a scorer.
  const goalEvents = result.events.filter(e => e.type === "GOAL");
  const scorerIds = new Set(goalEvents.map(e => e.scorerId).filter(Boolean));
  const assistIds = new Set(goalEvents.map(e => e.assistId).filter(Boolean));

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        status: "PLAYED",
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        homeAvgLevel: result.homeAvg,
        awayAvgLevel: result.awayAvg,
        homeTotalLevel: result.homeTotal,
        awayTotalLevel: result.awayTotal,
        simulatedAt: new Date(),
        penaltyScore,
        winnerTeamId,
        events: { create: result.events.map(e => ({
          minute: e.minute, type: e.type, teamId: e.teamId,
          scorerId: e.scorerId, assistId: e.assistId,
        })) },
      },
    });

    if (match.nextMatchId && winnerTeamId) {
      await tx.match.update({
        where: { id: match.nextMatchId },
        data: match.nextMatchSlot === "AWAY" ? { awayTeamId: winnerTeamId } : { homeTeamId: winnerTeamId },
      });
    }

    // Appearance XP + totalMatches for every player who was in the squad.
    const allPlayers = [...activeHome, ...activeAway];
    for (const p of allPlayers) {
      const goals = goalEvents.filter(e => e.scorerId === p.id).length;
      const assists = goalEvents.filter(e => e.assistId === p.id).length;
      const xpGain = (APPEARANCE_XP + goals * GOAL_XP + assists * ASSIST_XP) * matchXpMult;
      const derived = levelFromTotalXp(p.xp + xpGain);

      await tx.user.update({
        where: { id: p.id },
        data: {
          totalMatches: { increment: 1 },
          totalGoals: { increment: goals },
          totalAssists: { increment: assists },
          xp: derived.totalXp,
          level: derived.level,
          energy: Math.max(0, p.energy - 15),
        },
      });
      await enqueueLevelUps(tx, p.id, p.level, derived.level);
    }

    // Pending post-match payouts for every influence contributor (+ MVP),
    // scaled / extended by any live reward events.
    await createMatchRewards(tx, match, match.choreographies, {
      rewardMult,
      goalAssistEvent,
      scorerIds,
      assistIds,
    });
  });

  await settlePredictionsForMatch({
    id: match.id,
    leagueId: match.leagueId,
    leagueType: match.league?.type,
    scheduledAt: match.scheduledAt,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
  });

  // Every knockout cup — Cupa Internă, Cupa Campionilor, Cupa Internațională
  // — is decided the moment its final is played: trophy, prize money, feed
  // post and trophy-case entries are awarded here, not at season close.
  // (The championship / LIGA is still decided at season close.)
  if (match.bracketRound === "F" && winnerTeamId) {
    const league = await prisma.league.findUnique({ where: { id: match.leagueId } });
    if (league && CUP_TYPES.includes(league.type)) {
      await awardCupTrophyAtFinal(league);
    }
  }

  return prisma.match.findUnique({
    where: { id: match.id },
    include: { homeTeam: true, awayTeam: true, events: true },
  });
}

/** Simulates every match that is SCHEDULED and whose kickoff time has passed. */
async function simulateDueMatches() {
  const due = await prisma.match.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: new Date() },
      homeTeamId: { not: null },
      awayTeamId: { not: null },
    },
    select: { id: true },
  });

  const results = [];
  for (const m of due) {
    try {
      results.push(await simulateAndPersistMatch(m.id));
    } catch (err) {
      console.error(`Eroare la simularea meciului ${m.id}:`, err.message);
    }
  }
  return results;
}

module.exports = { simulateAndPersistMatch, simulateDueMatches };
