const express = require("express");
const { getMatch, simulateNow, addChoreography } = require("../controllers/matches.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

router.get("/:id", getMatch);
router.post("/:id/simulate", authenticate, requireRole("ADMIN"), simulateNow);
router.post("/:id/choreography", authenticate, addChoreography);

module.exports = router;
