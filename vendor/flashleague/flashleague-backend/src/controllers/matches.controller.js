const prisma = require("../config/db");
const { simulateAndPersistMatch } = require("../services/matchService");
const { multiplierFor } = require("../services/eventsService");
const { totalLevel } = require("../utils/matchSim");

// Sticker keys accepted for choreography cells — kept in sync with the
// sprite map in frontend/src/ui.jsx (STICKERS).
const STICKER_KEYS = new Set(["cake", "trophy", "ultras", "ball", "flame", "flare", "scarf", "confetti"]);
const CELL_COST = { color: 10, letter: 30, number: 30, sticker: 100 };
// Every choreography also costs a flat 1 token, no matter how many rows/cells.
const CHOREOGRAPHY_TOKEN_COST = 1;
const MAX_ROWS = 10;
const FIXED_COLS = 10;

function stripPlayers(team) {
  if (!team) return null;
  const { players, ...rest } = team;
  return rest;
}

/**
 * Resolves a team's saved Prim 11 + tactics into a display-ready shape for
 * the stadium "Primul 11" tab: formation, the three tactic knobs, and 11
 * slots each carrying either the assigned player summary or null. Returns
 * null when the team has no lineup saved yet.
 */
async function resolveLineup(teamId) {
  if (!teamId) return null;
  const lineup = await prisma.lineup.findUnique({ where: { teamId } });
  if (!lineup) return null;

  const slots = JSON.parse(lineup.slotsJson);
  const playerIds = slots.map(s => s.playerId).filter(Boolean);
  const players = playerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, firstName: true, lastName: true, position: true, level: true, nationality: true },
      })
    : [];
  const byId = new Map(players.map(p => [p.id, p]));

  return {
    formation: lineup.formation,
    style: lineup.style,
    marking: lineup.marking,
    pressing: lineup.pressing,
    slots: slots.map(s => ({
      position: s.position,
      player: s.playerId ? byId.get(s.playerId) || null : null,
    })),
  };
}

