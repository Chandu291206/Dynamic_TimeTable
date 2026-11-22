const prisma = require('../config/database');
const { timesOverlap, timeToMinutes } = require('../utils/time');
const { classLabel } = require('./timetable.service');

class ClashError extends Error {
  constructor(clashes, message = 'Timetable slot conflict detected') {
    super(message);
    this.name = 'ClashError';
    this.statusCode = 409;
    this.status = 409;
    this.code = 'CLASH_DETECTED';
    this.clashes = Array.isArray(clashes) ? clashes : [clashes];
  }
}

/**
 * Pure Functional Core:
 * Evaluates candidate slots against existing slots, periods, and references.
 *
 * @param {Object} params
 * @param {Array} params.candidateSlots - Array of candidate slot objects
 * @param {Array} [params.existingSlots] - Array of already committed slots
 * @param {Array} [params.periods] - Configured period definitions
 * @param {Object} [params.references] - { classes, subjects, faculties } lookup maps
 * @param {Object} [params.options] - { enforcePeriods?: boolean }
 * @returns {Array} Array of Clash objects
 */
function findClashes({
  candidateSlots = [],
  existingSlots = [],
  periods = [],
  references = {},
  options = {},
}) {
  const clashes = [];

  const classMap = references.classes instanceof Map
    ? references.classes
    : new Map(Object.entries(references.classes || {}).map(([k, v]) => [Number(k), v]));
  const subjectMap = references.subjects instanceof Map
    ? references.subjects
    : new Map(Object.entries(references.subjects || {}).map(([k, v]) => [Number(k), v]));
  const facultyMap = references.faculties instanceof Map
    ? references.faculties
    : new Map(Object.entries(references.faculties || {}).map(([k, v]) => [Number(k), v]));

  // Helper to extract assigned faculty [{ id, role }]
  function getAssignedFaculty(slot) {
    const list = [];
    if (slot.facultyId !== null && slot.facultyId !== undefined) {
      list.push({ id: Number(slot.facultyId), role: 'primary' });
    }
    if (slot.batchBFacultyId !== null && slot.batchBFacultyId !== undefined) {
      list.push({ id: Number(slot.batchBFacultyId), role: 'batchB' });
    }
    return list;
  }

  // Helper to get subject break status
  function isBreakSlot(slot) {
    if (slot.isBreak === true) return true;
    if (slot.subject?.isBreak === true || slot.subject?.code === 'LUNCH') return true;
    if (slot.subjectId && subjectMap.has(Number(slot.subjectId))) {
      const s = subjectMap.get(Number(slot.subjectId));
      return Boolean(s.isBreak || s.code === 'LUNCH');
    }
    return false;
  }

  // 1. Validate each candidate slot in isolation (references, break with faculty, same-slot double booking)
  for (let i = 0; i < candidateSlots.length; i++) {
    const cand = candidateSlots[i];

    // Reference validation if maps are provided
    if (classMap.size > 0 && cand.classId) {
      const c = classMap.get(Number(cand.classId));
      if (!c || c.isActive === false) {
        clashes.push({
          type: 'INVALID_REFERENCE',
          field: 'classId',
          day: cand.day,
          startTime: cand.startTime,
          endTime: cand.endTime,
          candidate: cand,
          message: `Class #${cand.classId} does not exist or is inactive`,
        });
      }
    }

    if (subjectMap.size > 0 && cand.subjectId) {
      const s = subjectMap.get(Number(cand.subjectId));
      if (!s || s.isActive === false) {
        clashes.push({
          type: 'INVALID_REFERENCE',
          field: 'subjectId',
          day: cand.day,
          startTime: cand.startTime,
          endTime: cand.endTime,
          candidate: cand,
          message: `Subject #${cand.subjectId} does not exist or is inactive`,
        });
      }
    }

    const assigned = getAssignedFaculty(cand);
    for (const f of assigned) {
      if (facultyMap.size > 0) {
        const fac = facultyMap.get(f.id);
        if (!fac || fac.isActive === false) {
          clashes.push({
            type: 'INVALID_REFERENCE',
            field: f.role === 'primary' ? 'facultyId' : 'batchBFacultyId',
            day: cand.day,
            startTime: cand.startTime,
            endTime: cand.endTime,
            candidate: cand,
            message: `Faculty #${f.id} (${f.role}) does not exist or is inactive`,
          });
        }
      }
    }

    // Check if facultyId and batchBFacultyId are the same person
    if (cand.facultyId && cand.batchBFacultyId && Number(cand.facultyId) === Number(cand.batchBFacultyId)) {
      clashes.push({
        type: 'FACULTY_DOUBLE_BOOKED',
        day: cand.day,
        startTime: cand.startTime,
        endTime: cand.endTime,
        facultyId: Number(cand.facultyId),
        candidate: cand,
        message: 'The same faculty member cannot be assigned to both Batch A and Batch B in the same slot',
      });
    }

    // Check BREAK_HAS_FACULTY
    if (isBreakSlot(cand) && assigned.length > 0) {
      clashes.push({
        type: 'BREAK_HAS_FACULTY',
        day: cand.day,
        startTime: cand.startTime,
        endTime: cand.endTime,
        candidate: cand,
        message: 'Break sessions cannot have faculty assigned',
      });
    }

    // Check OUTSIDE_PERIODS if enforced
    if (options.enforcePeriods && periods.length > 0) {
      const candStart = timeToMinutes(cand.startTime);
      const candEnd = timeToMinutes(cand.endTime);
      const startMatches = periods.some((p) => timeToMinutes(p.startTime) === candStart);
      const endMatches = periods.some((p) => timeToMinutes(p.endTime) === candEnd);
      if (!startMatches || !endMatches) {
        clashes.push({
          type: 'OUTSIDE_PERIODS',
          day: cand.day,
          startTime: cand.startTime,
          endTime: cand.endTime,
          candidate: cand,
          message: `Slot time ${cand.startTime}-${cand.endTime} does not align with the configured period grid`,
        });
      }
    }
  }

  // 2. Intra-candidate overlaps (between candidates themselves)
  for (let i = 0; i < candidateSlots.length; i++) {
    const c1 = candidateSlots[i];
    for (let j = i + 1; j < candidateSlots.length; j++) {
      const c2 = candidateSlots[j];
      if (c1.day !== c2.day) continue;

      if (!timesOverlap(c1, c2)) continue;

      // Class overlap within candidate batch
      if (Number(c1.classId) === Number(c2.classId)) {
        clashes.push({
          type: 'CLASS_OVERLAP',
          day: c1.day,
          startTime: c1.startTime,
          endTime: c1.endTime,
          candidate: c1,
          conflictsWith: c2,
          message: `Candidate slots overlap for class #${c1.classId} on day ${c1.day} (${c1.startTime}-${c1.endTime} and ${c2.startTime}-${c2.endTime})`,
        });
      }

      // Faculty double-booking within candidate batch
      const c1Facs = getAssignedFaculty(c1);
      const c2Facs = getAssignedFaculty(c2);
      for (const f1 of c1Facs) {
        for (const f2 of c2Facs) {
          if (f1.id === f2.id) {
            const facInfo = facultyMap.get(f1.id);
            const name = facInfo ? facInfo.name : `#${f1.id}`;
            clashes.push({
              type: 'FACULTY_DOUBLE_BOOKED',
              day: c1.day,
              startTime: c1.startTime,
              endTime: c1.endTime,
              facultyId: f1.id,
              facultyName: facInfo?.name,
              candidate: c1,
              conflictsWith: c2,
              message: `Faculty ${name} is assigned to overlapping candidate slots on day ${c1.day} (${c1.startTime}-${c1.endTime} and ${c2.startTime}-${c2.endTime})`,
            });
          }
        }
      }
    }
  }

  // 3. Candidate vs existingSlots overlaps
  for (const cand of candidateSlots) {
    const candFacs = getAssignedFaculty(cand);

    for (const existing of existingSlots) {
      // Don't compare against the slot itself when updating
      if (cand.id && existing.id && Number(cand.id) === Number(existing.id)) continue;
      if (cand.day !== existing.day) continue;
      if (!timesOverlap(cand, existing)) continue;

      const existingClassLabel = existing.class ? classLabel(existing.class) : (existing.classLabel || `Class #${existing.classId}`);

      // Same class overlap
      if (Number(cand.classId) === Number(existing.classId)) {
        clashes.push({
          type: 'CLASS_OVERLAP',
          day: cand.day,
          startTime: cand.startTime,
          endTime: cand.endTime,
          candidate: cand,
          conflictsWith: {
            slotId: existing.id,
            draftSlotId: existing.draftSlotId,
            classId: existing.classId,
            classLabel: existingClassLabel,
            subjectId: existing.subjectId,
            facultyId: existing.facultyId,
            batchBFacultyId: existing.batchBFacultyId,
            day: existing.day,
            startTime: existing.startTime,
            endTime: existing.endTime,
          },
          message: `${existingClassLabel} already has a slot scheduled from ${existing.startTime} to ${existing.endTime}`,
        });
      }

      // Faculty double-booking check
      const existingFacs = getAssignedFaculty(existing);
      for (const cf of candFacs) {
        for (const ef of existingFacs) {
          if (cf.id === ef.id) {
            const facInfo = facultyMap.get(cf.id) || existing.faculty || existing.batchBFaculty;
            const facName = facInfo?.name || `Faculty #${cf.id}`;
            clashes.push({
              type: 'FACULTY_DOUBLE_BOOKED',
              day: cand.day,
              startTime: cand.startTime,
              endTime: cand.endTime,
              facultyId: cf.id,
              facultyName: facName,
              candidate: cand,
              conflictsWith: {
                slotId: existing.id,
                draftSlotId: existing.draftSlotId,
                classId: existing.classId,
                classLabel: existingClassLabel,
                subjectId: existing.subjectId,
                facultyId: ef.id,
                facultyName: facName,
                role: ef.role,
                day: existing.day,
                startTime: existing.startTime,
                endTime: existing.endTime,
              },
              message: `${facName} is already booked in ${existingClassLabel} from ${existing.startTime} to ${existing.endTime}`,
            });
          }
        }
      }
    }
  }

  return clashes;
}

