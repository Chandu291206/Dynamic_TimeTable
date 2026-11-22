-- Drop obsolete indexes
DROP INDEX IF EXISTS "ClassRoom_year_branch_section_key";
DROP INDEX IF EXISTS "Subject_name_key";
DROP INDEX IF EXISTS "TimetableSlot_classId_day_startTime_endTime_key";

-- Alter ClassRoom table
ALTER TABLE "ClassRoom" 
  ALTER COLUMN "academicYear" SET NOT NULL,
  ALTER COLUMN "academicYear" SET DEFAULT '2026-27';

-- Alter Faculty table
ALTER TABLE "Faculty" 
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ALTER COLUMN "staffId" SET NOT NULL;

-- Alter Subject table
ALTER TABLE "Subject" 
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "isBreak" BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "code" SET NOT NULL;

-- Alter TimetableOverride & TimetableSlot for Batch B lab support
ALTER TABLE "TimetableOverride" 
  ADD COLUMN IF NOT EXISTS "batchBFacultyId" INTEGER;

ALTER TABLE "TimetableSlot" 
  ADD COLUMN IF NOT EXISTS "batchBFacultyId" INTEGER;

-- Create Period table
CREATE TABLE IF NOT EXISTS "Period" (
    "id" SERIAL NOT NULL,
    "periodNumber" INTEGER,
    "name" VARCHAR(50) NOT NULL,
    "startTime" CHAR(5) NOT NULL,
    "endTime" CHAR(5) NOT NULL,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- Indexes & Unique Constraints
CREATE INDEX IF NOT EXISTS "Period_order_idx" ON "Period"("order");
CREATE UNIQUE INDEX IF NOT EXISTS "ClassRoom_year_branch_section_academicYear_key" ON "ClassRoom"("year", "branch", "section", "academicYear");
CREATE INDEX IF NOT EXISTS "Faculty_name_idx" ON "Faculty"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Subject_code_key" ON "Subject"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "TimetableSlot_classId_day_startTime_key" ON "TimetableSlot"("classId", "day", "startTime");

-- Foreign Keys for Batch B Faculty
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_batchBFacultyId_fkey'
  ) THEN
    ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_batchBFacultyId_fkey" 
      FOREIGN KEY ("batchBFacultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TimetableOverride_batchBFacultyId_fkey'
  ) THEN
    ALTER TABLE "TimetableOverride" ADD CONSTRAINT "TimetableOverride_batchBFacultyId_fkey" 
      FOREIGN KEY ("batchBFacultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Check Constraints for TimetableSlot
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_day_check') THEN
    ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_day_check" CHECK ("day" BETWEEN 0 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_startTime_format_check') THEN
    ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_startTime_format_check" CHECK ("startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_endTime_format_check') THEN
    ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_endTime_format_check" CHECK ("endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_time_order_check') THEN
    ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_time_order_check" CHECK ("startTime" < "endTime");
  END IF;
END $$;

-- Check Constraints for TimetableOverride
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableOverride_startTime_format_check') THEN
    ALTER TABLE "TimetableOverride" ADD CONSTRAINT "TimetableOverride_startTime_format_check" CHECK ("startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableOverride_endTime_format_check') THEN
    ALTER TABLE "TimetableOverride" ADD CONSTRAINT "TimetableOverride_endTime_format_check" CHECK ("endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableOverride_time_order_check') THEN
    ALTER TABLE "TimetableOverride" ADD CONSTRAINT "TimetableOverride_time_order_check" CHECK ("startTime" < "endTime");
  END IF;
END $$;
