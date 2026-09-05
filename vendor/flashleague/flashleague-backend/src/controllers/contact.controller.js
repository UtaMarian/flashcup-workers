const prisma = require("../config/db");

const TOPICS = ["GENERAL", "BUG", "ACCOUNT", "PAYMENT", "OTHER"];
const STATUSES = ["NEW", "READ", "RESOLVED"];

const AUTHOR_SELECT = {
  select: { id: true, firstName: true, lastName: true, email: true, role: true },
};

function view(m) {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    topic: m.topic,
    subject: m.subject,
    message: m.message,
    status: m.status,
    handledAt: m.handledAt,
    createdAt: m.createdAt,
    user: m.user
      ? {
          id: m.user.id,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          email: m.user.email,
          role: m.user.role,
        }
      : null,
  };
}

// POST /api/contact — any authenticated user files a support/contact message.
async function createMessage(req, res, next) {
  try {
    const { topic, subject, message } = req.body || {};
    const subj = String(subject || "").trim();
    const body = String(message || "").trim();
    if (subj.length < 3) {
      return res.status(400).json({ error: "Subiectul trebuie să aibă cel puțin 3 caractere." });
    }
    if (body.length < 10) {
      return res.status(400).json({ error: "Mesajul trebuie să aibă cel puțin 10 caractere." });
    }
    const t = TOPICS.includes(topic) ? topic : "GENERAL";
    const created = await prisma.contactMessage.create({
      data: {
        userId: req.user.id,
        name: `${req.user.firstName} ${req.user.lastName}`.trim(),
        email: req.user.email,
        topic: t,
        subject: subj.slice(0, 160),
        message: body.slice(0, 4000),
      },
    });
    res.status(201).json({ message: view(created) });
  } catch (err) {
    next(err);
  }
}

// GET /api/contact — admin only. Every submission, newest first (optional ?status=).
async function listMessages(req, res, next) {
  try {
    const { status } = req.query;
    const where = STATUSES.includes(status) ? { status } : {};
    const [messages, all, unread] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { user: AUTHOR_SELECT },
      }),
      prisma.contactMessage.count(),
      prisma.contactMessage.count({ where: { status: "NEW" } }),
    ]);
    res.json({ messages: messages.map(view), counts: { all, unread } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/contact/:id — admin only. Move NEW → READ → RESOLVED.
async function updateMessage(req, res, next) {
  try {
    const { status } = req.body || {};
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: "Stare invalidă." });
    }
    const existing = await prisma.contactMessage.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Formular inexistent." });
    const updated = await prisma.contactMessage.update({
      where: { id: req.params.id },
      data: {
        status,
        handledAt: status === "RESOLVED" ? new Date() : existing.handledAt,
      },
      include: { user: AUTHOR_SELECT },
    });
    res.json({ message: view(updated) });
  } catch (err) {
    next(err);
  }
}

module.exports = { createMessage, listMessages, updateMessage, TOPICS, STATUSES };
