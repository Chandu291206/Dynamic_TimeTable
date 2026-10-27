const { getWeeklyTimetable } = require('../src/services/timetable.service');
const prisma = require('../src/config/database');

async function main() {
  const c = await prisma.classRoom.findFirst();
  if (!c) {
    console.log('No class found');
    return;
  }
  const res = await getWeeklyTimetable(c.id, new Date());
  console.log('Class:', c.year, c.branch, c.section);
  console.log('Periods:', JSON.stringify(res.periods, null, 2));
  console.log('Working hours in class metadata:', JSON.stringify(res.class?.working_hours, null, 2));
  for (const d of res.days) {
    console.log(d.dayName, ':', d.slots.map(s => `${s.startTime}-${s.endTime} ${s.subject?.name}`).join(', '));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
