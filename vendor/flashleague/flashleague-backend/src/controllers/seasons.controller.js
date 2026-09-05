const seasonService = require("../services/seasonService");

// GET /api/seasons   (public) — every season, most recent first.
async function listSeasons(req, res, next) {
  try {
    const seasons = await seasonService.listSeasons();
    res.json({ seasons });
  } catch (err) {
    next(err);
  }
}

// GET /api/seasons/:number/archive   (public) — every competition's final
// snapshot (standings + top scorers) closed in that season.
async function getSeasonArchive(req, res, next) {
  try {
    const number = Number(req.params.number);
    if (!Number.isInteger(number)) return res.status(400).json({ error: "Număr de sezon invalid." });
    const archives = await seasonService.getSeasonArchive(number);
    res.json({ archives });
  } catch (err) {
    next(err);
  }
}

// GET /api/seasons/current   (public) — just the number/status, cheap for any page to show.
async function getCurrentSeason(req, res, next) {
  try {
    const season = await seasonService.getOrCreateCurrentSeason();
    res.json({ season });
  } catch (err) {
    next(err);
  }
}

// GET /api/seasons/current/readiness   (admin only) — per-league breakdown for the admin panel.
async function getReadiness(req, res, next) {
  try {
    const readiness = await seasonService.globalSeasonReadiness();
    res.json(readiness);
  } catch (err) {
    next(err);
  }
}

// POST /api/seasons/current/close   (admin only)
async function closeCurrentSeason(req, res, next) {
  try {
    const result = await seasonService.closeGlobalSeason();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { listSeasons, getSeasonArchive, getCurrentSeason, getReadiness, closeCurrentSeason };
