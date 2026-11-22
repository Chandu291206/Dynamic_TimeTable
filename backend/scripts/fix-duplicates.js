const prisma = require('../src/config/database');
const { normalizeStaffId, normalizeSubjectCode } = require('../src/utils/identity');

async function fixDuplicates({ dryRun = true } = {}) {
  console.log(`=== FIX DUPLICATES SCRIPT (${dryRun ? 'DRY RUN' : 'APPLY MODE'}) ===\n`);

  const report = {
    facultyStaffIdNormalized: 0,
    facultyDuplicates: [],
    subjectCodesBackfilled: [],
    subjectDuplicatesResolved: [],
    slotsRepointed: 0,
    overridesRepointed: 0,
    subjectsDeleted: [],
    classesNormalized: 0,
  };

  // 1. Faculty checks & normalization
  const faculty = await prisma.faculty.findMany({
    include: { _count: { select: { timetableSlots: true, overrides: true } } },
    orderBy: { id: 'asc' },
  });

  const staffIdMap = new Map();
  for (const fac of faculty) {
    if (!fac.staffId) {
      throw new Error(`Faculty ID ${fac.id} (${fac.name}) has no staffId! Manual resolution required.`);
    }
    const cleanStaff = normalizeStaffId(fac.staffId);
    if (staffIdMap.has(cleanStaff)) {
      const existing = staffIdMap.get(cleanStaff);
      report.facultyDuplicates.push({ staffId: cleanStaff, kept: existing.id, conflict: fac.id });
    } else {
      staffIdMap.set(cleanStaff, fac);
    }
  }

  if (report.facultyDuplicates.length > 0) {
    console.error('Found duplicate staffId values in faculty:', report.facultyDuplicates);
    throw new Error('Duplicate faculty staffIds found! Automatic merging aborted.');
  }

  // Check if staffId needs formatting update
  for (const fac of faculty) {
    const cleanStaff = normalizeStaffId(fac.staffId);
    if (fac.staffId !== cleanStaff) {
      report.facultyStaffIdNormalized++;
      if (!dryRun) {
        await prisma.faculty.update({
          where: { id: fac.id },
          data: { staffId: cleanStaff },
        });
      }
    }
  }

  // 2. Subject backfill & duplicate resolution
  const subjects = await prisma.subject.findMany({
    include: { _count: { select: { timetableSlots: true, overrides: true } } },
    orderBy: { id: 'asc' },
  });

  // Step A: Determine candidate code for every subject
  const subjectsWithCode = subjects.map((sub) => {
    let candidateCode = sub.code ? normalizeSubjectCode(sub.code) : null;
    if (!candidateCode) {
      candidateCode = normalizeSubjectCode(sub.shortform || sub.name);
    }
    return {
      ...sub,
      candidateCode,
    };
  });

  // Identify subjects needing code backfill
  for (const sub of subjectsWithCode) {
    if (!sub.code || sub.code !== sub.candidateCode) {
      report.subjectCodesBackfilled.push({
        id: sub.id,
        name: sub.name,
        oldCode: sub.code,
        newCode: sub.candidateCode,
      });
    }
  }

  // Step B: Group by candidateCode to find duplicates
  const codeGroups = new Map();
  for (const sub of subjectsWithCode) {
    const code = sub.candidateCode;
    if (!codeGroups.has(code)) {
      codeGroups.set(code, []);
    }
    codeGroups.get(code).push(sub);
  }

  const clustersToResolve = [];
  for (const [code, group] of codeGroups.entries()) {
    if (group.length > 1) {
      // Pick survivor: most slots, then most overrides, then lowest id
      const sorted = [...group].sort((a, b) => {
        if (b._count.timetableSlots !== a._count.timetableSlots) {
          return b._count.timetableSlots - a._count.timetableSlots;
        }
        if (b._count.overrides !== a._count.overrides) {
          return b._count.overrides - a._count.overrides;
        }
        return a.id - b.id;
      });

      const survivor = sorted[0];
      const losers = sorted.slice(1);
      clustersToResolve.push({ code, survivor, losers });
    }
  }

  // Execute or report cluster resolutions
  for (const cluster of clustersToResolve) {
    const { code, survivor, losers } = cluster;
    report.subjectDuplicatesResolved.push({
      code,
      survivor: { id: survivor.id, name: survivor.name, slots: survivor._count.timetableSlots },
      losers: losers.map(l => ({ id: l.id, name: l.name, slots: l._count.timetableSlots })),
    });

    for (const loser of losers) {
      if (loser._count.timetableSlots > 0) {
        report.slotsRepointed += loser._count.timetableSlots;
      }
      if (loser._count.overrides > 0) {
        report.overridesRepointed += loser._count.overrides;
      }
      report.subjectsDeleted.push({ id: loser.id, name: loser.name, code });

      if (!dryRun) {
        // Repoint slots
        await prisma.timetableSlot.updateMany({
          where: { subjectId: loser.id },
          data: { subjectId: survivor.id },
        });

        // Repoint overrides
        await prisma.timetableOverride.updateMany({
          where: { subjectId: loser.id },
          data: { subjectId: survivor.id },
        });

        // Delete loser subject
        await prisma.subject.delete({
          where: { id: loser.id },
        });
      }
    }

    if (!dryRun) {
      // Ensure survivor has the normalized code and appropriate break flag
      const isLunch = survivor.name.trim().toUpperCase() === 'LUNCH' || code === 'LUNCH';
      await prisma.subject.update({
        where: { id: survivor.id },
        data: {
          code,
          shortform: code,
        },
      });
    }
  }

  // Update codes for non-duplicate subjects needing code backfill
  for (const item of report.subjectCodesBackfilled) {
    const isDeletedLoser = report.subjectsDeleted.some(d => d.id === item.id);
    if (!isDeletedLoser && !dryRun) {
      await prisma.subject.update({
        where: { id: item.id },
        data: {
          code: item.newCode,
          shortform: item.newCode,
        },
      });
    }
  }

  // 3. ClassRoom normalization (trim/uppercase branch & section, set academicYear)
  const classes = await prisma.classRoom.findMany();
  for (const cls of classes) {
    const normBranch = cls.branch.trim().toUpperCase();
    const normSection = cls.section.trim().toUpperCase();
    const normAcademicYear = (cls.academicYear || '2026-27').trim().toUpperCase();

    if (
      cls.branch !== normBranch ||
      cls.section !== normSection ||
      cls.academicYear !== normAcademicYear
    ) {
      report.classesNormalized++;
      if (!dryRun) {
        await prisma.classRoom.update({
          where: { id: cls.id },
          data: {
            branch: normBranch,
            section: normSection,
            academicYear: normAcademicYear,
          },
        });
      }
    }
  }

  // Summary output
  console.log('--- AUDIT REPORT SUMMARY ---');
  console.log(`- Faculty staffIds needing normalization: ${report.facultyStaffIdNormalized}`);
  console.log(`- Subject codes to backfill: ${report.subjectCodesBackfilled.length}`);
  console.log(`- Subject duplicate clusters found: ${report.subjectDuplicatesResolved.length}`);
  console.log(`- Slots to repoint: ${report.slotsRepointed}`);
  console.log(`- Overrides to repoint: ${report.overridesRepointed}`);
  console.log(`- Loser subjects to delete: ${report.subjectsDeleted.length}`);
  console.log(`- Classes to normalize: ${report.classesNormalized}\n`);

  if (report.subjectDuplicatesResolved.length > 0) {
    console.log('Duplicate Clusters Detail:');
    for (const c of report.subjectDuplicatesResolved) {
      console.log(`  Code: "${c.code}"`);
      console.log(`    Survivor: ID ${c.survivor.id} ("${c.survivor.name}", ${c.survivor.slots} slots)`);
      for (const l of c.losers) {
        console.log(`    -> Loser: ID ${l.id} ("${l.name}", ${l.slots} slots)`);
      }
    }
    console.log('');
  }

  if (!dryRun) {
    await prisma.timetableLog.create({
      data: {
        action: 'FIX_DUPLICATES_APPLIED',
        performedBy: 'system/phase1-migration',
        details: JSON.stringify({
          subjectsDeleted: report.subjectsDeleted.length,
          slotsRepointed: report.slotsRepointed,
          codesBackfilled: report.subjectCodesBackfilled.length,
        }),
      },
    });
    console.log('Changes successfully applied to database and recorded in TimetableLog.');
  } else {
    console.log('Dry run complete. No database changes were made.');
  }

  await prisma.$disconnect();
  return report;
}

if (require.main === module) {
  const isApply = process.argv.includes('--apply');
  fixDuplicates({ dryRun: !isApply }).catch((err) => {
    console.error('Fix duplicates failed:', err);
    process.exit(1);
  });
}

module.exports = { fixDuplicates };
