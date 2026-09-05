const prisma = require("../config/db");
const {
  EVENT_TYPES, EVENT_TYPE_KEYS, config, syncEventStatuses, getActiveEvents,
} = require("../services/eventsService");
const { VALID_POSITIONS } = require("./auth.controller");
const { betAmountForLevel } = require("../utils/predictions");
const { levelFromTotalXp } = require("../utils/xp");

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

/** Shape one event row for the admin list (config merged, countdown fields). */
function adminView(e) {
  return {
    id: e.id,
    type: e.type,
    label: EVENT_TYPES[e.type]?.label || e.type,
    blurb: EVENT_TYPES[e.type]?.blurb || "",
    scope: EVENT_TYPES[e.type]?.scope || null,
    status: e.status,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    config: config(e),
    createdAt: e.createdAt,
  };
}

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------

// GET /api/events   — every event, newest first
async function listEvents(req, res, next) {
  try {
    await syncEventStatuses();
    const events = await prisma.gameEvent.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ events: events.map(adminView) });
  } catch (err) {
    next(err);
  }
}

// GET /api/events/types   — the registry, for the admin "start event" form
async function listTypes(req, res) {
  const types = EVENT_TYPE_KEYS.map((type) => ({
    type,
    label: EVENT_TYPES[type].label,
    blurb: EVENT_TYPES[type].blurb,
    scope: EVENT_TYPES[type].scope,
    defaults: EVENT_TYPES[type].defaults,
  }));
  res.json({ types });
}

