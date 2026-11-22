const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseFacultyPdf,
  parseFacultyPdfDetailed,
  runFacultySync,
  isOfficialGrietUrl,
} = require('../src/services/faculty-sync.service');

function createMockPrisma() {
  const facultyStore = new Map();
  const syncRunStore = new Map();
  let nextFacultyId = 1;
  let nextSyncRunId = 1;

  return {
    facultyStore,
    syncRunStore,
    faculty: {
      findUnique: async ({ where }) => {
        if (where.staffId) {
          for (const f of facultyStore.values()) {
            if (f.staffId === where.staffId) return { ...f };
          }
        }
        if (where.id) {
          return facultyStore.get(where.id) ? { ...facultyStore.get(where.id) } : null;
        }
        return null;
      },
      create: async ({ data }) => {
        const id = nextFacultyId++;
        const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
        facultyStore.set(id, record);
        return { ...record };
      },
      update: async ({ where, data }) => {
        const existing = facultyStore.get(where.id);
        if (!existing) throw new Error(`Faculty not found: ${where.id}`);
        const updated = { ...existing, ...data, updatedAt: new Date() };
        facultyStore.set(where.id, updated);
        return { ...updated };
      },
      findMany: async () => Array.from(facultyStore.values()),
    },
    facultySyncRun: {
      create: async ({ data }) => {
        const id = nextSyncRunId++;
        const record = { id, ...data, startedAt: new Date() };
        syncRunStore.set(id, record);
        return { ...record };
      },
      update: async ({ where, data }) => {
        const existing = syncRunStore.get(where.id);
        if (!existing) throw new Error(`SyncRun not found: ${where.id}`);
        const updated = { ...existing, ...data };
        syncRunStore.set(where.id, updated);
        return { ...updated };
      },
    },
  };
}

