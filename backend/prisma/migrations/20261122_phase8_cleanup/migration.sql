-- 1. Subject: Ensure all shortforms are merged into code, then drop shortform
UPDATE "Subject" SET "code" = "shortform" WHERE ("code" IS NULL OR "code" = '') AND "shortform" IS NOT NULL;
ALTER TABLE "Subject" DROP COLUMN IF EXISTS "shortform";

-- 2. Faculty: Drop phone and sourceUpdatedAt
ALTER TABLE "Faculty" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "Faculty" DROP COLUMN IF EXISTS "sourceUpdatedAt";

-- 3. TimetableSlot: Add startPeriodId, endPeriodId, room; backfill and drop periods
ALTER TABLE "TimetableSlot" ADD COLUMN IF NOT EXISTS "startPeriodId" INTEGER;
ALTER TABLE "TimetableSlot" ADD COLUMN IF NOT EXISTS "endPeriodId" INTEGER;
ALTER TABLE "TimetableSlot" ADD COLUMN IF NOT EXISTS "room" VARCHAR(50);

UPDATE "TimetableSlot" s
SET "startPeriodId" = p.id
FROM "Period" p
WHERE s."startTime" = p."startTime";

UPDATE "TimetableSlot" s
SET "endPeriodId" = p.id
FROM "Period" p
WHERE s."endTime" = p."endTime";

ALTER TABLE "TimetableSlot" DROP COLUMN IF EXISTS "periods";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_startPeriodId_fkey') THEN
        ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_startPeriodId_fkey" FOREIGN KEY ("startPeriodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_endPeriodId_fkey') THEN
        ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_endPeriodId_fkey" FOREIGN KEY ("endPeriodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. TimetableDraftSlot: Add startPeriodId, endPeriodId, room
ALTER TABLE "TimetableDraftSlot" ADD COLUMN IF NOT EXISTS "startPeriodId" INTEGER;
ALTER TABLE "TimetableDraftSlot" ADD COLUMN IF NOT EXISTS "endPeriodId" INTEGER;
ALTER TABLE "TimetableDraftSlot" ADD COLUMN IF NOT EXISTS "room" VARCHAR(50);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableDraftSlot_startPeriodId_fkey') THEN
        ALTER TABLE "TimetableDraftSlot" ADD CONSTRAINT "TimetableDraftSlot_startPeriodId_fkey" FOREIGN KEY ("startPeriodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableDraftSlot_endPeriodId_fkey') THEN
        ALTER TABLE "TimetableDraftSlot" ADD CONSTRAINT "TimetableDraftSlot_endPeriodId_fkey" FOREIGN KEY ("endPeriodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 5. TimetableOverride: Add room
ALTER TABLE "TimetableOverride" ADD COLUMN IF NOT EXISTS "room" VARCHAR(50);
