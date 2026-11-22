const prisma = require('../src/config/database');

async function main() {
  console.log('Applying Phase 5 migration statements individually...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TimetableDraft" (
        "id" SERIAL NOT NULL,
        "classId" INTEGER NOT NULL,
        "name" VARCHAR(120),
        "version" INTEGER NOT NULL DEFAULT 1,
        "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        "createdById" INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "TimetableDraft_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TimetableDraftSlot" (
        "id" SERIAL NOT NULL,
        "draftId" INTEGER NOT NULL,
        "day" INTEGER NOT NULL,
        "startTime" CHAR(5) NOT NULL,
        "endTime" CHAR(5) NOT NULL,
        "subjectId" INTEGER,
        "facultyId" INTEGER,
        "batchBFacultyId" INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "TimetableDraftSlot_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "TimetableDraft_classId_idx" ON "TimetableDraft"("classId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "TimetableDraft_status_idx" ON "TimetableDraft"("status");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "TimetableDraft_one_open_per_class" ON "TimetableDraft"("classId") WHERE status = 'OPEN';
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "TimetableDraftSlot_draftId_day_idx" ON "TimetableDraftSlot"("draftId", "day");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "TimetableDraftSlot_draftId_day_startTime_key" ON "TimetableDraftSlot"("draftId", "day", "startTime");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableDraft_classId_fkey') THEN
            ALTER TABLE "TimetableDraft" ADD CONSTRAINT "TimetableDraft_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableDraft_createdById_fkey') THEN
            ALTER TABLE "TimetableDraft" ADD CONSTRAINT "TimetableDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableDraftSlot_draftId_fkey') THEN
            ALTER TABLE "TimetableDraftSlot" ADD CONSTRAINT "TimetableDraftSlot_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TimetableDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableDraftSlot_subjectId_fkey') THEN
            ALTER TABLE "TimetableDraftSlot" ADD CONSTRAINT "TimetableDraftSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableDraftSlot_facultyId_fkey') THEN
            ALTER TABLE "TimetableDraftSlot" ADD CONSTRAINT "TimetableDraftSlot_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableDraftSlot_batchBFacultyId_fkey') THEN
            ALTER TABLE "TimetableDraftSlot" ADD CONSTRAINT "TimetableDraftSlot_batchBFacultyId_fkey" FOREIGN KEY ("batchBFacultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
    END $$;
  `);

  console.log('Phase 5 migration executed successfully!');

  const draftTable = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables WHERE table_name IN ('TimetableDraft', 'TimetableDraftSlot');
  `);
  console.log('Verified tables:', draftTable);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
