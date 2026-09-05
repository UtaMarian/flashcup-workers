/**
 * Deterministic-ish match simulator. Team strength is the average level of
 * all active (non-banned, non-suspended) squad players. A strength
 * differential biases the expected goal count for each side; final scores
 * are then drawn with a bit of randomness so results aren't purely
 * mechanical.
 */

function averageLevel(players) {
  if (!players.length) return 1;
  const sum = players.reduce((acc, p) => acc + p.level, 0);
  return Math.round(sum / players.length);
}

function totalLevel(players) {
  return players.reduce((acc, p) => acc + p.level, 0);
}

const HOME_ADVANTAGE = 1.05; // +5%, per spec
const INFLUENCE_WEIGHT = 0.05; // how many "strength points" one influence point is worth

function poissonish(expected) {
  // Cheap approximation without external deps: random draws around the
  // expected value, floored at 0.
  const noise = (Math.random() - 0.5) * 2; // -1..1
  const value = expected + noise * Math.max(1, expected * 0.6);
  return Math.max(0, Math.round(value));
}

function pickWeightedPlayer(players, positionWeights) {
  const weighted = players.flatMap(p => {
    const w = positionWeights[p.position] ?? 1;
    return Array(Math.max(1, w)).fill(p);
  });
  return weighted[Math.floor(Math.random() * weighted.length)];
}

// Attackers/wingers are more likely to score; midfielders more likely to assist.
const SCORER_WEIGHTS = { ST: 6, LW: 4, RW: 4, AMC: 3, AML: 2, AMR: 2, MC: 1, ML: 1, MR: 1 };
const ASSIST_WEIGHTS = { AMC: 4, MC: 3, ML: 3, MR: 3, AML: 2, AMR: 2, ST: 1, LW: 2, RW: 2, DMC: 1 };
// Cards mostly go to the players actually doing the tackling.
const CARD_WEIGHTS = { DC: 5, DMC: 4, LB: 3, RB: 3, MC: 2, ML: 2, MR: 2, AMC: 1 };

// Picks a minute not already used by another event, so the Match Day
// timeline never has two things landing on the exact same tick. Falls back
// to a random minute (rare collision) once the 90-minute clock is dense.
function pickUniqueMinute(usedMinutes) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const minute = 1 + Math.floor(Math.random() * 90);
    if (!usedMinutes.has(minute)) {
      usedMinutes.add(minute);
      return minute;
    }
  }
  const minute = 1 + Math.floor(Math.random() * 90);
  usedMinutes.add(minute);
  return minute;
}

function buildGoalEvents(count, squad, teamId, usedMinutes) {
  const events = [];
  if (!squad.length) return events;
  for (let i = 0; i < count; i++) {
    const scorer = pickWeightedPlayer(squad, SCORER_WEIGHTS);
    const possibleAssisters = squad.filter(p => p.id !== scorer.id);
    const assist = possibleAssisters.length && Math.random() < 0.7
      ? pickWeightedPlayer(possibleAssisters, ASSIST_WEIGHTS)
      : null;
    events.push({
      minute: pickUniqueMinute(usedMinutes),
      type: "GOAL",
      teamId,
      scorerId: scorer.id,
      assistId: assist ? assist.id : null,
    });
  }
  return events;
}

// Flavor events (SHOT, CHANCE, CORNER, CARD, PENALTY_MISS) — same shape as a
// goal event; `scorerId` here just means "the player involved" (who took the
// shot / won the corner / picked up the card / stepped up for the penalty).
// When `assistWeights` is given, there's a chance of a second player too —
// for CHANCE that's who set it up, for PENALTY_MISS that's who won the
// penalty. These exist so the Match Day Live timeline (and its commentary,
// see frontend/src/lib/matchCommentary.js) has a natural rhythm between
// goals, not just silence — see matchService.js for how `type` gets persisted.
function buildFlavorEvents(count, squad, teamId, type, weights, usedMinutes, assistWeights = null) {
  const events = [];
  if (!squad.length || count <= 0) return events;
  for (let i = 0; i < count; i++) {
    const player = pickWeightedPlayer(squad, weights);
    let assistId = null;
    if (assistWeights) {
      const possibleAssisters = squad.filter(p => p.id !== player.id);
      if (possibleAssisters.length && Math.random() < 0.6) {
        assistId = pickWeightedPlayer(possibleAssisters, assistWeights).id;
      }
    }
    events.push({
      minute: pickUniqueMinute(usedMinutes),
      type,
      teamId,
      scorerId: player.id,
      assistId,
    });
  }
  return events;
}

