CREATE TABLE "FacultySyncRun" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "FacultySyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FacultySyncRun_startedAt_idx" ON "FacultySyncRun"("startedAt");
