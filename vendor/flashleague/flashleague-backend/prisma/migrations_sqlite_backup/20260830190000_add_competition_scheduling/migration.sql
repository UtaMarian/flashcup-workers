-- AlterTable: Supercup prize tiers + configurable competition fixture timing
ALTER TABLE "GameSettings" ADD COLUMN "nationalSupercupWinnerTeamPrize" INTEGER NOT NULL DEFAULT 30000;
ALTER TABLE "GameSettings" ADD COLUMN "nationalSupercupWinnerPlayerBonus" INTEGER NOT NULL DEFAULT 300;
ALTER TABLE "GameSettings" ADD COLUMN "internationalSupercupWinnerTeamPrize" INTEGER NOT NULL DEFAULT 50000;
ALTER TABLE "GameSettings" ADD COLUMN "internationalSupercupWinnerPlayerBonus" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "GameSettings" ADD COLUMN "supercupDay" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "GameSettings" ADD COLUMN "nationalCupStartRound" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "GameSettings" ADD COLUMN "continentalCupStartRound" INTEGER NOT NULL DEFAULT 13;
