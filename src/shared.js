/**
 * Single coupling point between this repo and the Flash Cup backend.
 *
 * The backend is vendored as a git submodule at `vendor/flashleague`. All the
 * domain logic the cron jobs need (match simulation, event lifecycle, manager
 * polls, the Prisma client, the logger) lives there and is re-exported here so
 * the job files stay tiny and there is exactly one path to update if the
 * backend layout changes.
 *
 * Requires the submodule to be checked out and `prisma generate` to have run
 * (see package.json `postinstall`).
 */
const path = require("path");

const BACKEND_SRC = path.join(
  __dirname,
  "..",
  "vendor",
  "flashleague",
  "flashleague-backend",
  "src"
);

const prisma = require(path.join(BACKEND_SRC, "config/db"));
const logger = require(path.join(BACKEND_SRC, "config/logger"));
const matchService = require(path.join(BACKEND_SRC, "services/matchService"));
const eventsService = require(path.join(BACKEND_SRC, "services/eventsService"));
const managerPollService = require(path.join(BACKEND_SRC, "services/managerPollService"));
const dailyBonus = require(path.join(BACKEND_SRC, "utils/dailyBonus"));

module.exports = {
  prisma,
  logger,
  matchService,
  eventsService,
  managerPollService,
  dailyBonus,
};