/**
 * Pure Functional Core:
 * Asserts that candidate slots have zero clashes; otherwise throws ClashError.
 */
function assertNoClashes(params) {
  const clashes = findClashes(params);
  if (clashes.length > 0) {
    const first = clashes[0];
    throw new ClashError(clashes, first.message || 'Timetable slot conflict detected');
  }
}

/**
 * Pure helper to detect mutual clashes among a set of existing slots.
 */
function detectExistingClashes(slots = []) {
  const clashes = [];

  for (let i = 0; i < slots.length; i++) {
    const s1 = slots[i];
    for (let j = i + 1; j < slots.length; j++) {
      const s2 = slots[j];
      if (s1.day !== s2.day) continue;
      if (!timesOverlap(s1, s2)) continue;

      const s1Label = s1.class ? classLabel(s1.class) : (s1.classLabel || `Class #${s1.classId}`);
      const s2Label = s2.class ? classLabel(s2.class) : (s2.classLabel || `Class #${s2.classId}`);

      // Class overlap
      if (Number(s1.classId) === Number(s2.classId)) {
        clashes.push({
          type: 'CLASS_OVERLAP',
          day: s1.day,
          startTime: s1.startTime < s2.startTime ? s1.startTime : s2.startTime,
          endTime: s1.endTime > s2.endTime ? s1.endTime : s2.endTime,
          classId: s1.classId,
          classLabel: s1Label,
          slots: [s1, s2],
          message: `${s1Label} has overlapping slots: ${s1.startTime}-${s1.endTime} and ${s2.startTime}-${s2.endTime}`,
        });
      }

      // Faculty double booking
      const f1List = [
        s1.facultyId ? { id: Number(s1.facultyId), name: s1.faculty?.name, staffId: s1.faculty?.staffId, role: 'primary' } : null,
        s1.batchBFacultyId ? { id: Number(s1.batchBFacultyId), name: s1.batchBFaculty?.name, staffId: s1.batchBFaculty?.staffId, role: 'batchB' } : null,
      ].filter(Boolean);

      const f2List = [
        s2.facultyId ? { id: Number(s2.facultyId), name: s2.faculty?.name, staffId: s2.faculty?.staffId, role: 'primary' } : null,
        s2.batchBFacultyId ? { id: Number(s2.batchBFacultyId), name: s2.batchBFaculty?.name, staffId: s2.batchBFaculty?.staffId, role: 'batchB' } : null,
      ].filter(Boolean);

      for (const f1 of f1List) {
        for (const f2 of f2List) {
          if (f1.id === f2.id) {
            clashes.push({
              type: 'FACULTY_DOUBLE_BOOKED',
              day: s1.day,
              startTime: s1.startTime < s2.startTime ? s1.startTime : s2.startTime,
              endTime: s1.endTime > s2.endTime ? s1.endTime : s2.endTime,
              facultyId: f1.id,
              faculty: { id: f1.id, name: f1.name, staffId: f1.staffId },
              slots: [
                { id: s1.id, classId: s1.classId, classLabel: s1Label, startTime: s1.startTime, endTime: s1.endTime, role: f1.role },
                { id: s2.id, classId: s2.classId, classLabel: s2Label, startTime: s2.startTime, endTime: s2.endTime, role: f2.role },
              ],
              message: `Faculty ${f1.name || `#${f1.id}`} is double-booked between ${s1Label} (${s1.startTime}-${s1.endTime}) and ${s2Label} (${s2.startTime}-${s2.endTime})`,
            });
          }
        }
      }
    }
  }

  return clashes;
}

