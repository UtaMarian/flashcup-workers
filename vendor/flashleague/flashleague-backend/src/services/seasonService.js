const prisma = require("../config/db");
const { generateRoundRobin, generateKnockoutBracket } = require("../utils/fixtures");
const { generateKickoffTimes, addDays } = require("../utils/matchTimes");
const { getGameSettings } = require("./settingsService");

/** Linear interpolation between settings.leaguePlayerMaxCash (1st place) and ...MinCash (last place). */
function leaguePlayerCash(position, totalTeams, settings) {
  if (totalTeams <= 1) return settings.leaguePlayerMaxCash;
  const t = (position - 1) / (totalTeams - 1);
  return Math.round(settings.leaguePlayerMaxCash - t * (settings.leaguePlayerMaxCash - settings.leaguePlayerMinCash));
}

/** Finds the currently ACTIVE season, lazily creating Season #1 if none exists yet. */
async function getOrCreateCurrentSeason() {
  let season = await prisma.season.findFirst({ where: { status: "ACTIVE" }, orderBy: { number: "desc" } });
  if (!season) {
    const last = await prisma.season.findFirst({ orderBy: { number: "desc" } });
    season = await prisma.season.create({ data: { number: (last?.number || 0) + 1, status: "ACTIVE" } });
  }
  return season;
}

/** All seasons, most recent first. */
async function listSeasons() {
  return prisma.season.findMany({ orderBy: { number: "desc" } });
}

/** Every SeasonArchive (with standings + top scorers) for one season number. */
async function getSeasonArchive(seasonNumber) {
  return prisma.seasonArchive.findMany({
    where: { seasonNumber },
    include: {
      standings: { orderBy: { position: "asc" } },
      topScorers: { orderBy: { goals: "desc" } },
    },
    orderBy: { closedAt: "asc" },
  });
}

/** Same computation as GET /leagues/:id/standings — kept in sync deliberately. */
async function computeStandings(leagueId) {
  const league = await prisma.league.findUnique({ where: { id: leagueId }, include: { teams: true } });
  if (!league) return { league: null, standings: [] };
  const playedMatches = await prisma.match.findMany({ where: { leagueId, status: "PLAYED" } });

  const table = Object.fromEntries(
    league.teams.map(t => [t.id, { team: t, mj: 0, v: 0, e: 0, inf: 0, gm: 0, gp: 0, pct: 0 }])
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
  const standings = Object.values(table)
    .map(row => ({ ...row, gd: row.gm - row.gp }))
    .sort((a, b) => b.pct - a.pct || b.gd - a.gd || b.gm - a.gm);
  return { league, standings };
}

/** Champion / finalist / semifinalists / quarterfinalists from a knockout cup's matches. */
async function computeCupResults(cupLeagueId) {
  const result = { champion: null, finalist: null, semifinalists: [], quarterfinalists: [] };
  if (!cupLeagueId) return result;

  const matches = await prisma.match.findMany({ where: { leagueId: cupLeagueId } });
  const finalMatch = matches.find(m => m.bracketRound === "F");
  if (!finalMatch || finalMatch.status !== "PLAYED" || !finalMatch.winnerTeamId) return result;

  result.champion = finalMatch.winnerTeamId;
  result.finalist = result.champion === finalMatch.homeTeamId ? finalMatch.awayTeamId : finalMatch.homeTeamId;

  for (const m of matches.filter(x => x.bracketRound === "SF" && x.status === "PLAYED" && x.winnerTeamId)) {
    const loser = m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
    if (loser) result.semifinalists.push(loser);
  }
  for (const m of matches.filter(x => x.bracketRound === "QF" && x.status === "PLAYED" && x.winnerTeamId)) {
    const loser = m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
    if (loser) result.quarterfinalists.push(loser);
  }
  return result;
}

/**
 * League player influence leaderboard: every player ranked by the total
 * Choreography.influence they contributed to that league's matches, tagged
 * with the team they contributed most for. `limit` caps the rows.
 */
async function leaguePlayerInfluenceBoard(leagueId, limit = 50, client = prisma) {
  const grouped = await client.choreography.groupBy({
    by: ["authorId", "teamId"],
    where: { match: { leagueId } },
    _sum: { influence: true },
    _count: { _all: true },
  });

  const byAuthor = new Map();
  for (const g of grouped) {
    const inf = g._sum.influence || 0;
    const cur = byAuthor.get(g.authorId) || { authorId: g.authorId, influence: 0, choreographies: 0, teamId: null, teamInfluence: -1 };
    cur.influence += inf;
    cur.choreographies += g._count._all;
    if (inf > cur.teamInfluence) { cur.teamInfluence = inf; cur.teamId = g.teamId; }
    byAuthor.set(g.authorId, cur);
  }

  const rows = [...byAuthor.values()]
    .filter(r => r.influence > 0)
    .sort((a, b) => b.influence - a.influence)
    .slice(0, limit);
  if (rows.length === 0) return [];

  // Sequential (not Promise.all) so this stays safe when `client` is an
  // interactive-transaction handle inside closeGlobalSeason.
  const users = await client.user.findMany({
    where: { id: { in: rows.map(r => r.authorId) } },
    select: { id: true, firstName: true, lastName: true, nationality: true, level: true },
  });
  const teams = await client.team.findMany({
    where: { id: { in: [...new Set(rows.map(r => r.teamId).filter(Boolean))] } },
    select: { id: true, name: true, colorHex: true, logoUrl: true },
  });
  const userById = Object.fromEntries(users.map(u => [u.id, u]));
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));

  return rows.map((r, i) => ({
    rank: i + 1,
    user: userById[r.authorId] || null,
    team: teamById[r.teamId] || null,
    influence: r.influence,
    choreographies: r.choreographies,
  }));
}

