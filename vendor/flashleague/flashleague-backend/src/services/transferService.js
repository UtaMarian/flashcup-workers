const prisma = require("../config/db");

const SQUAD_LIMIT = 30;

function fail(message, status = 409) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * The target player accepts a pending TransferOffer.
 *   FREE_AGENT — player has no club; just joins `toTeam` (fee 0).
 *   PURCHASE   — player is at `fromTeam` which listed them; on accept the
 *                `fee` moves from the buyer's club budget to the seller's,
 *                the listing is marked SOLD and the player is reassigned.
 * A single `Transfer` row records the completed move (public log). Any other
 * still-pending offers for this player (and, for PURCHASE, other pending
 * offers on the same listing) are expired.
 * Returns the fresh user row.
 */
async function acceptOffer(userId, offerId) {
  const offer = await prisma.transferOffer.findUnique({ where: { id: offerId }, include: { listing: true } });
  if (!offer) throw fail("Oferta nu există.", 404);
  if (offer.targetUserId !== userId) throw fail("Această ofertă nu îți este adresată.", 403);
  if (offer.status !== "PENDING") throw fail("Oferta nu mai este activă.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const playerName = `${user.firstName} ${user.lastName}`;
  const toSquadCount = await prisma.user.count({ where: { teamId: offer.toTeamId } });
  if (toSquadCount >= SQUAD_LIMIT) throw fail("Echipa care te-a ofertat are deja lotul complet (30 de jucători).");

  const now = new Date();

  if (offer.kind === "FREE_AGENT") {
    if (user.teamId) throw fail("Ești deja într-o echipă. Demisionează mai întâi.");
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { teamId: offer.toTeamId } }),
      prisma.teamHistory.create({ data: { userId, teamId: offer.toTeamId, reason: "JOINED" } }),
      prisma.transferOffer.update({ where: { id: offer.id }, data: { status: "ACCEPTED", resolvedAt: now } }),
      prisma.transferOffer.updateMany({
        where: { targetUserId: userId, status: "PENDING", id: { not: offer.id } },
        data: { status: "EXPIRED", resolvedAt: now },
      }),
      prisma.transfer.create({ data: { playerId: userId, fromTeamId: null, toTeamId: offer.toTeamId, fee: 0, kind: "OFFER" } }),
      prisma.post.create({
        data: {
          teamId: offer.toTeamId,
          authorId: offer.fromManagerId,
          type: "TEXT",
          text: `Transfer nou — ${playerName}, jucător liber de contract, s-a alăturat clubului nostru.`,
        },
      }),
    ]);
    return prisma.user.findUnique({ where: { id: userId } });
  }

  // PURCHASE
  if (!offer.listing || offer.listing.status !== "LISTED") throw fail("Listarea nu mai este activă.");
  if (user.teamId !== offer.fromTeamId) throw fail("Nu mai faci parte din clubul care te-a listat.");
  const [toTeam, fromTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: offer.toTeamId } }),
    prisma.team.findUnique({ where: { id: offer.fromTeamId } }),
  ]);
  if (!toTeam) throw fail("Clubul cumpărător nu mai există.", 404);
  if (toTeam.budget < offer.fee) throw fail("Clubul cumpărător nu mai are buget suficient.");

  await prisma.$transaction([
    prisma.team.update({ where: { id: offer.toTeamId }, data: { budget: { decrement: offer.fee } } }),
    prisma.team.update({ where: { id: offer.fromTeamId }, data: { budget: { increment: offer.fee } } }),
    prisma.teamHistory.updateMany({
      where: { userId, teamId: offer.fromTeamId, leftAt: null },
      data: { leftAt: now, reason: "TRANSFERRED" },
    }),
    prisma.user.update({ where: { id: userId }, data: { teamId: offer.toTeamId } }),
    prisma.teamHistory.create({ data: { userId, teamId: offer.toTeamId, reason: "TRANSFERRED" } }),
    prisma.transferListing.update({
      where: { id: offer.listing.id },
      data: { status: "SOLD", toTeamId: offer.toTeamId, soldPrice: offer.fee, soldAt: now },
    }),
    prisma.transferOffer.update({ where: { id: offer.id }, data: { status: "ACCEPTED", resolvedAt: now } }),
    prisma.transferOffer.updateMany({
      where: { status: "PENDING", id: { not: offer.id }, OR: [{ targetUserId: userId }, { listingId: offer.listing.id }] },
      data: { status: "EXPIRED", resolvedAt: now },
    }),
    prisma.transfer.create({ data: { playerId: userId, fromTeamId: offer.fromTeamId, toTeamId: offer.toTeamId, fee: offer.fee, kind: "MARKET" } }),
    prisma.post.create({
      data: {
        teamId: offer.toTeamId,
        authorId: offer.fromManagerId,
        type: "TEXT",
        text: `Transfer nou — ${playerName} s-a transferat de la ${fromTeam.name} și s-a alăturat clubului nostru.`,
      },
    }),
  ]);
  return prisma.user.findUnique({ where: { id: userId } });
}

async function declineOffer(userId, offerId) {
  const offer = await prisma.transferOffer.findUnique({ where: { id: offerId } });
  if (!offer) throw fail("Oferta nu există.", 404);
  if (offer.targetUserId !== userId) throw fail("Această ofertă nu îți este adresată.", 403);
  if (offer.status !== "PENDING") throw fail("Oferta nu mai este activă.");
  await prisma.transferOffer.update({ where: { id: offerId }, data: { status: "DECLINED", resolvedAt: new Date() } });
}

module.exports = { acceptOffer, declineOffer, SQUAD_LIMIT };
