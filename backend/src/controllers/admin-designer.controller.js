const { z } = require('zod');
const prisma = require('../config/database');
const {
  createDraftSchema,
  updateCellSchema,
  clearCellSchema,
} = require('../validators/designer.schema');
const { resolvePeriodsFromList } = require('../utils/period-resolver');
const {
  findClashes,
  assertNoClashes,
  acquireClashLock,
  getFacultyBusyMap,
  ClashError,
} = require('../services/clash.service');
const { classLabel } = require('../services/timetable.service');
const { recordLog } = require('../services/timetable-log.service');
const { timesOverlap } = require('../utils/time');
const logger = require('../utils/logger');

const idSchema = z.coerce.number().int().positive();

function parseId(value) {
  const parsed = idSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function serializeSlot(slot) {
  return {
    id: slot.id,
    draftId: slot.draftId,
    day: slot.day,
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: slot.room || null,
    startPeriodId: slot.startPeriodId || null,
    endPeriodId: slot.endPeriodId || null,
    subjectId: slot.subjectId,
    facultyId: slot.facultyId,
    batchBFacultyId: slot.batchBFacultyId || null,
    subject: slot.subject ? {
      id: slot.subject.id,
      code: slot.subject.code,
      name: slot.subject.name,
      isBreak: slot.subject.isBreak,
    } : null,
    faculty: slot.faculty ? {
      id: slot.faculty.id,
      name: slot.faculty.name,
      staffId: slot.faculty.staffId,
      department: slot.faculty.department,
    } : null,
    batchBFaculty: slot.batchBFaculty ? {
      id: slot.batchBFaculty.id,
      name: slot.batchBFaculty.name,
      staffId: slot.batchBFaculty.staffId,
      department: slot.batchBFaculty.department,
    } : null,
    startPeriod: slot.startPeriod ? {
      id: slot.startPeriod.id,
      order: slot.startPeriod.order,
      name: slot.startPeriod.name,
    } : null,
    endPeriod: slot.endPeriod ? {
      id: slot.endPeriod.id,
      order: slot.endPeriod.order,
      name: slot.endPeriod.name,
    } : null,
  };
}

function serializeDraft(draft) {
  return {
    id: draft.id,
    classId: draft.classId,
    name: draft.name,
    version: draft.version,
    status: draft.status,
    createdById: draft.createdById,
    createdBy: draft.createdBy ? { id: draft.createdBy.id, username: draft.createdBy.username } : null,
    class: draft.class ? {
      id: draft.class.id,
      year: draft.class.year,
      branch: draft.class.branch,
      section: draft.class.section,
      academicYear: draft.class.academicYear,
      label: classLabel(draft.class),
    } : undefined,
    slotsCount: draft.slots ? draft.slots.length : (draft._count?.slots ?? 0),
    slots: draft.slots ? draft.slots.map(serializeSlot) : undefined,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

/**
 * POST /api/admin/designer/drafts
 */
async function createDraft(req, res, next) {
  const parsed = createDraftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid draft parameters', fields: parsed.error.flatten().fieldErrors },
    });
  }

  const { classId, startFrom, name } = parsed.data;

  try {
    const classRoom = await prisma.classRoom.findUnique({ where: { id: classId } });
    if (!classRoom) {
      return res.status(404).json({ success: false, error: { code: 'CLASS_NOT_FOUND', message: 'Class not found' } });
    }

    // Check if an OPEN draft already exists for this class
    const existingOpen = await prisma.timetableDraft.findFirst({
      where: { classId, status: 'OPEN' },
      include: { class: true, slots: { include: { subject: true, faculty: true, batchBFaculty: true } } },
    });

    if (existingOpen) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DRAFT_ALREADY_EXISTS',
          message: `An open draft already exists for ${classLabel(classRoom)}`,
          draftId: existingOpen.id,
        },
        data: serializeDraft(existingOpen),
      });
    }

    // Create draft
    const draft = await prisma.$transaction(async (tx) => {
      const created = await tx.timetableDraft.create({
        data: {
          classId,
          name: name || `Draft for ${classLabel(classRoom)}`,
          version: 1,
          status: 'OPEN',
          createdById: req.user?.id,
        },
      });

      // If starting from published timetable, copy existing slots
      if (startFrom === 'published') {
        const liveSlots = await tx.timetableSlot.findMany({
          where: { classId },
        });

        for (const slot of liveSlots) {
          await tx.timetableDraftSlot.create({
            data: {
              draftId: created.id,
              day: slot.day,
              startTime: slot.startTime,
              endTime: slot.endTime,
              startPeriodId: slot.startPeriodId,
              endPeriodId: slot.endPeriodId,
              room: slot.room,
              subjectId: slot.subjectId,
              facultyId: slot.facultyId,
              batchBFacultyId: slot.batchBFacultyId,
            },
          });
        }
      }

      return tx.timetableDraft.findUnique({
        where: { id: created.id },
        include: {
          class: true,
          createdBy: true,
          slots: { include: { subject: true, faculty: true, batchBFaculty: true } },
        },
      });
    });

    logger.audit('DRAFT_CREATED', {
      draftId: draft.id,
      classId: draft.classId,
      startFrom,
      adminUserId: req.user?.id,
    });

    await recordLog({
      action: 'DRAFT_CREATED',
      performedBy: req.user?.username || 'Administrator',
      year: classRoom.year,
      branch: classRoom.branch,
      section: classRoom.section,
      details: `Created timetable draft (#${draft.id}) starting from ${startFrom} schedule`,
    });

    return res.status(201).json({ success: true, data: serializeDraft(draft) });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/admin/designer/drafts
 */
