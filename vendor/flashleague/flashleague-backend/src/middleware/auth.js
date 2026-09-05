const { verifyToken } = require("../utils/jwt");
const prisma = require("../config/db");

// Endpoints that must stay reachable for a signed-in but not-yet-verified
// account (the bootstrap call + the verification/onboarding flow itself).
const UNVERIFIED_ALLOWLIST = new Set([
  "/api/auth/me",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/auth/complete-profile",
]);

/** Requires a valid Bearer token, attaches req.user (fresh from DB). */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Autentificare necesară." });

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: "Cont inexistent." });
    if (user.status === "BANNED") return res.status(403).json({ error: "Cont banat." });
    if (user.status === "SUSPENDED") return res.status(403).json({ error: "Cont suspendat." });

    // LOCAL accounts can't touch the game until their email is verified.
    // Admins are exempt; social accounts are verified at creation.
    if (!user.emailVerifiedAt && user.role !== "ADMIN") {
      const path = (req.originalUrl || "").split("?")[0];
      if (!UNVERIFIED_ALLOWLIST.has(path)) {
        return res.status(403).json({
          error: "Verifică-ți adresa de email pentru a continua.",
          code: "EMAIL_NOT_VERIFIED",
        });
      }
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalid sau expirat." });
  }
}

module.exports = { authenticate };
