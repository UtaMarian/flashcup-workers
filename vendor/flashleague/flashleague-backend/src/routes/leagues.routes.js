const express = require("express");
const {
  listLeagues, createLeague, updateSettings, setLeagueFlag, startLeague, simulateLeague, getStandings, getMatches, getInfluenceBoard, getTopScorers, deleteLeague,
} = require("../controllers/leagues.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

// Public reads.
router.get("/", listLeagues);
router.get("/:id/standings", getStandings);
router.get("/:id/matches", getMatches);
router.get("/:id/influence-board", getInfluenceBoard);
router.get("/:id/top-scorers", getTopScorers);

// Admin-only: create the first league (or any subsequent one), configure
// its parameters, then start it — which triggers automatic fixture
// generation + daily kickoff-time assignment. Season-level actions
// (readiness / closing the season / continental cups) live under
// /api/seasons now — see routes/seasons.routes.js.
router.post("/", authenticate, requireRole("ADMIN"), createLeague);
router.patch("/:id/settings", authenticate, requireRole("ADMIN"), updateSettings);
router.patch("/:id/flag", authenticate, requireRole("ADMIN"), setLeagueFlag);
router.post("/:id/start", authenticate, requireRole("ADMIN"), startLeague);
router.post("/:id/simulate", authenticate, requireRole("ADMIN"), simulateLeague);
router.delete("/:id", authenticate, requireRole("ADMIN"), deleteLeague);

module.exports = router;
