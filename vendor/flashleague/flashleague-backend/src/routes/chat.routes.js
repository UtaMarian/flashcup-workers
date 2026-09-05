const express = require("express");
const {
  listFriends,
  friendStatus,
  addFriend,
  acceptFriend,
  removeFriend,
  listConversations,
  getConversation,
  sendMessage,
  deleteConversation,
  unreadCount,
} = require("../controllers/chat.controller");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

// Friends
router.get("/friends", listFriends);
router.get("/friends/:userId/status", friendStatus);
router.post("/friends/:userId/accept", acceptFriend);
router.post("/friends/:userId", addFriend);
router.delete("/friends/:userId", removeFriend);

// Direct messages
router.get("/unread-count", unreadCount);
router.get("/conversations", listConversations);
router.get("/conversations/:userId", getConversation);
router.post("/conversations/:userId", sendMessage);
router.delete("/conversations/:userId", deleteConversation);

module.exports = router;
