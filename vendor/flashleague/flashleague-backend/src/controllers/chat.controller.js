const prisma = require("../config/db");

// Minimal public shape for anyone shown in a friends list or a conversation.
const PUBLIC_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  position: true,
  level: true,
  nationality: true,
  role: true,
  team: { select: { id: true, name: true, colorHex: true, logoUrl: true } },
};

const MAX_BODY = 2000;

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    avatarUrl: u.avatarUrl || null,
    position: u.position || null,
    level: u.level,
    nationality: u.nationality || null,
    role: u.role,
    team: u.team ? { id: u.team.id, name: u.team.name, colorHex: u.team.colorHex, logoUrl: u.team.logoUrl || null } : null,
  };
}

function messageView(m, meId) {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt,
    readAt: m.readAt,
    mine: m.senderId === meId,
    senderId: m.senderId,
    recipientId: m.recipientId,
  };
}

// ---------------------------------------------------------------------------
// FRIENDS
// ---------------------------------------------------------------------------

// Relationship between the caller and `otherId`, from the caller's point of view.
async function relationStatus(meId, otherId) {
  if (meId === otherId) return "self";
  const row = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: meId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: meId },
      ],
    },
  });
  if (!row) return "none";
  if (row.status === "ACCEPTED") return "friends";
  return row.requesterId === meId ? "outgoing" : "incoming";
}

// GET /api/chat/friends — accepted friends + pending requests (both directions).
async function listFriends(req, res, next) {
  try {
    const meId = req.user.id;
    const rows = await prisma.friendship.findMany({
      where: { OR: [{ requesterId: meId }, { addresseeId: meId }] },
      include: { requester: { select: PUBLIC_SELECT }, addressee: { select: PUBLIC_SELECT } },
      orderBy: { createdAt: "desc" },
    });

    const friends = [];
    const incoming = [];
    const outgoing = [];
    for (const r of rows) {
      const other = r.requesterId === meId ? r.addressee : r.requester;
      const entry = { friendshipId: r.id, since: r.respondedAt || r.createdAt, user: publicUser(other) };
      if (r.status === "ACCEPTED") friends.push(entry);
      else if (r.requesterId === meId) outgoing.push({ ...entry, sentAt: r.createdAt });
      else incoming.push({ ...entry, sentAt: r.createdAt });
    }
    friends.sort((a, b) => `${a.user.firstName} ${a.user.lastName}`.localeCompare(`${b.user.firstName} ${b.user.lastName}`));
    res.json({ friends, incoming, outgoing });
  } catch (err) {
    next(err);
  }
}

// GET /api/chat/friends/:userId/status — for the "Add friend" button on a profile.
async function friendStatus(req, res, next) {
  try {
    res.json({ status: await relationStatus(req.user.id, req.params.userId) });
  } catch (err) {
    next(err);
  }
}

