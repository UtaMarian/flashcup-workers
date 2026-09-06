const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const teamsRoutes = require("./routes/teams.routes");
const leaguesRoutes = require("./routes/leagues.routes");
const matchesRoutes = require("./routes/matches.routes");
const playersRoutes = require("./routes/players.routes");
const managerRoutes = require("./routes/manager.routes");
const seasonsRoutes = require("./routes/seasons.routes");
const predictionsRoutes = require("./routes/predictions.routes");
const adminRoutes = require("./routes/admin.routes");
const recordsRoutes = require("./routes/records.routes");
const transfersRoutes = require("./routes/transfers.routes");
const postsRoutes = require("./routes/posts.routes");
const rewardsRoutes = require("./routes/rewards.routes");
const eventsRoutes = require("./routes/events.routes");
const contactRoutes = require("./routes/contact.routes");
const changelogRoutes = require("./routes/changelog.routes");
const chatRoutes = require("./routes/chat.routes");
const referralRoutes = require("./routes/referrals.routes");
const announcementsRoutes = require("./routes/announcements.routes");
const { handleStripeWebhook } = require("./controllers/stripeWebhook.controller");

const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Needed so express-rate-limit (and req.ip generally) sees the real client
// IP instead of the reverse proxy's (nginx in Docker, or the hosting
// provider's edge in production) — without it every request looks like it
// comes from the same address.
app.set("trust proxy", 1);

app.use(helmet());
app.use(compression());

// Frontend now lives on a different origin (flashcup.live) than the API
// (api.flashcup.live), so this is real cross-origin traffic, not same-site.
// CORS_ORIGINS is a comma-separated allowlist; unset -> allow any origin
// (keeps local dev/Docker-compose frictionless, where frontend/API were
// same-origin behind one nginx proxy).
const corsOrigins = (process.env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : undefined));

// Stripe webhook — MUST be mounted with the raw body (needed for signature
// verification) and BEFORE express.json() below, or Stripe's signature check
// fails against an already-parsed/re-serialized body.
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok", app: "Flash Cup API" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/leagues", leaguesRoutes);
app.use("/api/matches", matchesRoutes);
app.use("/api/players", playersRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api/seasons", seasonsRoutes);
app.use("/api/predictions", predictionsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/records", recordsRoutes);
app.use("/api/transfers", transfersRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/rewards", rewardsRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/changelog", changelogRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/announcements", announcementsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