async function listDrafts(req, res, next) {
  try {
    const status = req.query.status || 'OPEN';
    const drafts = await prisma.timetableDraft.findMany({
      where: status === 'ALL' ? undefined : { status },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        class: true,
        createdBy: true,
        _count: { select: { slots: true } },
      },
    });

    return res.json({ success: true, data: drafts.map(serializeDraft) });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/admin/designer/drafts/:draftId
 */
async function getDraft(req, res, next) {
  const draftId = parseId(req.params.draftId);
  if (!draftId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'draftId must be a positive integer' } });
  }

  try {
    const draft = await prisma.timetableDraft.findUnique({
      where: { id: draftId },
      include: {
        class: true,
        createdBy: true,
        slots: {
          include: { subject: true, faculty: true, batchBFaculty: true, startPeriod: true, endPeriod: true },
          orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
        },
      },
    });

    if (!draft) {
      return res.status(404).json({ success: false, error: { code: 'DRAFT_NOT_FOUND', message: 'Draft not found' } });
    }

    const periods = await prisma.period.findMany({ orderBy: [{ order: 'asc' }] });

    // Validate draft against published slots of all OTHER classes
    const otherPublishedSlots = await prisma.timetableSlot.findMany({
      where: { classId: { not: draft.classId } },
      include: { class: true, subject: true, faculty: true, batchBFaculty: true },
    });

    const candidateSlots = draft.slots.map((s) => ({
      ...s,
      classId: draft.classId,
    }));

    const clashes = findClashes({
      candidateSlots,
      existingSlots: otherPublishedSlots,
    });

    return res.json({
      success: true,
      data: {
        draft: serializeDraft(draft),
        periods,
        validation: {
          isValid: clashes.length === 0,
          totalClashes: clashes.length,
          clashes,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PUT /api/admin/designer/drafts/:draftId/cells
 */
async function updateCell(req, res, next) {
  const draftId = parseId(req.params.draftId);
  if (!draftId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'draftId must be a positive integer' } });
  }

  const parsed = updateCellSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid cell data', fields: parsed.error.flatten().fieldErrors },
    });
  }

  const { day, startTime, endTime, subjectId, facultyId, batchBFacultyId, expectedVersion } = parsed.data;

  try {
    const draft = await prisma.timetableDraft.findUnique({
      where: { id: draftId },
      include: { slots: true },
    });

    if (!draft) {
      return res.status(404).json({ success: false, error: { code: 'DRAFT_NOT_FOUND', message: 'Draft not found' } });
    }

    if (draft.status !== 'OPEN') {
      return res.status(400).json({ success: false, error: { code: 'DRAFT_NOT_OPEN', message: 'Only OPEN drafts can be edited' } });
    }

    // Optimistic concurrency check
    if (expectedVersion !== undefined && draft.version !== expectedVersion) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'STALE_DRAFT',
          message: 'The draft has been updated by another user or session. Please reload to see latest changes.',
          currentVersion: draft.version,
        },
      });
    }

    // Load references if provided
    const [subject, faculty, batchBFaculty] = await Promise.all([
      subjectId ? prisma.subject.findUnique({ where: { id: subjectId } }) : null,
      facultyId ? prisma.faculty.findUnique({ where: { id: facultyId } }) : null,
      batchBFacultyId ? prisma.faculty.findUnique({ where: { id: batchBFacultyId } }) : null,
    ]);

    if (subjectId && !subject) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Subject not found', fields: { subjectId: 'Subject does not exist' } } });
    }
    if (facultyId && !faculty) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Faculty not found', fields: { facultyId: 'Faculty does not exist' } } });
    }
    if (batchBFacultyId && !batchBFaculty) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Batch B Faculty not found', fields: { batchBFacultyId: 'Faculty does not exist' } } });
    }

    // Break subject cannot have faculty
    if (subject && subject.isBreak && (facultyId || batchBFacultyId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'BREAK_HAS_FACULTY', message: 'Break sessions cannot have faculty assigned' },
      });
    }

    // Candidate slot representation
    const candidate = {
      classId: draft.classId,
      day,
      startTime,
      endTime,
      subjectId: subjectId || null,
      facultyId: facultyId || null,
      batchBFacultyId: batchBFacultyId || null,
      subject,
      faculty,
      batchBFaculty,
    };

    // Existing slots to check against:
    // 1. Other draft slots in this draft (excluding the exact slot or replaced slot at (day, startTime))
    const intraDraftExisting = draft.slots
      .filter((s) => !(s.day === day && s.startTime === startTime))
      .map((s) => ({ ...s, classId: draft.classId }));

    // 2. Published slots of all OTHER classes
    const otherPublishedSlots = await prisma.timetableSlot.findMany({
      where: { classId: { not: draft.classId } },
      include: { class: true, subject: true, faculty: true, batchBFaculty: true },
    });

    const combinedExisting = [...intraDraftExisting, ...otherPublishedSlots];

    // Assert zero clashes
    assertNoClashes({
      candidateSlots: [candidate],
      existingSlots: combinedExisting,
    });

    // Save cell and increment version
    const result = await prisma.$transaction(async (tx) => {
      const periods = await tx.period.findMany({ orderBy: { order: 'asc' } });
      const { startPeriodId, endPeriodId } = resolvePeriodsFromList(startTime, endTime, periods);

      const slot = await tx.timetableDraftSlot.upsert({
        where: { draftId_day_startTime: { draftId, day, startTime } },
        update: {
          endTime,
          room: parsed.data.room !== undefined ? parsed.data.room : null,
          startPeriodId: parsed.data.startPeriodId || startPeriodId,
          endPeriodId: parsed.data.endPeriodId || endPeriodId,
          subjectId: subjectId || null,
          facultyId: facultyId || null,
          batchBFacultyId: batchBFacultyId || null,
        },
        create: {
          draftId,
          day,
          startTime,
          endTime,
          room: parsed.data.room !== undefined ? parsed.data.room : null,
          startPeriodId: parsed.data.startPeriodId || startPeriodId,
          endPeriodId: parsed.data.endPeriodId || endPeriodId,
          subjectId: subjectId || null,
          facultyId: facultyId || null,
          batchBFacultyId: batchBFacultyId || null,
        },
        include: { subject: true, faculty: true, batchBFaculty: true, startPeriod: true, endPeriod: true },
      });

      const updatedDraft = await tx.timetableDraft.update({
        where: { id: draftId },
        data: { version: { increment: 1 } },
      });

      return { slot, version: updatedDraft.version };
    });

    return res.json({
      success: true,
      data: {
        slot: serializeSlot(result.slot),
        version: result.version,
      },
    });
  } catch (err) {
    if (err instanceof ClashError) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CLASH_DETECTED',
          message: err.message,
          clashes: err.clashes,
        },
      });
    }
    return next(err);
  }
}

