const prisma = require("../config/db");
const { betAmountForLevel, truncateToDay } = require("../utils/predictions");

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_OFFSET = { yesterday: -1, today: 0, tomorrow: 1 };

// National competitions are only relevant to the teams playing in them, so
// the board only shows those matches when the caller's own team is involved.
// International competitions are shown to every player.
const NATIONAL_TYPES = new Set(["LIGA", "CUPA_INTERNA", "SUPERCUPA_NATIONALA"]);

// GET /api/predictions/board?day=yesterday|today|tomorrow
// Every match scheduled on the given calendar day, grouped by league/cup,
// annotated with the caller's own prediction (if any) per match and their
// token-reward progress per group. The group's progress bar tracks WON
// predictions (not just placed ones) — it only reaches 100% once every
// match in the group has been predicted AND guessed correctly, which is
// exactly the condition that makes the token collectible.
async function getBoard(req, res, next) {
  try {
    const dayParam = req.query.day || "today";
    const offset = DAY_OFFSET[dayParam];
    if (offset === undefined) return res.status(400).json({ error: "Parametru 'day' invalid — acceptate: yesterday, today, tomorrow." });

    const start = new Date(truncateToDay(new Date()).getTime() + offset * DAY_MS);
    const end = new Date(start.getTime() + DAY_MS);

    const user = req.user;

    const allMatches = await prisma.match.findMany({
      where: { scheduledAt: { gte: start, lt: end } },
      include: {
        homeTeam: { include: { players: { select: { level: true, status: true } } } },
        awayTeam: { include: { players: { select: { level: true, status: true } } } },
        league: true,
      },
      orderBy: [{ leagueId: "asc" }, { scheduledAt: "asc" }],
    });

    // National competitions (campionat, cupă/supercupă națională) only show up
    // for the two teams involved; international competitions show for everyone.
    const matches = allMatches.filter((m) => {
      if (!NATIONAL_TYPES.has(m.league?.type)) return true;
      return !!user.teamId && (m.homeTeamId === user.teamId || m.awayTeamId === user.teamId);
    });

    const sumActiveLevels = (team) =>
      (team?.players || []).filter(p => p.status === "ACTIVE").reduce((s, p) => s + p.level, 0);
    const stripTeam = (team) => {
      if (!team) return null;
      const { players, ...rest } = team;
      return rest;
    };

    const matchIds = matches.map(m => m.id);
    const leagueIds = [...new Set(matches.map(m => m.leagueId))];

    const [myPredictions, rewards] = await Promise.all([
      matchIds.length ? prisma.prediction.findMany({ where: { userId: user.id, matchId: { in: matchIds } } }) : [],
      leagueIds.length ? prisma.predictionReward.findMany({ where: { userId: user.id, leagueId: { in: leagueIds }, day: start } }) : [],
    ]);
    const predictionByMatch = Object.fromEntries(myPredictions.map(p => [p.matchId, p]));
    // All token rewards for this (league, day), keyed by league — a group can
    // now have several: the milestone:0 "all-in" bonus plus 5/10/15… thresholds.
    const rewardsByLeague = {};
    for (const r of rewards) (rewardsByLeague[r.leagueId] ||= []).push(r);

    const groupsByLeague = {};
    for (const m of matches) {
      if (!groupsByLeague[m.leagueId]) groupsByLeague[m.leagueId] = { league: m.league, matches: [] };
      groupsByLeague[m.leagueId].matches.push(m);
    }

    const now = new Date();
    const groups = Object.values(groupsByLeague).map(g => {
      const total = g.matches.length;
      const won = g.matches.filter(m => predictionByMatch[m.id]?.outcome === "WON").length;
      const groupRewards = (rewardsByLeague[g.league.id] || [])
        .sort((a, b) => a.milestone - b.milestone)
        .map(r => ({ id: r.id, milestone: r.milestone, collected: !!r.collectedAt }));

      return {
        league: { id: g.league.id, name: g.league.name, type: g.league.type, flag: g.league.flag || null },
        progress: { won, total },
        rewards: groupRewards,
        matches: g.matches.map(m => {
          const mine = predictionByMatch[m.id];
          const played = m.status === "PLAYED";
          return {
            id: m.id,
            round: m.round,
            scheduledAt: m.scheduledAt,
            status: m.status,
            homeTeam: stripTeam(m.homeTeam),
            awayTeam: stripTeam(m.awayTeam),
            homeGoals: m.homeGoals,
            awayGoals: m.awayGoals,
            // Crowd influence + squad-level totals, for the row's hover peek.
            homeInfluence: m.homeInfluence,
            awayInfluence: m.awayInfluence,
            homeTotalLevel: played ? (m.homeTotalLevel ?? 0) : sumActiveLevels(m.homeTeam),
            awayTotalLevel: played ? (m.awayTotalLevel ?? 0) : sumActiveLevels(m.awayTeam),
            myPrediction: mine ? {
              id: mine.id, choice: mine.choice, stake: mine.stake, outcome: mine.outcome,
              payout: mine.payout, collected: !!mine.collectedAt,
              superMultiplier: mine.superMultiplier || null,
            } : null,
            locked: m.status !== "SCHEDULED" || !m.homeTeamId || !m.awayTeamId || new Date(m.scheduledAt) <= now,
          };
        }),
      };
    });

    res.json({ day: dayParam, stake: betAmountForLevel(user.level), groups });
  } catch (err) {
    next(err);
  }
}

