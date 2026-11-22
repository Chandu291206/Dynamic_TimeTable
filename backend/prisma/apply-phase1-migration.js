const prisma = require('../src/config/database');

const CANONICAL_PERIODS = [
  { periodNumber: 1, name: 'Period 1', startTime: '09:00', endTime: '09:50', isBreak: false, order: 1 },
  { periodNumber: 2, name: 'Period 2', startTime: '09:50', endTime: '10:40', isBreak: false, order: 2 },
  { periodNumber: 3, name: 'Period 3', startTime: '10:40', endTime: '11:30', isBreak: false, order: 3 },
  { periodNumber: 4, name: 'Period 4', startTime: '11:30', endTime: '12:20', isBreak: false, order: 4 },
  { periodNumber: null, name: 'Lunch Break', startTime: '12:20', endTime: '12:55', isBreak: true, order: 5 },
  { periodNumber: 5, name: 'Period 5', startTime: '12:55', endTime: '13:45', isBreak: false, order: 6 },
  { periodNumber: 6, name: 'Period 6', startTime: '13:45', endTime: '14:35', isBreak: false, order: 7 },
  { periodNumber: 7, name: 'Period 7', startTime: '14:35', endTime: '15:25', isBreak: false, order: 8 },
];

async function main() {
  console.log('=== SEEDING PERIODS AND POST-MIGRATION UPDATES ===\n');

  console.log('1. Flagging break subjects...');
  const lunchUpdate = await prisma.subject.updateMany({
    where: {
      OR: [
        { code: 'LUNCH' },
        { name: { equals: 'LUNCH', mode: 'insensitive' } },
      ],
    },
    data: {
      isBreak: true,
      code: 'LUNCH',
    },
  });
  console.log(`   Flagged ${lunchUpdate.count} break subject(s) with isBreak = true.`);

  console.log('2. Seeding canonical Period table...');
  for (const p of CANONICAL_PERIODS) {
    const existing = await prisma.period.findFirst({
      where: { order: p.order },
    });
    if (!existing) {
      await prisma.period.create({ data: p });
    } else {
      await prisma.period.update({
        where: { id: existing.id },
        data: p,
      });
    }
  }
  const periodCount = await prisma.period.count();
  console.log(`   Canonical periods verified (${periodCount} periods configured in DB).`);

  await prisma.timetableLog.create({
    data: {
      action: 'PHASE1_MIGRATION_APPLIED',
      performedBy: 'system/phase1',
      details: 'Applied Phase 1 schema: identity constraints, Period table, and Batch B faculty relations.',
    },
  });

  console.log('\n=== POST-MIGRATION SETUP COMPLETE ===');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Post-migration failed:', err);
  process.exit(1);
});
