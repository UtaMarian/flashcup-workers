const prisma = require("../config/db");
const { ensureReferralCode, REWARD_TOKENS } = require("../utils/referrals");

// GET /api/referrals/me — the caller's invite code + who they've brought in.
async function getMyReferrals(req, res, next) {
  try {
    const meId = req.user.id;
    const code = await ensureReferralCode(meId);

    const rows = await prisma.referral.findMany({
      where: { referrerId: meId },
      orderBy: { createdAt: "desc" },
      include: {
        referred: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, emailVerifiedAt: true },
        },
      },
    });

    const invited = rows.map((r) => ({
      id: r.referred.id,
      name: `${r.referred.firstName} ${r.referred.lastName}`.trim(),
      avatarUrl: r.referred.avatarUrl || null,
      status: r.status, // PENDING | COMPLETED
      rewardTokens: r.rewardTokens,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    }));

    const confirmed = invited.filter((i) => i.status === "COMPLETED");
    const totals = {
      joined: invited.length,
      confirmed: confirmed.length,
      tokensEarned: confirmed.reduce((sum, i) => sum + i.rewardTokens, 0),
    };

    res.json({ code, path: `/?ref=${code}`, rewardTokens: REWARD_TOKENS, totals, invited });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyReferrals };
