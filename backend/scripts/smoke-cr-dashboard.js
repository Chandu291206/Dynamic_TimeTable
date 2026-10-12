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
  try {
    const login = await jsonRequest(baseUrl, '/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: process.env.CR_INITIAL_USERNAME || 'cr1', password: process.env.CR_INITIAL_PASSWORD || 'crpass' }),
    });
    const token = login.body.data?.token;
    if (login.status !== 200 || !token) throw new Error('CR login failed.');

    const dashboard = await jsonRequest(baseUrl, '/cr/dashboard', { headers: { authorization: `Bearer ${token}` } });
    if (dashboard.status !== 200 || dashboard.body.data.class.label !== 'Y3 - AIML - B') throw new Error('CR dashboard did not return the assigned class.');

    const unauthenticated = await jsonRequest(baseUrl, '/cr/dashboard');
    if (unauthenticated.status !== 401) throw new Error('Expected dashboard without a token to return 401.');

    console.log(JSON.stringify({ class: dashboard.body.data.class.label, todaySlots: dashboard.body.data.timetable.slots.length, upcomingOverrides: dashboard.body.data.upcomingOverrides.length }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
