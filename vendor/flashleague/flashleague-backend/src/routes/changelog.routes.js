const express = require("express");
const { getChangelog, listAll, createEntry, updateEntry, deleteEntry } = require("../controllers/changelog.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

router.use(authenticate);

// Any authenticated user — the player-facing Update log.
router.get("/", getChangelog);

// Admin — "Actualizări" panel.
router.get("/all", requireRole("ADMIN"), listAll);
router.post("/", requireRole("ADMIN"), createEntry);
router.patch("/:id", requireRole("ADMIN"), updateEntry);
router.delete("/:id", requireRole("ADMIN"), deleteEntry);

module.exports = router;
