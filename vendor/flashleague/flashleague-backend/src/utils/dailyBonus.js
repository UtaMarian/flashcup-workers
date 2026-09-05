/**
 * Daily-bonus economy helper.
 *
 * The cron job that actually grants the daily bonus now lives in the separate
 * `flashcup-workers` repo. This module keeps the pure payout formula in the
 * backend because the shop's "daily gift" endpoint
 * (players.controller.js -> dailyGiftState) needs to preview the amount.
 */

/** Daily cash grant scales with level; the token grant is flat for everyone. */
function dailyCashForLevel(level) {
  return 20 + level * 5;
}

module.exports = { dailyCashForLevel };