/**
 * League top-scorers board: goals + assists scored by players who are
 * CURRENTLY on a club in the given LIGA, counted across EVERY competition
 * tagged to that LIGA's season (championship, national cup, supercups,
 * continental cups). Ranked by goals, then assists. Feeds both the public
 * "Marcatori" tab and the season-close Golden Boot (Gheata de Aur) trophy.
 * Returns { league, scorers } — league is null for a non-LIGA / unseasoned id.
 */
async function leagueSeasonTopScorers(leagueId, limit = 40, client = prisma) {
  const league = await client.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, flag: true, seasonId: true, seasonNumber: true, type: true, teams: { select: { id: true } } },
  });
  if (!league || league.type !== "LIGA" || !league.seasonId) return { league: null, scorers: [] };

  const seasonLeagues = await client.league.findMany({ where: { seasonId: league.seasonId }, select: { id: true } });
  const seasonLeagueIds = seasonLeagues.map(l => l.id);
  const teamIds = league.teams.map(t => t.id);
  if (teamIds.length === 0) return { league, scorers: [] };

  const roster = await client.user.findMany({ where: { teamId: { in: teamIds } }, select: { id: true } });
  const rosterIds = roster.map(u => u.id);
  if (rosterIds.length === 0) return { league, scorers: [] };

  const goalRows = await client.matchEvent.groupBy({
    by: ["scorerId"],
    where: { type: "GOAL", scorerId: { in: rosterIds }, match: { leagueId: { in: seasonLeagueIds } } },
    _count: { scorerId: true },
  });
  const assistRows = await client.matchEvent.groupBy({
    by: ["assistId"],
    where: { type: "GOAL", assistId: { in: rosterIds }, match: { leagueId: { in: seasonLeagueIds } } },
    _count: { assistId: true },
  });
  const assistsByUser = Object.fromEntries(assistRows.map(a => [a.assistId, a._count.assistId]));

  const ranked = goalRows
    .map(g => ({ userId: g.scorerId, goals: g._count.scorerId, assists: assistsByUser[g.scorerId] || 0 }))
    .filter(r => r.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .slice(0, limit);
  if (ranked.length === 0) return { league, scorers: [] };

  const users = await client.user.findMany({
    where: { id: { in: ranked.map(r => r.userId) } },
    select: { id: true, firstName: true, lastName: true, nationality: true, level: true, teamId: true },
  });
  const userById = Object.fromEntries(users.map(u => [u.id, u]));
  const teams = await client.team.findMany({
    where: { id: { in: [...new Set(users.map(u => u.teamId).filter(Boolean))] } },
    select: { id: true, name: true, colorHex: true, logoUrl: true },
  });
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));

  const scorers = ranked.map((r, i) => {
    const u = userById[r.userId] || null;
    return {
      rank: i + 1,
      user: u ? { id: u.id, firstName: u.firstName, lastName: u.lastName, nationality: u.nationality, level: u.level } : null,
      team: u && u.teamId ? teamById[u.teamId] || null : null,
      goals: r.goals,
      assists: r.assists,
    };
  });
  return { league, scorers };
}

/**
 * Global team influence leaderboard for a season: teams ranked by the total
 * Choreography.influence their players contributed across every competition
 * tagged to that season. `limit` caps the rows.
 */
async function seasonTeamInfluenceBoard(seasonId, limit = 20, client = prisma) {
  const leagues = await client.league.findMany({ where: { seasonId }, select: { id: true } });
  const leagueIds = leagues.map(l => l.id);
  if (leagueIds.length === 0) return [];

  const grouped = await client.choreography.groupBy({
    by: ["teamId"],
    where: { match: { leagueId: { in: leagueIds } } },
    _sum: { influence: true },
    _count: { _all: true },
    orderBy: { _sum: { influence: "desc" } },
    take: limit,
  });
  const rows = grouped.filter(g => (g._sum.influence || 0) > 0);
  if (rows.length === 0) return [];

  const teams = await client.team.findMany({
    where: { id: { in: rows.map(r => r.teamId) } },
    select: { id: true, name: true, colorHex: true, logoUrl: true },
  });
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));

  return rows.map((g, i) => ({
    rank: i + 1,
    team: teamById[g.teamId] || null,
    influence: g._sum.influence || 0,
    choreographies: g._count._all,
  }));
}

/**
 * A single team's 1-based position in the season team-influence ranking
 * (same ordering as seasonTeamInfluenceBoard). Returns null if the team has
 * contributed no influence this season.
 */
async function seasonTeamInfluenceRank(seasonId, teamId, client = prisma) {
  const leagues = await client.league.findMany({ where: { seasonId }, select: { id: true } });
  const leagueIds = leagues.map((l) => l.id);
  if (leagueIds.length === 0) return null;

  const grouped = await client.choreography.groupBy({
    by: ["teamId"],
    where: { match: { leagueId: { in: leagueIds } } },
    _sum: { influence: true },
    orderBy: { _sum: { influence: "desc" } },
  });
  const ranked = grouped.filter((g) => (g._sum.influence || 0) > 0);
  const idx = ranked.findIndex((g) => g.teamId === teamId);
  return idx === -1 ? null : idx + 1;
}

/** True once every match created for a league has reached a terminal state (PLAYED). */
async function isLeagueFullyPlayed(leagueId) {
  const count = await prisma.match.count({ where: { leagueId, status: { not: "PLAYED" } } });
  return count === 0;
}