/**
 * homeSquad/awaySquad: arrays of { id, level, position }
 * homeTeamId/awayTeamId: ids to stamp onto generated events
 * influence: crowd influence accumulated via player choreographies before
 *   kickoff (src/controllers/matches.controller.js addChoreography) — each
 *   point is worth INFLUENCE_WEIGHT "strength points".
 * home/awayAttackMod, home/awayDefenseMod: tactic modifiers from a team's
 *   saved Lineup (src/utils/tactics.js tacticModifiers) — default to 1 (no
 *   effect) so callers that don't pass them reproduce the old behavior
 *   exactly. A side's attackMod scales its own expected goals; its
 *   defenseMod scales how many the *opponent* is expected to score.
 *
 * Strength = totalLevel * (1.05 if home) + influence * INFLUENCE_WEIGHT.
 * The differential between the two sides' strength biases the expected
 * goal count for each side; final scores are still drawn with randomness
 * (poissonish) so results aren't purely mechanical.
 */
function simulateMatch(homeSquad, awaySquad, homeTeamId, awayTeamId, {
  homeInfluence = 0, awayInfluence = 0,
  homeAttackMod = 1, homeDefenseMod = 1, awayAttackMod = 1, awayDefenseMod = 1,
} = {}) {
  const homeAvg = averageLevel(homeSquad);
  const awayAvg = averageLevel(awaySquad);
  const homeTotal = totalLevel(homeSquad);
  const awayTotal = totalLevel(awaySquad);

  const homeStrength = homeTotal * HOME_ADVANTAGE + homeInfluence * INFLUENCE_WEIGHT;
  const awayStrength = awayTotal + awayInfluence * INFLUENCE_WEIGHT;

  const totalStrength = homeStrength + awayStrength || 1;
  const diff = (homeStrength - awayStrength) / totalStrength; // normalized, roughly -1..1

  const homeBaseExpected = (1.3 + diff * 2.2) * homeAttackMod * awayDefenseMod;
  const awayBaseExpected = (1.1 - diff * 2.2) * awayAttackMod * homeDefenseMod;

  const homeGoals = poissonish(homeBaseExpected);
  const awayGoals = poissonish(awayBaseExpected);

  const usedMinutes = new Set();
  const goalEvents = [
    ...buildGoalEvents(homeGoals, homeSquad, homeTeamId, usedMinutes),
    ...buildGoalEvents(awayGoals, awaySquad, awayTeamId, usedMinutes),
  ];

  // Flavor events scale with each side's attacking tempo (the same
  // "expected goals" figure used above), so a one-sided game reads as
  // one-sided in the timeline too, not just on the scoreboard. Cards are
  // rare and slightly more likely for the side under more pressure.
  const flavorEvents = [
    ...buildFlavorEvents(Math.round(2 + homeBaseExpected * 2.5), homeSquad, homeTeamId, "SHOT", SCORER_WEIGHTS, usedMinutes),
    ...buildFlavorEvents(Math.round(2 + awayBaseExpected * 2.5), awaySquad, awayTeamId, "SHOT", SCORER_WEIGHTS, usedMinutes),
    ...buildFlavorEvents(1 + Math.floor(Math.random() * 2), homeSquad, homeTeamId, "CHANCE", SCORER_WEIGHTS, usedMinutes, ASSIST_WEIGHTS),
    ...buildFlavorEvents(1 + Math.floor(Math.random() * 2), awaySquad, awayTeamId, "CHANCE", SCORER_WEIGHTS, usedMinutes, ASSIST_WEIGHTS),
    ...buildFlavorEvents(Math.round(1 + homeBaseExpected), homeSquad, homeTeamId, "CORNER", ASSIST_WEIGHTS, usedMinutes),
    ...buildFlavorEvents(Math.round(1 + awayBaseExpected), awaySquad, awayTeamId, "CORNER", ASSIST_WEIGHTS, usedMinutes),
    ...buildFlavorEvents(Math.random() < 0.5 + Math.max(0, -diff) * 0.3 ? 1 : 0, homeSquad, homeTeamId, "CARD", CARD_WEIGHTS, usedMinutes),
    ...buildFlavorEvents(Math.random() < 0.5 + Math.max(0, diff) * 0.3 ? 1 : 0, awaySquad, awayTeamId, "CARD", CARD_WEIGHTS, usedMinutes),
    // Rare, dramatic beat — a penalty won and then missed/saved (never a goal,
    // so it never touches homeGoals/awayGoals; purely narrative).
    ...buildFlavorEvents(Math.random() < 0.15 ? 1 : 0, homeSquad, homeTeamId, "PENALTY_MISS", SCORER_WEIGHTS, usedMinutes, ASSIST_WEIGHTS),
    ...buildFlavorEvents(Math.random() < 0.15 ? 1 : 0, awaySquad, awayTeamId, "PENALTY_MISS", SCORER_WEIGHTS, usedMinutes, ASSIST_WEIGHTS),
  ];

  const events = [...goalEvents, ...flavorEvents].sort((a, b) => a.minute - b.minute);

  return { homeGoals, awayGoals, homeAvg, awayAvg, homeTotal, awayTotal, events };
}

module.exports = { simulateMatch, averageLevel, totalLevel };
