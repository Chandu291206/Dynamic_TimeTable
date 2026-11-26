/**
 * Resolves the physical classroom or laboratory for a timetable slot.
 * Priority:
 * 1. Explicit slot / override room override
 * 2. Lab room mapping from class metadata (classroom.labs[subjectCode])
 * 3. Day-specific theory room from class metadata (classroom.theory[dayName])
 * 4. General theory room from class metadata (classroom.theory)
 * 5. 'TBA'
 */
function resolveSlotRoom(slot, classMeta, dayName) {
  if (slot?.room && typeof slot.room === 'string' && slot.room.trim()) {
    const r = slot.room.trim();
    return r.startsWith('Room') || r.startsWith('Lab') ? r : `Room ${r}`;
  }

  const classroom = classMeta?.classroom;
  if (!classroom) return 'TBA';

  const code = (slot?.subject?.code || '').trim().toUpperCase();

  // 1. Lab check
  if (classroom.labs && typeof classroom.labs === 'object') {
    for (const [labCode, labRoom] of Object.entries(classroom.labs)) {
      if (labCode.toUpperCase() === code || code.includes(labCode.toUpperCase())) {
        const lr = String(labRoom).trim();
        return lr.startsWith('Lab') || lr.startsWith('Room') ? lr : `Lab ${lr}`;
      }
    }
  }

  // 2. Day-specific theory room
  if (dayName && classroom.theory && typeof classroom.theory === 'object' && classroom.theory[dayName]) {
    const tr = String(classroom.theory[dayName]).trim();
    return tr.startsWith('Room') || tr.startsWith('Lab') ? tr : `Room ${tr}`;
  }

  // 3. General theory room
  if (classroom.theory && typeof classroom.theory === 'string' && classroom.theory.trim()) {
    const tr = classroom.theory.trim();
    return tr.startsWith('Room') || tr.startsWith('Lab') ? tr : `Room ${tr}`;
  }

  return 'TBA';
}

module.exports = { resolveSlotRoom };
