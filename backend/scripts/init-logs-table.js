const prisma = require('../src/config/database');

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TimetableLog" (
      "id" SERIAL PRIMARY KEY,
      "action" VARCHAR(100) NOT NULL,
      "performedBy" VARCHAR(100) NOT NULL,
      "year" INTEGER,
      "branch" VARCHAR(50),
      "section" VARCHAR(50),
      "day" VARCHAR(50),
      "date" VARCHAR(50),
      "details" TEXT,
      "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "TimetableLog_timestamp_idx" ON "TimetableLog"("timestamp" DESC);
  `);
  console.log('TimetableLog table created/verified successfully.');
}

main()
  .catch((err) => {
    console.error('Error creating table:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
