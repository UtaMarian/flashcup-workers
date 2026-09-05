const prisma = require("../config/db");
const { simulateAndPersistMatch } = require("../services/matchService");
const { generateRoundRobin } = require("../utils/fixtures");
const { generateKickoffTimes, addDays } = require("../utils/matchTimes");
const seasonService = require("../services/seasonService");
const { getGameSettings } = require("../services/settingsService");
const { getOrSet } = require("../utils/cache");

// Standings/top-scorers/influence-board only change when a match is
// simulated (at most once a minute, from the cron worker) — a short TTL
// cache avoids recomputing them on every request from Dashboard/Competitions.
const BOARD_CACHE_TTL_MS = 20 * 1000;

/**
 * Creates the auto-generated "Cupa Națională" knockout league that accompanies
 * every LIGA once it starts. Runs inside the caller's transaction. Its first
 * knockout round is played on the day of league round
 * `settings.nationalCupStartRound`; every later round runs one calendar day
 * apart. Uses the game-wide cup kickoff-hour window
 * (settings.cupMatchDayStartHour/EndHour). Silently no-ops if there are fewer
 * than 2 teams. Delegates the bracket build to seasonService.buildKnockoutLeague
 * (same shape used at season rollover).
 */
async function createInternalCupForLeague(tx, league, teamIds, startDate, settings) {
  const cupStartDay = addDays(startDate, (settings.nationalCupStartRound - 1) * league.daysBetweenRounds);
  return seasonService.buildKnockoutLeague(tx, {
    name: `Cupa Națională — ${league.name}`,
    type: "CUPA_INTERNA",
    flag: league.flag || null, // national cup inherits its parent's flag
    seasonId: league.seasonId,
    seasonNumber: league.seasonNumber,
    parentLeagueId: league.id,
    teamIds,
    startDate: cupStartDay,
    hours: { startHour: settings.cupMatchDayStartHour, endHour: settings.cupMatchDayEndHour },
    daysBetweenRounds: 1,
  });
}

