const express = require("express");
const { deletePost, addComment, deleteComment, reactToPost } = require("../controllers/posts.controller");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.delete("/:id", authenticate, deletePost);
router.put("/:id/reaction", authenticate, reactToPost);
router.post("/:id/comments", authenticate, addComment);
router.delete("/:id/comments/:commentId", authenticate, deleteComment);

module.exports = router;
