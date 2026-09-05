require("dotenv").config();

const http = require("http");
const { startMatchScheduler } = require("./jobs/matchScheduler");
const { startEnergyRegenJob } = require("./jobs/energyJob");
const { startManagerPollJob } = require("./jobs/managerPollJob");
const { startEventsJob } = require("./jobs/eventsJob");
const { logger } = require("./shared");

// Background-jobs process for Flash Cup, separate from the HTTP API (which
// lives in the `flashleague` repo and runs no cron of its own).
//
// IMPORTANT: run exactly ONE instance of this process. node-cron has no
// leader-election — a second worker would duplicate every timed action
// (match simulation, energy regen, manager-poll resolution, event
// transitions). The API is stateless (JWT, no sessions) and can be scaled
// horizontally without this restriction.
logger.info("Flash Cup worker pornit — rulează joburile de fundal.");
startMatchScheduler();
startEnergyRegenJob();
startManagerPollJob();
startEventsJob();

// dailyBonusJob is intentionally NOT started — the daily gift is claimed
// manually from the in-app shop. The file is kept (see src/jobs/dailyBonusJob.js)
// only so the scheduled variant is one require away if that ever changes.

// Minimal HTTP endpoint. The cron jobs need no HTTP, but PaaS platforms that
// only offer a "web service" tier (Render free plan, Railway, etc.) require
// the process to bind $PORT and answer a health check. On a real background-
// worker service this just sits idle and harmless.
const port = process.env.PORT;
if (port) {
  http
    .createServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "flashcup-workers" }));
    })
    .listen(port, () => logger.info(`[health] ascultă pe :${port}`));
}
