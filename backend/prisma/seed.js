const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { PrismaClient, UserRole } = require('@prisma/client');
const { importTimetableJson } = require('../src/services/timetable-json.service');

const prisma = new PrismaClient();

async function main() {
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

  console.log('Seed complete: canonical class, courses, timetable, CR, and administrator created.');
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
