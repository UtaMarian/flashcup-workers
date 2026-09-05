const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// Fallbacks are an obvious placeholder, not a real credential — set
// ADMIN_EMAIL/ADMIN_PASSWORD in .env for any environment that isn't a
// disposable local test DB.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-strong-password";

async function main() {
  // 1) Required admin account.
  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL.toLowerCase() } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL.toLowerCase(),
        passwordHash,
        firstName: "Administrator",
        lastName: "Flash Cup",
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✔ Cont admin creat: ${ADMIN_EMAIL}`);
  } else {
    console.log(`• Cont admin deja există: ${ADMIN_EMAIL}`);
  }

  // 2) Starter league ("Liga 1") + a handful of teams, so the app isn't
  //    empty on first run. Admin can create more leagues/teams from the panel.
  let liga1 = await prisma.league.findFirst({ where: { name: "Liga 1", type: "LIGA" } });
  if (!liga1) {
    liga1 = await prisma.league.create({
      data: {
        name: "Liga 1",
        type: "LIGA",
        season: "2026/27",
        status: "DRAFT",
        matchDayStartHour: 16,
        matchDayEndHour: 22,
        qualifyChampionsSlots: 2,
        qualifyInternationalSlots: 2,
      },
    });
    console.log("✔ Ligă creată: Liga 1 (DRAFT)");
  }

  const starterTeams = [
    { name: "FC Carpați", city: "Cluj-Napoca", colorHex: "#1F6F4A" },
    { name: "Oțelul Argint", city: "Galați", colorHex: "#3A5A8C" },
    { name: "Stejarul FC", city: "Brașov", colorHex: "#8C3A3A" },
    { name: "Dunărea United", city: "Constanța", colorHex: "#B08A2E" },
  ];

  for (const t of starterTeams) {
    const exists = await prisma.team.findFirst({ where: { name: t.name } });
    if (!exists) {
      await prisma.team.create({ data: { ...t, leagueId: liga1.id } });
      console.log(`✔ Echipă creată: ${t.name}`);
    }
  }

  console.log("\nSeed finalizat.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
