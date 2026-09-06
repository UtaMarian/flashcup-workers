-- AlterTable: manual daily-gift claim + one-time Starter Pack purchase
ALTER TABLE "User" ADD COLUMN "lastDailyGiftAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "starterPackClaimedAt" DATETIME;
