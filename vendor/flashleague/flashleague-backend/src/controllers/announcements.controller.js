const prisma = require("../config/db");

const AUTHOR_SELECT = { select: { id: true, firstName: true, lastName: true, role: true } };

function view(a) {
  return {
    id: a.id,
    title: a.title || null,
    text: a.text,
    active: a.active,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    author: a.author
      ? { id: a.author.id, firstName: a.author.firstName, lastName: a.author.lastName, role: a.author.role }
      : null,
  };
}

// GET /api/announcements — any authenticated user. Active announcements only,
// newest first, capped. Shown on every player's dashboard feed regardless of team.
async function listActive(req, res, next) {
  try {
    const rows = await prisma.announcement.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { author: AUTHOR_SELECT },
    });
    res.json({ announcements: rows.map(view) });
  } catch (err) {
    next(err);
  }
}

// GET /api/announcements/all — ADMIN. Every announcement (incl. inactive).
async function listAll(req, res, next) {
  try {
    const rows = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      include: { author: AUTHOR_SELECT },
    });
    res.json({ announcements: rows.map(view) });
  } catch (err) {
    next(err);
  }
}

// POST /api/announcements — ADMIN. { title?, text, active? }
async function create(req, res, next) {
  try {
    const { title, text, active } = req.body || {};
    const body = String(text || "").trim();
    if (body.length < 3) {
      return res.status(400).json({ error: "Textul anunțului trebuie să aibă cel puțin 3 caractere." });
    }
    const created = await prisma.announcement.create({
      data: {
        authorId: req.user.id,
        title: title ? String(title).trim().slice(0, 160) : null,
        text: body.slice(0, 4000),
        active: active === undefined ? true : !!active,
      },
      include: { author: AUTHOR_SELECT },
    });
    res.status(201).json({ announcement: view(created) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/announcements/:id — ADMIN. { title?, text?, active? }
async function update(req, res, next) {
  try {
    const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Anunț inexistent." });

    const { title, text, active } = req.body || {};
    const data = {};
    if (title !== undefined) data.title = title ? String(title).trim().slice(0, 160) : null;
    if (text !== undefined) {
      const body = String(text || "").trim();
      if (body.length < 3) return res.status(400).json({ error: "Textul anunțului trebuie să aibă cel puțin 3 caractere." });
      data.text = body.slice(0, 4000);
    }
    if (active !== undefined) data.active = !!active;

    const updated = await prisma.announcement.update({
      where: { id: req.params.id },
      data,
      include: { author: AUTHOR_SELECT },
    });
    res.json({ announcement: view(updated) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/announcements/:id — ADMIN.
async function remove(req, res, next) {
  try {
    const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Anunț inexistent." });
    await prisma.announcement.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listActive, listAll, create, update, remove };
