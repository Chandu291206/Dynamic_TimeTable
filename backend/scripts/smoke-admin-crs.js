const app = require('../src/app');
const prisma = require('../src/config/database');

async function jsonRequest(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  return { status: response.status, body: contentType.includes('application/json') ? await response.json() : null };
}

async function main() {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  let createdId;
  try {
    const login = await jsonRequest(baseUrl, '/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
    });
    const token = login.body.data?.token;
    if (!token) throw new Error('Admin login failed.');
    const options = { headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } };
    const username = `smoke_cr_${Date.now()}`;

    const created = await jsonRequest(baseUrl, '/admin/crs', { ...options, method: 'POST', body: JSON.stringify({ username, password: 'temporary-password', classId: 1 }) });
    if (created.status !== 201) throw new Error(`Expected CR creation 201, received ${created.status}`);
    createdId = created.body.data.id;

    const updated = await jsonRequest(baseUrl, `/admin/crs/${createdId}`, { ...options, method: 'PUT', body: JSON.stringify({ isActive: false, password: 'updated-password' }) });
    if (updated.status !== 200 || updated.body.data.isActive !== false) throw new Error('CR update failed.');

    const unassigned = await jsonRequest(baseUrl, `/admin/crs/${createdId}/class`, { ...options, method: 'PUT', body: JSON.stringify({ classId: null }) });
    if (unassigned.status !== 200 || unassigned.body.data.classId !== null) throw new Error('CR class removal failed.');

    const listed = await jsonRequest(baseUrl, '/admin/crs', options);
    if (listed.status !== 200 || !listed.body.data.some((user) => user.id === createdId)) throw new Error('Created CR was not returned by listing.');

    const deleted = await jsonRequest(baseUrl, `/admin/crs/${createdId}`, { ...options, method: 'DELETE' });
    if (deleted.status !== 204) throw new Error(`Expected deletion 204, received ${deleted.status}`);
    createdId = null;
    console.log(JSON.stringify({ listedCRs: listed.body.data.length, temporaryCRRemoved: true }, null, 2));
  } finally {
    if (createdId) await prisma.user.delete({ where: { id: createdId } }).catch(() => undefined);
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