/** Readiness for a single LIGA: itself + its Cupa Internă (if any) must be fully played. */
async function leagueReadiness(league) {
  const matchCount = await prisma.match.count({ where: { leagueId: league.id } });
  if (matchCount === 0) return { ready: false, reason: "Liga nu are meciuri generate." };

  const ligaDone = await isLeagueFullyPlayed(league.id);
  if (!ligaDone) return { ready: false, reason: "Mai sunt meciuri de campionat nejucate." };

  const internalCup = await prisma.league.findFirst({ where: { parentLeagueId: league.id, type: "CUPA_INTERNA" } });
  if (internalCup) {
    const cupDone = await isLeagueFullyPlayed(internalCup.id);
    if (!cupDone) return { ready: false, reason: "Mai sunt meciuri de Cupă Națională nejucate." };
  }

  return { ready: true, internalCupId: internalCup?.id || null };
}

/**
 * Readiness for ending the CURRENT global season: every active LIGA (and
 * its Cupa Internă) must be fully played. Cupa Campionilor / Cupa
 * Internațională from a *previous* season don't block this — they're
 * generated fresh at the end of this one.
 */
async function globalSeasonReadiness() {
  const season = await getOrCreateCurrentSeason();
  const ligas = await prisma.league.findMany({ where: { seasonId: season.id, type: "LIGA", status: "ACTIVE" } });

  const leagues = [];
  let allReady = true;
  for (const l of ligas) {
    const r = await leagueReadiness(l);
    if (!r.ready) allReady = false;
    leagues.push({ id: l.id, name: l.name, ready: r.ready, reason: r.reason || null });
  }

  return { season, ready: allReady && ligas.length > 0, leagues };
}

/** Shared knockout-league builder used by the internal cup and the two season-wide continental cups. */
async function buildKnockoutLeague(tx, { name, type, flag, seasonId, seasonNumber, parentLeagueId, teamIds, startDate, hours, daysBetweenRounds }) {
  const { preliminaryMatches, mainRounds } = generateKnockoutBracket(teamIds);
  if (mainRounds.length === 0) return null;

  const cupLeague = await tx.league.create({
    data: { name, type, flag: flag || null, season: `Sezon ${seasonNumber}`, seasonId, seasonNumber, status: "ACTIVE", parentLeagueId: parentLeagueId || null },
  });

  let roundIndex = 0;
  let prelimIds = [];
  if (preliminaryMatches.length > 0) {
    const day = addDays(startDate, roundIndex * daysBetweenRounds);
    const kickoffs = generateKickoffTimes(day, preliminaryMatches.length, hours);
    for (let i = 0; i < preliminaryMatches.length; i++) {
      const m = await tx.match.create({
        data: {
          leagueId: cupLeague.id, round: roundIndex + 1, bracketRound: "PRELIMINARY",
          homeTeamId: preliminaryMatches[i].home, awayTeamId: preliminaryMatches[i].away,
          scheduledAt: kickoffs[i], status: "SCHEDULED",
        },
      });
      prelimIds.push(m.id);
    }
    roundIndex++;
  }

  let previousRoundIds = null;
  for (let ri = 0; ri < mainRounds.length; ri++) {
    const { name: roundName, matches } = mainRounds[ri];
    const day = addDays(startDate, roundIndex * daysBetweenRounds);
    const kickoffs = generateKickoffTimes(day, matches.length, hours);
    const createdIds = [];

    for (let i = 0; i < matches.length; i++) {
      let homeTeamId = null, awayTeamId = null;
      if (ri === 0) {
        homeTeamId = typeof matches[i].home === "string" ? matches[i].home : null;
        awayTeamId = typeof matches[i].away === "string" ? matches[i].away : null;
      }
      const created = await tx.match.create({
        data: {
          leagueId: cupLeague.id, round: roundIndex + 1, bracketRound: roundName,
          homeTeamId, awayTeamId, scheduledAt: kickoffs[i], status: "SCHEDULED",
        },
      });
      createdIds.push(created.id);

      if (ri === 0) {
        const home = matches[i].home, away = matches[i].away;
        if (home && typeof home === "object") await tx.match.update({ where: { id: prelimIds[home.fromPreliminary] }, data: { nextMatchId: created.id, nextMatchSlot: "HOME" } });
        if (away && typeof away === "object") await tx.match.update({ where: { id: prelimIds[away.fromPreliminary] }, data: { nextMatchId: created.id, nextMatchSlot: "AWAY" } });
      }
    }

    if (previousRoundIds) {
      for (let i = 0; i < previousRoundIds.length; i++) {
        const nextIdx = Math.floor(i / 2);
        const slot = i % 2 === 0 ? "HOME" : "AWAY";
        await tx.match.update({ where: { id: previousRoundIds[i] }, data: { nextMatchId: createdIds[nextIdx], nextMatchSlot: slot } });
      }
    }

    previousRoundIds = createdIds;
    roundIndex++;
  }

  return cupLeague;
}

/**
 * Top scorers (+ assists) across the given league ids, ranked by goals.
 * Used both for a LIGA's own archive and a knockout cup's archive — the
 * caller decides the scope (e.g. [league.id] vs [league.id, internalCupId]).
 */
