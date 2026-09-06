-- AlterTable: one-time onboarding tutorial + one-time "elected manager" notice
ALTER TABLE "User" ADD COLUMN "tutorialSeenAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "managerElectedAt" DATETIME;
