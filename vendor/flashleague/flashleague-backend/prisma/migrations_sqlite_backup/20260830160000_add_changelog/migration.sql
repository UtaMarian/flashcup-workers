-- CreateTable
CREATE TABLE "ChangelogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "releaseDate" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortKey" INTEGER NOT NULL DEFAULT 0,
    "translations" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ChangelogEntry_version_key" ON "ChangelogEntry"("version");

-- CreateIndex
CREATE INDEX "ChangelogEntry_published_sortKey_idx" ON "ChangelogEntry"("published", "sortKey");
