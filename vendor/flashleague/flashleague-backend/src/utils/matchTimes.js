/**
 * Given a calendar day and a count of matches to schedule that day, spreads
 * kickoff times evenly across the [startHour, endHour] window (default
 * 16:00–22:00), so matches don't collide and the whole day's card is used.
 *
 * Returns an array of Date objects, one per match, in the same order.
 */
function generateKickoffTimes(day, matchCount, { startHour = 16, endHour = 22 } = {}) {
  const times = [];
  const windowMinutes = (endHour - startHour) * 60;

  if (matchCount <= 1) {
    const mid = new Date(day);
    mid.setHours(startHour, 0, 0, 0);
    times.push(mid);
    return times;
  }

  const step = windowMinutes / matchCount;

  for (let i = 0; i < matchCount; i++) {
    const minutesFromStart = Math.round(i * step);
    const t = new Date(day);
    t.setHours(startHour, 0, 0, 0);
    t.setMinutes(t.getMinutes() + minutesFromStart);
    times.push(t);
  }

  return times;
}

/** Adds `days` calendar days to a date, returning a new Date at midnight local time. */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

module.exports = { generateKickoffTimes, addDays };
