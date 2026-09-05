const prisma = require("../config/db");
const { levelFromTotalXp } = require("../utils/xp");

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

const TEAM_SUMMARY = { select: { id: true, name: true, colorHex: true, logoUrl: true } };

// GET /api/rewards/me — this player's uncollected match + level-up rewards.
async function listMyRewards(req, res, next) {
  try {
    const userId = req.user.id;
    const [matchRewards, levelUpRewards, seasonRewards] = await Promise.all([
      prisma.matchReward.findMany({
        where: { userId, collectedAt: null },
        include: {
          match: {
            select: {
              id: true,
              scheduledAt: true,
              round: true,
              bracketRound: true,
              homeTeam: TEAM_SUMMARY,
              awayTeam: TEAM_SUMMARY,
              league: { select: { name: true, type: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.levelUpReward.findMany({
        where: { userId, collectedAt: null },
        orderBy: { level: "asc" },
      }),
      prisma.seasonInfluenceReward.findMany({
        where: { userId, collectedAt: null },
        orderBy: [{ seasonNumber: "desc" }, { rank: "asc" }],
      }),
    ]);
    res.json({ matchRewards, levelUpRewards, seasonRewards });
  } catch (err) {
    next(err);
  }
}

// POST /api/rewards/match/:id/collect
async function collectMatchReward(req, res, next) {
  try {
    const reward = await prisma.matchReward.findUnique({ where: { id: req.params.id } });
    if (!reward || reward.userId !== req.user.id) {
      return res.status(404).json({ error: "Recompensa nu există." });
    }
    if (reward.collectedAt) {
      return res.status(409).json({ error: "Recompensa a fost deja colectată." });
    }

    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          cash: { increment: reward.cash },
          energy: { increment: reward.energy },
          tokens: { increment: reward.tokens },
        },
      }),
      prisma.matchReward.update({ where: { id: reward.id }, data: { collectedAt: new Date() } }),
    ]);

    res.json({
      user: publicUser(user),
      progression: levelFromTotalXp(user.xp),
      reward: { ...reward, collectedAt: new Date() },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/rewards/levelup/:id/collect
async function collectLevelUpReward(req, res, next) {
  try {
    const reward = await prisma.levelUpReward.findUnique({ where: { id: req.params.id } });
    if (!reward || reward.userId !== req.user.id) {
      return res.status(404).json({ error: "Recompensa nu există." });
    }
    if (reward.collectedAt) {
      return res.status(409).json({ error: "Recompensa a fost deja colectată." });
    }

    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { cash: { increment: reward.cash }, tokens: { increment: reward.tokens } },
      }),
      prisma.levelUpReward.update({ where: { id: reward.id }, data: { collectedAt: new Date() } }),
    ]);

    res.json({
      user: publicUser(user),
      progression: levelFromTotalXp(user.xp),
      reward: { level: reward.level, cash: reward.cash, tokens: reward.tokens },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/rewards/season/:id/collect
async function collectSeasonReward(req, res, next) {
  try {
    const reward = await prisma.seasonInfluenceReward.findUnique({ where: { id: req.params.id } });
    if (!reward || reward.userId !== req.user.id) {
      return res.status(404).json({ error: "Recompensa nu există." });
    }
    if (reward.collectedAt) {
      return res.status(409).json({ error: "Recompensa a fost deja colectată." });
    }

    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { cash: { increment: reward.cash }, tokens: { increment: reward.tokens } },
      }),
      prisma.seasonInfluenceReward.update({ where: { id: reward.id }, data: { collectedAt: new Date() } }),
    ]);

    res.json({
      user: publicUser(user),
      progression: levelFromTotalXp(user.xp),
      reward: { ...reward, collectedAt: new Date() },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listMyRewards, collectMatchReward, collectLevelUpReward, collectSeasonReward };
