require("dotenv").config();

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
logger.info("Flash Cup worker pornit — rulează joburile de fundal (fără server HTTP).");
startMatchScheduler();
startEnergyRegenJob();
startManagerPollJob();
startEventsJob();

// dailyBonusJob is intentionally NOT started — the daily gift is claimed
// manually from the in-app shop. The file is kept (see src/jobs/dailyBonusJob.js)
// only so the scheduled variant is one require away if that ever changes.
