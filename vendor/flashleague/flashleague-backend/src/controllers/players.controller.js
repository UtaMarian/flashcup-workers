const prisma = require("../config/db");
const { hashPassword, comparePassword } = require("../utils/password");
const { levelFromTotalXp } = require("../utils/xp");
const { enqueueLevelUps } = require("../services/rewardService");
const { multiplierFor } = require("../services/eventsService");
const transferService = require("../services/transferService");
const { getStripeClient } = require("../config/stripe");

// Absolute origin the player's browser is served from — used to build the
// Stripe Checkout success/cancel redirect targets. No trailing slash.
const APP_URL = (process.env.APP_URL || "http://localhost:5173").replace(/\/+$/, "");

const ATTRIBUTE_FIELDS = {
  viteza: "attrSpeed",
  tehnica: "attrTechnique",
  pase: "attrPassing",
  fizic: "attrPhysical",
  aparare: "attrDefense",
  atac: "attrAttack",
};

const ENERGY_COST_PER_SESSION = 10;
const XP_PER_SESSION = 80;
const ATTRIBUTE_CAP = 1000;

const ENERGY_MAX = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// SHOP CATALOG
// The game has no payment provider wired up, so every "real money" purchase
// (priceEur) is *simulated*: the resources are granted immediately and no
// balance is charged. Token purchases really do spend the player's tokens.
// `bonus` is a percentage added on top of the headline amount when granted.
// ---------------------------------------------------------------------------

// Energy packs — bought with real money (simulated).
const ENERGY_PACKS = [
  { id: "energy_100", energy: 100, bonus: 0, priceEur: 2.49 },
  { id: "energy_250", energy: 250, bonus: 0, priceEur: 4.99, tag: "POPULAR" },
  { id: "energy_550", energy: 550, bonus: 10, priceEur: 9.99 },
  { id: "energy_1200", energy: 1200, bonus: 20, priceEur: 19.99 },
];

// Currency (cash) packs — bought with real money (simulated).
const CURRENCY_PACKS = [
  { id: "cash_10k", cash: 10000, bonus: 0, priceEur: 1.99 },
  { id: "cash_30k", cash: 30000, bonus: 0, priceEur: 4.99, tag: "BEST_VALUE" },
  { id: "cash_75k", cash: 75000, bonus: 15, priceEur: 9.99 },
  { id: "cash_160k", cash: 160000, bonus: 25, priceEur: 19.99 },
];

// Energy refills — bought with tokens (really spends tokens).
const TOKEN_ENERGY_PACKS = [
  { id: "trefill_50", energy: 50, bonus: 0, tokens: 5 },
  { id: "trefill_120", energy: 120, bonus: 0, tokens: 10 },
  { id: "trefill_300", energy: 300, bonus: 10, tokens: 20 },
  { id: "trefill_650", energy: 650, bonus: 20, tokens: 40 },
];

// Repeatable "Super Value" bundle — real money (simulated).
const SHOP_BUNDLE = { id: "bundle_super", cash: 75000, energy: 550, priceEur: 14.99 };

// One-time discounted Starter Pack — real money (simulated), once per account.
const STARTER_PACK = { id: "starter_pack", cash: 50000, energy: 400, tokens: 15, priceEur: 2.99, valueEur: 12.99 };

const { dailyCashForLevel } = require("../utils/dailyBonus");

function withBonus(amount, bonus) {
  return amount + Math.round((amount * (bonus || 0)) / 100);
}

function dailyGiftState(user) {
  const last = user.lastDailyGiftAt ? new Date(user.lastDailyGiftAt).getTime() : 0;
  const availableAtMs = last ? last + DAY_MS : 0;
  const ready = Date.now() >= availableAtMs;
  return {
    ready,
    availableAt: availableAtMs ? new Date(availableAtMs).toISOString() : null,
    cash: dailyCashForLevel(user.level),
    tokens: 1,
  };
}

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// GET /api/players/me
async function getMe(req, res) {
  res.json({ user: publicUser(req.user), progression: levelFromTotalXp(req.user.xp) });
}

