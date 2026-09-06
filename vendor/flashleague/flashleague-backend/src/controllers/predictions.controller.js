const prisma = require("../config/db");
const { betAmountForLevel, truncateToDay } = require("../utils/predictions");

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_OFFSET = { yesterday: -1, today: 0, tomorrow: 1 };

// Resolves ?day=yesterday|today|tomorrow to a [start, end) local-day window.
// Returns null for an invalid value.
function dayWindow(dayParam) {
  const offset = DAY_OFFSET[dayParam];
  if (offset === undefined) return null;
  const start = new Date(truncateToDay(new Date()).getTime() + offset * DAY_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

// GET /api/predictions/board?day=yesterday|today|tomorrow
// Lightweight index of the day's competitions — every league/cup with at
// least one match scheduled that day, plus the caller's WON/total progress
// and token-reward state per competition. Deliberately carries NO match or
// team detail: the client hydrates each competition's rows separately via
// GET /board/:leagueId, so the page paints fast and the DB is hit with one
// small query per competition instead of a single heavy join.
async function getBoard(req, res, next) {
  try {
    const dayParam = req.query.day || "today";
    const win = dayWindow(dayParam);
    if (!win) return res.status(400).json({ error: "Parametru 'day' invalid — acceptate: yesterday, today, tomorrow." });

    const user = req.user;

    const matches = await prisma.match.findMany({
      where: { scheduledAt: { gte: win.start, lt: win.end } },
      select: {
        id: true,
        leagueId: true,
        league: { select: { id: true, name: true, type: true, flag: true } },
      },
      orderBy: [{ leagueId: "asc" }, { scheduledAt: "asc" }],
    });

    if (!matches.length) {
      return res.json({ day: dayParam, stake: betAmountForLevel(user.level), groups: [] });
    }

    const matchIds = matches.map(m => m.id);
    const leagueIds = [...new Set(matches.map(m => m.leagueId))];

    const [myPredictions, rewards] = await Promise.all([
      prisma.prediction.findMany({
        where: { userId: user.id, matchId: { in: matchIds } },
        select: { matchId: true, outcome: true },
      }),
      prisma.predictionReward.findMany({
        where: { userId: user.id, leagueId: { in: leagueIds }, day: win.start },
        select: { id: true, milestone: true, collectedAt: true, leagueId: true },
      }),
    ]);
    const outcomeByMatch = Object.fromEntries(myPredictions.map(p => [p.matchId, p.outcome]));
    const rewardsByLeague = {};
    for (const r of rewards) (rewardsByLeague[r.leagueId] ||= []).push(r);

    const byLeague = {};
    for (const m of matches) {
      const g = (byLeague[m.leagueId] ||= { league: m.league, total: 0, won: 0 });
      g.total++;
      if (outcomeByMatch[m.id] === "WON") g.won++;
    }

    const groups = Object.values(byLeague).map(g => ({
      league: { id: g.league.id, name: g.league.name, type: g.league.type, flag: g.league.flag || null },
      progress: { won: g.won, total: g.total },
      rewards: (rewardsByLeague[g.league.id] || [])
        .sort((a, b) => a.milestone - b.milestone)
        .map(r => ({ id: r.id, milestone: r.milestone, collected: !!r.collectedAt })),
    }));

    res.json({ day: dayParam, stake: betAmountForLevel(user.level), groups });
  } catch (err) {
    next(err);
  }
}

// GET /api/predictions/board/:leagueId?day=yesterday|today|tomorrow
// The rows for ONE competition on the given day — team crests, squad-level
// totals, crowd influence and the caller's own prediction per match. Called
// once per competition by the client, right after GET /board.
async function getBoardGroup(req, res, next) {
  try {
    const dayParam = req.query.day || "today";
    const win = dayWindow(dayParam);
    if (!win) return res.status(400).json({ error: "Parametru 'day' invalid — acceptate: yesterday, today, tomorrow." });

    const user = req.user;
    const { leagueId } = req.params;

    const matches = await prisma.match.findMany({
      where: { leagueId, scheduledAt: { gte: win.start, lt: win.end } },
      include: {
        homeTeam: { include: { players: { select: { level: true, status: true } } } },
        awayTeam: { include: { players: { select: { level: true, status: true } } } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    const myPredictions = matches.length
      ? await prisma.prediction.findMany({ where: { userId: user.id, matchId: { in: matches.map(m => m.id) } } })
      : [];
    const predictionByMatch = Object.fromEntries(myPredictions.map(p => [p.matchId, p]));

    const sumActiveLevels = (team) =>
      (team?.players || []).filter(p => p.status === "ACTIVE").reduce((s, p) => s + p.level, 0);
    const stripTeam = (team) => {
      if (!team) return null;
      const { players, ...rest } = team;
      return rest;
    };

    const now = new Date();
    const rows = matches.map(m => {
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
    });

    res.json({ leagueId, matches: rows });
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

module.exports = { getBoard, getBoardGroup, placePrediction, cancelPrediction, collectPrediction, collectReward };