async function buildTopScorers(tx, leagueIds, take = 10) {
  if (!leagueIds.length) return [];

  const goalEvents = await tx.matchEvent.groupBy({
    by: ["scorerId"],
    where: { type: "GOAL", match: { leagueId: { in: leagueIds } }, scorerId: { not: null } },
    _count: { scorerId: true },
  });
  const assistEvents = await tx.matchEvent.groupBy({
    by: ["assistId"],
    where: { type: "GOAL", match: { leagueId: { in: leagueIds } }, assistId: { not: null } },
    _count: { assistId: true },
  });
  const assistsByPlayer = Object.fromEntries(assistEvents.map(a => [a.assistId, a._count.assistId]));

  const ranked = goalEvents
    .map(g => ({ userId: g.scorerId, goals: g._count.scorerId, assists: assistsByPlayer[g.scorerId] || 0 }))
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .slice(0, take);
  if (!ranked.length) return [];

  const users = await tx.user.findMany({ where: { id: { in: ranked.map(r => r.userId) } }, select: { id: true, firstName: true, lastName: true, teamId: true } });
  const userById = Object.fromEntries(users.map(u => [u.id, u]));
  const teams = await tx.team.findMany({ where: { id: { in: [...new Set(users.map(u => u.teamId).filter(Boolean))] } }, select: { id: true, name: true } });
  const teamNameById = Object.fromEntries(teams.map(t => [t.id, t.name]));

  return ranked.map(r => {
    const u = userById[r.userId];
    return {
      userId: r.userId,
      playerName: u ? `${u.firstName} ${u.lastName}` : "—",
      teamId: u?.teamId || null,
      teamName: u?.teamId ? (teamNameById[u.teamId] || "—") : "—",
      goals: r.goals,
      assists: r.assists,
    };
  });
}

/**
 * Creates the immutable SeasonArchive snapshot for one closed competition.
 * Idempotent — a repeat call (same seasonNumber + leagueId) is a no-op,
 * guarded by SeasonArchive's unique constraint.
 */
async function archiveCompetition(tx, { seasonNumber, league, championTeamId, championTeamName, standingsRows, topScorers }) {
  try {
    return await tx.seasonArchive.create({
      data: {
        seasonNumber, leagueId: league.id, leagueName: league.name, leagueType: league.type,
        championTeamId: championTeamId || null, championTeamName: championTeamName || null,
        standings: { create: standingsRows },
        topScorers: { create: topScorers },
      },
    });
  } catch (err) {
    if (err.code === "P2002") return null;
    throw err;
  }
}

/** Awards LIGA + Cupa Internă trophies, prize money, and season archives for one league; returns its standings + cup result for the caller to fold into the global qualification pool. */
async function closeOneLeague(tx, league, internalCupId, settings) {
  const { standings } = await computeStandings(league.id);
  const totalTeams = standings.length;
  const cupResults = await computeCupResults(internalCupId);
  const now = new Date();
  const seasonNumber = league.seasonNumber || 0;
  const teamNameById = Object.fromEntries(standings.map(r => [r.team.id, r.team.name]));

  for (let i = 0; i < standings.length; i++) {
    const pos = i + 1;
    const teamId = standings[i].team.id;
    let teamPrize = 0;
    if (pos === 1) teamPrize = settings.leagueWinnerTeamPrize;
    else if (pos <= 1 + league.qualifyChampionsSlots) teamPrize = settings.championsQualifyTeamPrize;
    else if (pos <= 1 + league.qualifyChampionsSlots + league.qualifyInternationalSlots) teamPrize = settings.internationalQualifyTeamPrize;

    if (teamPrize > 0) await tx.team.update({ where: { id: teamId }, data: { budget: { increment: teamPrize } } });

    const roster = await tx.user.findMany({ where: { teamId, status: "ACTIVE" } });
    let playerCash = leaguePlayerCash(pos, totalTeams, settings);
    if (pos === 1) playerCash += settings.leagueWinnerPlayerBonus;
    for (const p of roster) {
      await tx.user.update({ where: { id: p.id }, data: { cash: { increment: playerCash } } });
    }
  }

  const championTeamId = standings[0]?.team.id;
  if (championTeamId) {
    const trophy = await tx.trophy.create({
      data: { seasonNumber, competitionType: "LIGA", competitionName: league.name, countryCode: league.flag || null, teamId: championTeamId },
    });
    const roster = await tx.user.findMany({ where: { teamId: championTeamId, status: "ACTIVE" } });
    for (const p of roster) await tx.trophyPlayer.create({ data: { trophyId: trophy.id, userId: p.id } });
    await tx.post.create({
      data: {
        teamId: championTeamId, type: "TROPHY", trophyId: trophy.id,
        text: `${standings[0].team.name} a câștigat ${league.name}! 🏆`,
      },
    });
  }

  await tx.league.update({ where: { id: league.id }, data: { status: "FINISHED", closedAt: now, winnerTeamId: championTeamId || null } });

  const ligaStandingsRows = standings.map((row, i) => ({
    position: i + 1, teamId: row.team.id, teamName: row.team.name,
    played: row.mj, wins: row.v, draws: row.e, losses: row.inf,
    goalsFor: row.gm, goalsAgainst: row.gp, points: row.pct,
  }));
  const ligaTopScorers = await buildTopScorers(tx, [league.id]);
  await archiveCompetition(tx, {
    seasonNumber, league, championTeamId, championTeamName: championTeamId ? teamNameById[championTeamId] : null,
    standingsRows: ligaStandingsRows, topScorers: ligaTopScorers,
  });

  // The Cupa Internă trophy, prize money, TROPHY post, FINISHED status and
  // archive are all handled the moment its final is played
  // (awardCupTrophyAtFinal), so by the time we get here it's already closed.
  // We only still need its per-team placement label for the season record.
  const cupResultByTeam = {};
  if (internalCupId) {
    if (cupResults.champion) cupResultByTeam[cupResults.champion] = "WINNER";
    if (cupResults.finalist) cupResultByTeam[cupResults.finalist] = "FINALIST";
    for (const t of cupResults.semifinalists) cupResultByTeam[t] = "SEMIFINALIST";
    for (const t of cupResults.quarterfinalists) cupResultByTeam[t] = "QUARTERFINALIST";
  }

  // Season records — one per team that was in this league.
  for (let i = 0; i < standings.length; i++) {
    const row = standings[i];
    const teamId = row.team.id;
    const leagueIds = internalCupId ? [league.id, internalCupId] : [league.id];
    const influenceAgg = await tx.choreography.aggregate({
      _sum: { influence: true },
      where: { teamId, match: { leagueId: { in: leagueIds } } },
    });
    const starRow = await tx.choreography.groupBy({
      by: ["authorId"],
      where: { teamId, match: { leagueId: { in: leagueIds } } },
      _sum: { influence: true },
      orderBy: { _sum: { influence: "desc" } },
      take: 1,
    });
    let starPlayerName = null;
    if (starRow.length) {
      const star = await tx.user.findUnique({ where: { id: starRow[0].authorId } });
      starPlayerName = star ? `${star.firstName} ${star.lastName}` : null;
    }

    const recordData = {
      finalPosition: i + 1, totalInfluence: influenceAgg._sum.influence || 0,
      starPlayerId: starRow[0]?.authorId || null, starPlayerName,
      cupResult: cupResultByTeam[teamId] || null,
      points: row.pct, wins: row.v, draws: row.e, losses: row.inf, goalsFor: row.gm, goalsAgainst: row.gp,
    };

    await tx.teamSeasonRecord.upsert({
      where: { seasonNumber_teamId: { seasonNumber, teamId } },
      create: { seasonNumber, leagueId: league.id, leagueName: league.name, teamId, ...recordData },
      update: recordData,
    });
  }

  return {
    standings,
    champions: standings.slice(0, league.qualifyChampionsSlots + 1),
    championTeamId: championTeamId || null,
    cupChampionId: cupResults.champion || null,
  };
}

