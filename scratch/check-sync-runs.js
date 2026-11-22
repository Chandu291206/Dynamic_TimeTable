const prisma = require('../backend/src/config/database');

async function main() {
  const runs = await prisma.facultySyncRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 5
  });
  console.log('Recent sync runs:', runs);
}

main().finally(() => prisma.$disconnect());
