const express = require("express");
const { getSettings, patchSettings } = require("../controllers/admin.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

router.get("/settings", authenticate, requireRole("ADMIN"), getSettings);
router.patch("/settings", authenticate, requireRole("ADMIN"), patchSettings);

module.exports = router;
