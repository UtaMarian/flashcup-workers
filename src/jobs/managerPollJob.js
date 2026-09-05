const cron = require("node-cron");
const { logger, managerPollService } = require("../shared");

const { resolveDuePolls } = managerPollService;

/**
 * Runs every minute: closes any manager-election poll whose 24h window has
 * elapsed and applies its result (see managerPollService.resolvePoll).
 */
function startManagerPollJob() {
  cron.schedule("* * * * *", async () => {
    try {
      const n = await resolveDuePolls();
      if (n) logger.info({ count: n }, "[manager-poll] Sondaje încheiate");
    } catch (err) {
      logger.error({ err }, "[manager-poll] Eroare");
    }
  });
  logger.info("[manager-poll] Pornit — verifică sondajele de manager în fiecare minut.");
}

module.exports = { startManagerPollJob };
