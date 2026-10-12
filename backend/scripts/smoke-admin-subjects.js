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
  let subjectId;
  try {
    const login = await jsonRequest(baseUrl, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }) });
    const options = { headers: { authorization: `Bearer ${login.body.data.token}`, 'content-type': 'application/json' } };
    const name = `TEST SUBJECT ${Date.now()}`;
    const created = await jsonRequest(baseUrl, '/admin/subjects', { ...options, method: 'POST', body: JSON.stringify({ name }) });
    if (created.status !== 201) throw new Error(`Expected subject creation 201, got ${created.status}`);
    subjectId = created.body.data.id;

    const duplicate = await jsonRequest(baseUrl, '/admin/subjects', { ...options, method: 'POST', body: JSON.stringify({ name }) });
    if (duplicate.status !== 409) throw new Error(`Expected duplicate creation 409, got ${duplicate.status}`);
    const updated = await jsonRequest(baseUrl, `/admin/subjects/${subjectId}`, { ...options, method: 'PUT', body: JSON.stringify({ name: `${name} UPDATED` }) });
    if (updated.status !== 200) throw new Error('Subject update failed.');
    const deleted = await jsonRequest(baseUrl, `/admin/subjects/${subjectId}`, { ...options, method: 'DELETE' });
    if (deleted.status !== 204) throw new Error(`Expected subject deletion 204, got ${deleted.status}`);
    subjectId = null;
    console.log(JSON.stringify({ subjectCrud: 'ok', duplicateProtected: true }, null, 2));
  } finally {
    if (subjectId) await prisma.subject.delete({ where: { id: subjectId } }).catch(() => undefined);
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
