const prisma = require("../config/db");
const seasonService = require("../services/seasonService");

// A 6-digit hex colour (#rrggbb). Used to validate kit colours.
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * A team's saved Prim 11 as `{ formation, playerIds }` where playerIds is an
 * 11-length array in slot order (index 0 = GK), entries null for empty slots.
 * Returns null when the team has no Lineup saved. Lets the client list the
 * squad starters-first (in formation order), then the bench.
 */
async function getLineupOrder(teamId) {
  const lineup = await prisma.lineup.findUnique({ where: { teamId } });
  if (!lineup) return null;
  try {
    const slots = JSON.parse(lineup.slotsJson);
    return {
      formation: lineup.formation,
      playerIds: slots.map(s => s.playerId || null),
      style: lineup.style,
      marking: lineup.marking,
      pressing: lineup.pressing,
    };
  } catch {
    return null;
  }
}

// A team logo is either an http(s) URL (e.g. from football-logos.cc /
// raw.githubusercontent.com/luukhopman/football-logos) or a small
// client-downscaled image data URI. Cap the length so a data URI can't
// bloat the row.
const MAX_LOGO_LEN = 300_000;
function normalizeLogo(logoUrl) {
  if (logoUrl === undefined) return { skip: true };
  if (logoUrl === null || logoUrl === "") return { value: null };
  if (typeof logoUrl !== "string" || logoUrl.length > MAX_LOGO_LEN) return { error: "Logo invalid sau prea mare." };
  if (/^https?:\/\/.+/i.test(logoUrl) || /^data:image\/(png|jpeg|jpg|webp|svg\+xml);/i.test(logoUrl)) return { value: logoUrl };
  return { error: "Logo-ul trebuie să fie un URL http(s) sau o imagine încărcată." };
}

// GET /api/teams
async function listTeams(req, res, next) {
  try {
    const teams = await prisma.team.findMany({
      include: { league: true, _count: { select: { players: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ teams });
  } catch (err) {
    next(err);
  }
}

// GET /api/teams/:id  — includes full squad
async function getTeam(req, res, next) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: {
        league: true,
        players: {
          select: {
            id: true, firstName: true, lastName: true, position: true, nationality: true, role: true, isBot: true,
            level: true, xp: true, totalGoals: true, totalAssists: true, totalMatches: true, lastLoginAt: true,
          },
        },
      },
    });
    if (!team) return res.status(404).json({ error: "Echipa nu există." });
    const lineup = await getLineupOrder(team.id);
    res.json({ team: { ...team, lineup } });
  } catch (err) {
    next(err);
  }
}

// POST /api/teams   { name, city, colorHex, colorHex2, logoUrl, leagueId }   (admin only)
async function createTeam(req, res, next) {
  try {
    const { name, city, colorHex, colorHex2, logoUrl, leagueId } = req.body;
    if (!name) return res.status(400).json({ error: "Numele echipei este obligatoriu." });

    const logo = normalizeLogo(logoUrl);
    if (logo.error) return res.status(400).json({ error: logo.error });

    if (leagueId) {
      const league = await prisma.league.findUnique({ where: { id: leagueId } });
      if (!league) return res.status(404).json({ error: "Liga specificată nu există." });
    }

    const team = await prisma.team.create({
      data: {
        name, city,
        colorHex: colorHex || "#1F6F4A",
        colorHex2: HEX_COLOR.test(colorHex2 || "") ? colorHex2 : null,
        logoUrl: logo.skip ? null : logo.value,
        leagueId: leagueId || null,
      },
    });
    res.status(201).json({ team });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/teams/:id/league   { leagueId }   (admin only) — assign/reassign a team to a league
async function assignLeague(req, res, next) {
  try {
    const { leagueId } = req.body;
    if (leagueId) {
      const league = await prisma.league.findUnique({ where: { id: leagueId } });
      if (!league) return res.status(404).json({ error: "Liga specificată nu există." });
    }
    const team = await prisma.team.update({ where: { id: req.params.id }, data: { leagueId: leagueId || null } });
    res.json({ team });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/teams/:id   { name?, city?, colorHex?, colorHex2?, logoUrl? }   (admin only)
async function updateTeam(req, res, next) {
  try {
    const { name, city, colorHex, colorHex2, logoUrl } = req.body;
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: "Numele echipei este obligatoriu." });
    }

    const logo = normalizeLogo(logoUrl);
    if (logo.error) return res.status(400).json({ error: logo.error });

    const team = await prisma.team.findUnique({ where: { id: req.params.id } });
    if (!team) return res.status(404).json({ error: "Echipa nu există." });

    const updated = await prisma.team.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        city: city !== undefined ? city : undefined,
        colorHex: colorHex !== undefined ? colorHex : undefined,
        colorHex2: colorHex2 === undefined
          ? undefined
          : (HEX_COLOR.test(colorHex2 || "") ? colorHex2 : null),
        logoUrl: logo.skip ? undefined : logo.value,
      },
    });
    res.json({ team: updated });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/teams/:id   (admin only)
