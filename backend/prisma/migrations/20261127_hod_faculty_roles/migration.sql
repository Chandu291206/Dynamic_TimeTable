-- Add HOD and FACULTY to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'HOD';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FACULTY';

-- Add facultyId column and foreign key to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "facultyId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_facultyId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_facultyId_fkey"
      FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "User_facultyId_idx" ON "User"("facultyId");