// ============================================================================
// Database Operations & Advisory Locking
// ============================================================================

/**
 * Acquires a transaction-level PostgreSQL advisory lock.
 * Automatically releases when the transaction commits or aborts.
 */
async function acquireClashLock(tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('timetable_clash_lock'))`;
}

/**
 * Validates a single slot candidate against database state with conflict checks.
 */
async function validateSlotNoClash({ slot, excludeSlotId = null, tx = prisma }) {
  const [classRoom, subject, faculty, batchBFaculty] = await Promise.all([
    tx.classRoom.findUnique({ where: { id: slot.classId } }),
    slot.subjectId ? tx.subject.findUnique({ where: { id: slot.subjectId } }) : null,
    slot.facultyId ? tx.faculty.findUnique({ where: { id: slot.facultyId } }) : null,
    slot.batchBFacultyId ? tx.faculty.findUnique({ where: { id: slot.batchBFacultyId } }) : null,
  ]);

  if (!classRoom) {
    const err = new Error('Class not found');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    err.fields = { classId: 'Choose an existing class' };
    throw err;
  }
  if (slot.subjectId && !subject) {
    const err = new Error('Subject not found');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    err.fields = { subjectId: 'Choose an existing subject' };
    throw err;
  }
  if (slot.facultyId && !faculty) {
    const err = new Error('Faculty member not found');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    err.fields = { facultyId: 'Choose an existing faculty member' };
    throw err;
  }
  if (slot.batchBFacultyId && !batchBFaculty) {
    const err = new Error('Batch B Faculty member not found');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    err.fields = { batchBFacultyId: 'Choose an existing faculty member' };
    throw err;
  }
  if (subject && subject.isBreak && (slot.facultyId || slot.batchBFacultyId)) {
    const err = new Error('Break sessions cannot have faculty assigned');
    err.status = 400;
    err.code = 'BREAK_HAS_FACULTY';
    throw err;
  }

  const classes = { [classRoom.id]: classRoom };
  const subjects = subject ? { [subject.id]: subject } : {};
  const faculties = {};
  if (faculty) faculties[faculty.id] = faculty;
  if (batchBFaculty) faculties[batchBFaculty.id] = batchBFaculty;

  // Retrieve relevant existing slots for the same day (same class OR matching faculty)
  const facultyIds = [slot.facultyId, slot.batchBFacultyId].filter(Boolean).map(Number);

  const existingSlots = await tx.timetableSlot.findMany({
    where: {
      day: slot.day,
      ...(excludeSlotId ? { id: { not: Number(excludeSlotId) } } : {}),
      OR: [
        { classId: slot.classId },
        ...(facultyIds.length > 0 ? [
          { facultyId: { in: facultyIds } },
          { batchBFacultyId: { in: facultyIds } },
        ] : []),
      ],
    },
    include: { class: true, subject: true, faculty: true, batchBFaculty: true },
  });

  assertNoClashes({
    candidateSlots: [slot],
    existingSlots,
    references: { classes, subjects, faculties },
  });

  return { classRoom, subject, faculty, batchBFaculty };
}

/**
 * Returns a faculty busy map across all published slots.
 * Format: { [facultyId]: [{ day, startTime, endTime, classId, classLabel, slotId }] }
 */
async function getFacultyBusyMap({ excludeClassId = null, tx = prisma } = {}) {
  const slots = await tx.timetableSlot.findMany({
    where: {
      ...(excludeClassId ? { classId: { not: Number(excludeClassId) } } : {}),
      OR: [
        { facultyId: { not: null } },
        { batchBFacultyId: { not: null } },
      ],
    },
    include: { class: true },
  });

  const busyMap = {};

  for (const s of slots) {
    const label = s.class ? classLabel(s.class) : `Class #${s.classId}`;
    if (s.facultyId) {
      if (!busyMap[s.facultyId]) busyMap[s.facultyId] = [];
      busyMap[s.facultyId].push({
        slotId: s.id,
        classId: s.classId,
        classLabel: label,
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        role: 'primary',
      });
    }
    if (s.batchBFacultyId) {
      if (!busyMap[s.batchBFacultyId]) busyMap[s.batchBFacultyId] = [];
      busyMap[s.batchBFacultyId].push({
        slotId: s.id,
        classId: s.classId,
        classLabel: label,
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        role: 'batchB',
      });
    }
  }

  return busyMap;
}

/**
 * Scans all published slots in the database and generates a conflicts report.
 */
async function getLiveClashesReport(tx = prisma) {
  const slots = await tx.timetableSlot.findMany({
    include: { class: true, subject: true, faculty: true, batchBFaculty: true },
    orderBy: [{ classId: 'asc' }, { day: 'asc' }, { startTime: 'asc' }],
  });

  const clashes = detectExistingClashes(slots);

  return {
    totalClashes: clashes.length,
    clashes,
  };
}

module.exports = {
  ClashError,
  findClashes,
  assertNoClashes,
  detectExistingClashes,
  acquireClashLock,
  validateSlotNoClash,
  getFacultyBusyMap,
  getLiveClashesReport,
};