// POST /api/events   { type, startsAt?, durationMinutes, config? }
async function createEvent(req, res, next) {
  try {
    const { type, startsAt, durationMinutes, config: cfg } = req.body || {};
    if (!EVENT_TYPES[type]) {
      return res.status(400).json({ error: `Tip de eveniment invalid. Valori acceptate: ${EVENT_TYPE_KEYS.join(", ")}.` });
    }
    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return res.status(400).json({ error: "Durata (în minute) trebuie să fie un număr pozitiv." });
    }

    const start = startsAt ? new Date(startsAt) : new Date();
    if (Number.isNaN(start.getTime())) return res.status(400).json({ error: "Data de start este invalidă." });
    const end = new Date(start.getTime() + minutes * 60 * 1000);

    // Only one non-finished event per type at a time.
    const clash = await prisma.gameEvent.findFirst({
      where: { type, status: { in: ["SCHEDULED", "ACTIVE"] } },
    });
    if (clash) {
      return res.status(409).json({ error: "Există deja un eveniment activ sau programat de acest tip. Anulează-l mai întâi." });
    }

    let configJson = "{}";
    if (cfg && typeof cfg === "object") configJson = JSON.stringify(cfg);
    else if (typeof cfg === "string" && cfg.trim()) {
      try { configJson = JSON.stringify(JSON.parse(cfg)); }
      catch { return res.status(400).json({ error: "Config JSON invalid." }); }
    }

    const now = new Date();
    const event = await prisma.gameEvent.create({
      data: {
        type,
        status: start <= now ? "ACTIVE" : "SCHEDULED",
        startsAt: start,
        endsAt: end,
        configJson,
        createdById: req.user.id,
      },
    });
    res.status(201).json({ event: adminView(event) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/events/:id   { durationMinutes? | endsAt?, config? }
async function updateEvent(req, res, next) {
  try {
    const event = await prisma.gameEvent.findUnique({ where: { id: req.params.id } });
    if (!event) return res.status(404).json({ error: "Evenimentul nu există." });
    if (["ENDED", "CANCELLED"].includes(event.status)) {
      return res.status(409).json({ error: "Evenimentul s-a încheiat deja." });
    }

    const data = {};
    const { durationMinutes, endsAt, config: cfg } = req.body || {};

    if (endsAt !== undefined) {
      const d = new Date(endsAt);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Data de final este invalidă." });
      data.endsAt = d;
    } else if (durationMinutes !== undefined) {
      const minutes = Number(durationMinutes);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        return res.status(400).json({ error: "Durata (în minute) trebuie să fie un număr pozitiv." });
      }
      // Interpret durationMinutes as total length measured from the start.
      data.endsAt = new Date(new Date(event.startsAt).getTime() + minutes * 60 * 1000);
    }

    if (cfg !== undefined) {
      if (event.status !== "SCHEDULED") {
        return res.status(409).json({ error: "Configurarea poate fi modificată doar cât timp evenimentul este programat (neînceput)." });
      }
      try {
        const parsed = typeof cfg === "string" ? JSON.parse(cfg) : cfg;
        data.configJson = JSON.stringify(parsed || {});
      } catch {
        return res.status(400).json({ error: "Config JSON invalid." });
      }
    }

    if (data.endsAt && data.endsAt <= new Date()) {
      return res.status(400).json({ error: "Noua dată de final este în trecut — folosește „Anulează”." });
    }

    const updated = await prisma.gameEvent.update({ where: { id: event.id }, data });
    res.json({ event: adminView(updated) });
  } catch (err) {
    next(err);
  }
}

// POST /api/events/:id/cancel
async function cancelEvent(req, res, next) {
  try {
    const event = await prisma.gameEvent.findUnique({ where: { id: req.params.id } });
    if (!event) return res.status(404).json({ error: "Evenimentul nu există." });
    if (["ENDED", "CANCELLED"].includes(event.status)) {
      return res.status(409).json({ error: "Evenimentul s-a încheiat deja." });
    }
    const updated = await prisma.gameEvent.update({
      where: { id: event.id },
      data: { status: event.status === "SCHEDULED" ? "CANCELLED" : "ENDED", endsAt: new Date() },
    });
    res.json({ event: adminView(updated) });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PLAYER-FACING
// ---------------------------------------------------------------------------

async function lastClaim(eventId, userId, kind) {
  return prisma.gameEventClaim.findFirst({
    where: { eventId, userId, kind },
    orderBy: { createdAt: "desc" },
  });
}

// GET /api/events/active — live events + this user's per-event CLAIM state
async function activeEvents(req, res, next) {
  try {
    const events = await getActiveEvents();
    const userId = req.user.id;

    const out = [];
    for (const e of events) {
      const base = {
        id: e.id,
        type: e.type,
        label: EVENT_TYPES[e.type]?.label || e.type,
        blurb: EVENT_TYPES[e.type]?.blurb || "",
        scope: EVENT_TYPES[e.type]?.scope || null,
        endsAt: e.endsAt,
        startsAt: e.startsAt,
      };

      if (e.type === "REWARD_WHEEL") {
        const cooldownMs = e.config.cooldownMs;
        const last = await lastClaim(e.id, userId, "WHEEL_SPIN");
        const nextSpinAt = last ? new Date(new Date(last.createdAt).getTime() + cooldownMs) : null;
        base.me = {
          canSpin: !nextSpinAt || nextSpinAt <= new Date(),
          nextSpinAt,
          prizes: (e.config.prizes || []).map((p) => ({
            label: p.label,
            cash: p.cash || 0,
            tokens: p.tokens || 0,
            energy: p.energy || 0,
          })),
        };
      } else if (e.type === "POSITION_CHANGE") {
        const used = await prisma.gameEventClaim.count({ where: { eventId: e.id, userId, kind: "POSITION_CHANGE" } });
        base.me = {
          tokenCost: e.config.tokenCost,
          oncePerEvent: !!e.config.oncePerEvent,
          used,
          canChange: !e.config.oncePerEvent || used === 0,
          currentPosition: req.user.position || null,
          positions: VALID_POSITIONS,
        };
      } else if (e.type === "SUPERBET") {
        const grantsPerUser = e.config.grantsPerUser ?? 1;
        let grants = await prisma.gameEventClaim.count({ where: { eventId: e.id, userId, kind: "SUPERBET_GRANT" } });
        // Lazily hand the player their superbet(s) the first time they look.
        if (grants < grantsPerUser) {
          const toCreate = grantsPerUser - grants;
          await prisma.gameEventClaim.createMany({
            data: Array.from({ length: toCreate }, () => ({ eventId: e.id, userId, kind: "SUPERBET_GRANT" })),
          });
          grants = grantsPerUser;
        }
        const used = await prisma.gameEventClaim.count({ where: { eventId: e.id, userId, kind: "SUPERBET_USED" } });
        base.me = { multiplier: e.config.multiplier, grantsTotal: grants, grantsUsed: used, grantsRemaining: Math.max(0, grants - used) };
      }

      out.push(base);
    }

    res.json({ events: out });
  } catch (err) {
    next(err);
  }
}

function pickWeighted(prizes) {
  const total = prizes.reduce((s, p) => s + (p.weight || 1), 0);
  let roll = Math.random() * total;
  for (const p of prizes) {
    roll -= (p.weight || 1);
    if (roll <= 0) return p;
  }
  return prizes[prizes.length - 1];
}

// POST /api/events/:id/wheel/spin
async function spinWheel(req, res, next) {
  try {
    const events = await getActiveEvents();
    const event = events.find((e) => e.id === req.params.id && e.type === "REWARD_WHEEL");
    if (!event) return res.status(404).json({ error: "Nu există un eveniment „Roata recompenselor” activ." });

    const cooldownMs = event.config.cooldownMs;
    const last = await lastClaim(event.id, req.user.id, "WHEEL_SPIN");
    if (last && new Date(last.createdAt).getTime() + cooldownMs > Date.now()) {
      const nextSpinAt = new Date(new Date(last.createdAt).getTime() + cooldownMs);
      return res.status(409).json({ error: "Roata este în cooldown.", nextSpinAt });
    }

    const prizes = event.config.prizes || [];
    if (prizes.length === 0) return res.status(409).json({ error: "Roata nu are premii configurate." });
    const prize = pickWeighted(prizes);
    const prizeIndex = prizes.indexOf(prize);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.gameEventClaim.create({
        data: { eventId: event.id, userId: req.user.id, kind: "WHEEL_SPIN", dataJson: JSON.stringify({ ...prize, prizeIndex }) },
      });
      return tx.user.update({
        where: { id: req.user.id },
        data: {
          cash: { increment: prize.cash || 0 },
          tokens: { increment: prize.tokens || 0 },
          energy: { increment: prize.energy || 0 },
        },
      });
    });

    res.json({
      prize: { label: prize.label, cash: prize.cash || 0, tokens: prize.tokens || 0, energy: prize.energy || 0, prizeIndex },
      user: publicUser(updated),
      progression: levelFromTotalXp(updated.xp),
      nextSpinAt: new Date(Date.now() + cooldownMs),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/events/:id/position-change   { position }
async function changePosition(req, res, next) {
  try {
    const events = await getActiveEvents();
    const event = events.find((e) => e.id === req.params.id && e.type === "POSITION_CHANGE");
    if (!event) return res.status(404).json({ error: "Nu există un eveniment de schimbare a poziției activ." });

    const { position } = req.body || {};
    if (!VALID_POSITIONS.includes(position)) {
      return res.status(400).json({ error: `Poziție invalidă. Valori acceptate: ${VALID_POSITIONS.join(", ")}.` });
    }
    if (position === req.user.position) {
      return res.status(409).json({ error: "Joci deja pe această poziție." });
    }

    const cost = event.config.tokenCost ?? 50;
    if (event.config.oncePerEvent) {
      const used = await prisma.gameEventClaim.count({ where: { eventId: event.id, userId: req.user.id, kind: "POSITION_CHANGE" } });
      if (used > 0) return res.status(409).json({ error: "Ți-ai schimbat deja poziția în cadrul acestui eveniment." });
    }
    if (req.user.tokens < cost) {
      return res.status(409).json({ error: `Ai nevoie de ${cost} tokeni. Disponibil: ${req.user.tokens}.` });
    }

    const from = req.user.position || null;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.gameEventClaim.create({
        data: { eventId: event.id, userId: req.user.id, kind: "POSITION_CHANGE", dataJson: JSON.stringify({ from, to: position, cost }) },
      });
      return tx.user.update({
        where: { id: req.user.id },
        data: { position, tokens: { decrement: cost } },
      });
    });

    res.json({ user: publicUser(updated), progression: levelFromTotalXp(updated.xp) });
  } catch (err) {
    next(err);
  }
}

// POST /api/events/:id/superbet/apply   { matchId }
async function applySuperbet(req, res, next) {
  try {
    const events = await getActiveEvents();
    const event = events.find((e) => e.id === req.params.id && e.type === "SUPERBET");
    if (!event) return res.status(404).json({ error: "Nu există un eveniment „Superpariu” activ." });

    const grantsPerUser = event.config.grantsPerUser ?? 1;
    const [grants, used] = await Promise.all([
      prisma.gameEventClaim.count({ where: { eventId: event.id, userId: req.user.id, kind: "SUPERBET_GRANT" } }),
      prisma.gameEventClaim.count({ where: { eventId: event.id, userId: req.user.id, kind: "SUPERBET_USED" } }),
    ]);
    const available = Math.max(0, Math.max(grants, grantsPerUser) - used);
    if (available <= 0) return res.status(409).json({ error: "Ți-ai folosit deja superpariul." });

    const { matchId } = req.body || {};
    const match = await prisma.match.findUnique({ where: { id: matchId || "" } });
    if (!match) return res.status(404).json({ error: "Meciul nu există." });
    if (match.status !== "SCHEDULED" || !match.homeTeamId || !match.awayTeamId) {
      return res.status(409).json({ error: "Nu poți aplica superpariul pe acest meci." });
    }
    if (new Date(match.scheduledAt) <= new Date()) {
      return res.status(409).json({ error: "Meciul a început deja." });
    }

    const multiplier = event.config.multiplier ?? 10;
    const existing = await prisma.prediction.findUnique({
      where: { userId_matchId: { userId: req.user.id, matchId: match.id } },
    });

    const result = await prisma.$transaction(async (tx) => {
      let prediction;
      let cashSpent = 0;
      if (existing) {
        if (existing.superMultiplier) throw Object.assign(new Error("Ai aplicat deja un superpariu pe acest meci."), { status: 409 });
        prediction = await tx.prediction.update({ where: { id: existing.id }, data: { superMultiplier: multiplier } });
      } else {
        const stake = betAmountForLevel(req.user.level);
        if (req.user.cash < stake) throw Object.assign(new Error(`Nu ai suficienți bani pentru miză. Cost: ${stake}, disponibil: ${req.user.cash}.`), { status: 409 });
        await tx.user.update({ where: { id: req.user.id }, data: { cash: { decrement: stake } } });
        cashSpent = stake;
        prediction = await tx.prediction.create({
          data: { userId: req.user.id, matchId: match.id, choice: "1", stake, superMultiplier: multiplier },
        });
      }
      await tx.gameEventClaim.create({
        data: { eventId: event.id, userId: req.user.id, kind: "SUPERBET_USED", dataJson: JSON.stringify({ matchId: match.id }) },
      });
      return { prediction, cashSpent };
    });

    res.json({
      prediction: result.prediction,
      cashRemaining: req.user.cash - result.cashSpent,
      grantsRemaining: available - 1,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = {
  listEvents, listTypes, createEvent, updateEvent, cancelEvent,
  activeEvents, spinWheel, changePosition, applySuperbet,
};