/**
 * Re-creates one closed LIGA for the next season: same teams (no
 * promotion/relegation — every team that played this season continues),
 * same settings (kickoff window, days between rounds, tur-retur, cup
 * qualification slot counts), standings reset to zero. Reassigns every
 * team's `leagueId` to the new league (so it's what players see as their
 * "current" competition) and generates its full round-robin fixture list
 * plus a fresh Cupa Internă bracket — the same shape POST /leagues/:id/start
 * produces for a brand-new league, just automatic instead of admin-triggered.
 * No-op (returns null) if fewer than 2 teams remain.
 */
async function continueLeagueToNewSeason(tx, oldLeague, teamIds, nextSeason, startDate, settings) {
  if (teamIds.length < 2) return null;

  const newLeague = await tx.league.create({
    data: {
      name: oldLeague.name, type: "LIGA", season: `Sezon ${nextSeason.number}`,
      flag: oldLeague.flag || null,
      seasonId: nextSeason.id, seasonNumber: nextSeason.number, status: "ACTIVE", startDate,
      matchDayStartHour: oldLeague.matchDayStartHour, matchDayEndHour: oldLeague.matchDayEndHour,
      daysBetweenRounds: oldLeague.daysBetweenRounds, doubleRoundRobin: oldLeague.doubleRoundRobin,
      qualifyChampionsSlots: oldLeague.qualifyChampionsSlots, qualifyInternationalSlots: oldLeague.qualifyInternationalSlots,
      teams: { connect: teamIds.map(id => ({ id })) },
    },
  });

  const rounds = generateRoundRobin(teamIds, { doubleRound: newLeague.doubleRoundRobin });
  const hours = { startHour: newLeague.matchDayStartHour, endHour: newLeague.matchDayEndHour };
  const cupHours = { startHour: settings.cupMatchDayStartHour, endHour: settings.cupMatchDayEndHour };
  const matchesToCreate = [];
  rounds.forEach((roundPairs, roundIndex) => {
    const day = addDays(startDate, roundIndex * newLeague.daysBetweenRounds);
    const kickoffs = generateKickoffTimes(day, roundPairs.length, hours);
    roundPairs.forEach((pair, i) => {
      matchesToCreate.push({ leagueId: newLeague.id, round: roundIndex + 1, homeTeamId: pair.home, awayTeamId: pair.away, scheduledAt: kickoffs[i], status: "SCHEDULED" });
    });
  });
  if (matchesToCreate.length) await tx.match.createMany({ data: matchesToCreate });

  // Cupa Națională: first knockout round lands on the day of league round
  // `nationalCupStartRound`, then one round per day after that.
  const cupStartDay = addDays(startDate, (settings.nationalCupStartRound - 1) * newLeague.daysBetweenRounds);
  const internalCup = await buildKnockoutLeague(tx, {
    name: `Cupa Națională — ${newLeague.name}`, type: "CUPA_INTERNA",
    flag: newLeague.flag || null,
    seasonId: nextSeason.id, seasonNumber: nextSeason.number, parentLeagueId: newLeague.id,
    teamIds, startDate: cupStartDay, hours: cupHours, daysBetweenRounds: 1,
  });

  return { league: newLeague, internalCup };
}

/**
 * Closes the CURRENT global season: every active LIGA (and its Cupa
 * Internă) must already be fully played (checked via globalSeasonReadiness
 * — the caller must verify this first). For every LIGA: awards its
 * trophies + prize money + season archives, then immediately re-creates it
 * for the next season (same teams, fresh fixtures + Cupa Internă — see
 * continueLeagueToNewSeason). Pools the qualifying teams (computed from
 * the just-closed standings) across *all* leagues and builds ONE
 * season-wide Cupa Campionilor and ONE Cupa Internațională from those
 * pools, tagged with the *new* season so players only ever see the
 * current season's competitions.
 */