/**
 * DELETE /api/admin/designer/drafts/:draftId/cells
 */
async function clearCell(req, res, next) {
  const draftId = parseId(req.params.draftId);
  if (!draftId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'draftId must be a positive integer' } });
  }

  const queryOrBody = {
    day: req.body?.day !== undefined ? req.body.day : req.query.day,
    startTime: req.body?.startTime !== undefined ? req.body.startTime : req.query.startTime,
    expectedVersion: req.body?.expectedVersion !== undefined ? req.body.expectedVersion : req.query.expectedVersion,
  };

  const parsed = clearCellSchema.safeParse(queryOrBody);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid cell coordinates', fields: parsed.error.flatten().fieldErrors },
    });
  }

  const { day, startTime, expectedVersion } = parsed.data;

  try {
    const draft = await prisma.timetableDraft.findUnique({ where: { id: draftId } });
    if (!draft) return res.status(404).json({ success: false, error: { code: 'DRAFT_NOT_FOUND', message: 'Draft not found' } });
    if (draft.status !== 'OPEN') return res.status(400).json({ success: false, error: { code: 'DRAFT_NOT_OPEN', message: 'Only OPEN drafts can be edited' } });

    if (expectedVersion !== undefined && draft.version !== expectedVersion) {
      return res.status(409).json({
        success: false,
        error: { code: 'STALE_DRAFT', message: 'Draft has been modified. Please refresh.', currentVersion: draft.version },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.timetableDraftSlot.deleteMany({
        where: { draftId, day, startTime },
      });

      return tx.timetableDraft.update({
        where: { id: draftId },
        data: { version: { increment: 1 } },
      });
    });

    return res.json({ success: true, data: { cleared: true, version: updated.version } });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/admin/designer/drafts/:draftId/availability
 */
async function getAvailability(req, res, next) {
  const draftId = parseId(req.params.draftId);
  if (!draftId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'draftId must be a positive integer' } });
  }

  try {
    const draft = await prisma.timetableDraft.findUnique({ where: { id: draftId } });
    if (!draft) {
      return res.status(404).json({ success: false, error: { code: 'DRAFT_NOT_FOUND', message: 'Draft not found' } });
    }

    const busyMap = await getFacultyBusyMap({ excludeClassId: draft.classId });
    return res.json({ success: true, data: { busyMap } });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/admin/designer/drafts/:draftId/validate
 */
async function validateDraft(req, res, next) {
  const draftId = parseId(req.params.draftId);
  if (!draftId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'draftId must be a positive integer' } });
  }

  try {
    const draft = await prisma.timetableDraft.findUnique({
      where: { id: draftId },
      include: { slots: { include: { subject: true, faculty: true, batchBFaculty: true } } },
    });

    if (!draft) {
      return res.status(404).json({ success: false, error: { code: 'DRAFT_NOT_FOUND', message: 'Draft not found' } });
    }

    const otherPublishedSlots = await prisma.timetableSlot.findMany({
      where: { classId: { not: draft.classId } },
      include: { class: true, subject: true, faculty: true, batchBFaculty: true },
    });

    const candidateSlots = draft.slots.map((s) => ({
      ...s,
      classId: draft.classId,
    }));

    const clashes = findClashes({
      candidateSlots,
      existingSlots: otherPublishedSlots,
    });

    return res.json({
      success: true,
      data: {
        isValid: clashes.length === 0,
        totalClashes: clashes.length,
        clashes,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/admin/designer/drafts/:draftId/publish
 */
async function publishDraft(req, res, next) {
  const draftId = parseId(req.params.draftId);
  if (!draftId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'draftId must be a positive integer' } });
  }

  try {
    const publishResult = await prisma.$transaction(async (tx) => {
      // 1. Take advisory lock
      await acquireClashLock(tx);

      // 2. Fetch fresh draft inside lock
      const draft = await tx.timetableDraft.findUnique({
        where: { id: draftId },
        include: {
          class: true,
          slots: { include: { subject: true, faculty: true, batchBFaculty: true } },
        },
      });

      if (!draft) {
        const err = new Error('Draft not found');
        err.status = 404;
        err.code = 'DRAFT_NOT_FOUND';
        throw err;
      }

      if (draft.status !== 'OPEN') {
        const err = new Error('Draft is not in OPEN status');
        err.status = 400;
        err.code = 'DRAFT_NOT_OPEN';
        throw err;
      }

      // 3. Re-validate against ALL other classes' published slots inside lock
      const otherPublishedSlots = await tx.timetableSlot.findMany({
        where: { classId: { not: draft.classId } },
        include: { class: true, subject: true, faculty: true, batchBFaculty: true },
      });

      const candidateSlots = draft.slots.map((s) => ({
        ...s,
        classId: draft.classId,
      }));

      assertNoClashes({
        candidateSlots,
        existingSlots: otherPublishedSlots,
      });

      // 4. Diff-based update of TimetableSlot
      const existingSlots = await tx.timetableSlot.findMany({
        where: { classId: draft.classId },
      });

      const existingByCoord = new Map(existingSlots.map((s) => [`${s.day}_${s.startTime}`, s]));
      const draftByCoord = new Map(draft.slots.map((s) => [`${s.day}_${s.startTime}`, s]));

      // Delete slots that are no longer in draft
      for (const [coord, existing] of existingByCoord.entries()) {
        if (!draftByCoord.has(coord)) {
          await tx.timetableSlot.delete({ where: { id: existing.id } });
        }
      }

      // Update or create draft slots
      const activePeriods = await tx.period.findMany({ orderBy: { order: 'asc' } });

      for (const [coord, draftSlot] of draftByCoord.entries()) {
        const { startPeriodId, endPeriodId } = resolvePeriodsFromList(draftSlot.startTime, draftSlot.endTime, activePeriods);
        const resolvedStartPeriodId = draftSlot.startPeriodId || startPeriodId;
        const resolvedEndPeriodId = draftSlot.endPeriodId || endPeriodId;

        const existing = existingByCoord.get(coord);
        if (existing) {
          // If properties changed, update; otherwise keep row id intact
          const needsUpdate = existing.endTime !== draftSlot.endTime ||
            existing.room !== draftSlot.room ||
            existing.startPeriodId !== resolvedStartPeriodId ||
            existing.endPeriodId !== resolvedEndPeriodId ||
            existing.subjectId !== draftSlot.subjectId ||
            existing.facultyId !== draftSlot.facultyId ||
            existing.batchBFacultyId !== draftSlot.batchBFacultyId;

          if (needsUpdate) {
            await tx.timetableSlot.update({
              where: { id: existing.id },
              data: {
                endTime: draftSlot.endTime,
                room: draftSlot.room,
                startPeriodId: resolvedStartPeriodId,
                endPeriodId: resolvedEndPeriodId,
                subjectId: draftSlot.subjectId,
                facultyId: draftSlot.facultyId,
                batchBFacultyId: draftSlot.batchBFacultyId,
              },
            });
          }
        } else {
          // Insert new slot
          await tx.timetableSlot.create({
            data: {
              classId: draft.classId,
              day: draftSlot.day,
              startTime: draftSlot.startTime,
              endTime: draftSlot.endTime,
              room: draftSlot.room,
              startPeriodId: resolvedStartPeriodId,
              endPeriodId: resolvedEndPeriodId,
              subjectId: draftSlot.subjectId,
              facultyId: draftSlot.facultyId,
              batchBFacultyId: draftSlot.batchBFacultyId,
            },
          });
        }
      }

      // 5. Impact Warnings: check future overrides for this class that no longer overlap any slot
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const futureOverrides = await tx.timetableOverride.findMany({
        where: {
          classId: draft.classId,
          date: { gte: today },
        },
        include: { subject: true, faculty: true },
      });

      const updatedSlots = await tx.timetableSlot.findMany({
        where: { classId: draft.classId },
      });

      const impactWarnings = [];
      for (const override of futureOverrides) {
        const overrideDay = override.date.getUTCDay() === 0 ? 6 : override.date.getUTCDay() - 1;
        const matchingSlots = updatedSlots.filter((s) => s.day === overrideDay);
        const overlapsAny = matchingSlots.some((s) => timesOverlap(override, s));

        if (!overlapsAny) {
          impactWarnings.push({
            overrideId: override.id,
            date: override.date.toISOString().slice(0, 10),
            startTime: override.startTime,
            endTime: override.endTime,
            subjectName: override.subject?.name || 'TBA',
            facultyName: override.faculty?.name || 'TBA',
            reason: 'NO_OVERLAPPING_SLOT',
            message: `Future override on ${override.date.toISOString().slice(0, 10)} (${override.startTime}–${override.endTime}) no longer overlaps any timetable slot`,
          });
        }
      }

      // 6. Mark draft as PUBLISHED
      await tx.timetableDraft.update({
        where: { id: draftId },
        data: { status: 'PUBLISHED' },
      });

      return {
        classRoom: draft.class,
        publishedSlotsCount: draft.slots.length,
        impactWarnings,
      };
    });

    logger.audit('DRAFT_PUBLISHED', {
      draftId,
      classId: publishResult.classRoom.id,
      publishedSlotsCount: publishResult.publishedSlotsCount,
      impactWarningsCount: publishResult.impactWarnings.length,
      adminUserId: req.user?.id,
    });

    await recordLog({
      action: 'DRAFT_PUBLISHED',
      performedBy: req.user?.username || 'Administrator',
      year: publishResult.classRoom.year,
      branch: publishResult.classRoom.branch,
      section: publishResult.classRoom.section,
      details: `Published timetable draft #${draftId} (${publishResult.publishedSlotsCount} sessions scheduled). ${publishResult.impactWarnings.length} override warning(s).`,
    });

    return res.json({
      success: true,
      message: `Timetable successfully published for ${classLabel(publishResult.classRoom)}`,
      data: {
        draftId,
        class: publishResult.classRoom,
        publishedSlotsCount: publishResult.publishedSlotsCount,
        impactWarnings: publishResult.impactWarnings,
      },
    });
  } catch (err) {
    if (err instanceof ClashError) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CLASH_DETECTED',
          message: err.message,
          clashes: err.clashes,
        },
      });
    }
    if (err.status && err.code) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    return next(err);
  }
}

