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
  let classId;
  try {
    const login = await jsonRequest(baseUrl, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }) });
    const options = { headers: { authorization: `Bearer ${login.body.data.token}`, 'content-type': 'application/json' } };
    const section = `T${Date.now().toString().slice(-6)}`;
    const created = await jsonRequest(baseUrl, '/admin/classes', { ...options, method: 'POST', body: JSON.stringify({ year: 4, branch: 'testing', section }) });
    if (created.status !== 201 || created.body.data.label !== `Y4 - TESTING - ${section}`) throw new Error('Class creation or label failed.');
    classId = created.body.data.id;
    const duplicate = await jsonRequest(baseUrl, '/admin/classes', { ...options, method: 'POST', body: JSON.stringify({ year: 4, branch: 'TESTING', section }) });
    if (duplicate.status !== 409) throw new Error(`Expected duplicate class 409, got ${duplicate.status}`);
    const updated = await jsonRequest(baseUrl, `/admin/classes/${classId}`, { ...options, method: 'PUT', body: JSON.stringify({ year: 4, branch: 'testing', section: `${section}X` }) });
    if (updated.status !== 200) throw new Error('Class update failed.');
    const deleted = await jsonRequest(baseUrl, `/admin/classes/${classId}`, { ...options, method: 'DELETE' });
    if (deleted.status !== 204) throw new Error(`Expected class deletion 204, got ${deleted.status}`);
    classId = null;
    console.log(JSON.stringify({ classCrud: 'ok', duplicateProtected: true }, null, 2));
  } finally {
    if (classId) await prisma.classRoom.delete({ where: { id: classId } }).catch(() => undefined);
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
