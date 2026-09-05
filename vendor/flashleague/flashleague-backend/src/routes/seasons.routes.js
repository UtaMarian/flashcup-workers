const express = require("express");
const { listSeasons, getSeasonArchive, getCurrentSeason, getReadiness, closeCurrentSeason } = require("../controllers/seasons.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

router.get("/", listSeasons);
router.get("/current", getCurrentSeason);
router.get("/:number/archive", getSeasonArchive);
router.get("/current/readiness", authenticate, requireRole("ADMIN"), getReadiness);
router.post("/current/close", authenticate, requireRole("ADMIN"), closeCurrentSeason);

module.exports = router;
