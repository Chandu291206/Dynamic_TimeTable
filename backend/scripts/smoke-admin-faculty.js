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
  let facultyId;
  try {
    const login = await jsonRequest(baseUrl, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }) });
    const options = { headers: { authorization: `Bearer ${login.body.data.token}`, 'content-type': 'application/json' } };
    const staffId = `smoke-${Date.now()}`;
    const created = await jsonRequest(baseUrl, '/admin/faculty', { ...options, method: 'POST', body: JSON.stringify({ name: 'Temporary Faculty', staffId, department: 'AIML', designation: 'Assistant Professor' }) });
    if (created.status !== 201) throw new Error(`Expected faculty creation 201, got ${created.status}`);
    facultyId = created.body.data.id;

    const updated = await jsonRequest(baseUrl, `/admin/faculty/${facultyId}`, { ...options, method: 'PUT', body: JSON.stringify({ qualification: 'M.Tech' }) });
    if (updated.status !== 200 || updated.body.data.qualification !== 'M.Tech') throw new Error('Faculty update failed.');
    const fetched = await jsonRequest(baseUrl, `/admin/faculty/${facultyId}`, options);
    if (fetched.status !== 200 || 'imageData' in fetched.body.data) throw new Error('Faculty retrieval failed or exposed binary image data.');
    const syncStatus = await jsonRequest(baseUrl, '/admin/faculty/sync/status', options);
    if (syncStatus.status !== 200) throw new Error('Sync status endpoint failed.');

    const removed = await jsonRequest(baseUrl, `/admin/faculty/${facultyId}`, { ...options, method: 'DELETE' });
    if (removed.status !== 204) throw new Error(`Expected faculty deletion 204, got ${removed.status}`);
    facultyId = null;
    console.log(JSON.stringify({ facultyCrud: 'ok', syncStatus: syncStatus.body.data?.status || 'NO_RUN_YET' }, null, 2));
  } finally {
    if (facultyId) await prisma.faculty.delete({ where: { id: facultyId } }).catch(() => undefined);
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
