const prisma = require('../backend/src/config/database');

async function main() {
  const cols = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'FacultySyncRun'
  `;
  console.log('FacultySyncRun columns:', cols);
}

main().finally(() => prisma.$disconnect());
