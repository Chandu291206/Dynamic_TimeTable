const app = require('../src/app');
const prisma = require('../src/config/database');

async function jsonRequest(baseUrl, path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, body: await response.json() };
}

async function main() {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  let overrideId;

  try {
    const login = await jsonRequest(baseUrl, '/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: process.env.CR_INITIAL_USERNAME || 'cr1', password: process.env.CR_INITIAL_PASSWORD || 'crpass' }),
    });
    const token = login.body.data?.token;
    if (!token) throw new Error('CR login failed.');
    const options = { headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } };
    const payload = { date: '2030-01-07', startTime: '09:00', endTime: '09:50' };

    const created = await jsonRequest(baseUrl, '/cr/overrides', { ...options, method: 'POST', body: JSON.stringify(payload) });
    if (created.status !== 201) throw new Error(`Expected override creation to return 201, received ${created.status}`);
    overrideId = created.body.data.id;

    const conflict = await jsonRequest(baseUrl, '/cr/overrides', { ...options, method: 'POST', body: JSON.stringify(payload) });
    if (conflict.status !== 409) throw new Error(`Expected overlapping override to return 409, received ${conflict.status}`);

    const timetable = await jsonRequest(baseUrl, '/timetable/1?date=2030-01-07');
    if (timetable.status !== 200 || !timetable.body.slots[0].isOverride) throw new Error('Expected the timetable to resolve the created override.');
    console.log(JSON.stringify({ created: created.body.data, resolvedOverride: timetable.body.slots[0].override }, null, 2));
  } finally {
    if (overrideId) await prisma.timetableOverride.delete({ where: { id: overrideId } });
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
