/**
 * Round-robin fixture generation using the classic "circle method".
 *
 * Given a list of team ids, produces rounds of pairings so that every team
 * plays every other team once (single round robin). If `doubleRound` is
 * true, a second leg with reversed home/away is appended so every team
 * plays every other team twice (home + away) — this is the default for
 * a league season.
 *
 * If the number of teams is odd, a "BYE" placeholder is added so the
 * algorithm still works; matches against BYE are filtered out.
 */
function generateRoundRobin(teamIds, { doubleRound = true } = {}) {
  const ids = [...teamIds];
  const hasBye = ids.length % 2 !== 0;
  if (hasBye) ids.push("BYE");

  const n = ids.length;
  const roundsCount = n - 1;
  const half = n / 2;

  const rounds = [];
  let arr = [...ids];

  for (let r = 0; r < roundsCount; r++) {
    const roundPairs = [];
    for (let i = 0; i < half; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home !== "BYE" && away !== "BYE") {
        // Alternate home/away across rounds for fairness.
        if (r % 2 === 0) roundPairs.push({ home, away });
        else roundPairs.push({ home: away, away: home });
      }
    }
    rounds.push(roundPairs);

    // Rotate all elements except the first ("circle method").
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr = [fixed, ...rest];
  }

  if (!doubleRound) return rounds;

  // Second leg: same pairings, reversed home/away, appended as further rounds.
  const secondLeg = rounds.map(roundPairs =>
    roundPairs.map(({ home, away }) => ({ home: away, away: home }))
  );

  return [...rounds, ...secondLeg];
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const BRACKET_ROUND_LABELS = { 2: "F", 4: "SF", 8: "QF", 16: "R16", 32: "R32", 64: "R64" };

/** Round labels for a power-of-two bracket, largest round first, ending with "F". */
function bracketRoundNamesFor(bracketSize) {
  const names = [];
  for (let s = bracketSize; s >= 2; s /= 2) names.push(BRACKET_ROUND_LABELS[s] || `R${s}`);
  return names;
}

/**
 * Builds a single-elimination knockout bracket for an arbitrary number of
 * teams (>=2), handling any count — not just powers of two.
 *
 * If `teamIds.length` isn't a power of two, the excess teams play a
 * preliminary round first; the survivors plus the byed teams then fill an
 * exact power-of-two main bracket. E.g. 10 teams -> 2 preliminary matches
 * (4 teams), 6 byes -> 8-team bracket starting at the quarterfinals.
 *
 * Returns:
 *   preliminaryMatches: [{ home, away }]                  (real team ids)
 *   mainRounds: [{ name, matches: [{ home?, away? }] }]    round[0].matches[i]
 *     entries are either a team id (bye) or { fromPreliminary: idx } — a
 *     placeholder meaning "winner of preliminaryMatches[idx]".
 */
function generateKnockoutBracket(teamIds) {
  const n = teamIds.length;
  if (n < 2) return { preliminaryMatches: [], mainRounds: [] };

  let bracketSize = 1;
  while (bracketSize * 2 <= n) bracketSize *= 2;

  const numPlayIn = n - bracketSize;
  const playInTeamsCount = numPlayIn * 2;
  const byeTeamsCount = n - playInTeamsCount;

  const shuffled = shuffle(teamIds);
  const byeTeams = shuffled.slice(0, byeTeamsCount);
  const playInTeams = shuffled.slice(byeTeamsCount);

  const preliminaryMatches = [];
  for (let i = 0; i < playInTeams.length; i += 2) {
    preliminaryMatches.push({ home: playInTeams[i], away: playInTeams[i + 1] });
  }

  const entrants = shuffle([
    ...byeTeams,
    ...preliminaryMatches.map((_, i) => ({ fromPreliminary: i })),
  ]);

  const roundNames = bracketRoundNamesFor(bracketSize);
  const mainRounds = roundNames.map((name, ri) => ({
    name,
    matches: Array.from({ length: bracketSize / Math.pow(2, ri + 1) }, () => ({})),
  }));

  const round1 = mainRounds[0].matches;
  for (let i = 0; i < round1.length; i++) {
    round1[i].home = entrants[i * 2];
    round1[i].away = entrants[i * 2 + 1];
  }

  return { preliminaryMatches, mainRounds };
}

module.exports = { generateRoundRobin, generateKnockoutBracket, bracketRoundNamesFor };
