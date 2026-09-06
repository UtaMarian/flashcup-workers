const express = require("express");
const { listActive, listAll, create, update, remove } = require("../controllers/announcements.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

router.use(authenticate);

// Any authenticated player — feed of active announcements
router.get("/", listActive);

// Admin — "Postări generale" panel
router.get("/all", requireRole("ADMIN"), listAll);
router.post("/", requireRole("ADMIN"), create);
router.patch("/:id", requireRole("ADMIN"), update);
router.delete("/:id", requireRole("ADMIN"), remove);

module.exports = router;
