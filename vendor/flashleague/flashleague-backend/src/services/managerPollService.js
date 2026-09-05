const prisma = require("../config/db");

const POLL_DURATION_MS = 24 * 60 * 60 * 1000;
const PASS_RATIO = 0.51;

function fail(message, status = 409) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function pct(yes, no) {
  const total = yes + no;
  return total === 0 ? 0 : Math.round((yes / total) * 100);
}

/**
 * Resolve one poll if it is OPEN and past `closesAt`. Idempotent — safe to
 * call from both the cron job and a lazy read. When YES / (YES + NO) >= 51%
 * (and the candidate is still a non-bot squad member) the candidate is made
 * MANAGER and every current MANAGER of that team is demoted to PLAYER.
 */
async function resolvePoll(pollId) {
  const poll = await prisma.managerPoll.findUnique({ where: { id: pollId }, include: { votes: true, candidate: true } });
  if (!poll || poll.status !== "OPEN") return poll;
  if (Date.now() < new Date(poll.closesAt).getTime()) return poll;

  const yes = poll.votes.filter(v => v.choice === "YES").length;
  const no = poll.votes.filter(v => v.choice === "NO").length;
  const candidateOk = poll.candidate.teamId === poll.teamId && !poll.candidate.isBot;
  const passed = candidateOk && (yes + no) > 0 && yes / (yes + no) >= PASS_RATIO;
  const now = new Date();
  const candidateName = `${poll.candidate.firstName} ${poll.candidate.lastName}`;

  if (passed) {
    await prisma.$transaction([
      prisma.user.updateMany({ where: { teamId: poll.teamId, role: "MANAGER" }, data: { role: "PLAYER" } }),
      // Flag the new manager so the app can show them a one-time notice on
      // their next visit that the poll passed and they now run the team.
      prisma.user.update({ where: { id: poll.candidateId }, data: { role: "MANAGER", managerElectedAt: now } }),
      prisma.managerPoll.update({ where: { id: poll.id }, data: { status: "PASSED", resolvedAt: now } }),
      prisma.post.create({
        data: {
          teamId: poll.teamId,
          authorId: poll.startedById,
          type: "TEXT",
          text: `Sondaj încheiat — ${candidateName} este noul manager al echipei (${pct(yes, no)}% DA).`,
        },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.managerPoll.update({ where: { id: poll.id }, data: { status: "FAILED", resolvedAt: now } }),
      prisma.post.create({
        data: {
          teamId: poll.teamId,
          authorId: poll.startedById,
          type: "TEXT",
          text: `Sondajul pentru ${candidateName} ca manager nu a trecut (${pct(yes, no)}% DA).`,
        },
      }),
    ]);
  }
  return prisma.managerPoll.findUnique({ where: { id: poll.id } });
}

async function resolveDuePolls() {
  const due = await prisma.managerPoll.findMany({
    where: { status: "OPEN", closesAt: { lte: new Date() } },
    select: { id: true },
  });
  for (const p of due) {
    try { await resolvePoll(p.id); } catch (err) { console.error("[manager-poll] resolve error:", err); }
  }
  return due.length;
}

module.exports = { resolvePoll, resolveDuePolls, POLL_DURATION_MS, PASS_RATIO, pct };
