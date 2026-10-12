const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const [classes, subjects, slots, users, faculty, overrides] = await Promise.all([
    prisma.classRoom.findMany(),
    prisma.subject.count(),
    prisma.timetableSlot.count(),
    prisma.user.findMany({ select: { username: true, role: true, classId: true, isActive: true } }),
    prisma.faculty.count(),
    prisma.timetableOverride.count(),
  ]);

  console.log(JSON.stringify({ classes, subjects, slots, users, faculty, overrides }, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
