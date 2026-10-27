const prisma = require('../src/config/database');

async function main() {
  await prisma.timetableSlot.deleteMany({ where: { classId: 66 } });
  await prisma.timetableOverride.deleteMany({ where: { classId: 66 } });
  await prisma.classRoom.delete({ where: { id: 66 } });
  console.log('Successfully deleted legacy class 66');
}

main().catch(console.error).finally(() => prisma.$disconnect());
