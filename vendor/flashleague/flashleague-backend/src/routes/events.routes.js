const express = require("express");
const {
  listEvents, listTypes, createEvent, updateEvent, cancelEvent,
  activeEvents, spinWheel, changePosition, applySuperbet,
} = require("../controllers/events.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

router.use(authenticate);

// Player-facing
router.get("/active", activeEvents);
router.post("/:id/wheel/spin", spinWheel);
router.post("/:id/position-change", changePosition);
router.post("/:id/superbet/apply", applySuperbet);

// Admin
router.get("/", requireRole("ADMIN"), listEvents);
router.get("/types", requireRole("ADMIN"), listTypes);
router.post("/", requireRole("ADMIN"), createEvent);
router.patch("/:id", requireRole("ADMIN"), updateEvent);
router.post("/:id/cancel", requireRole("ADMIN"), cancelEvent);

module.exports = router;
