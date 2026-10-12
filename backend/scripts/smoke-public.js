const app = require('../src/app');
const prisma = require('../src/config/database');

async function main() {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const port = server.address().port;
    const classesResponse = await fetch(`http://127.0.0.1:${port}/api/classes`);
    if (!classesResponse.ok) throw new Error(`Classes request failed: ${classesResponse.status}`);
    const classes = await classesResponse.json();
    if (!classes.length) throw new Error('Expected the seed class to exist.');

    const timetableResponse = await fetch(`http://127.0.0.1:${port}/api/timetable/${classes[0].id}?date=2026-10-05`);
    if (!timetableResponse.ok) throw new Error(`Timetable request failed: ${timetableResponse.status}`);
    const timetable = await timetableResponse.json();
    if (timetable.slots.length !== 8) throw new Error(`Expected 8 seeded slots, received ${timetable.slots.length}.`);

    console.log(JSON.stringify({ class: classes[0].label, date: timetable.date, day: timetable.day, slots: timetable.slots.length }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
