const cron = require("node-cron");
const { prisma, dailyBonus } = require("../shared");

// Payout formula lives in the backend (the shop previews the amount); reuse
// it here so the two never drift.
const { dailyCashForLevel } = dailyBonus;

const DAY_MS = 24 * 60 * 60 * 1000;

async function grantDailyBonuses() {
  const now = new Date();
  const due = await prisma.user.findMany({
    where: { lastDailyBonusAt: { lte: new Date(now.getTime() - DAY_MS) } },
    select: { id: true, level: true, cash: true, tokens: true },
  });

  for (const u of due) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        cash: u.cash + dailyCashForLevel(u.level),
        tokens: u.tokens + 1,
        lastDailyBonusAt: now,
      },
    });
  }
}

// NOTE: not wired into src/worker.js — the daily gift is currently claimed
// manually from the in-app shop. Kept here so re-enabling it is a one-liner.
function startDailyBonusJob() {
  cron.schedule("*/15 * * * *", async () => {
    try {
      await grantDailyBonuses();
    } catch (err) {
      console.error("[daily-bonus] Eroare:", err);
    }
  });

  console.log("[daily-bonus] Pornit — acordă bonusul zilnic (cash + 1 token) la fiecare 24h per jucător.");
}

module.exports = { startDailyBonusJob, grantDailyBonuses };
