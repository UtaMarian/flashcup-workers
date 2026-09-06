-- AlterTable: per-page one-time "coach tip" dismissals
ALTER TABLE "User" ADD COLUMN "pageTipsSeenJson" TEXT NOT NULL DEFAULT '[]';
