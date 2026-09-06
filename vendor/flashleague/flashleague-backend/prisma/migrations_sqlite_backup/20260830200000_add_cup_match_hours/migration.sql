-- AlterTable: editable kickoff-hour window for cup/supercup knockout matches
ALTER TABLE "GameSettings" ADD COLUMN "cupMatchDayStartHour" INTEGER NOT NULL DEFAULT 18;
ALTER TABLE "GameSettings" ADD COLUMN "cupMatchDayEndHour" INTEGER NOT NULL DEFAULT 22;
