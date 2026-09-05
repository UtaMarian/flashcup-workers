const prisma = require("../config/db");

const AUTHOR_SUMMARY = { id: true, firstName: true, lastName: true, role: true };
const TEAM_SUMMARY = { select: { id: true, name: true, colorHex: true, logoUrl: true } };

const POST_INCLUDE = {
  author: { select: AUTHOR_SUMMARY },
  trophy: true,
  comments: {
    include: { author: { select: AUTHOR_SUMMARY } },
    orderBy: { createdAt: "asc" },
  },
  reactions: { select: { userId: true, value: true } },
};

/** Collapses raw reactions into { likes, dislikes, myReaction } for the client. */
function shapePost(post, userId) {
  const reactions = post.reactions || [];
  const likes = reactions.filter(r => r.value === 1).length;
  const dislikes = reactions.filter(r => r.value === -1).length;
  const mine = reactions.find(r => r.userId === userId);
  const { reactions: _drop, ...rest } = post;
  return { ...rest, likes, dislikes, myReaction: mine ? mine.value : 0 };
}

// GET /api/teams/:id/posts
async function listPosts(req, res, next) {
  try {
    const posts = await prisma.post.findMany({
      where: { teamId: req.params.id },
      include: POST_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    res.json({ posts: posts.map(p => shapePost(p, req.user.id)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/teams/:id/feed?days=10 — posts + club events (transfers, trophies)
// from the last N days, merged and sorted newest-first.
async function getTeamFeed(req, res, next) {
  try {
    const teamId = req.params.id;
    const days = Math.min(60, Math.max(1, Number(req.query.days) || 10));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [posts, transfers, trophies] = await Promise.all([
      prisma.post.findMany({
        where: { teamId, createdAt: { gte: since } },
        include: POST_INCLUDE,
        orderBy: { createdAt: "desc" },
      }),
      prisma.transfer.findMany({
        where: { createdAt: { gte: since }, OR: [{ fromTeamId: teamId }, { toTeamId: teamId }] },
        include: {
          player: { select: { id: true, firstName: true, lastName: true, position: true } },
          fromTeam: TEAM_SUMMARY,
          toTeam: TEAM_SUMMARY,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.trophy.findMany({
        // MVP_LIGA is a personal player award, not a club-feed event.
        where: { teamId, awardedAt: { gte: since }, competitionType: { not: "MVP_LIGA" } },
        include: { posts: { select: { id: true } } },
        orderBy: { awardedAt: "desc" },
      }),
    ]);

    const items = [
      ...posts.map(p => ({ kind: "post", at: p.createdAt, post: shapePost(p, req.user.id) })),
      ...transfers.map(t => ({
        kind: "transfer",
        at: t.createdAt,
        id: t.id,
        player: t.player,
        fromTeam: t.fromTeam,
        toTeam: t.toTeam,
        fee: t.fee,
        direction: t.toTeamId === teamId ? "IN" : "OUT",
      })),
      // A Trophy that already has a celebratory TROPHY post is covered by that post.
      ...trophies
        .filter(t => t.posts.length === 0)
        .map(t => ({
          kind: "trophy",
          at: t.awardedAt,
          id: t.id,
          competitionType: t.competitionType,
          competitionName: t.competitionName,
          seasonNumber: t.seasonNumber,
        })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at));

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// POST /api/teams/:id/posts   { text }   — any authenticated member of that team
async function createPost(req, res, next) {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "Textul postării este obligatoriu." });
    if (req.user.teamId !== req.params.id) {
      return res.status(403).json({ error: "Poți posta doar pe feed-ul propriei echipe." });
    }

    const post = await prisma.post.create({
      data: { teamId: req.params.id, authorId: req.user.id, text: text.trim() },
      include: POST_INCLUDE,
    });
    res.status(201).json({ post: shapePost(post, req.user.id) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/posts/:id — only the author (system/TROPHY posts can't be removed here)
async function deletePost(req, res, next) {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: "Postarea nu există." });
    if (post.type !== "TEXT" || !post.authorId) {
      return res.status(403).json({ error: "Această postare nu poate fi ștearsă." });
    }
    if (post.authorId !== req.user.id) {
      return res.status(403).json({ error: "Poți șterge doar propriile postări." });
    }
    await prisma.post.delete({ where: { id: post.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// POST /api/posts/:id/comments   { text }
async function addComment(req, res, next) {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "Comentariul nu poate fi gol." });

    const post = await prisma.post.findUnique({ where: { id: req.params.id }, select: { id: true, teamId: true } });
    if (!post) return res.status(404).json({ error: "Postarea nu există." });
    if (req.user.teamId !== post.teamId) {
      return res.status(403).json({ error: "Poți comenta doar pe feed-ul propriei echipe." });
    }

    const comment = await prisma.comment.create({
      data: { postId: post.id, authorId: req.user.id, text: text.trim() },
      include: { author: { select: AUTHOR_SUMMARY } },
    });
    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/posts/:id/comments/:commentId — comment author or the team's manager
async function deleteComment(req, res, next) {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: req.params.commentId },
      include: { post: { select: { teamId: true } } },
    });
    if (!comment || comment.postId !== req.params.id) {
      return res.status(404).json({ error: "Comentariul nu există." });
    }
    const isAuthor = comment.authorId === req.user.id;
    const isTeamManager = req.user.role === "MANAGER" && req.user.teamId === comment.post.teamId;
    if (!isAuthor && !isTeamManager) {
      return res.status(403).json({ error: "Nu poți șterge acest comentariu." });
    }
    await prisma.comment.delete({ where: { id: comment.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// PUT /api/posts/:id/reaction   { value: 1 | -1 | 0 }
// 1 = like, -1 = dislike, 0 = clear. Re-sending the current value also clears it.
async function reactToPost(req, res, next) {
  try {
    const value = Number(req.body.value);
    if (![1, -1, 0].includes(value)) {
      return res.status(400).json({ error: "Reacție invalidă." });
    }

    const post = await prisma.post.findUnique({ where: { id: req.params.id }, select: { id: true, teamId: true } });
    if (!post) return res.status(404).json({ error: "Postarea nu există." });
    if (req.user.teamId !== post.teamId) {
      return res.status(403).json({ error: "Poți reacționa doar pe feed-ul propriei echipe." });
    }

    const existing = await prisma.postReaction.findUnique({
      where: { postId_userId: { postId: post.id, userId: req.user.id } },
    });

    if (value === 0 || (existing && existing.value === value)) {
      if (existing) await prisma.postReaction.delete({ where: { id: existing.id } });
    } else if (existing) {
      await prisma.postReaction.update({ where: { id: existing.id }, data: { value } });
    } else {
      await prisma.postReaction.create({ data: { postId: post.id, userId: req.user.id, value } });
    }

    const reactions = await prisma.postReaction.findMany({ where: { postId: post.id }, select: { userId: true, value: true } });
    const likes = reactions.filter(r => r.value === 1).length;
    const dislikes = reactions.filter(r => r.value === -1).length;
    const mine = reactions.find(r => r.userId === req.user.id);
    res.json({ likes, dislikes, myReaction: mine ? mine.value : 0 });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPosts, getTeamFeed, createPost, deletePost,
  addComment, deleteComment, reactToPost,
};
