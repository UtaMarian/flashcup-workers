const cron = require("node-cron");
const { prisma, logger, eventsService } = require("../shared");

const { getActiveEvent } = eventsService;

const REGEN_INTERVAL_MS = 5 * 60 * 1000; // +1 energy every 5 minutes (default)
const CONCURRENCY = 25; // cap parallel DB writes per tick

/**
 * Regenerates energy for every user, +1 per 5-minute tick elapsed since
 * their lastEnergyRegenAt, capped at 100. Users already at 100 just have
 * their timer reset to now, so idle time at the cap isn't "banked" for an
 * instant refill the moment they spend energy again.
 */
async function regenerateEnergy() {
  const now = new Date();

  // A live FAST_ENERGY_REGEN event shortens the per-tick interval.
  const fastRegen = await getActiveEvent("FAST_ENERGY_REGEN");
  const interval = Math.max(10000, fastRegen?.config?.intervalMs || REGEN_INTERVAL_MS);

  const users = await prisma.user.findMany({ select: { id: true, energy: true, lastEnergyRegenAt: true } });

  // Same per-user logic as before; the writes just run concurrently (in
  // capped batches) instead of one-at-a-time, so this job keeps up with a
  // growing user base within its one-minute cron window.
  const updates = [];
  for (const u of users) {
    if (u.energy >= 100) {
      if (now - new Date(u.lastEnergyRegenAt) > interval) {
        updates.push(() => prisma.user.update({ where: { id: u.id }, data: { lastEnergyRegenAt: now } }));
      }
      continue;
    }

    const elapsed = now - new Date(u.lastEnergyRegenAt);
    const ticks = Math.floor(elapsed / interval);
    if (ticks < 1) continue;

    updates.push(() =>
      prisma.user.update({
        where: { id: u.id },
        data: {
          energy: Math.min(100, u.energy + ticks),
          lastEnergyRegenAt: new Date(new Date(u.lastEnergyRegenAt).getTime() + ticks * interval),
        },
      })
    );
  }

  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    await Promise.all(updates.slice(i, i + CONCURRENCY).map((run) => run()));
  }
}

function startEnergyRegenJob() {
  cron.schedule("* * * * *", async () => {
    try {
      await regenerateEnergy();
    } catch (err) {
      logger.error({ err }, "[energy-regen] Eroare");
    }
  });

  logger.info("[energy-regen] Pornit — regenerează +1 energie la fiecare 5 minute.");
}

module.exports = { startEnergyRegenJob };
