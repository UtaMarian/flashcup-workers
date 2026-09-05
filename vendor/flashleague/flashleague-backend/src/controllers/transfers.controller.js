const prisma = require("../config/db");

// GET /api/transfers?limit=50 — public log of completed transfers.
async function listTransfers(req, res, next) {
  try {
    const limit = Math.min(200, Math.max(1, Math.trunc(Number(req.query.limit)) || 50));
    const transfers = await prisma.transfer.findMany({
      include: {
        player: { select: { id: true, firstName: true, lastName: true, position: true } },
        fromTeam: { select: { id: true, name: true, colorHex: true } },
        toTeam: { select: { id: true, name: true, colorHex: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({ transfers });
  } catch (err) {
    next(err);
  }
}

module.exports = { listTransfers };
