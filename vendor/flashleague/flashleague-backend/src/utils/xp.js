/**
 * Exponential leveling curve.
 *
 * Design goal (from spec): easy to reach level 10, very hard to reach
 * level 50, extremely hard to reach level 100.
 *
 * xpToReachNextLevel(level) = BASE * level ^ EXPONENT
 *
 * With BASE=8, EXPONENT=2.1 the *cumulative* cost to reach a level looks
 * roughly like:
 *   level 10  : ~2,800 xp   (~35 training sessions at 80xp each — a day or two)
 *   level 50  : ~460,000 xp   (~5,800 sessions — weeks of dedicated play)
 *   level 100 : ~4,000,000 xp (~50,000 sessions — a long-term grind)
 *
 * i.e. each additional level costs roughly level^2.1 more than the last,
 * so the climb from 1-10 is quick, but 10-50 and 50-100 balloon hard.
 */

const BASE = 8;
const EXPONENT = 2.1;
const MAX_LEVEL = 150;

function xpToReachNextLevel(level) {
  return Math.round(BASE * Math.pow(level, EXPONENT));
}

/** Cumulative XP required to go from level 1 to `level` (inclusive start). */
function cumulativeXpForLevel(level) {
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += xpToReachNextLevel(l);
  }
  return total;
}

/**
 * Given a *total* lifetime XP value, derive the current level, xp banked
 * within the current level, and xp needed to reach the next one.
 */
function levelFromTotalXp(totalXp) {
  let level = 1;
  let remaining = totalXp;

  while (level < MAX_LEVEL) {
    const cost = xpToReachNextLevel(level);
    if (remaining < cost) break;
    remaining -= cost;
    level += 1;
  }

  const nextLevelCost = level < MAX_LEVEL ? xpToReachNextLevel(level) : null;

  return {
    level,
    xpIntoLevel: remaining,
    xpForNextLevel: nextLevelCost,
    totalXp,
  };
}

/** Apply an XP gain to a user-like {xp, level} pair, returns new derived state. */
function applyXpGain(currentTotalXp, gained) {
  const totalXp = Math.max(0, currentTotalXp + gained);
  return levelFromTotalXp(totalXp);
}

module.exports = {
  BASE,
  EXPONENT,
  MAX_LEVEL,
  xpToReachNextLevel,
  cumulativeXpForLevel,
  levelFromTotalXp,
  applyXpGain,
};
