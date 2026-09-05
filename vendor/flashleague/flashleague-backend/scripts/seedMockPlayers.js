// One-off maintenance script — NOT run automatically on startup.
// Adds exactly 11 synthetic "bot" players (isBot: true) to every Team that
// doesn't already have any, so every team can immediately build a complete
// Prim 11. Positions cycle through the 4-4-2 template so a freshly-seeded
// team's default lineup has zero out-of-position warnings out of the box.
// Safe to re-run: teams that already have bot players are skipped.
//
// Usage: node scripts/seedMockPlayers.js   (or `npm run seed:mock-players`)
const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../src/utils/password");
const { cumulativeXpForLevel } = require("../src/utils/xp");
const { FORMATIONS } = require("../src/utils/formations");

const prisma = new PrismaClient();

const POSITION_TEMPLATE = FORMATIONS["4-4-2"]; // ["GK","LB","DC","DC","RB","ML","MC","MC","MR","ST","ST"]

const FIRST_NAMES = [
  "Andrei", "Mihai", "Alexandru", "Cristian", "Florin", "Gabriel", "Ionuț", "Radu",
  "Ștefan", "Bogdan", "Cătălin", "Marius", "Vlad", "Daniel", "Adrian", "Sorin",
  "Constantin", "Nicolae", "Petru", "Victor",
];
const LAST_NAMES = [
  "Popescu", "Ionescu", "Popa", "Stoica", "Dumitrescu", "Gheorghe", "Marin", "Ciobanu",
  "Constantinescu", "Rusu", "Munteanu", "Matei", "Dobre", "Nistor", "Barbu", "Florea",
  "Toma", "Voicu", "Diaconu", "Neagu",
];

function randomName() {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return { first, last };
}

function randomAttr() {
  return 20 + Math.floor(Math.random() * 51); // 20-70
}

async function seedTeam(team, index) {
  const password = await hashPassword(`Bot!${team.id.slice(-6)}${Math.random().toString(36).slice(2, 8)}`);

  for (let i = 0; i < POSITION_TEMPLATE.length; i++) {
    const { first, last } = randomName();
    const level = 1 + Math.floor(Math.random() * 30); // 1-30
    const totalXp = cumulativeXpForLevel(level);

    const user = await prisma.user.create({
      data: {
        email: `bot_${team.id.slice(-8)}_${i}@flashleague.bot`,
        passwordHash: password,
        firstName: first,
        lastName: last,
        role: "PLAYER",
        position: POSITION_TEMPLATE[i],
        teamId: team.id,
        isBot: true,
        level,
        xp: totalXp,
        attrSpeed: randomAttr(),
        attrTechnique: randomAttr(),
        attrPassing: randomAttr(),
        attrPhysical: randomAttr(),
        attrDefense: randomAttr(),
        attrAttack: randomAttr(),
      },
    });

    await prisma.teamHistory.create({
      data: { userId: user.id, teamId: team.id, reason: "JOINED" },
    });
  }

  console.log(`✔ [${index}] ${team.name}: adăugați 11 jucători mockup.`);
}

async function main() {
  const teams = await prisma.team.findMany({ select: { id: true, name: true } });
  let seeded = 0;

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const existingBots = await prisma.user.count({ where: { teamId: team.id, isBot: true } });
    if (existingBots > 0) {
      console.log(`• [${i}] ${team.name}: are deja ${existingBots} jucători mockup — sărit.`);
      continue;
    }
    await seedTeam(team, i);
    seeded++;
  }

  console.log(`\nGata. Echipe completate: ${seeded}/${teams.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
