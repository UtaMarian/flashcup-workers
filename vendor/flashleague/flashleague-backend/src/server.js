require("dotenv").config();

const app = require("./app");
const logger = require("./config/logger");

// HTTP API only — stateless (JWT, no sessions), safe to scale horizontally.
// Background cron jobs (match simulation, energy regen, manager polls,
// events) live in a separate repo — https://github.com/UtaMarian/flashcup-workers
// — which runs them as a singleton process against the same database.
const PORT = process.env.PORT || 4001;

app.listen(PORT, () => {
  logger.info(`Flash Cup API rulează pe http://localhost:${PORT}`);
});
