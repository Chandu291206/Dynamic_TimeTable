const prisma = require('../backend/src/config/database');

async function verifyPhase1() {
  console.log('--- Verifying Phase 1 Database & Constraints ---');

  // 1. Period Table
  const periods = await prisma.period.findMany({ orderBy: { order: 'asc' } });
  console.log(`Periods in DB: ${periods.length}`);
  for (const p of periods) {
    console.log(`  Period ${p.periodNumber || 'B'}: ${p.name} (${p.startTime}-${p.endTime}) isBreak=${p.isBreak}`);
  }

  // 2. Faculty staffId uniqueness & non-nullability
  const facultyCount = await prisma.faculty.count();
  const [{ count: nullStaff }] = await prisma.$queryRaw`SELECT COUNT(*) FROM "Faculty" WHERE "staffId" IS NULL;`;
  console.log(`Total Faculty: ${facultyCount}, Null Staff IDs: ${nullStaff}`);

  // 3. Subject codes & breaks
  const subjectCount = await prisma.subject.count();
  const [{ count: nullCodes }] = await prisma.$queryRaw`SELECT COUNT(*) FROM "Subject" WHERE "code" IS NULL;`;
  const breaks = await prisma.subject.findMany({ where: { isBreak: true } });
  console.log(`Total Subjects: ${subjectCount}, Null Codes: ${nullCodes}, Break subjects: ${breaks.map(b => b.code).join(', ')}`);

  // 4. ClassRoom uniqueness
  const classes = await prisma.classRoom.findMany();
  console.log(`Total Classes: ${classes.length}, All have academicYear: ${classes.every(c => Boolean(c.academicYear))}`);

  // 5. TimetableSlot check constraints in PostgreSQL
  const checkConstraints = await prisma.$queryRaw`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = '"TimetableSlot"'::regclass AND contype = 'c';
  `;
  console.log('TimetableSlot Check Constraints in PostgreSQL:');
  for (const c of checkConstraints) {
    console.log(`  - ${c.conname}: ${c.pg_get_constraintdef}`);
  }

  // 6. Check unique constraints on tables
  const uniqueIndexes = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename IN ('Faculty', 'Subject', 'ClassRoom', 'TimetableSlot', 'Period');
  `;
  console.log('Unique Constraints / Indexes:');
  for (const idx of uniqueIndexes) {
    console.log(`  - ${idx.indexname}`);
  }
}

verifyPhase1()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
