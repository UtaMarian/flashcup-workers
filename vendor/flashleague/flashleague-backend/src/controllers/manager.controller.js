const prisma = require("../config/db");
const { FORMATIONS } = require("../utils/formations");
const { SQUAD_LIMIT } = require("../services/transferService");

const PLAYER_SUMMARY = {
  id: true, firstName: true, lastName: true, position: true, nationality: true,
  level: true, totalGoals: true, totalAssists: true, totalMatches: true, lastLoginAt: true,
};

const STYLES = ["ECHILIBRAT", "OFENSIV", "DEFENSIV", "POSESIE", "CONTRAATAC"];
const MARKINGS = ["ZONAL", "OM_LA_OM"];
const PRESSINGS = ["SCAZUT", "MEDIU", "RIDICAT"];
const DEFAULT_FORMATION = "4-4-2";

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// POST /api/manager/kick/:userId   (manager only — must manage the player's own team)
async function kickPlayer(req, res, next) {
  try {
    const manager = req.user;
    if (!manager.teamId) {
      return res.status(409).json({ error: "Nu ești asociat niciunei echipe." });
    }

    const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!target) return res.status(404).json({ error: "Jucătorul nu există." });
    if (target.teamId !== manager.teamId) {
      return res.status(403).json({ error: "Poți exclude doar jucători din propria echipă." });
    }
    if (target.id === manager.id) {
      return res.status(400).json({ error: "Nu te poți exclude pe tine însuți. Folosește demisia din profil." });
    }

    await prisma.$transaction([
      prisma.teamHistory.updateMany({
        where: { userId: target.id, teamId: manager.teamId, leftAt: null },
        data: { leftAt: new Date(), reason: "KICKED" },
      }),
      prisma.user.update({ where: { id: target.id }, data: { teamId: null } }),
    ]);

    const updated = await prisma.user.findUnique({ where: { id: target.id } });
    res.json({ success: true, user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
}

// GET /api/manager/lineup   (manager only)
// Returns the manager's team's saved Prim 11 + tactics, resolved with
// player summaries — or a default empty 4-4-2 shape if nothing saved yet.
async function getLineup(req, res, next) {
  try {
    const manager = req.user;
    if (!manager.teamId) return res.status(409).json({ error: "Nu ești asociat niciunei echipe." });

    const lineup = await prisma.lineup.findUnique({ where: { teamId: manager.teamId } });

    if (!lineup) {
      return res.json({
        lineup: {
          formation: DEFAULT_FORMATION,
          slots: FORMATIONS[DEFAULT_FORMATION].map(position => ({ position, player: null })),
          style: "ECHILIBRAT",
          marking: "ZONAL",
          pressing: "MEDIU",
        },
      });
    }

    const slots = JSON.parse(lineup.slotsJson);
    const playerIds = slots.map(s => s.playerId).filter(Boolean);
    const players = playerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, firstName: true, lastName: true, position: true, level: true },
        })
      : [];
    const byId = new Map(players.map(p => [p.id, p]));

    res.json({
      lineup: {
        formation: lineup.formation,
        slots: slots.map(s => ({ position: s.position, player: s.playerId ? byId.get(s.playerId) || null : null })),
        style: lineup.style,
        marking: lineup.marking,
        pressing: lineup.pressing,
      },
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/manager/lineup   { formation, playerIds: [11 x string|null], style, marking, pressing }   (manager only)
async function saveLineup(req, res, next) {
  try {
    const manager = req.user;
    if (!manager.teamId) return res.status(409).json({ error: "Nu ești asociat niciunei echipe." });

    const { formation, playerIds, style, marking, pressing } = req.body;

    const template = FORMATIONS[formation];
    if (!template) return res.status(400).json({ error: "Formație invalidă." });

    if (!Array.isArray(playerIds) || playerIds.length !== 11) {
      return res.status(400).json({ error: "Trebuie trimiși exact 11 jucători (unii pot fi necompletați)." });
    }

    const nonNullIds = playerIds.filter(Boolean);
    if (new Set(nonNullIds).size !== nonNullIds.length) {
      return res.status(400).json({ error: "Un jucător nu poate ocupa mai mult de un post." });
    }

    if (style !== undefined && !STYLES.includes(style)) return res.status(400).json({ error: "Stil de joc invalid." });
    if (marking !== undefined && !MARKINGS.includes(marking)) return res.status(400).json({ error: "Marcaj invalid." });
    if (pressing !== undefined && !PRESSINGS.includes(pressing)) return res.status(400).json({ error: "Presing invalid." });

    if (nonNullIds.length) {
      const owned = await prisma.user.findMany({
        where: { id: { in: nonNullIds }, teamId: manager.teamId, role: { in: ["PLAYER", "MANAGER"] } },
        select: { id: true },
      });
      if (owned.length !== nonNullIds.length) {
        return res.status(403).json({ error: "Poți selecta doar jucători din propria echipă." });
      }
    }

    const slotsJson = JSON.stringify(template.map((position, i) => ({ position, playerId: playerIds[i] || null })));

    const lineup = await prisma.lineup.upsert({
      where: { teamId: manager.teamId },
      update: {
        formation,
        slotsJson,
        style: style || "ECHILIBRAT",
        marking: marking || "ZONAL",
        pressing: pressing || "MEDIU",
      },
      create: {
        teamId: manager.teamId,
        formation,
        slotsJson,
        style: style || "ECHILIBRAT",
        marking: marking || "ZONAL",
        pressing: pressing || "MEDIU",
      },
    });

    res.json({ lineup });
  } catch (err) {
    next(err);
  }
}

/* ---------------------------------------------------------------------------
   TRANSFERS  (manager only — all require the manager to have a team)
--------------------------------------------------------------------------- */

function teamOr409(res, manager) {
  if (!manager.teamId) {
    res.status(409).json({ error: "Nu ești asociat niciunei echipe." });
    return null;
  }
  return manager.teamId;
}

// GET /api/manager/free-agents
async function listFreeAgents(req, res, next) {
  try {
    const teamId = teamOr409(res, req.user);
    if (!teamId) return;

    const activeSince = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const [agents, myOffers] = await Promise.all([
      prisma.user.findMany({
        where: {
          teamId: null,
          role: { in: ["PLAYER", "MANAGER"] },
          status: "ACTIVE",
          level: { gte: 5 },
          lastLoginAt: { gte: activeSince },
        },
        select: PLAYER_SUMMARY,
        orderBy: [{ level: "desc" }, { lastName: "asc" }],
      }),
      prisma.transferOffer.findMany({
        where: { toTeamId: teamId, kind: "FREE_AGENT", status: "PENDING" },
        select: { id: true, targetUserId: true },
      }),
    ]);
    const pendingByUser = Object.fromEntries(myOffers.map(o => [o.targetUserId, o.id]));
    res.json({ freeAgents: agents.map(a => ({ ...a, pendingOfferId: pendingByUser[a.id] || null })) });
  } catch (err) { next(err); }
}

// POST /api/manager/transfer-offers   { targetUserId }
async function sendTransferOffer(req, res, next) {
  try {
    const teamId = teamOr409(res, req.user);
    if (!teamId) return;
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: "Jucătorul țintă este obligatoriu." });

    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) return res.status(404).json({ error: "Jucătorul nu există." });
    if (target.teamId) return res.status(409).json({ error: "Jucătorul nu este liber de contract." });
    if (!["PLAYER", "MANAGER"].includes(target.role)) return res.status(400).json({ error: "Nu poți oferta acest cont." });

    const squadCount = await prisma.user.count({ where: { teamId } });
    if (squadCount >= SQUAD_LIMIT) return res.status(409).json({ error: "Lotul tău este deja complet (30 de jucători)." });

    const existing = await prisma.transferOffer.findFirst({
      where: { toTeamId: teamId, targetUserId, kind: "FREE_AGENT", status: "PENDING" },
    });
    if (existing) return res.status(409).json({ error: "Ai deja o ofertă activă către acest jucător." });

    const offer = await prisma.transferOffer.create({
      data: { kind: "FREE_AGENT", targetUserId, toTeamId: teamId, fromManagerId: req.user.id, fee: 0 },
    });
    res.status(201).json({ offer });
  } catch (err) { next(err); }
}