// POST /api/predictions   { matchId, choice }
// choice is "1" (home win), "X" (draw) or "2" (away win). First pick on a
// match costs a flat cash stake determined by the user's level
// (betAmountForLevel) — same stake-deduction shape as addChoreography
// (matches.controller.js). The user can freely change `choice` afterwards,
// with no re-charge, as long as the match hasn't kicked off yet.
async function placePrediction(req, res, next) {
  try {
    const user = req.user;
    const { matchId, choice } = req.body;
    if (!["1", "X", "2"].includes(choice)) {
      return res.status(400).json({ error: "Predicție invalidă — acceptate: 1, X, 2." });
    }

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return res.status(404).json({ error: "Meciul nu există." });
    if (match.status !== "SCHEDULED" || !match.homeTeamId || !match.awayTeamId) {
      return res.status(409).json({ error: "Nu mai poți paria pe acest meci." });
    }
    if (new Date(match.scheduledAt) <= new Date()) {
      return res.status(409).json({ error: "Meciul a început deja." });
    }

    const existing = await prisma.prediction.findUnique({
      where: { userId_matchId: { userId: user.id, matchId } },
    });

    if (existing) {
      const prediction = await prisma.prediction.update({ where: { id: existing.id }, data: { choice } });
      return res.json({ prediction, cashRemaining: user.cash });
    }

    const stake = betAmountForLevel(user.level);
    if (user.cash < stake) {
      return res.status(409).json({ error: `Nu ai suficienți bani. Cost: ${stake}, disponibil: ${user.cash}.` });
    }

    const [, prediction] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { cash: { decrement: stake } } }),
      prisma.prediction.create({ data: { userId: user.id, matchId, choice, stake } }),
    ]);

    res.status(201).json({ prediction, cashRemaining: user.cash - stake });
  } catch (err) {
    next(err);
  }
}

// POST /api/predictions/:id/collect
// Claims the cash payout for one of the caller's own WON, uncollected predictions.
async function collectPrediction(req, res, next) {
  try {
    const user = req.user;
    const prediction = await prisma.prediction.findUnique({ where: { id: req.params.id } });
    if (!prediction || prediction.userId !== user.id) return res.status(404).json({ error: "Predicția nu există." });
    if (prediction.outcome !== "WON") return res.status(409).json({ error: "Această predicție nu este câștigătoare." });
    if (prediction.collectedAt) return res.status(409).json({ error: "Câștigul a fost deja colectat." });

    const [, updated] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { cash: { increment: prediction.payout } } }),
      prisma.prediction.update({ where: { id: prediction.id }, data: { collectedAt: new Date() } }),
    ]);

    res.json({ prediction: updated, cashRemaining: user.cash + prediction.payout });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/predictions/:id
// Cancels one of the caller's own still-pending predictions (match not yet
// kicked off) and refunds the flat cash stake. Clicking an already-selected
// 1 / X / 2 chip in the UI unchecks the bet through here.
async function cancelPrediction(req, res, next) {
  try {
    const user = req.user;
    const prediction = await prisma.prediction.findUnique({ where: { id: req.params.id } });
    if (!prediction || prediction.userId !== user.id) return res.status(404).json({ error: "Predicția nu există." });
    if (prediction.outcome !== "PENDING" || prediction.collectedAt) {
      return res.status(409).json({ error: "Predicția a fost deja decontată." });
    }

    const match = await prisma.match.findUnique({ where: { id: prediction.matchId } });
    if (match && (match.status !== "SCHEDULED" || new Date(match.scheduledAt) <= new Date())) {
      return res.status(409).json({ error: "Meciul a început deja — pariul nu mai poate fi retras." });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { cash: { increment: prediction.stake } } }),
      prisma.prediction.delete({ where: { id: prediction.id } }),
    ]);

    res.json({ success: true, refunded: prediction.stake, cashRemaining: user.cash + prediction.stake });
  } catch (err) {
    next(err);
  }
}

// POST /api/predictions/rewards/:id/collect
// Claims the +1 token for one of the caller's own eligible, uncollected group rewards.
async function collectReward(req, res, next) {
  try {
    const user = req.user;
    const reward = await prisma.predictionReward.findUnique({ where: { id: req.params.id } });
    if (!reward || reward.userId !== user.id) return res.status(404).json({ error: "Recompensa nu există." });
    if (reward.collectedAt) return res.status(409).json({ error: "Tokenul a fost deja colectat." });

    const [, updated] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { tokens: { increment: 1 } } }),
      prisma.predictionReward.update({ where: { id: reward.id }, data: { collectedAt: new Date() } }),
    ]);

    res.json({ reward: updated, tokensRemaining: user.tokens + 1 });
  } catch (err) {
    next(err);
  }
}

module.exports = { getBoard, placePrediction, cancelPrediction, collectPrediction, collectReward };
