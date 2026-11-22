const prisma = require('../src/config/database');

async function main() {
  console.log('Applying Phase 8 cleanup migration statements individually...');

  // 1. Subject merge shortform into code
  await prisma.$executeRawUnsafe(`
    UPDATE "Subject" SET "code" = "shortform" WHERE ("code" IS NULL OR "code" = '') AND "shortform" IS NOT NULL;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Subject" DROP COLUMN IF EXISTS "shortform";
  `);
  console.log('1. Subject: merged and dropped shortform.');

  // 2. Faculty drop phone and sourceUpdatedAt
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Faculty" DROP COLUMN IF EXISTS "phone";
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Faculty" DROP COLUMN IF EXISTS "sourceUpdatedAt";
  `);
  console.log('2. Faculty: dropped phone and sourceUpdatedAt.');

  // 3. TimetableSlot
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TimetableSlot" ADD COLUMN IF NOT EXISTS "startPeriodId" INTEGER;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TimetableSlot" ADD COLUMN IF NOT EXISTS "endPeriodId" INTEGER;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TimetableSlot" ADD COLUMN IF NOT EXISTS "room" VARCHAR(50);
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "TimetableSlot" s
    SET "startPeriodId" = p.id
    FROM "Period" p
    WHERE s."startTime" = p."startTime";
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "TimetableSlot" s
    SET "endPeriodId" = p.id
    FROM "Period" p
    WHERE s."endTime" = p."endTime";
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TimetableSlot" DROP COLUMN IF EXISTS "periods";
  `);
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_startPeriodId_fkey') THEN
            ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_startPeriodId_fkey" FOREIGN KEY ("startPeriodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_endPeriodId_fkey') THEN
            ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_endPeriodId_fkey" FOREIGN KEY ("endPeriodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END $$;
  `);
  console.log('3. TimetableSlot: added startPeriodId, endPeriodId, room; backfilled from Period; dropped periods.');

  // 4. TimetableDraftSlot
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TimetableDraftSlot" ADD COLUMN IF NOT EXISTS "startPeriodId" INTEGER;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TimetableDraftSlot" ADD COLUMN IF NOT EXISTS "endPeriodId" INTEGER;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TimetableDraftSlot" ADD COLUMN IF NOT EXISTS "room" VARCHAR(50);
  `);
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableDraftSlot_startPeriodId_fkey') THEN
            ALTER TABLE "TimetableDraftSlot" ADD CONSTRAINT "TimetableDraftSlot_startPeriodId_fkey" FOREIGN KEY ("startPeriodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableDraftSlot_endPeriodId_fkey') THEN
            ALTER TABLE "TimetableDraftSlot" ADD CONSTRAINT "TimetableDraftSlot_endPeriodId_fkey" FOREIGN KEY ("endPeriodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END $$;
  `);
  console.log('4. TimetableDraftSlot: added startPeriodId, endPeriodId, room with foreign keys.');

  // 5. TimetableOverride
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TimetableOverride" ADD COLUMN IF NOT EXISTS "room" VARCHAR(50);
  `);
  console.log('5. TimetableOverride: added room.');

  console.log('\nPhase 8 database migration successfully executed!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Phase 8 migration failed:', err);
  process.exit(1);
});