// GET /api/leagues
async function listLeagues(req, res, next) {
  try {
    const leagues = await prisma.league.findMany({
      include: { teams: true, _count: { select: { matches: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({ leagues });
  } catch (err) {
    next(err);
  }
}

// POST /api/leagues   (admin only)
// { name, matchDayStartHour, matchDayEndHour,
//   qualifyChampionsSlots, qualifyInternationalSlots, doubleRoundRobin }
// Always creates a LIGA — Cupa Campionilor / Cupa Internațională are
// generated automatically, season-wide, when the global season closes
// (see seasonService.closeGlobalSeason). The season itself is never
// chosen by the admin: every new league joins whichever season is
// currently active.
async function createLeague(req, res, next) {
  try {
    const {
      name, flag, matchDayStartHour, matchDayEndHour,
      qualifyChampionsSlots, qualifyInternationalSlots, doubleRoundRobin,
    } = req.body;

    if (!name) return res.status(400).json({ error: "Numele competiției este obligatoriu." });

    const [season, settings] = await Promise.all([seasonService.getOrCreateCurrentSeason(), getGameSettings()]);

    const league = await prisma.league.create({
      data: {
        name,
        type: "LIGA",
        flag: flag || null,
        season: `Sezon ${season.number}`,
        seasonId: season.id,
        seasonNumber: season.number,
        matchDayStartHour: matchDayStartHour ?? settings.defaultMatchDayStartHour,
        matchDayEndHour: matchDayEndHour ?? settings.defaultMatchDayEndHour,
        daysBetweenRounds: settings.defaultDaysBetweenRounds,
        qualifyChampionsSlots: qualifyChampionsSlots ?? settings.defaultQualifyChampionsSlots,
        qualifyInternationalSlots: qualifyInternationalSlots ?? settings.defaultQualifyInternationalSlots,
        doubleRoundRobin: doubleRoundRobin ?? settings.defaultDoubleRoundRobin,
      },
    });
    res.status(201).json({ league });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/leagues/:id/settings   (admin only) — parameters needed before starting the league
async function updateSettings(req, res, next) {
  try {
    const league = await prisma.league.findUnique({ where: { id: req.params.id } });
    if (!league) return res.status(404).json({ error: "Liga nu există." });
    if (league.status !== "DRAFT") {
      return res.status(409).json({ error: "Setările pot fi modificate doar cât timp liga e în stadiul DRAFT." });
    }

    const {
      name, startDate, matchDayStartHour, matchDayEndHour, daysBetweenRounds,
      doubleRoundRobin, qualifyChampionsSlots, qualifyInternationalSlots,
    } = req.body;

    const updated = await prisma.league.update({
      where: { id: req.params.id },
      data: {
        name: name ?? undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        matchDayStartHour: matchDayStartHour ?? undefined,
        matchDayEndHour: matchDayEndHour ?? undefined,
        daysBetweenRounds: daysBetweenRounds ?? undefined,
        doubleRoundRobin: doubleRoundRobin ?? undefined,
        qualifyChampionsSlots: qualifyChampionsSlots ?? undefined,
        qualifyInternationalSlots: qualifyInternationalSlots ?? undefined,
      },
    });
    res.json({ league: updated });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/leagues/:id/flag   { flag }   (admin only)
// Cosmetic — editable at any point in the league's life. `flag` is an ISO
// 3166-1 alpha-2 code, "INT" for a continental cup, or "" / null to clear.
// Setting it on a LIGA also updates its auto-generated national cup.
async function setLeagueFlag(req, res, next) {
  try {
    const league = await prisma.league.findUnique({ where: { id: req.params.id } });
    if (!league) return res.status(404).json({ error: "Liga nu există." });

    let flag = (req.body.flag || "").trim().toUpperCase();
    if (flag && flag !== "INT" && flag.length !== 2) {
      return res.status(400).json({ error: 'Steagul trebuie să fie un cod de țară din 2 litere, "INT", sau gol.' });
    }
    flag = flag || null;

    await prisma.$transaction([
      prisma.league.update({ where: { id: league.id }, data: { flag } }),
      prisma.league.updateMany({ where: { parentLeagueId: league.id, type: "CUPA_INTERNA" }, data: { flag } }),
    ]);

    const updated = await prisma.league.findUnique({ where: { id: league.id } });
    res.json({ league: updated });
  } catch (err) {
    next(err);
  }
}

// POST /api/leagues/:id/start   (admin only)
// Generates the full round-robin fixture list and auto-assigns a daily
// matchday + a kickoff time inside the configured [start,end] hour window
// for every match, starting from league.startDate (or "now" if unset).
async function startLeague(req, res, next) {
  try {
    const league = await prisma.league.findUnique({
      where: { id: req.params.id },
      include: { teams: true },
    });
    if (!league) return res.status(404).json({ error: "Liga nu există." });
    if (league.status !== "DRAFT") {
      return res.status(409).json({ error: "Liga a fost deja pornită." });
    }
    if (league.teams.length < 2) {
      return res.status(400).json({ error: "Sunt necesare minimum 2 echipe pentru a porni liga." });
    }

    const settings = await getGameSettings();

    const rounds = generateRoundRobin(league.teams.map(t => t.id), {
      doubleRound: league.doubleRoundRobin,
    });

    const startDate = league.startDate ? new Date(league.startDate) : new Date();
    startDate.setHours(0, 0, 0, 0);

    const matchesToCreate = [];
    rounds.forEach((roundPairs, roundIndex) => {
      const day = addDays(startDate, roundIndex * league.daysBetweenRounds);
      const kickoffs = generateKickoffTimes(day, roundPairs.length, {
        startHour: league.matchDayStartHour,
        endHour: league.matchDayEndHour,
      });
      roundPairs.forEach((pair, i) => {
        matchesToCreate.push({
          leagueId: league.id,
          round: roundIndex + 1,
          homeTeamId: pair.home,
          awayTeamId: pair.away,
          scheduledAt: kickoffs[i],
          status: "SCHEDULED",
        });
      });
    });

    const { updated, cupLeague } = await prisma.$transaction(async (tx) => {
      await tx.match.createMany({ data: matchesToCreate });
      const updated = await tx.league.update({
        where: { id: league.id },
        data: { status: "ACTIVE", startDate },
      });

      let cupLeague = null;
      if (league.type === "LIGA") {
        cupLeague = await createInternalCupForLeague(tx, league, league.teams.map(t => t.id), startDate, settings);
      }

      return { updated, cupLeague };
    });

    res.json({
      league: updated,
      generatedMatches: matchesToCreate.length,
      totalRounds: rounds.length,
      internalCup: cupLeague ? { id: cupLeague.id, name: cupLeague.name } : null,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/leagues/:id/standings — computed on the fly from played matches
async function getStandings(req, res, next) {
  try {
    const payload = await getOrSet(`standings:${req.params.id}`, BOARD_CACHE_TTL_MS, async () => {
      const league = await prisma.league.findUnique({
        where: { id: req.params.id },
        include: { teams: true },
      });
      if (!league) return null;

      const playedMatches = await prisma.match.findMany({
        where: { leagueId: league.id, status: "PLAYED" },
      });

      const table = Object.fromEntries(
        league.teams.map(t => [t.id, {
          team: t, mj: 0, v: 0, e: 0, inf: 0, gm: 0, gp: 0, pct: 0,
        }])
      );

      for (const m of playedMatches) {
        const home = table[m.homeTeamId];
        const away = table[m.awayTeamId];
        if (!home || !away) continue;

        home.mj += 1; away.mj += 1;
        home.gm += m.homeGoals; home.gp += m.awayGoals;
        away.gm += m.awayGoals; away.gp += m.homeGoals;

        if (m.homeGoals > m.awayGoals) { home.v += 1; away.inf += 1; home.pct += 3; }
        else if (m.homeGoals < m.awayGoals) { away.v += 1; home.inf += 1; away.pct += 3; }
        else { home.e += 1; away.e += 1; home.pct += 1; away.pct += 1; }
      }

      // Last-5 form (oldest→newest) per team, from the same played matches.
      const formByTeam = Object.fromEntries(league.teams.map(t => [t.id, []]));
      const chron = [...playedMatches].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
      for (const m of chron) {
        if (formByTeam[m.homeTeamId]) {
          formByTeam[m.homeTeamId].push(m.homeGoals > m.awayGoals ? "W" : m.homeGoals < m.awayGoals ? "L" : "D");
        }
        if (formByTeam[m.awayTeamId]) {
          formByTeam[m.awayTeamId].push(m.awayGoals > m.homeGoals ? "W" : m.awayGoals < m.homeGoals ? "L" : "D");
        }
      }

      const standings = Object.values(table)
        .map(row => ({ ...row, gd: row.gm - row.gp, form: (formByTeam[row.team.id] || []).slice(-5) }))
        .sort((a, b) => b.pct - a.pct || b.gd - a.gd || b.gm - a.gm);

      return { league, standings };
    });

    if (!payload) return res.status(404).json({ error: "Liga nu există." });
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

// GET /api/leagues/:id/matches?status=PLAYED|SCHEDULED — full fixture list
async function getMatches(req, res, next) {
  try {
    const { status } = req.query;
    const matches = await prisma.match.findMany({
      where: { leagueId: req.params.id, ...(status ? { status } : {}) },
      include: { homeTeam: true, awayTeam: true, league: { select: { type: true, name: true } } },
      orderBy: [{ round: "asc" }, { scheduledAt: "asc" }],
    });
    res.json({ matches });
  } catch (err) {
    next(err);
  }
}

// GET /api/leagues/:id/influence-board — stats-only leaderboard: every
// player ranked by the crowd influence they've contributed to this league's
// matches this season, plus this league's own season-close prize tiers.
async function getInfluenceBoard(req, res, next) {
  try {
    const payload = await getOrSet(`influence-board:${req.params.id}`, BOARD_CACHE_TTL_MS, async () => {
      const league = await prisma.league.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, seasonNumber: true, flag: true } });
      if (!league) return null;

      const players = await seasonService.leaguePlayerInfluenceBoard(league.id, 50);
      return { league, players, prizes: seasonService.PLAYER_INFLUENCE_PRIZES };
    });

    if (!payload) return res.status(404).json({ error: "Liga nu există." });
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

// GET /api/leagues/:id/top-scorers — stats-only "Marcatori" board: goals +
// assists by players currently on this LIGA's clubs, counted across every
// competition of the LIGA's season. Empty for a non-LIGA id.
async function getTopScorers(req, res, next) {
  try {
    const result = await getOrSet(`top-scorers:${req.params.id}`, BOARD_CACHE_TTL_MS, async () => {
      const { league, scorers } = await seasonService.leagueSeasonTopScorers(req.params.id, 40);
      if (!league) {
        const exists = await prisma.league.findUnique({ where: { id: req.params.id }, select: { id: true } });
        if (!exists) return { notFound: true };
        return { body: { league: null, scorers: [] } };
      }
      return {
        body: {
          league: { id: league.id, name: league.name, flag: league.flag, seasonNumber: league.seasonNumber },
          scorers,
        },
      };
    });

    if (result.notFound) return res.status(404).json({ error: "Liga nu există." });
    res.json(result.body);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/leagues/:id   (admin only)
// Removes the league (and, if it's a LIGA, its auto-generated CUPA_INTERNA
// along with it): all of their matches/events are deleted, and any teams
// pointed at this league are released back to "no league".
async function deleteLeague(req, res, next) {
  try {
    const league = await prisma.league.findUnique({ where: { id: req.params.id }, include: { cups: true } });
    if (!league) return res.status(404).json({ error: "Liga nu există." });

    const cupIds = league.cups.map(c => c.id);
    const allLeagueIds = [league.id, ...cupIds];

    await prisma.$transaction([
      // Break self-referential bracket links first so the row deletes below
      // don't trip SQLite's immediate foreign-key checking.
      prisma.match.updateMany({ where: { leagueId: { in: allLeagueIds } }, data: { nextMatchId: null } }),
      prisma.matchEvent.deleteMany({ where: { match: { leagueId: { in: allLeagueIds } } } }),
      prisma.choreography.deleteMany({ where: { match: { leagueId: { in: allLeagueIds } } } }),
      prisma.match.deleteMany({ where: { leagueId: { in: allLeagueIds } } }),
      prisma.team.updateMany({ where: { leagueId: league.id }, data: { leagueId: null } }),
      prisma.league.updateMany({ where: { id: { in: cupIds } }, data: { parentLeagueId: null } }),
      prisma.league.deleteMany({ where: { id: { in: allLeagueIds } } }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// POST /api/leagues/:id/simulate   (admin only)
// Force-simulate every remaining SCHEDULED match in the league. For knockout
// brackets the passes repeat so each round runs once its feeder round has
// resolved (winners are advanced by simulateAndPersistMatch). Matches that
// don't have both teams assigned yet, or that error, are skipped.
async function simulateLeague(req, res, next) {
  try {
    const league = await prisma.league.findUnique({ where: { id: req.params.id } });
    if (!league) return res.status(404).json({ error: "Liga nu există." });
    if (league.status === "DRAFT") {
      return res.status(409).json({ error: "Liga nu a fost pornită — nu are meciuri generate." });
    }

    let simulated = 0;
    const errors = [];
    const failed = new Set();

    for (let pass = 0; pass < 100; pass++) {
      const batch = await prisma.match.findMany({
        where: {
          leagueId: league.id,
          status: "SCHEDULED",
          homeTeamId: { not: null },
          awayTeamId: { not: null },
          id: { notIn: [...failed] },
        },
        orderBy: [{ round: "asc" }, { scheduledAt: "asc" }],
        select: { id: true },
      });
      if (batch.length === 0) break;

      let progressed = false;
      for (const m of batch) {
        try {
          await simulateAndPersistMatch(m.id);
          simulated += 1;
          progressed = true;
        } catch (err) {
          failed.add(m.id);
          errors.push({ matchId: m.id, error: err.message });
        }
      }
      if (!progressed) break; // nothing left we can simulate
    }

    const remaining = await prisma.match.count({ where: { leagueId: league.id, status: "SCHEDULED" } });
    res.json({ simulated, remaining, errors });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listLeagues, createLeague, updateSettings, setLeagueFlag, startLeague, simulateLeague, getStandings, getMatches, getInfluenceBoard, getTopScorers, deleteLeague,
};
