const prisma = require("../config/db");

// Tokens the referrer receives once the invited account verifies its email.
const REWARD_TOKENS = 25;

// Unambiguous alphabet (no I/O/0/1) — codes appear in shareable links.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 7;

function normalizeRef(raw) {
  const s = String(raw || "").trim();
  return s ? s.slice(0, 40) : null;
}

function randomCode() {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

// A `ref` value may be a user's referralCode or, as a fallback, a raw user id.
async function resolveReferrerId(ref) {
  const key = normalizeRef(ref);
  if (!key) return null;
  const byCode = await prisma.user.findUnique({ where: { referralCode: key }, select: { id: true } });
  if (byCode) return byCode.id;
  const byId = await prisma.user.findUnique({ where: { id: key }, select: { id: true } });
  return byId ? byId.id : null;
}

/**
 * Record that `referredId` signed up through `ref`. Best-effort: a missing or
 * invalid ref, a self-referral, or an already-referred account are all silently
 * ignored — signup must never fail because of this.
 */
async function recordReferral(referredId, ref) {
  try {
    const referrerId = await resolveReferrerId(ref);
    if (!referrerId || referrerId === referredId) return;
    const existing = await prisma.referral.findUnique({ where: { referredId } });
    if (existing) return;
    await prisma.referral.create({
      data: { referrerId, referredId, rewardTokens: REWARD_TOKENS },
    });
  } catch (err) {
    console.error("[referrals] recordReferral failed:", err.message);
  }
}

/**
 * Called when `referredId`'s email becomes verified. Idempotent: only a PENDING
 * referral row is acted on, and only once — the referrer is granted the tokens.
 */
async function completeReferral(referredId) {
  try {
    const row = await prisma.referral.findUnique({ where: { referredId } });
    if (!row || row.status === "COMPLETED") return;
    await prisma.$transaction([
      prisma.referral.update({
        where: { id: row.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: row.referrerId },
        data: { tokens: { increment: row.rewardTokens } },
      }),
    ]);
  } catch (err) {
    console.error("[referrals] completeReferral failed:", err.message);
  }
}

// Return the user's invite code, generating + persisting one on first use.
async function ensureReferralCode(userId) {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (current?.referralCode) return current.referralCode;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: randomCode() },
        select: { referralCode: true },
      });
      return updated.referralCode;
    } catch (err) {
      if (err.code === "P2002") continue; // code collision — retry
      throw err;
    }
  }
  return null;
}

module.exports = {
  REWARD_TOKENS,
  recordReferral,
  completeReferral,
  ensureReferralCode,
};
