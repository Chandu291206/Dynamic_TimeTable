const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { PrismaClient, UserRole } = require('@prisma/client');
const { importTimetableJson } = require('../src/services/timetable-json.service');

const prisma = new PrismaClient();

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

async function seedPeriods(db) {
  for (const p of CANONICAL_PERIODS) {
    const existing = await db.period.findFirst({ where: { order: p.order } });
    if (!existing) {
      await db.period.create({ data: p });
    } else {
      await db.period.update({ where: { id: existing.id }, data: p });
    }
  }
}

async function main() {
  await seedPeriods(prisma);
  console.log('Seeded canonical period grid.');

  const cse1JsonPath = path.join(__dirname, '../src/data/cse1-timetable.json');
  const cse1Data = JSON.parse(fs.readFileSync(cse1JsonPath, 'utf8'));

  const { classRoom, importedSlotsCount } = await importTimetableJson(cse1Data, { db: prisma });
  console.log(`Imported canonical timetable for ${cse1Data.branch} (${importedSlotsCount} slots).`);

  const crPasswordHash = await bcrypt.hash(process.env.CR_INITIAL_PASSWORD || 'crpass', 12);
  await prisma.user.upsert({
    where: { username: process.env.CR_INITIAL_USERNAME || 'cr1' },
    update: { role: UserRole.CR, classId: classRoom.id, isActive: true, passwordHash: crPasswordHash },
    create: { username: process.env.CR_INITIAL_USERNAME || 'cr1', passwordHash: crPasswordHash, role: UserRole.CR, classId: classRoom.id },
  });

  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set before seeding.');
  }
  const adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { username: process.env.ADMIN_USERNAME },
    update: { role: UserRole.ADMIN, classId: null, isActive: true, passwordHash: adminPasswordHash },
    create: { username: process.env.ADMIN_USERNAME, passwordHash: adminPasswordHash, role: UserRole.ADMIN },
  });

  console.log('Seed complete: canonical class, periods, courses, timetable, CR, and administrator created.');
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
