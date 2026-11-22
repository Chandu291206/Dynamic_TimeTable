const prisma = require('../backend/src/config/database');

async function main() {
  const f = await prisma.faculty.findMany({
    where: { profileSourceUrl: { not: null } },
    take: 5
  });
  console.log('Sample faculty with profileSourceUrl:', f);
}

main().finally(() => prisma.$disconnect());
