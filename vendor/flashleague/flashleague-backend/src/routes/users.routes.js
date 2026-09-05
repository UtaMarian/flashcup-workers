const express = require("express");
const { listUsers, setRole, setBanStatus, assignTeam, grantEconomy } = require("../controllers/users.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

router.use(authenticate, requireRole("ADMIN"));

router.get("/", listUsers);
router.patch("/:id/role", setRole);
router.patch("/:id/ban", setBanStatus);
router.patch("/:id/team", assignTeam);
router.patch("/:id/economy", grantEconomy);

module.exports = router;
