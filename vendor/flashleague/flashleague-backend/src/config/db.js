const { PrismaClient } = require("@prisma/client");

// A single shared Prisma instance, reused across the app (recommended
// pattern to avoid exhausting DB connections in dev with hot reloads).
const prisma = new PrismaClient();

module.exports = prisma;