async function closeGlobalSeason() {
  const readiness = await globalSeasonReadiness();
  if (!readiness.ready) {
    const blocking = readiness.leagues.filter(l => !l.ready).map(l => l.name).join(", ");
    throw Object.assign(new Error(`Nu toate campionatele sezonului au fost încheiate: ${blocking || "niciun campionat activ"}.`), { status: 409 });
  }

  const settings = await getGameSettings();
  const season = readiness.season;
  const ligas = await prisma.league.findMany({ where: { seasonId: season.id, type: "LIGA", status: "ACTIVE" } });

  // Safety net: every Cupa Internă should already have been decided when its
  // final was played, but award any that predates that hook before we close.
  for (const league of ligas) {
    const internalCup = await prisma.league.findFirst({ where: { parentLeagueId: league.id, type: "CUPA_INTERNA" } });
    if (internalCup && internalCup.status !== "FINISHED") await awardCupTrophyAtFinal(internalCup);
  }

  const championsPool = [];
  const internationalPool = [];
  const cupsCreated = {};
  const leaguesContinued = [];
  const nationalSupercups = [];

  await prisma.$transaction(async (tx) => {
    const nextSeason = await tx.season.create({ data: { number: season.number + 1, status: "ACTIVE" } });

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() + 1);
    const hours = { startHour: settings.cupMatchDayStartHour, endHour: settings.cupMatchDayEndHour };
    // Supercups are a single match on season day `supercupDay` (day 1 = the
    // first league round). Continental knockouts run one round per day from
    // the day of league round `continentalCupStartRound`.
    const supercupStartDay = addDays(startDate, settings.supercupDay - 1);
    const continentalStartDay = addDays(startDate, settings.continentalCupStartRound - 1);

    for (const league of ligas) {
      const internalCup = await tx.league.findFirst({ where: { parentLeagueId: league.id, type: "CUPA_INTERNA" } });
      const { standings, championTeamId, cupChampionId } = await closeOneLeague(tx, league, internalCup?.id || null, settings);
      championsPool.push(...standings.slice(0, league.qualifyChampionsSlots).map(r => r.team.id));
      internationalPool.push(...standings.slice(league.qualifyChampionsSlots, league.qualifyChampionsSlots + league.qualifyInternationalSlots).map(r => r.team.id));

      // Top-3 player influence leaderboard prizes for this league.
      await awardLeagueInfluencePrizes(tx, league);
      // Golden Boot (Gheata de Aur) for this league's top scorer.
      await awardLeagueTopScorerTrophy(tx, league);

      const continued = await continueLeagueToNewSeason(tx, league, standings.map(r => r.team.id), nextSeason, startDate, settings);
      if (continued) leaguesContinued.push({ id: continued.league.id, name: continued.league.name });

      // Supercupa Națională for the new season: this league's just-crowned
      // champion vs its Cupa Națională winner. If they're the same club (or
      // there was no cup winner), the league runner-up steps in.
      if (continued && championTeamId) {
        let opponent = cupChampionId && cupChampionId !== championTeamId ? cupChampionId : (standings[1]?.team.id || null);
        if (opponent && opponent !== championTeamId) {
          const supercup = await buildKnockoutLeague(tx, {
            name: `Supercupa Națională — ${continued.league.name}`, type: "SUPERCUPA_NATIONALA",
            flag: continued.league.flag || null,
            seasonId: nextSeason.id, seasonNumber: nextSeason.number, parentLeagueId: continued.league.id,
            teamIds: [championTeamId, opponent], startDate: supercupStartDay, hours, daysBetweenRounds: 1,
          });
          if (supercup) nationalSupercups.push({ id: supercup.id, name: supercup.name });
        }
      }
    }

    // Top-3 global team influence leaderboard prizes (across every competition this season).
    await awardGlobalTeamInfluencePrizes(tx, season);

    if (championsPool.length >= 2) {
      const championsCup = await buildKnockoutLeague(tx, {
        name: `Cupa Campionilor — Sezonul ${nextSeason.number}`, type: "CUPA_CAMPIONILOR", flag: "INT",
        seasonId: nextSeason.id, seasonNumber: nextSeason.number, teamIds: championsPool,
        startDate: continentalStartDay, hours, daysBetweenRounds: 1,
      });
      if (championsCup) cupsCreated.championsCup = { id: championsCup.id, name: championsCup.name };
    }
    if (internationalPool.length >= 2) {
      const internationalCup = await buildKnockoutLeague(tx, {
        name: `Cupa Internațională — Sezonul ${nextSeason.number}`, type: "CUPA_INTERNATIONALA", flag: "INT",
        seasonId: nextSeason.id, seasonNumber: nextSeason.number, teamIds: internationalPool,
        startDate: continentalStartDay, hours, daysBetweenRounds: 1,
      });
      if (internationalCup) cupsCreated.internationalCup = { id: internationalCup.id, name: internationalCup.name };
    }

    // Supercupa Internațională: the closing season's Cupa Campionilor winner
    // vs its Cupa Internațională winner (both decided at their finals). Skipped
    // when either cup didn't run this season (e.g. Season 1) or one club won both.
    const closingContinental = await tx.league.findMany({
      where: { seasonId: season.id, type: { in: ["CUPA_CAMPIONILOR", "CUPA_INTERNATIONALA"] } },
      select: { type: true, winnerTeamId: true },
    });
    const clWinner = closingContinental.find(l => l.type === "CUPA_CAMPIONILOR")?.winnerTeamId || null;
    const icWinner = closingContinental.find(l => l.type === "CUPA_INTERNATIONALA")?.winnerTeamId || null;
    if (clWinner && icWinner && clWinner !== icWinner) {
      const intlSupercup = await buildKnockoutLeague(tx, {
        name: `Supercupa Internațională — Sezonul ${nextSeason.number}`, type: "SUPERCUPA_INTERNATIONALA", flag: "INT",
        seasonId: nextSeason.id, seasonNumber: nextSeason.number, teamIds: [clWinner, icWinner],
        startDate: supercupStartDay, hours, daysBetweenRounds: 1,
      });
      if (intlSupercup) cupsCreated.internationalSupercup = { id: intlSupercup.id, name: intlSupercup.name };
    }

    await tx.season.update({ where: { id: season.id }, data: { status: "FINISHED", closedAt: new Date() } });
  }, { timeout: 30000 });

  return {
    closedSeason: season.number,
    nextSeason: season.number + 1,
    leaguesClosed: ligas.length,
    leaguesContinued,
    championsCup: cupsCreated.championsCup || null,
    internationalCup: cupsCreated.internationalCup || null,
    nationalSupercups,
    internationalSupercup: cupsCreated.internationalSupercup || null,
  };
}

