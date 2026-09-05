const express = require("express");
const {
  listTeams, getTeam, createTeam, assignLeague, updateTeam, deleteTeam, getTeamProfile,
  getManagerPoll, startManagerPoll, voteManagerPoll, cancelManagerPoll,
} = require("../controllers/teams.controller");
const { listPosts, createPost, getTeamFeed } = require("../controllers/posts.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

// Public reads — team list is needed on the registration screen (team picker).
router.get("/", listTeams);
router.get("/:id", getTeam);
router.get("/:id/profile", getTeamProfile);

// Admin-only writes.
router.post("/", authenticate, requireRole("ADMIN"), createTeam);
router.patch("/:id", authenticate, requireRole("ADMIN"), updateTeam);
router.delete("/:id", authenticate, requireRole("ADMIN"), deleteTeam);
router.patch("/:id/league", authenticate, requireRole("ADMIN"), assignLeague);

// Club news feed — nested under the team.
router.get("/:id/feed", authenticate, getTeamFeed);
router.get("/:id/posts", authenticate, listPosts);
router.post("/:id/posts", authenticate, createPost);

// Manager-election poll — any squad member.
router.get("/:teamId/manager-poll", authenticate, getManagerPoll);
router.post("/:teamId/manager-poll", authenticate, startManagerPoll);
router.post("/:teamId/manager-poll/vote", authenticate, voteManagerPoll);
router.post("/:teamId/manager-poll/cancel", authenticate, cancelManagerPoll);

module.exports = router;