// PATCH /api/players/me   { firstName?, lastName?, nationality? }
async function updateProfile(req, res, next) {
  try {
    const { firstName, lastName, nationality } = req.body;
    if (nationality !== undefined && nationality !== null && !/^[A-Z]{2}$/.test(nationality)) {
      return res.status(400).json({ error: "Naționalitate invalidă." });
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
        nationality: nationality !== undefined ? nationality : undefined,
      },
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// POST /api/players/me/tutorial-seen — dismiss the one-time onboarding tutorial.
async function markTutorialSeen(req, res, next) {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { tutorialSeenAt: new Date() },
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// Page ids that have a one-time "coach tip".
const TIP_PAGES = ["dashboard", "training", "team", "competitions", "match", "predictions", "events", "shop", "manage"];

// POST /api/players/me/page-tip-seen   { page }
// Records that the player has dismissed the coach tip for one page.
async function markPageTipSeen(req, res, next) {
  try {
    const page = String((req.body || {}).page || "");
    if (!TIP_PAGES.includes(page)) {
      return res.status(400).json({ error: "Pagină necunoscută." });
    }
    let seen = [];
    try { seen = JSON.parse(req.user.pageTipsSeenJson || "[]"); } catch { seen = []; }
    if (!Array.isArray(seen)) seen = [];
    if (!seen.includes(page)) seen.push(page);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { pageTipsSeenJson: JSON.stringify(seen) },
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// POST /api/players/me/manager-notice/dismiss — acknowledge the "you were
// elected manager" notice so it stops showing.
async function dismissManagerNotice(req, res, next) {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { managerElectedAt: null },
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/players/me/password   { currentPassword, newPassword }
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    // Accounts created via Google/Facebook have no local password yet — they may
    // set an initial one here without providing a current password.
    const hasLocalPassword = !!req.user.passwordHash;

    if (!newPassword || (hasLocalPassword && !currentPassword)) {
      return res.status(400).json({ error: "Parola curentă și noua parolă sunt obligatorii." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Noua parolă trebuie să aibă minimum 8 caractere." });
    }

    if (hasLocalPassword) {
      const valid = await comparePassword(currentPassword, req.user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Parola curentă este incorectă." });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// POST /api/players/me/train   { attribute: "viteza"|"tehnica"|"fizic"|"aparare"|"atac" }
async function train(req, res, next) {
  try {
    const { attribute } = req.body;
    const field = ATTRIBUTE_FIELDS[attribute];
    if (!field) {
      return res.status(400).json({ error: `Atribut invalid. Valori acceptate: ${Object.keys(ATTRIBUTE_FIELDS).join(", ")}.` });
    }

    const user = req.user;
    if (user.energy < ENERGY_COST_PER_SESSION) {
      return res.status(409).json({ error: "Energie insuficientă pentru antrenament." });
    }
    if (user[field] >= ATTRIBUTE_CAP) {
      return res.status(409).json({ error: "Acest atribut este deja la nivel maxim." });
    }

    // A live DOUBLE_TRAINING_XP event multiplies the XP from this session.
    const xpGain = XP_PER_SESSION * (await multiplierFor("DOUBLE_TRAINING_XP"));
    const derived = levelFromTotalXp(user.xp + xpGain);

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: user.id },
        data: {
          [field]: Math.min(ATTRIBUTE_CAP, user[field] + 1),
          energy: user.energy - ENERGY_COST_PER_SESSION,
          xp: derived.totalXp,
          level: derived.level,
        },
      });
      await enqueueLevelUps(tx, user.id, user.level, derived.level);
      return u;
    });

    res.json({ user: publicUser(updated), progression: derived });
  } catch (err) {
    next(err);
  }
}

// POST /api/players/me/resign
async function resign(req, res, next) {
  try {
    const user = req.user;
    if (!user.teamId) return res.status(409).json({ error: "Nu faci parte din nicio echipă." });

    const wasManager = user.role === "MANAGER";

    await prisma.$transaction([
      prisma.teamHistory.updateMany({
        where: { userId: user.id, teamId: user.teamId, leftAt: null },
        data: { leftAt: new Date(), reason: "RESIGNED" },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { teamId: null, role: wasManager ? "PLAYER" : undefined },
      }),
    ]);

    res.json({
      success: true,
      message: wasManager
        ? "Ai demisionat din echipă. Rolul de manager a fost eliberat — ai redevenit jucător."
        : "Ai demisionat din echipă. Poți alege o altă echipă disponibilă.",
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/players/me/join   { teamId }   — for a player currently without a team
async function joinTeam(req, res, next) {
  try {
    const user = req.user;
    if (user.teamId) return res.status(409).json({ error: "Ești deja într-o echipă. Demisionează mai întâi." });

    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: "Echipa este obligatorie." });

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: "Echipa nu există." });

    const squadCount = await prisma.user.count({ where: { teamId } });
    if (squadCount >= 30) return res.status(409).json({ error: "Echipa selectată are deja lotul complet (30 de jucători)." });

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { teamId } }),
      prisma.teamHistory.create({ data: { userId: user.id, teamId, reason: "JOINED" } }),
    ]);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    res.json({ user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
}

// GET /api/players/:id/profile — public player page: trophy case, team
// history (a player can represent several teams within one season), and
// current-season stats.
async function getPlayerProfile(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { team: { include: { league: true } } },
    });
    if (!user) return res.status(404).json({ error: "Jucătorul nu există." });

    const TEAM_SUMMARY = { select: { id: true, name: true, colorHex: true, logoUrl: true } };

    const trophyLinks = await prisma.trophyPlayer.findMany({
      where: { userId: user.id },
      include: { trophy: { include: { team: TEAM_SUMMARY } } },
      orderBy: { trophy: { awardedAt: "desc" } },
    });
    const trophies = trophyLinks.map(tp => tp.trophy);

    const teamHistory = await prisma.teamHistory.findMany({
      where: { userId: user.id },
      include: { team: TEAM_SUMMARY },
      orderBy: { joinedAt: "desc" },
    });

    const transfers = await prisma.transfer.findMany({
      where: { playerId: user.id },
      include: { fromTeam: TEAM_SUMMARY, toTeam: TEAM_SUMMARY },
      orderBy: { createdAt: "desc" },
    });

    let seasonStats = { goals: 0, assists: 0 };
    if (user.team && user.team.league && user.team.league.status === "ACTIVE") {
      const cup = await prisma.league.findFirst({ where: { parentLeagueId: user.team.league.id, type: "CUPA_INTERNA" } });
      const leagueIds = [user.team.league.id, ...(cup ? [cup.id] : [])];
      const [goals, assists] = await Promise.all([
        prisma.matchEvent.count({ where: { type: "GOAL", scorerId: user.id, match: { leagueId: { in: leagueIds } } } }),
        prisma.matchEvent.count({ where: { type: "GOAL", assistId: user.id, match: { leagueId: { in: leagueIds } } } }),
      ]);
      seasonStats = { goals, assists };
    }

    const { passwordHash, ...publicFields } = user;
    res.json({ user: publicFields, trophies, teamHistory, transfers, seasonStats });
  } catch (err) {
    next(err);
  }
}

// GET /api/players/me/transfer-offers — my pending transfer offers (feed)
async function listMyTransferOffers(req, res, next) {
  try {
    const offers = await prisma.transferOffer.findMany({
      where: { targetUserId: req.user.id, status: "PENDING" },
      include: {
        toTeam: { select: { id: true, name: true, colorHex: true } },
        fromTeam: { select: { id: true, name: true, colorHex: true } },
        fromManager: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ offers });
  } catch (err) {
    next(err);
  }
}

// POST /api/players/me/transfer-offers/:id/accept
async function acceptTransferOffer(req, res, next) {
  try {
    const updated = await transferService.acceptOffer(req.user.id, req.params.id);
    res.json({ user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
}

// POST /api/players/me/transfer-offers/:id/decline
async function declineTransferOffer(req, res, next) {
  try {
    await transferService.declineOffer(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/players/me/shop — full shop catalog + the player's wallet + daily-gift state.
async function getShop(req, res) {
  const u = req.user;
  res.json({
    energyPacks: ENERGY_PACKS,
    currencyPacks: CURRENCY_PACKS,
    tokenEnergyPacks: TOKEN_ENERGY_PACKS,
    bundle: SHOP_BUNDLE,
    starterPack: STARTER_PACK,
    starterPackClaimed: !!u.starterPackClaimedAt,
    dailyGift: dailyGiftState(u),
    energy: u.energy,
    energyMax: ENERGY_MAX,
    cash: u.cash,
    tokens: u.tokens,
  });
}

// Resolves a shop catalog entry for one of the four real-money kinds into
// the resources it grants + its EUR price. Shared by checkout-session
// creation (below) so the Stripe line item and the snapshotted grant always
// agree with the catalog. Throws { status } errors the controller maps to
// an HTTP response.
function resolveRealMoneyPack(kind, packId, user) {
  if (kind === "energy") {
    const pack = ENERGY_PACKS.find((p) => p.id === packId);
    if (!pack) throw Object.assign(new Error("Pachet de energie invalid."), { status: 400 });
    const energy = withBonus(pack.energy, pack.bonus);
    return { grant: { cash: 0, energy, tokens: 0 }, priceEur: pack.priceEur, label: `Flash Cup — ${energy} energie` };
  }
  if (kind === "currency") {
    const pack = CURRENCY_PACKS.find((p) => p.id === packId);
    if (!pack) throw Object.assign(new Error("Pachet de cash invalid."), { status: 400 });
    const cash = withBonus(pack.cash, pack.bonus);
    return { grant: { cash, energy: 0, tokens: 0 }, priceEur: pack.priceEur, label: `Flash Cup — ${cash} cash` };
  }
  if (kind === "bundle") {
    return { grant: { cash: SHOP_BUNDLE.cash, energy: SHOP_BUNDLE.energy, tokens: 0 }, priceEur: SHOP_BUNDLE.priceEur, label: "Flash Cup — Pachet Super Value" };
  }
  if (kind === "starter") {
    if (user.starterPackClaimedAt) {
      throw Object.assign(new Error("Pachetul de început a fost deja revendicat."), { status: 409 });
    }
    return { grant: { cash: STARTER_PACK.cash, energy: STARTER_PACK.energy, tokens: STARTER_PACK.tokens }, priceEur: STARTER_PACK.priceEur, label: "Flash Cup — Starter Pack" };
  }
  throw Object.assign(new Error("Tip de achiziție invalid."), { status: 400 });
}

function randomSuffix(len = 8) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

// POST /api/players/me/shop/checkout   { kind: "energy"|"currency"|"bundle"|"starter", packId }
// Creates a Stripe Checkout Session for a real-money shop item and a
// matching PENDING ShopOrder. Grants NOTHING itself — fulfillment happens
// only in the Stripe webhook handler once payment is confirmed. Returns the
// hosted Checkout URL for the client to redirect the browser to.
async function createShopCheckout(req, res, next) {
  try {
    const { kind, packId } = req.body;
    const user = req.user;

    let resolved;
    try {
      resolved = resolveRealMoneyPack(kind, packId, user);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
    const { grant, priceEur, label } = resolved;
    const amountTotal = Math.round(priceEur * 100); // EUR -> cents

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      client_reference_id: user.id,
      // payment_method_types intentionally omitted — lets Stripe show the
      // best payment methods for the buyer (dynamic payment methods).
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountTotal,
          product_data: { name: label, description: "Flash Cup — resurse de joc" },
        },
      }],
      metadata: { userId: user.id, kind, packId: packId || kind },
      success_url: `${APP_URL}/?shop=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/?shop=cancel`,
      integration_identifier: `flashcup_shop_${randomSuffix()}`,
    });

    await prisma.shopOrder.create({
      data: {
        userId: user.id,
        kind,
        packId: packId || kind,
        currency: "eur",
        amountTotal,
        grantCash: grant.cash,
        grantEnergy: grant.energy,
        grantTokens: grant.tokens,
        stripeCheckoutSessionId: session.id,
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    next(err);
  }
}

// GET /api/players/me/shop/orders/:sessionId
// Lets the client poll a Checkout Session's fulfillment status after the
// player returns from Stripe (success_url) — fulfillment itself always
// happens in the webhook handler, never here.
async function getShopOrderStatus(req, res, next) {
  try {
    const order = await prisma.shopOrder.findUnique({ where: { stripeCheckoutSessionId: req.params.sessionId } });
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ error: "Comanda nu a fost găsită." });
    }
    res.json({
      status: order.status,
      kind: order.kind,
      packId: order.packId,
      grant: { cash: order.grantCash, energy: order.grantEnergy, tokens: order.grantTokens },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/players/me/shop/token-energy   { packId }
// Really spends the player's tokens for energy.
async function buyTokenEnergy(req, res, next) {
  try {
    const { packId } = req.body;
    const pack = TOKEN_ENERGY_PACKS.find((p) => p.id === packId);
    if (!pack) return res.status(400).json({ error: "Pachet de reîncărcare invalid." });

    const user = req.user;
    if (user.tokens < pack.tokens) {
      return res.status(409).json({ error: "Tokeni insuficienți pentru acest pachet." });
    }

    const energyGained = withBonus(pack.energy, pack.bonus);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { energy: user.energy + energyGained, tokens: user.tokens - pack.tokens },
    });

    res.json({
      user: publicUser(updated),
      progression: levelFromTotalXp(updated.xp),
      purchase: { packId: pack.id, energyGained, tokensSpent: pack.tokens },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/players/me/shop/daily-gift — manual daily-gift claim (24h cooldown).
async function claimDailyGift(req, res, next) {
  try {
    const user = req.user;
    const state = dailyGiftState(user);
    if (!state.ready) {
      return res.status(409).json({ error: "Cadoul zilnic nu este încă disponibil.", availableAt: state.availableAt });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        cash: user.cash + state.cash,
        tokens: user.tokens + state.tokens,
        lastDailyGiftAt: new Date(),
      },
    });

    res.json({
      user: publicUser(updated),
      progression: levelFromTotalXp(updated.xp),
      claim: { cash: state.cash, tokens: state.tokens },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe, updateProfile, changePassword, train, resign, joinTeam, getPlayerProfile,
  listMyTransferOffers, acceptTransferOffer, declineTransferOffer,
  getShop, createShopCheckout, getShopOrderStatus, buyTokenEnergy, claimDailyGift,
  markTutorialSeen, dismissManagerNotice, markPageTipSeen,
};