// Releases every player, deletes the club feed + team history, detaches the
// team from any match it played (scores/events are kept), then removes it.
async function deleteTeam(req, res, next) {
  try {
    const team = await prisma.team.findUnique({ where: { id: req.params.id } });
    if (!team) return res.status(404).json({ error: "Echipa nu există." });

    await prisma.$transaction([
      prisma.teamHistory.updateMany({
        where: { teamId: team.id, leftAt: null },
        data: { leftAt: new Date(), reason: "KICKED" },
      }),
      prisma.user.updateMany({ where: { teamId: team.id }, data: { teamId: null } }),
      prisma.post.deleteMany({ where: { teamId: team.id } }),
      prisma.teamHistory.deleteMany({ where: { teamId: team.id } }),
      prisma.choreography.deleteMany({ where: { teamId: team.id } }),
      prisma.trophyPlayer.deleteMany({ where: { trophy: { teamId: team.id } } }),
      prisma.trophy.deleteMany({ where: { teamId: team.id } }),
      prisma.teamSeasonRecord.deleteMany({ where: { teamId: team.id } }),
      prisma.match.updateMany({ where: { homeTeamId: team.id }, data: { homeTeamId: null } }),
      prisma.match.updateMany({ where: { awayTeamId: team.id }, data: { awayTeamId: null } }),
      prisma.league.updateMany({ where: { winnerTeamId: team.id }, data: { winnerTeamId: null } }),
      prisma.team.delete({ where: { id: team.id } }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/teams/:id/profile — club page: squad + season influence, trophy
// case, and season-by-season history.
async function getTeamProfile(req, res, next) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: {
        league: true,
        players: {
          select: {
            id: true, firstName: true, lastName: true, position: true, nationality: true,
            level: true, totalGoals: true, totalAssists: true, totalMatches: true, status: true, role: true,
          },
        },
      },
    });
    if (!team) return res.status(404).json({ error: "Echipa nu există." });

    // Current season's leagues (own LIGA + its CUPA_INTERNA, if any), used to
    // scope "influență adăugată în sezonul curent" per player.
    let seasonLeagueIds = [];
    if (team.league && team.league.status === "ACTIVE") {
      const cup = await prisma.league.findFirst({ where: { parentLeagueId: team.league.id, type: "CUPA_INTERNA" } });
      seasonLeagueIds = [team.league.id, ...(cup ? [cup.id] : [])];
    }

    const squad = await Promise.all(team.players.map(async (p) => {
      let seasonInfluence = 0;
      if (seasonLeagueIds.length) {
        const agg = await prisma.choreography.aggregate({
          _sum: { influence: true },
          where: { authorId: p.id, teamId: team.id, match: { leagueId: { in: seasonLeagueIds } } },
        });
        seasonInfluence = agg._sum.influence || 0;
      }
      return { ...p, seasonInfluence };
    }));

    const totalLevel = team.players.filter(p => p.status === "ACTIVE").reduce((sum, p) => sum + p.level, 0);

    // MVP_LIGA is a personal player award (podium of a league's influence
    // board) — it lives in the player's trophy case, not the club cabinet.
    const trophies = await prisma.trophy.findMany({
      where: { teamId: team.id, competitionType: { not: "MVP_LIGA" } },
      orderBy: { awardedAt: "desc" },
    });
    const seasonRecords = await prisma.teamSeasonRecord.findMany({ where: { teamId: team.id }, orderBy: { seasonNumber: "desc" } });

    const lineup = await getLineupOrder(team.id);

    // Header extras: current manager, previous-season trophy haul, and the
    // club's rank in the global season team-influence board.
    const managerPlayer = team.players.find((p) => p.role === "MANAGER") || null;
    const manager = managerPlayer
      ? { id: managerPlayer.id, firstName: managerPlayer.firstName, lastName: managerPlayer.lastName }
      : null;

    const activeSeason = await prisma.season.findFirst({ where: { status: "ACTIVE" }, orderBy: { number: "desc" } });
    const lastSeasonNumber = activeSeason && activeSeason.number > 1 ? activeSeason.number - 1 : null;
    const lastSeasonTrophies = lastSeasonNumber
      ? await prisma.trophy.findMany({
          where: { teamId: team.id, competitionType: { not: "MVP_LIGA" }, seasonNumber: lastSeasonNumber },
          orderBy: { awardedAt: "desc" },
        })
      : [];

    let influenceRank = null;
    if (activeSeason) {
      try {
        influenceRank = await seasonService.seasonTeamInfluenceRank(activeSeason.id, team.id);
      } catch { influenceRank = null; }
    }

    const { players, ...teamRest } = team;
    res.json({
      team: teamRest, totalLevel, squad, lineup, trophies, seasonRecords,
      manager, lastSeasonTrophies, lastSeasonNumber, influenceRank,
    });
  } catch (err) {
    next(err);
  }
}

/* ---------------------------------------------------------------------------
   MANAGER ELECTION POLL  (any squad member; one open poll per team)
--------------------------------------------------------------------------- */
const { resolvePoll, POLL_DURATION_MS } = require("../services/managerPollService");

async function memberOr403(req, res) {
  const teamId = req.params.teamId;
  if (req.user.teamId !== teamId) {
    res.status(403).json({ error: "Nu faci parte din această echipă." });
    return null;
  }
  return teamId;
}

async function getActiveManagerPoll(teamId) {
  let poll = await prisma.managerPoll.findFirst({ where: { teamId, status: "OPEN" }, orderBy: { createdAt: "desc" } });
  if (poll && Date.now() >= new Date(poll.closesAt).getTime()) {
    poll = await resolvePoll(poll.id);
  }
  return poll && poll.status === "OPEN" ? poll : null;
}

// GET /api/teams/:teamId/manager-poll
async function getManagerPoll(req, res, next) {
  try {
    const teamId = await memberOr403(req, res);
    if (!teamId) return;

    const poll = await getActiveManagerPoll(teamId);
    if (!poll) return res.json({ poll: null });

    const [candidate, startedBy, votes, eligible, myVote] = await Promise.all([
      prisma.user.findUnique({ where: { id: poll.candidateId }, select: { id: true, firstName: true, lastName: true, position: true } }),
      prisma.user.findUnique({ where: { id: poll.startedById }, select: { firstName: true, lastName: true } }),
      prisma.managerPollVote.findMany({ where: { pollId: poll.id }, select: { choice: true } }),
      prisma.user.count({ where: { teamId, isBot: false } }),
      prisma.managerPollVote.findUnique({ where: { pollId_voterId: { pollId: poll.id, voterId: req.user.id } }, select: { choice: true } }),
    ]);
    const yes = votes.filter(v => v.choice === "YES").length;
    const no = votes.filter(v => v.choice === "NO").length;

    res.json({
      poll: {
        id: poll.id,
        candidate,
        startedBy,
        startedById: poll.startedById,
        createdAt: poll.createdAt,
        closesAt: poll.closesAt,
        tally: { yes, no, eligible },
        myVote: myVote ? myVote.choice : null,
        canManage: poll.startedById === req.user.id || req.user.role === "MANAGER",
      },
    });
  } catch (err) { next(err); }
}

// POST /api/teams/:teamId/manager-poll   { candidateId }
async function startManagerPoll(req, res, next) {
  try {
    const teamId = await memberOr403(req, res);
    if (!teamId) return;
    if (req.user.isBot) return res.status(403).json({ error: "Doar jucătorii reali pot porni un sondaj." });

    const existing = await getActiveManagerPoll(teamId);
    if (existing) return res.status(409).json({ error: "Există deja un sondaj de manager în desfășurare." });

    const { candidateId } = req.body;
    if (!candidateId) return res.status(400).json({ error: "Candidatul este obligatoriu." });
    const candidate = await prisma.user.findUnique({ where: { id: candidateId } });
    if (!candidate || candidate.teamId !== teamId) return res.status(400).json({ error: "Candidatul trebuie să facă parte din echipă." });
    if (candidate.isBot) return res.status(400).json({ error: "Nu poți propune un jucător-bot." });
    if (candidate.role === "MANAGER") return res.status(409).json({ error: "Acest jucător este deja managerul echipei." });

    const poll = await prisma.managerPoll.create({
      data: {
        teamId,
        candidateId,
        startedById: req.user.id,
        closesAt: new Date(Date.now() + POLL_DURATION_MS),
      },
    });
    res.status(201).json({ poll });
  } catch (err) { next(err); }
}

// POST /api/teams/:teamId/manager-poll/vote   { choice: "YES" | "NO" }
async function voteManagerPoll(req, res, next) {
  try {
    const teamId = await memberOr403(req, res);
    if (!teamId) return;
    if (req.user.isBot) return res.status(403).json({ error: "Doar jucătorii reali pot vota." });

    const choice = req.body.choice;
    if (!["YES", "NO"].includes(choice)) return res.status(400).json({ error: "Vot invalid." });

    const poll = await getActiveManagerPoll(teamId);
    if (!poll) return res.status(409).json({ error: "Nu există un sondaj activ." });

    await prisma.managerPollVote.upsert({
      where: { pollId_voterId: { pollId: poll.id, voterId: req.user.id } },
      update: { choice },
      create: { pollId: poll.id, voterId: req.user.id, choice },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
}

// POST /api/teams/:teamId/manager-poll/cancel
async function cancelManagerPoll(req, res, next) {
  try {
    const teamId = await memberOr403(req, res);
    if (!teamId) return;
    const poll = await prisma.managerPoll.findFirst({ where: { teamId, status: "OPEN" } });
    if (!poll) return res.status(404).json({ error: "Niciun sondaj activ." });
    if (poll.startedById !== req.user.id && req.user.role !== "MANAGER") {
      return res.status(403).json({ error: "Doar cel care a pornit sondajul sau managerul îl pot anula." });
    }
    await prisma.managerPoll.update({ where: { id: poll.id }, data: { status: "CANCELLED", resolvedAt: new Date() } });
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = {
  listTeams, getTeam, createTeam, assignLeague, updateTeam, deleteTeam, getTeamProfile,
  getManagerPoll, startManagerPoll, voteManagerPoll, cancelManagerPoll,
};
