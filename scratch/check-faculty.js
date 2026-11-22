const prisma = require('../backend/src/config/database');

async function main() {
  const f = await prisma.faculty.findMany({
    select: { id: true, name: true, staffId: true, department: true }
  });
  console.log('Total faculty:', f.length);
  console.log('Sample staffIds:', f.slice(0, 15));
}

main().finally(() => prisma.$disconnect());
