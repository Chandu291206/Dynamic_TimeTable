const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../src/config/database');
const { getLiveClashesReport } = require('../src/services/clash.service');
const { timesOverlap } = require('../src/utils/time');

async function verifyIntegrity() {
  console.log('================================================================');
  console.log('       TIMETABLE DATABASE COMPREHENSIVE INTEGRITY VERIFICATION  ');
  console.log('================================================================\n');

  let violations = 0;

  // 1. Check Faculty Staff ID non-nullability and uniqueness
  console.log('[1/8] Checking Faculty staffId integrity...');
  const nullStaffIds = await prisma.$queryRawUnsafe(`
    SELECT count(*)::int as count FROM "Faculty" WHERE "staffId" IS NULL OR trim("staffId") = '';
  `);
  if (nullStaffIds[0].count > 0) {
    console.error(`  FAIL: Found ${nullStaffIds[0].count} faculty with NULL or empty staffId.`);
    violations++;
  } else {
    console.log('  PASS: Zero null or empty staffIds found across all faculty.');
  }

  const dupStaffIds = await prisma.$queryRawUnsafe(`
    SELECT "staffId", count(*)::int as count FROM "Faculty" GROUP BY "staffId" HAVING count(*) > 1;
  `);
  if (dupStaffIds.length > 0) {
    console.error(`  FAIL: Found duplicate staffIds: ${JSON.stringify(dupStaffIds)}`);
    violations++;
  } else {
    console.log('  PASS: All faculty staffIds are strictly unique.');
  }

  // 2. Check Subject code uniqueness
  console.log('\n[2/8] Checking Subject code uniqueness...');
  const dupSubjectCodes = await prisma.$queryRawUnsafe(`
    SELECT "code", count(*)::int as count FROM "Subject" GROUP BY "code" HAVING count(*) > 1;
  `);
  if (dupSubjectCodes.length > 0) {
    console.error(`  FAIL: Found duplicate subject codes: ${JSON.stringify(dupSubjectCodes)}`);
    violations++;
  } else {
    console.log('  PASS: All subject codes are strictly unique.');
  }

  // 3. Check ClassRoom composite key uniqueness
  console.log('\n[3/8] Checking ClassRoom (year, branch, section, academicYear) uniqueness...');
  const dupClasses = await prisma.$queryRawUnsafe(`
    SELECT year, branch, section, "academicYear", count(*)::int as count
    FROM "ClassRoom"
    GROUP BY year, branch, section, "academicYear"
    HAVING count(*) > 1;
  `);
  if (dupClasses.length > 0) {
    console.error(`  FAIL: Found duplicate classes: ${JSON.stringify(dupClasses)}`);
    violations++;
  } else {
    console.log('  PASS: All class room 4-tuples are strictly unique.');
  }

  // 4. Check Orphan Foreign Keys
  console.log('\n[4/8] Checking for orphan foreign keys...');
  const orphanSlotClass = await prisma.$queryRawUnsafe(`
    SELECT count(*)::int as count FROM "TimetableSlot" s LEFT JOIN "ClassRoom" c ON s."classId" = c.id WHERE c.id IS NULL;
  `);
  const orphanSlotSubject = await prisma.$queryRawUnsafe(`
    SELECT count(*)::int as count FROM "TimetableSlot" s LEFT JOIN "Subject" sub ON s."subjectId" = sub.id WHERE s."subjectId" IS NOT NULL AND sub.id IS NULL;
  `);
  const orphanSlotFaculty = await prisma.$queryRawUnsafe(`
    SELECT count(*)::int as count FROM "TimetableSlot" s LEFT JOIN "Faculty" f ON s."facultyId" = f.id WHERE s."facultyId" IS NOT NULL AND f.id IS NULL;
  `);
  const totalOrphans = orphanSlotClass[0].count + orphanSlotSubject[0].count + orphanSlotFaculty[0].count;
  if (totalOrphans > 0) {
    console.error(`  FAIL: Found ${totalOrphans} orphan foreign key reference(s) in TimetableSlot.`);
    violations++;
  } else {
    console.log('  PASS: Zero orphan foreign key references.');
  }

  // 5. Check PostgreSQL CHECK Constraints
  console.log('\n[5/8] Verifying database CHECK constraints...');
  const constraints = await prisma.$queryRawUnsafe(`
    SELECT conname FROM pg_constraint WHERE conrelid = '"TimetableSlot"'::regclass AND contype = 'c';
  `);
  const constraintNames = constraints.map((c) => c.conname);
  const requiredConstraints = [
    'TimetableSlot_day_check',
    'TimetableSlot_time_order_check',
    'TimetableSlot_startTime_format_check',
    'TimetableSlot_endTime_format_check',
  ];
  let missingConstraints = 0;
  for (const req of requiredConstraints) {
    if (!constraintNames.includes(req)) {
      console.error(`  FAIL: Missing constraint ${req}`);
      missingConstraints++;
      violations++;
    }
  }
  if (missingConstraints === 0) {
    console.log(`  PASS: All ${requiredConstraints.length} required database CHECK constraints are active.`);
  }

  // 6. Check Override alignment with slots
  console.log('\n[6/8] Checking timetable overrides overlap alignment...');
  const allOverrides = await prisma.timetableOverride.findMany();
  const allSlots = await prisma.timetableSlot.findMany();

  let unalignedOverrides = 0;
  for (const override of allOverrides) {
    const overrideDay = override.date.getUTCDay() === 0 ? 6 : override.date.getUTCDay() - 1;
    const matchingSlots = allSlots.filter((s) => s.classId === override.classId && s.day === overrideDay);
    const overlaps = matchingSlots.some((s) => timesOverlap(override, s));
    if (!overlaps) {
      unalignedOverrides++;
    }
  }
  if (unalignedOverrides > 0) {
    console.log(`  INFO: ${unalignedOverrides} historical override(s) do not overlap recurring timetable slots.`);
  } else {
    console.log('  PASS: All overrides overlap valid timetable slots.');
  }

  // 7. Live Timetable Clashes Report
  console.log('\n[7/8] Running live timetable clash detection across all classes...');
  const clashReport = await getLiveClashesReport();
  console.log(`  Total Live Clashes: ${clashReport.totalClashes}`);
  if (clashReport.totalClashes > 0) {
    console.log('  Existing historical clashes in published data:');
    for (const c of clashReport.clashes) {
      console.log(`   - [${c.type}] Day ${c.day} (${c.startTime}–${c.endTime}): ${c.message}`);
    }
  } else {
    console.log('  PASS: Zero clashes detected in live published timetables.');
  }

  // 8. Verify Phase 8 dropped columns and period foreign keys
  console.log('\n[8/8] Verifying Phase 8 column cleanup & period foreign keys...');
  const droppedColumns = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'Faculty' AND column_name IN ('phone', 'sourceUpdatedAt')) OR
        (table_name = 'Subject' AND column_name = 'shortform') OR
        (table_name = 'TimetableSlot' AND column_name = 'periods')
      );
  `);

  if (droppedColumns.length > 0) {
    console.error(`  FAIL: Found unexpected obsolete columns still in database: ${JSON.stringify(droppedColumns)}`);
    violations++;
  } else {
    console.log('  PASS: Obsolete columns (phone, sourceUpdatedAt, shortform, periods) confirmed dropped.');
  }

  const periodRows = await prisma.period.count();
  console.log(`  INFO: Active periods configured: ${periodRows}`);

  console.log('\n================================================================');
  if (violations === 0) {
    console.log('   INTEGRITY STATUS: HEALTHY (All schema & identity rules pass)');
  } else {
    console.error(`   INTEGRITY STATUS: ${violations} VIOLATION(S) DETECTED`);
  }
  console.log('================================================================\n');

  await prisma.$disconnect();
  if (violations > 0) process.exit(1);
}

verifyIntegrity().catch((err) => {
  console.error('Integrity check crashed:', err);
  process.exit(1);
});