/** Knockout competitions that are decided when their final is played (not at season close). */
const CUP_TYPES = ["CUPA_INTERNA", "CUPA_CAMPIONILOR", "CUPA_INTERNATIONALA", "SUPERCUPA_NATIONALA", "SUPERCUPA_INTERNATIONALA"];

/** Prize tiers for a cup whose final just finished, given resolved cupResults + settings. */
function cupPrizeTiers(type, cupResults, settings) {
  if (type === "SUPERCUPA_NATIONALA" || type === "SUPERCUPA_INTERNATIONALA") {
    const isNational = type === "SUPERCUPA_NATIONALA";
    return [
      {
        teamIds: cupResults.champion ? [cupResults.champion] : [],
        team: isNational ? settings.nationalSupercupWinnerTeamPrize : settings.internationalSupercupWinnerTeamPrize,
        player: isNational ? settings.nationalSupercupWinnerPlayerBonus : settings.internationalSupercupWinnerPlayerBonus,
      },
    ];
  }
  if (type === "CUPA_INTERNA") {
    return [
      { teamIds: cupResults.champion ? [cupResults.champion] : [], team: settings.cupWinnerTeamPrize, player: settings.cupFinalistPlayerPrize + settings.cupWinnerPlayerBonus },
      { teamIds: cupResults.finalist ? [cupResults.finalist] : [], team: settings.cupFinalistTeamPrize, player: settings.cupFinalistPlayerPrize },
      { teamIds: cupResults.semifinalists, team: settings.cupSemifinalistTeamPrize, player: settings.cupSemifinalistPlayerPrize },
      { teamIds: cupResults.quarterfinalists, team: settings.cupQuarterfinalistTeamPrize, player: settings.cupQuarterfinalistPlayerPrize },
    ];
  }
  const isChampions = type === "CUPA_CAMPIONILOR";
  return [
    {
      teamIds: cupResults.champion ? [cupResults.champion] : [],
      team: isChampions ? settings.championsCupWinnerTeamPrize : settings.internationalCupWinnerTeamPrize,
      player: isChampions ? settings.championsCupWinnerPlayerBonus : settings.internationalCupWinnerPlayerBonus,
    },
  ];
}

/**
 * Awards the trophy + prize money + TROPHY feed post + season archive for a
 * knockout cup whose FINAL has just been played, and marks the cup FINISHED.
 * Covers all three cups — Cupa Internă, Cupa Campionilor, Cupa Internațională
 * — the moment their final completes (called from matchService.js after a
 * bracketRound "F" match is persisted), NOT at season close. The
 * championship (LIGA) is still decided at season close.
 *
 * Idempotent: `status === "FINISHED"` short-circuits a repeat call, and the
 * SeasonArchive unique (seasonNumber, leagueId) guards the rest. No-op while
 * the final has no winner yet.
 */
async function awardCupTrophyAtFinal(league) {
  if (!CUP_TYPES.includes(league.type)) return;
  if (league.status === "FINISHED") return;

  const cupResults = await computeCupResults(league.id);
  if (!cupResults.champion) return;

  const seasonNumber = league.seasonNumber || 0;

  // Already awarded once (e.g. under the old code path, or a re-run): just
  // make sure the competition is marked closed and stop — never re-pay.
  const existingTrophy = await prisma.trophy.findFirst({
    where: { competitionType: league.type, seasonNumber, teamId: cupResults.champion },
  });
  if (existingTrophy) {
    await prisma.league.update({
      where: { id: league.id },
      data: { status: "FINISHED", closedAt: new Date(), winnerTeamId: cupResults.champion },
    });
    return;
  }

  const settings = await getGameSettings();
  const tiers = cupPrizeTiers(league.type, cupResults, settings);

  try {
    await prisma.$transaction(async (tx) => {
      for (const tier of tiers) {
        for (const teamId of tier.teamIds) {
          if (tier.team > 0) await tx.team.update({ where: { id: teamId }, data: { budget: { increment: tier.team } } });
          if (tier.player > 0) {
            const roster = await tx.user.findMany({ where: { teamId, status: "ACTIVE" }, select: { id: true } });
            for (const p of roster) await tx.user.update({ where: { id: p.id }, data: { cash: { increment: tier.player } } });
          }
        }
      }

      const winnerTeam = await tx.team.findUnique({ where: { id: cupResults.champion } });
      const trophy = await tx.trophy.create({
        data: { seasonNumber, competitionType: league.type, competitionName: league.name, countryCode: league.flag || null, teamId: cupResults.champion },
      });
      const champRoster = await tx.user.findMany({ where: { teamId: cupResults.champion, status: "ACTIVE" }, select: { id: true } });
      for (const p of champRoster) await tx.trophyPlayer.create({ data: { trophyId: trophy.id, userId: p.id } });
      await tx.post.create({
        data: { teamId: cupResults.champion, type: "TROPHY", trophyId: trophy.id, text: `${winnerTeam.name} a câștigat ${league.name}! 🏆` },
      });

      await tx.league.update({
        where: { id: league.id },
        data: { status: "FINISHED", closedAt: new Date(), winnerTeamId: cupResults.champion },
      });

      const teamIds = [cupResults.champion, cupResults.finalist, ...cupResults.semifinalists, ...cupResults.quarterfinalists].filter(Boolean);
      const teams = await tx.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } });
      const teamNameById = Object.fromEntries(teams.map(t => [t.id, t.name]));

      const standingsRows = [];
      let pos = 1;
      standingsRows.push({ position: pos++, teamId: cupResults.champion, teamName: teamNameById[cupResults.champion] });
      if (cupResults.finalist) standingsRows.push({ position: pos++, teamId: cupResults.finalist, teamName: teamNameById[cupResults.finalist] });
      for (const t of cupResults.semifinalists) standingsRows.push({ position: pos++, teamId: t, teamName: teamNameById[t] });
      for (const t of cupResults.quarterfinalists) standingsRows.push({ position: pos++, teamId: t, teamName: teamNameById[t] });

      const topScorers = await buildTopScorers(tx, [league.id]);
      await archiveCompetition(tx, {
        seasonNumber, league, championTeamId: cupResults.champion, championTeamName: teamNameById[cupResults.champion],
        standingsRows, topScorers,
      });
    });
  } catch (err) {
    if (err.code === "P2002") return;
    throw err;
  }
}

