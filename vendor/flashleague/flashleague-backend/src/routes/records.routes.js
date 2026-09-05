const express = require("express");
const { getRecords, getTeamInfluenceBoard } = require("../controllers/records.controller");

const router = express.Router();

router.get("/", getRecords);
router.get("/team-influence", getTeamInfluenceBoard);

module.exports = router;
