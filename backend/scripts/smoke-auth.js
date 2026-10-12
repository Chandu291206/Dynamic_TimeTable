const app = require('../src/app');
const prisma = require('../src/config/database');

async function request(baseUrl, path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, body: await response.json() };
}

async function main() {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  try {
    const failedLogin = await request(baseUrl, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'cr1', password: 'incorrect' }) });
    if (failedLogin.status !== 401) throw new Error(`Expected failed login to return 401, received ${failedLogin.status}`);

    const login = await request(baseUrl, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: process.env.CR_INITIAL_USERNAME || 'cr1', password: process.env.CR_INITIAL_PASSWORD || 'crpass' }) });
    if (login.status !== 200 || !login.body.data?.token) throw new Error('Expected CR login to return a token.');
    if ('passwordHash' in login.body.data.user) throw new Error('Password hash was exposed.');

    const me = await request(baseUrl, '/auth/me', { headers: { authorization: `Bearer ${login.body.data.token}` } });
    if (me.status !== 200 || me.body.data.user.role !== 'CR') throw new Error('Expected authenticated CR user.');

    console.log(JSON.stringify({ login: login.body.data.user, me: me.body.data.user }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