// GET /api/matches/:id
async function getMatch(req, res, next) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        homeTeam: { include: { players: { select: { id: true, level: true, status: true } } } },
        awayTeam: { include: { players: { select: { id: true, level: true, status: true } } } },
        league: true,
        events: { include: { scorer: true, assistBy: true }, orderBy: { minute: "asc" } },
        choreographies: {
          include: { author: { select: { id: true, firstName: true, lastName: true, level: true, nationality: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!match) return res.status(404).json({ error: "Meciul nu există." });

    // Pre-match, show the live sum of active-squad levels (squads can still
    // change); once played, the snapshot taken at simulation time is authoritative.
    const liveHomeTotal = match.homeTeam ? totalLevel(match.homeTeam.players.filter(p => p.status === "ACTIVE")) : 0;
    const liveAwayTotal = match.awayTeam ? totalLevel(match.awayTeam.players.filter(p => p.status === "ACTIVE")) : 0;

    const [homeLineup, awayLineup] = await Promise.all([
      resolveLineup(match.homeTeamId),
      resolveLineup(match.awayTeamId),
    ]);

    res.json({
      match: {
        ...match,
        homeTeam: stripPlayers(match.homeTeam),
        awayTeam: stripPlayers(match.awayTeam),
        homeTotalLevel: match.status === "PLAYED" ? match.homeTotalLevel : liveHomeTotal,
        awayTotalLevel: match.status === "PLAYED" ? match.awayTotalLevel : liveAwayTotal,
        homeLineup,
        awayLineup,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/matches/:id/simulate   (admin only)
// Manual trigger — normally matches simulate automatically once their
// kickoff time passes (via the match-scheduler cron in the flashcup-workers
// repo), this endpoint lets an admin force it early for testing/demo purposes.
async function simulateNow(req, res, next) {
  try {
    const match = await simulateAndPersistMatch(req.params.id);
    res.json({ match });
  } catch (err) {
    next(err);
  }
}

// POST /api/matches/:id/choreography   { rows, cells }
// cells is a `rows`-length array of 10-cell rows; each cell is either null
// or { type: "color"|"letter"|"number"|"sticker", value: string }. Costs
// cash (color=10, letter/number=30, sticker=100 per cell) plus a flat 1
// token per choreography regardless of size, and grants the author's team
// "influence" = cost * (author level * 0.3), factored into the simulation.
// A player may submit any number of choreographies for the same match
// (each is its own purchase), as long as it's still before kickoff.
async function addChoreography(req, res, next) {
  try {
    const user = req.user;
    if (!user.teamId) return res.status(409).json({ error: "Nu faci parte din nicio echipă." });

    const match = await prisma.match.findUnique({ where: { id: req.params.id } });
    if (!match) return res.status(404).json({ error: "Meciul nu există." });
    if (match.status !== "SCHEDULED") {
      return res.status(409).json({ error: "Poți adăuga influență doar înainte de începerea meciului." });
    }
    if (match.homeTeamId !== user.teamId && match.awayTeamId !== user.teamId) {
      return res.status(403).json({ error: "Poți influența doar meciurile propriei echipe." });
    }

    const { rows, cells } = req.body;
    if (!Number.isInteger(rows) || rows < 1 || rows > MAX_ROWS) {
      return res.status(400).json({ error: `Numărul de rânduri trebuie să fie între 1 și ${MAX_ROWS}.` });
    }
    if (!Array.isArray(cells) || cells.length !== rows) {
      return res.status(400).json({ error: "Grila trimisă nu corespunde numărului de rânduri." });
    }

    let cost = 0;
    for (const row of cells) {
      if (!Array.isArray(row) || row.length !== FIXED_COLS) {
        return res.status(400).json({ error: `Fiecare rând trebuie să aibă exact ${FIXED_COLS} pătrate.` });
      }
      for (const cell of row) {
        if (cell === null || cell === undefined) continue;
        if (!cell.type || !CELL_COST[cell.type]) {
          return res.status(400).json({ error: "Tip de pătrățel invalid — acceptate: color, letter, number, sticker." });
        }
        if (cell.type === "sticker" && !STICKER_KEYS.has(cell.value)) {
          return res.status(400).json({ error: "Sticker necunoscut." });
        }
        cost += CELL_COST[cell.type];
      }
    }

    if (cost === 0) return res.status(400).json({ error: "Coregrafia este goală — adaugă cel puțin un pătrățel." });
    if (user.cash < cost) return res.status(409).json({ error: `Nu ai suficienți bani. Cost: ${cost}, disponibil: ${user.cash}.` });
    if (user.tokens < CHOREOGRAPHY_TOKEN_COST) {
      return res.status(409).json({ error: `Ai nevoie de ${CHOREOGRAPHY_TOKEN_COST} token pentru o coregrafie. Disponibil: ${user.tokens}.` });
    }

    // Starters in the team's saved Prim 11 contribute 15% more crowd
    // influence than bench players.
    let starterBonus = 1;
    const lineup = await prisma.lineup.findUnique({ where: { teamId: user.teamId } });
    if (lineup) {
      try {
        const slots = JSON.parse(lineup.slotsJson);
        if (slots.some(s => s.playerId === user.id)) starterBonus = 1.15;
      } catch { /* malformed lineup — treat as bench */ }
    }

    // A live DOUBLE_CHOREO_INFLUENCE event doubles the influence for the same cost.
    const influenceMult = await multiplierFor("DOUBLE_CHOREO_INFLUENCE");
    const influence = cost * (user.level * 0.3) * starterBonus * influenceMult;
    const isHome = match.homeTeamId === user.teamId;

    const [, , choreography] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { cash: { decrement: cost }, tokens: { decrement: CHOREOGRAPHY_TOKEN_COST } } }),
      prisma.match.update({
        where: { id: match.id },
        data: isHome ? { homeInfluence: { increment: influence } } : { awayInfluence: { increment: influence } },
      }),
      prisma.choreography.create({
        data: {
          matchId: match.id,
          teamId: user.teamId,
          authorId: user.id,
          rows,
          cols: FIXED_COLS,
          cellsJson: JSON.stringify(cells),
          cost,
          influence,
        },
        include: { author: { select: { id: true, firstName: true, lastName: true, level: true, nationality: true } } },
      }),
    ]);

    res.status(201).json({ choreography, cashRemaining: user.cash - cost, tokensRemaining: user.tokens - CHOREOGRAPHY_TOKEN_COST });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMatch, simulateNow, addChoreography };