// GET /api/manager/transfer-offers   — offers my team is a party to
async function listSentTransferOffers(req, res, next) {
  try {
    const teamId = teamOr409(res, req.user);
    if (!teamId) return;
    const offers = await prisma.transferOffer.findMany({
      where: { toTeamId: teamId },
      include: {
        targetUser: { select: { id: true, firstName: true, lastName: true, position: true } },
        fromTeam: { select: { id: true, name: true, colorHex: true } },
        listing: { select: { id: true, price: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ offers });
  } catch (err) { next(err); }
}

// DELETE /api/manager/transfer-offers/:id
async function cancelTransferOffer(req, res, next) {
  try {
    const teamId = teamOr409(res, req.user);
    if (!teamId) return;
    const offer = await prisma.transferOffer.findUnique({ where: { id: req.params.id } });
    if (!offer || offer.toTeamId !== teamId) return res.status(404).json({ error: "Oferta nu există." });
    if (offer.status !== "PENDING") return res.status(409).json({ error: "Oferta nu mai poate fi anulată." });
    await prisma.transferOffer.update({ where: { id: offer.id }, data: { status: "CANCELLED", resolvedAt: new Date() } });
    res.json({ success: true });
  } catch (err) { next(err); }
}

// GET /api/manager/transfer-listings   — the market + my club's own listings
async function listTransferListings(req, res, next) {
  try {
    const teamId = teamOr409(res, req.user);
    if (!teamId) return;
    const listings = await prisma.transferListing.findMany({
      where: { OR: [{ status: "LISTED" }, { fromTeamId: teamId }] },
      include: {
        player: { select: PLAYER_SUMMARY },
        fromTeam: { select: { id: true, name: true, colorHex: true } },
        toTeam: { select: { id: true, name: true } },
        offers: { where: { toTeamId: teamId, status: "PENDING" }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({
      listings: listings.map(l => ({
        ...l,
        mine: l.fromTeamId === teamId,
        myPendingOfferId: l.offers[0]?.id || null,
        offers: undefined,
      })),
    });
  } catch (err) { next(err); }
}

// POST /api/manager/transfer-listings   { playerId, price }
async function createTransferListing(req, res, next) {
  try {
    const teamId = teamOr409(res, req.user);
    if (!teamId) return;
    const { playerId } = req.body;
    const price = Math.trunc(Number(req.body.price));
    if (!playerId) return res.status(400).json({ error: "Jucătorul este obligatoriu." });
    if (!Number.isFinite(price) || price < 1) return res.status(400).json({ error: "Valoarea de piață trebuie să fie un număr pozitiv." });

    const player = await prisma.user.findUnique({ where: { id: playerId } });
    if (!player || player.teamId !== teamId) return res.status(403).json({ error: "Poți lista doar jucători din propria echipă." });
    if (!["PLAYER", "MANAGER"].includes(player.role)) return res.status(400).json({ error: "Acest cont nu poate fi listat." });

    const already = await prisma.transferListing.findFirst({ where: { playerId, status: "LISTED" } });
    if (already) return res.status(409).json({ error: "Jucătorul este deja pe lista de transferuri." });

    const listing = await prisma.transferListing.create({
      data: { playerId, fromTeamId: teamId, listedByManagerId: req.user.id, price },
    });
    res.status(201).json({ listing });
  } catch (err) { next(err); }
}

// DELETE /api/manager/transfer-listings/:id
async function withdrawTransferListing(req, res, next) {
  try {
    const teamId = teamOr409(res, req.user);
    if (!teamId) return;
    const listing = await prisma.transferListing.findUnique({ where: { id: req.params.id } });
    if (!listing || listing.fromTeamId !== teamId) return res.status(404).json({ error: "Listarea nu există." });
    if (listing.status !== "LISTED") return res.status(409).json({ error: "Listarea nu mai este activă." });
    const now = new Date();
    await prisma.$transaction([
      prisma.transferListing.update({ where: { id: listing.id }, data: { status: "WITHDRAWN" } }),
      prisma.transferOffer.updateMany({
        where: { listingId: listing.id, status: "PENDING" },
        data: { status: "EXPIRED", resolvedAt: now },
      }),
    ]);
    res.json({ success: true });
  } catch (err) { next(err); }
}

// POST /api/manager/transfer-listings/:id/buy   — creates a PURCHASE offer
// the listed player must then accept. Money is not moved here.
async function buyTransferListing(req, res, next) {
  try {
    const teamId = teamOr409(res, req.user);
    if (!teamId) return;
    const listing = await prisma.transferListing.findUnique({ where: { id: req.params.id } });
    if (!listing || listing.status !== "LISTED") return res.status(404).json({ error: "Listarea nu este disponibilă." });
    if (listing.fromTeamId === teamId) return res.status(400).json({ error: "Nu poți cumpăra un jucător din propriul club." });

    const myTeam = await prisma.team.findUnique({ where: { id: teamId } });
    if (myTeam.budget < listing.price) return res.status(409).json({ error: "Bugetul clubului este insuficient pentru acest transfer." });

    const squadCount = await prisma.user.count({ where: { teamId } });
    if (squadCount >= SQUAD_LIMIT) return res.status(409).json({ error: "Lotul tău este deja complet (30 de jucători)." });

    const existing = await prisma.transferOffer.findFirst({
      where: { listingId: listing.id, toTeamId: teamId, kind: "PURCHASE", status: "PENDING" },
    });
    if (existing) return res.status(409).json({ error: "Ai deja o ofertă activă pentru acest jucător." });

    const offer = await prisma.transferOffer.create({
      data: {
        kind: "PURCHASE",
        targetUserId: listing.playerId,
        toTeamId: teamId,
        fromTeamId: listing.fromTeamId,
        fromManagerId: req.user.id,
        listingId: listing.id,
        fee: listing.price,
      },
    });
    res.status(201).json({ offer });
  } catch (err) { next(err); }
}

// PATCH /api/manager/team   { colorHex?, colorHex2? }   (manager only — own team)
// Lets the elected manager pick the club's two kit colours. `colorHex2` may be
// cleared by sending null / "".
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
async function updateTeamColors(req, res, next) {
  try {
    const manager = req.user;
    if (!manager.teamId) return res.status(409).json({ error: "Nu ești asociat niciunei echipe." });

    const { colorHex, colorHex2 } = req.body;
    const data = {};
    if (colorHex !== undefined) {
      if (!HEX_COLOR.test(colorHex || "")) return res.status(400).json({ error: "Culoare principală invalidă." });
      data.colorHex = colorHex;
    }
    if (colorHex2 !== undefined) {
      if (colorHex2 === null || colorHex2 === "") data.colorHex2 = null;
      else if (!HEX_COLOR.test(colorHex2)) return res.status(400).json({ error: "Culoare secundară invalidă." });
      else data.colorHex2 = colorHex2;
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nicio culoare de actualizat." });

    const team = await prisma.team.update({ where: { id: manager.teamId }, data });
    res.json({ team });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  kickPlayer, getLineup, saveLineup, updateTeamColors,
  listFreeAgents, sendTransferOffer, listSentTransferOffers, cancelTransferOffer,
  listTransferListings, createTransferListing, withdrawTransferListing, buyTransferListing,
};