/**
 * Season-close prizes for the top 3 of a league's player influence board:
 * a pending SeasonInfluenceReward (collected from the feed) plus an
 * MVP_LIGA Trophy (tier = rank) in the player's trophy case. Runs inside
 * closeGlobalSeason's transaction.
 */
const PLAYER_INFLUENCE_PRIZES = [
  { rank: 1, cash: 50000, tokens: 50 },
  { rank: 2, cash: 25000, tokens: 25 },
  { rank: 3, cash: 10000, tokens: 10 },
];
const TEAM_INFLUENCE_PRIZES = [
  { rank: 1, cash: 500000 },
  { rank: 2, cash: 250000 },
  { rank: 3, cash: 100000 },
];

async function awardLeagueInfluencePrizes(tx, league) {
  const board = await leaguePlayerInfluenceBoard(league.id, 3, tx);
  const seasonNumber = league.seasonNumber || 0;

  for (const row of board) {
    if (!row.user) continue;
    const prize = PLAYER_INFLUENCE_PRIZES.find(p => p.rank === row.rank);
    if (!prize) continue;

    await tx.seasonInfluenceReward.upsert({
      where: { userId_seasonNumber_leagueId: { userId: row.user.id, seasonNumber, leagueId: league.id } },
      update: {},
      create: {
        userId: row.user.id, seasonNumber, leagueId: league.id, leagueName: league.name,
        rank: row.rank, influence: row.influence, cash: prize.cash, tokens: prize.tokens,
      },
    });

    if (row.team?.id) {
      const trophy = await tx.trophy.create({
        data: {
          seasonNumber, competitionType: "MVP_LIGA", tier: row.rank,
          competitionName: `MVP Influență — ${league.name}`, countryCode: league.flag || null, teamId: row.team.id,
        },
      });
      await tx.trophyPlayer.create({ data: { trophyId: trophy.id, userId: row.user.id } });
    }
  }
}

/**
 * Season-close Golden Boot (Gheata de Aur): a GHETA_AUR trophy for the
 * player who scored the most goals across every competition this season,
 * among the clubs of this LIGA. Trophy only — no cash/token prize, no feed
 * post (mirrors the MVP_LIGA distinction). Runs inside closeGlobalSeason's
 * transaction, per LIGA.
 */
async function awardLeagueTopScorerTrophy(tx, league) {
  const { scorers } = await leagueSeasonTopScorers(league.id, 1, tx);
  const top = scorers[0];
  if (!top || !top.goals || !top.user || !top.team) return;

  const seasonNumber = league.seasonNumber || 0;
  const trophy = await tx.trophy.create({
    data: {
      seasonNumber, competitionType: "GHETA_AUR", tier: null,
      competitionName: `Gheata de Aur — ${league.name}`, countryCode: league.flag || null, teamId: top.team.id,
    },
  });
  await tx.trophyPlayer.create({ data: { trophyId: trophy.id, userId: top.user.id } });
}

/** Season-close budget prizes for the global top-3 team influence board. */
async function awardGlobalTeamInfluencePrizes(tx, season) {
  const board = await seasonTeamInfluenceBoard(season.id, 3, tx);
  for (const row of board) {
    const prize = TEAM_INFLUENCE_PRIZES.find(p => p.rank === row.rank);
    if (!prize || !row.team) continue;
    await tx.team.update({ where: { id: row.team.id }, data: { budget: { increment: prize.cash } } });
  }
}

module.exports = {
  computeStandings, computeCupResults, getOrCreateCurrentSeason, globalSeasonReadiness, closeGlobalSeason,
  leaguePlayerCash, listSeasons, getSeasonArchive, awardCupTrophyAtFinal, CUP_TYPES, buildKnockoutLeague,
  leaguePlayerInfluenceBoard, seasonTeamInfluenceBoard, seasonTeamInfluenceRank,
  leagueSeasonTopScorers, awardLeagueTopScorerTrophy,
  PLAYER_INFLUENCE_PRIZES, TEAM_INFLUENCE_PRIZES,
};