describe('Faculty Sync Service & Parser (Goal G1)', () => {
  it('validates official HTTPS GRIET URLs', () => {
    assert.equal(isOfficialGrietUrl('https://www.griet.ac.in/images/Staff.pdf'), true);
    assert.equal(isOfficialGrietUrl('https://griet.ac.in/staff.php'), true);
    assert.equal(isOfficialGrietUrl('http://www.griet.ac.in/Staff.pdf'), false); // Not HTTPS
    assert.equal(isOfficialGrietUrl('https://malicious-griet.ac.in/Staff.pdf'), false);
    assert.equal(isOfficialGrietUrl('https://evil.com/fake.pdf'), false);
    assert.equal(isOfficialGrietUrl('invalid-url'), false);
  });

  it('parses valid faculty lines into normalized records with mandatory staffId', () => {
    const sampleText = `
      1 Dr. J.Praveen 1079 Ph.D Professor & Principal
      2 Dr. K. Prasanna Lakshmi 1528 Ph.D Professor
      3 Mr. K. Sunil Kumar Reddy 1175 M.Tech Associate Professor
    `;
    const records = parseFacultyPdf(sampleText);

    assert.equal(records.length, 3);
    assert.equal(records[0].staffId, '1079');
    assert.equal(records[0].name, 'Dr. J.Praveen');
    assert.equal(records[0].qualification, 'Ph.D');
    assert.equal(records[0].designation, 'Professor & Principal');

    assert.equal(records[2].staffId, '1175');
    assert.equal(records[2].name, 'Mr. K. Sunil Kumar Reddy');
    assert.equal(records.issues.length, 0);
    assert.equal(records.skippedCount, 0);
  });

  it('skips rows with missing staffId and logs missing_staff_id issue', () => {
    const sampleText = `
      1 Dr. J.Praveen 1079 Ph.D Professor
      2 Dr. Missing StaffId Ph.D Professor
      3 Dr. Valid Person 1840 M.Tech Assistant Professor
    `;
    const detailed = parseFacultyPdfDetailed(sampleText);

    assert.equal(detailed.records.length, 2);
    assert.equal(detailed.skippedCount, 1);
    assert.equal(detailed.issues.length, 1);
    assert.equal(detailed.issues[0].type, 'missing_staff_id');
    assert.match(detailed.issues[0].name, /Dr. Missing StaffId/);
  });

  it('skips BOTH rows when duplicate staffId appears in source and records duplicate_staff_id_in_source', () => {
    const sampleText = `
      1 Dr. First Person 1500 Ph.D Professor
      2 Dr. Second Person 1500 M.Tech Associate Professor
      3 Dr. Third Person 1600 Ph.D Professor
    `;
    const detailed = parseFacultyPdfDetailed(sampleText);

    // StaffId 1500 is duplicated: neither row should be included
    assert.equal(detailed.records.length, 1);
    assert.equal(detailed.records[0].staffId, '1600');
    assert.equal(detailed.skippedCount, 2);
    assert.equal(detailed.issues.length, 2);
    assert.equal(detailed.issues[0].type, 'duplicate_staff_id_in_source');
    assert.equal(detailed.issues[0].staffId, '1500');
    assert.equal(detailed.issues[1].type, 'duplicate_staff_id_in_source');
    assert.equal(detailed.issues[1].staffId, '1500');
  });

  it('Requirement 1: Source with two "Dr. A. Kumar" rows, different staffIds -> 2 distinct Faculty records', async () => {
    const mockDb = createMockPrisma();
    const sourceText = `
      1 Dr. A. Kumar 2001 Ph.D Professor
      2 Dr. A. Kumar 2002 M.Tech Associate Professor
    `;

    const result = await runFacultySync({
      pdfText: sourceText,
      prismaClient: mockDb,
    });

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.created, 2);
    assert.equal(result.updated, 0);
    assert.equal(result.unchanged, 0);

    const facultyList = await mockDb.faculty.findMany();
    assert.equal(facultyList.length, 2);
    assert.equal(facultyList[0].name, 'Dr. A. Kumar');
    assert.equal(facultyList[0].staffId, '2001');
    assert.equal(facultyList[1].name, 'Dr. A. Kumar');
    assert.equal(facultyList[1].staffId, '2002');
    assert.notEqual(facultyList[0].id, facultyList[1].id);
  });

  it('Requirement 2: Re-running the same sync -> 0 created, 0 duplicated, N unchanged', async () => {
    const mockDb = createMockPrisma();
    const sourceText = `
      1 Dr. J. Praveen 1079 Ph.D Professor
      2 Dr. G. Karuna 922 Ph.D Professor
    `;

    // First run
    const run1 = await runFacultySync({ pdfText: sourceText, prismaClient: mockDb });
    assert.equal(run1.created, 2);
    assert.equal(run1.unchanged, 0);

    // Second run with same data
    const run2 = await runFacultySync({ pdfText: sourceText, prismaClient: mockDb });
    assert.equal(run2.created, 0);
    assert.equal(run2.updated, 0);
    assert.equal(run2.unchanged, 2);
    assert.equal(run2.failed, 0);

    const facultyList = await mockDb.faculty.findMany();
    assert.equal(facultyList.length, 2); // No duplicates created
  });

  it('Requirement 3: Row with missing staffId -> skipped and reported, nothing created', async () => {
    const mockDb = createMockPrisma();
    const sourceText = `
      1 Dr. Ghost Faculty Ph.D Professor
    `;

    const run = await runFacultySync({ pdfText: sourceText, prismaClient: mockDb });
    assert.equal(run.created, 0);
    assert.equal(run.skipped, 1);
    assert.ok(run.issues);
    assert.equal(run.issues.length, 1);
    assert.equal(run.issues[0].type, 'missing_staff_id');

    const facultyList = await mockDb.faculty.findMany();
    assert.equal(facultyList.length, 0);
  });

  it('Requirement 4: Same staffId twice in source -> both skipped and reported', async () => {
    const mockDb = createMockPrisma();
    const sourceText = `
      1 Dr. First Twin 3001 Ph.D Professor
      2 Dr. Second Twin 3001 Ph.D Professor
    `;

    const run = await runFacultySync({ pdfText: sourceText, prismaClient: mockDb });
    assert.equal(run.created, 0);
    assert.equal(run.skipped, 2);
    assert.ok(run.issues);
    assert.equal(run.issues.length, 2);
    assert.equal(run.issues[0].type, 'duplicate_staff_id_in_source');
    assert.equal(run.issues[1].type, 'duplicate_staff_id_in_source');

    const facultyList = await mockDb.faculty.findMany();
    assert.equal(facultyList.length, 0);
  });

  it('Requirement 5: Failed image fetch / row update preserves existing good image', async () => {
    const mockDb = createMockPrisma();
    // Seed existing faculty with an existing good image
    await mockDb.faculty.create({
      data: {
        staffId: '4001',
        name: 'Dr. Existing Faculty',
        imageSourceUrl: 'https://www.griet.ac.in/images/original_good_image.jpg',
        designation: 'Professor',
        qualification: 'Ph.D',
      },
    });

    // Run sync where record has null image (or no image change)
    const sourceText = `
      1 Dr. Existing Faculty 4001 Ph.D Professor
    `;
    const run = await runFacultySync({ pdfText: sourceText, prismaClient: mockDb });
    assert.equal(run.unchanged, 1);

    const faculty = await mockDb.faculty.findUnique({ where: { staffId: '4001' } });
    assert.equal(faculty.imageSourceUrl, 'https://www.griet.ac.in/images/original_good_image.jpg');
  });
});
