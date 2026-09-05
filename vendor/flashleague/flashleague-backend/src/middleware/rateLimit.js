const rateLimit = require("express-rate-limit");

// Applied only to the public, unauthenticated auth endpoints — the rest of
// the public API (teams, leagues, health...) has no brute-force/spam value.
// Requires app.set("trust proxy", ...) in app.js so the real client IP is
// used instead of the reverse proxy's.

// Stricter: the highest-value brute-force target.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Prea multe încercări de autentificare. Încearcă din nou peste câteva minute." },
});

// Shared, more lenient: register / password reset / social sign-in — public
// but lower-value targets, still worth capping against spam/enumeration.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Prea multe cereri. Încearcă din nou peste câteva minute." },
});

module.exports = { loginLimiter, authLimiter };