// POST /api/chat/friends/:userId — send a request. If the other user already
// sent me one, this accepts it instead.
async function addFriend(req, res, next) {
  try {
    const meId = req.user.id;
    const otherId = req.params.userId;
    if (meId === otherId) return res.status(400).json({ error: "Nu te poți adăuga pe tine." });

    const other = await prisma.user.findUnique({ where: { id: otherId }, select: { id: true, isBot: true } });
    if (!other) return res.status(404).json({ error: "Utilizatorul nu există." });

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: meId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: meId },
        ],
      },
    });

    if (existing) {
      if (existing.status === "ACCEPTED") return res.status(409).json({ error: "Sunteți deja prieteni." });
      if (existing.requesterId === meId) return res.status(409).json({ error: "Ai trimis deja o cerere acestui jucător." });
      // They already requested me — accept.
      await prisma.friendship.update({
        where: { id: existing.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      return res.json({ status: "friends" });
    }

    await prisma.friendship.create({ data: { requesterId: meId, addresseeId: otherId } });
    res.status(201).json({ status: "outgoing" });
  } catch (err) {
    next(err);
  }
}

// POST /api/chat/friends/:userId/accept — accept a request that :userId sent me.
async function acceptFriend(req, res, next) {
  try {
    const meId = req.user.id;
    const otherId = req.params.userId;
    const pending = await prisma.friendship.findFirst({
      where: { requesterId: otherId, addresseeId: meId, status: "PENDING" },
    });
    if (!pending) return res.status(404).json({ error: "Nu există nicio cerere de la acest jucător." });
    await prisma.friendship.update({
      where: { id: pending.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });
    res.json({ status: "friends" });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/chat/friends/:userId — remove a friend, cancel a sent request,
// or decline a received one (any row between us, any state).
async function removeFriend(req, res, next) {
  try {
    const meId = req.user.id;
    const otherId = req.params.userId;
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: meId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: meId },
        ],
      },
    });
    res.json({ status: "none" });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DIRECT MESSAGES
// ---------------------------------------------------------------------------

// GET /api/chat/conversations — one entry per person I've exchanged messages
// with (that I haven't cleared), newest activity first.
async function listConversations(req, res, next) {
  try {
    const meId = req.user.id;
    const rows = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: meId, deletedBySender: false },
          { recipientId: meId, deletedByRecipient: false },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: { sender: { select: PUBLIC_SELECT }, recipient: { select: PUBLIC_SELECT } },
    });

    const byPartner = new Map();
    for (const m of rows) {
      const partner = m.senderId === meId ? m.recipient : m.sender;
      let conv = byPartner.get(partner.id);
      if (!conv) {
        conv = { user: publicUser(partner), lastMessage: null, lastAt: m.createdAt, unread: 0 };
        byPartner.set(partner.id, conv);
      }
      if (!conv.lastMessage) {
        conv.lastMessage = { body: m.body, createdAt: m.createdAt, mine: m.senderId === meId };
        conv.lastAt = m.createdAt;
      }
      if (m.recipientId === meId && !m.readAt && !m.deletedByRecipient) conv.unread += 1;
    }

    const conversations = [...byPartner.values()].sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
}

// GET /api/chat/conversations/:userId — full thread with one person; marks
// their messages to me as read.
async function getConversation(req, res, next) {
  try {
    const meId = req.user.id;
    const otherId = req.params.userId;

    const other = await prisma.user.findUnique({ where: { id: otherId }, select: PUBLIC_SELECT });
    if (!other) return res.status(404).json({ error: "Utilizatorul nu există." });

    await prisma.directMessage.updateMany({
      where: { senderId: otherId, recipientId: meId, readAt: null, deletedByRecipient: false },
      data: { readAt: new Date() },
    });

    const rows = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: meId, recipientId: otherId, deletedBySender: false },
          { senderId: otherId, recipientId: meId, deletedByRecipient: false },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      user: publicUser(other),
      status: await relationStatus(meId, otherId),
      messages: rows.map((m) => messageView(m, meId)),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/chat/conversations/:userId  { body }
async function sendMessage(req, res, next) {
  try {
    const meId = req.user.id;
    const otherId = req.params.userId;
    if (meId === otherId) return res.status(400).json({ error: "Nu îți poți trimite mesaje ție." });

    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Mesajul nu poate fi gol." });
    if (body.length > MAX_BODY) return res.status(400).json({ error: `Mesajul depășește ${MAX_BODY} de caractere.` });

    const other = await prisma.user.findUnique({ where: { id: otherId }, select: { id: true } });
    if (!other) return res.status(404).json({ error: "Utilizatorul nu există." });

    const created = await prisma.directMessage.create({
      data: { senderId: meId, recipientId: otherId, body },
    });
    res.status(201).json({ message: messageView(created, meId) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/chat/conversations/:userId — clear the whole thread for me only.
async function deleteConversation(req, res, next) {
  try {
    const meId = req.user.id;
    const otherId = req.params.userId;
    await prisma.$transaction([
      prisma.directMessage.updateMany({
        where: { senderId: meId, recipientId: otherId, deletedBySender: false },
        data: { deletedBySender: true },
      }),
      prisma.directMessage.updateMany({
        where: { senderId: otherId, recipientId: meId, deletedByRecipient: false },
        data: { deletedByRecipient: true, readAt: new Date() },
      }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/chat/unread-count — badge data for the navbar.
async function unreadCount(req, res, next) {
  try {
    const meId = req.user.id;
    const [count, friendRequests] = await Promise.all([
      prisma.directMessage.count({
        where: { recipientId: meId, readAt: null, deletedByRecipient: false },
      }),
      prisma.friendship.count({ where: { addresseeId: meId, status: "PENDING" } }),
    ]);
    res.json({ count, friendRequests });
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
};
