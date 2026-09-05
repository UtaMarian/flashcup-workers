const cron = require("node-cron");
const { logger, matchService } = require("../shared");

const { simulateDueMatches } = matchService;

/**
 * Runs every minute: finds every SCHEDULED match whose scheduledAt is in
 * the past and simulates it. This is what turns the fixture list generated
 * by POST /api/leagues/:id/start into actual results automatically, without
 * any manual admin action.
 */
function startMatchScheduler() {
  cron.schedule("* * * * *", async () => {
    try {
      const played = await simulateDueMatches();
      if (played.length) {
        logger.info({ count: played.length }, "[match-scheduler] Meciuri simulate");
      }
    } catch (err) {
      logger.error({ err }, "[match-scheduler] Eroare");
    }
  });

  logger.info("[match-scheduler] Pornit — verifică meciurile programate în fiecare minut.");
}

module.exports = { startMatchScheduler };
