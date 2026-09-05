/** Flat cash stake per prediction, scaled by level. Kept in sync with frontend/src/ui.jsx. */
function betAmountForLevel(level) {
  return Math.max(1, level) * 10;
}

/** Cash payout for a correctly guessed prediction — collected via POST /:id/collect. */
function payoutForStake(stake) {
  return stake * 2;
}

/** Truncates a date to local midnight — the boundary used to group matches into a "day". */
function truncateToDay(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

module.exports = { betAmountForLevel, payoutForStake, truncateToDay };
