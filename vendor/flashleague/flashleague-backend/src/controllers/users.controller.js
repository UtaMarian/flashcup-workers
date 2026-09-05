const prisma = require("../config/db");

// On-field role groups — mirrors frontend/src/ui.jsx POSITION_GROUPS.
const POSITION_GROUPS = {
  GK: ["GK"],
  DEF: ["DC", "LB", "RB"],
  MID: ["DMC", "MC", "ML", "MR", "AMC", "AML", "AMR"],
  FWD: ["ST", "LW", "RW"],
};

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// GET /api/users?search=&role=&status=&teamId=&position=&minLevel=&limit=&offset=  (admin only)
// `position` accepts either an exact code (e.g. "ST") or a group key
// (GK|DEF|MID|FWD). Paginated: returns { users, total } for the current
// filter; the client appends pages via `offset`.
async function listUsers(req, res, next) {
  try {
    const { search, role, status, teamId, position, minLevel } = req.query;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 25));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    let positionFilter = {};
    if (position) {
      if (POSITION_GROUPS[position]) positionFilter = { position: { in: POSITION_GROUPS[position] } };
      else positionFilter = { position };
    }

    const where = {
      AND: [
        role ? { role } : {},
        status ? { status } : {},
        teamId ? (teamId === "none" ? { teamId: null } : { teamId }) : {},
        positionFilter,
        minLevel ? { level: { gte: Number(minLevel) } } : {},
        search
          ? {
              OR: [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { email: { contains: search } },
              ],
            }
          : {},
      ],
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { team: true },
        orderBy: { registeredAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users: users.map(publicUser), total, offset, limit });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/users/:id/role   { role: "PLAYER"|"MANAGER"|"ADMIN" }  (admin only)
async function setRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!["PLAYER", "MANAGER", "ADMIN"].includes(role)) {
      return res.status(400).json({ error: "Rol invalid." });
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/users/:id/ban   { ban: true|false, reason? }  (admin only)
async function setBanStatus(req, res, next) {
  try {
    const { ban, reason } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: ban
        ? { status: "BANNED", bannedAt: new Date(), bannedReason: reason || null }
        : { status: "ACTIVE", bannedAt: null, bannedReason: null },
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/users/:id/team   { teamId: string | null }   (admin only)
async function assignTeam(req, res, next) {
  try {
    const { teamId } = req.body;
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: "Utilizatorul nu există." });

    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) return res.status(404).json({ error: "Echipa nu există." });
      if (teamId !== target.teamId) {
        const squadCount = await prisma.user.count({ where: { teamId } });
        if (squadCount >= 30) return res.status(409).json({ error: "Echipa selectată are deja lotul complet (30 de jucători)." });
      }
    }

    if (teamId !== target.teamId) {
      await prisma.$transaction([
        ...(target.teamId
          ? [prisma.teamHistory.updateMany({
              where: { userId: target.id, teamId: target.teamId, leftAt: null },
              data: { leftAt: new Date(), reason: "TRANSFERRED" },
            })]
          : []),
        prisma.user.update({ where: { id: target.id }, data: { teamId: teamId || null } }),
        ...(teamId
          ? [prisma.teamHistory.create({
              data: { userId: target.id, teamId, reason: target.teamId ? "TRANSFERRED" : "JOINED" },
            })]
          : []),
      ]);
    }

    const updated = await prisma.user.findUnique({ where: { id: target.id }, include: { team: true } });
    res.json({ user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/users/:id/economy   { cash?: number, tokens?: number }   (admin only)
// Amounts are ADDED to the player's current balance (can be negative to deduct).
async function grantEconomy(req, res, next) {
  try {
    const { cash, tokens } = req.body;
    if (cash === undefined && tokens === undefined) {
      return res.status(400).json({ error: "Specifică cel puțin cash sau tokens." });
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: "Utilizatorul nu există." });

    const nextCash = cash !== undefined ? Math.max(0, target.cash + Number(cash)) : undefined;
    const nextTokens = tokens !== undefined ? Math.max(0, target.tokens + Number(tokens)) : undefined;

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { cash: nextCash, tokens: nextTokens },
    });
    res.json({ user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, setRole, setBanStatus, assignTeam, grantEconomy };
