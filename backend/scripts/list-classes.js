const prisma = require('../src/config/database');

async function main() {
  const classes = await prisma.classRoom.findMany();
  console.log('Existing classes:', classes.map(c => ({ id: c.id, year: c.year, branch: c.branch, section: c.section })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
