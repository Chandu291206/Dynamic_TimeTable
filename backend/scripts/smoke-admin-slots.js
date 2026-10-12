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
  let slotId;
  try {
    const login = await jsonRequest(baseUrl, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }) });
    const options = { headers: { authorization: `Bearer ${login.body.data.token}`, 'content-type': 'application/json' } };
    const subjectList = await jsonRequest(baseUrl, '/admin/subjects', options);
    const section = `S${Date.now().toString().slice(-6)}`;
    const classResult = await jsonRequest(baseUrl, '/admin/classes', { ...options, method: 'POST', body: JSON.stringify({ year: 4, branch: 'TEST', section }) });
    classId = classResult.body.data.id;
    const payload = { classId, day: 0, startTime: '09:00', endTime: '09:50', subjectId: subjectList.body.data[0].id };
    const created = await jsonRequest(baseUrl, '/admin/slots', { ...options, method: 'POST', body: JSON.stringify(payload) });
    if (created.status !== 201) throw new Error(`Expected slot creation 201, got ${created.status}`);
    slotId = created.body.data.id;
    const conflict = await jsonRequest(baseUrl, '/admin/slots', { ...options, method: 'POST', body: JSON.stringify({ ...payload, startTime: '09:30', endTime: '10:20' }) });
    if (conflict.status !== 409) throw new Error(`Expected slot conflict 409, got ${conflict.status}`);
    const updated = await jsonRequest(baseUrl, `/admin/slots/${slotId}`, { ...options, method: 'PUT', body: JSON.stringify({ ...payload, startTime: '10:00', endTime: '10:50' }) });
    if (updated.status !== 200 || updated.body.data.startTime !== '10:00') throw new Error('Slot update failed.');
    const deleted = await jsonRequest(baseUrl, `/admin/slots/${slotId}`, { ...options, method: 'DELETE' });
    if (deleted.status !== 204) throw new Error(`Expected slot deletion 204, got ${deleted.status}`);
    slotId = null;
    await jsonRequest(baseUrl, `/admin/classes/${classId}`, { ...options, method: 'DELETE' });
    classId = null;
    console.log(JSON.stringify({ slotCrud: 'ok', overlapProtected: true }, null, 2));
  } finally {
    if (slotId) await prisma.timetableSlot.delete({ where: { id: slotId } }).catch(() => undefined);
    if (classId) await prisma.classRoom.delete({ where: { id: classId } }).catch(() => undefined);
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