/**
 * DELETE /api/admin/designer/drafts/:draftId
 */
async function discardDraft(req, res, next) {
  const draftId = parseId(req.params.draftId);
  if (!draftId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'draftId must be a positive integer' } });
  }

  try {
    const draft = await prisma.timetableDraft.findUnique({
      where: { id: draftId },
      include: { class: true },
    });

    if (!draft) {
      return res.status(404).json({ success: false, error: { code: 'DRAFT_NOT_FOUND', message: 'Draft not found' } });
    }

    await prisma.timetableDraft.update({
      where: { id: draftId },
      data: { status: 'DISCARDED' },
    });

    logger.audit('DRAFT_DISCARDED', { draftId, classId: draft.classId, adminUserId: req.user?.id });

    await recordLog({
      action: 'DRAFT_DISCARDED',
      performedBy: req.user?.username || 'Administrator',
      year: draft.class?.year,
      branch: draft.class?.branch,
      section: draft.class?.section,
      details: `Discarded timetable draft #${draftId} for ${draft.class ? classLabel(draft.class) : 'Class'}`,
    });

    return res.json({ success: true, message: 'Draft discarded successfully' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createDraft,
  listDrafts,
  getDraft,
  updateCell,
  clearCell,
  getAvailability,
  validateDraft,
  publishDraft,
  discardDraft,
};
