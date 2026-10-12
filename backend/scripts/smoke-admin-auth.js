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
    const adminLogin = await jsonRequest(baseUrl, '/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
    });
    const adminToken = adminLogin.body.data?.token;
    if (adminLogin.status !== 200 || adminLogin.body.data?.user.role !== 'ADMIN') throw new Error('Admin login failed.');

    const adminMe = await jsonRequest(baseUrl, '/admin/me', { headers: { authorization: `Bearer ${adminToken}` } });
    if (adminMe.status !== 200 || adminMe.body.data.user.role !== 'ADMIN') throw new Error('Admin-only endpoint rejected the admin account.');

    const crLogin = await jsonRequest(baseUrl, '/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: process.env.CR_INITIAL_USERNAME || 'cr1', password: process.env.CR_INITIAL_PASSWORD || 'crpass' }),
    });
    const crResult = await jsonRequest(baseUrl, '/admin/me', { headers: { authorization: `Bearer ${crLogin.body.data.token}` } });
    if (crResult.status !== 403) throw new Error(`Expected CR access to admin endpoint to return 403, received ${crResult.status}`);

    console.log(JSON.stringify({ admin: adminMe.body.data.user, crAdminAccessStatus: crResult.status }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
