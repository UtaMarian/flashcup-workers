const express = require("express");
const { listMyRewards, collectMatchReward, collectLevelUpReward, collectSeasonReward } = require("../controllers/rewards.controller");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.get("/me", authenticate, listMyRewards);
router.post("/match/:id/collect", authenticate, collectMatchReward);
router.post("/levelup/:id/collect", authenticate, collectLevelUpReward);
router.post("/season/:id/collect", authenticate, collectSeasonReward);

module.exports = router;
