const express = require("express");
const { createMessage, listMessages, updateMessage } = require("../controllers/contact.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

router.use(authenticate);

// Player-facing
router.post("/", createMessage);

// Admin — "Formulare" panel
router.get("/", requireRole("ADMIN"), listMessages);
router.patch("/:id", requireRole("ADMIN"), updateMessage);

module.exports = router;
