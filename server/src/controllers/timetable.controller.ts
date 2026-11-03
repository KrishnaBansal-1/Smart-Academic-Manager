import { Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, ApiError } from '../utils/response';
import { loadSolverInput } from '../services/scheduler/dataLoader';
import { runPreflight } from '../services/scheduler/preflight';
import { runSolverJob } from '../services/scheduler/worker';
import { checkPlacement } from '../services/scheduler/conflicts';
import { evaluateSoftCost } from '../services/scheduler/cost';
import { buildOccupancyKeys } from '../services/scheduler/occupancy';
import { BookingService } from '../services/booking.service';
import { runWithTransaction } from '../utils/transaction';
import { GenerationJob } from '../models/GenerationJob';
import { Timetable } from '../models/Timetable';
import { ScheduleSlot, IScheduleSlot } from '../models/ScheduleSlot';
import { AcademicTerm } from '../models/AcademicTerm';
import { User } from '../models/User';
import { NotificationService } from '../services/notification.service';
import { emitToAll } from '../services/socket.service';
import { today } from '../utils/dateKey';
import { SolverSlot } from '../services/scheduler/types';

export const preflightSchema = z.object({
  termId: z.string().min(1, 'termId is required'),
  pinnedTimetableId: z.string().optional(),
});

export const generateSchema = z.object({
  termId: z.string().min(1, 'termId is required'),
  pinnedTimetableId: z.string().optional(),
  config: z
    .object({
      maxSeconds: z.number().min(1).max(120).optional(),
      seed: z.number().optional(),
      targetScore: z.number().optional(),
    })
    .optional(),
});

export const updateSlotSchema = z.object({
  day: z.number().min(1).max(7),
  period: z.number().min(1).max(20),
  classroomId: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
  revision: z.number(),
});

export const swapSlotsSchema = z.object({
  slotA: z.string().min(1, 'slotA is required'),
  slotB: z.string().min(1, 'slotB is required'),
  revision: z.number(),
});

export const publishSchema = z.object({
  effectiveFrom: z.string().optional(),
});

/**
 * POST /api/v1/timetables/preflight
 */
export const preflightTimetable = asyncHandler(async (req: Request, res: Response) => {
  const { termId, pinnedTimetableId } = preflightSchema.parse(req.body);
  const input = await loadSolverInput(termId, pinnedTimetableId);
  const result = runPreflight(input);
  sendSuccess(res, result, result.valid ? 'Preflight checks passed' : 'Preflight checks failed with errors');
});

/**
 * POST /api/v1/timetables/generate
 */
export const generateTimetable = asyncHandler(async (req: Request, res: Response) => {
  const { termId, pinnedTimetableId, config } = generateSchema.parse(req.body);
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const term = await AcademicTerm.findById(termId);
  if (!term) {
    throw new ApiError(404, 'Academic term not found');
  }

  const runningJob = await GenerationJob.findOne({ termId: term._id, status: 'RUNNING' });
  if (runningJob) {
    throw new ApiError(409, 'A timetable generation job is already running for this term.');
  }

  const seed = config?.seed ?? Math.floor(Math.random() * 1000000);
  const input = await loadSolverInput(term._id, pinnedTimetableId, { ...config, seed });

  let job;
  try {
    job = await GenerationJob.create({
      termId: term._id,
      status: 'RUNNING',
      progress: 0,
      config: config || {},
      seed,
    });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
      throw new ApiError(409, 'A timetable generation job is already running for this term.');
    }
    throw err;
  }

  (async () => {
    try {
      const output = await runSolverJob(input, async (progress, message) => {
        try {
          await GenerationJob.findByIdAndUpdate(job._id, { progress });
          emitToAll('generation:update', { jobId: job._id.toString(), progress, message, status: 'RUNNING' });
        } catch {
          // ignore transient progress update errors
        }
      });

      if (output.error) {
        await GenerationJob.findByIdAndUpdate(job._id, {
          status: 'FAILED',
          error: output.error,
          progress: 100,
          metrics: output.metrics,
          unplaced: output.unplaced,
        });
        emitToAll('generation:update', {
          jobId: job._id.toString(),
          status: 'FAILED',
          progress: 100,
          error: output.error,
          metrics: output.metrics,
        });
        return;
      }

      const draftCount = await Timetable.countDocuments({ termId: term._id });
      const timetableTitle = `${term.name} - Draft ${draftCount + 1}`;

      const timetable = await Timetable.create({
        title: timetableTitle,
        termId: term._id,
        status: 'DRAFT',
        revision: 1,
        basedOnTimetableId: pinnedTimetableId ? new Types.ObjectId(pinnedTimetableId) : undefined,
        generationJobId: job._id,
        softScore: output.metrics.softScore,
        createdBy: userId,
      });

      const slotsToInsert = output.slots.map((s) => ({
        timetableId: timetable._id,
        lineageId: s.lineageId,
        offeringId: s.offeringId ? new Types.ObjectId(s.offeringId) : undefined,
        courseId: new Types.ObjectId(s.courseId),
        batchId: new Types.ObjectId(s.batchId),
        professorIds: s.professorIds.map((p) => new Types.ObjectId(p)),
        classroomId: s.classroomId ? new Types.ObjectId(s.classroomId) : null,
        dayOfWeek: s.dayOfWeek,
        slotIndex: s.slotIndex,
        durationSlots: s.durationSlots,
        kind: s.kind,
        pinned: s.pinned,
        placed: s.placed,
        unplacedReason: s.unplacedReason,
        occupancyKeys: s.occupancyKeys || [],
      }));

      if (slotsToInsert.length > 0) {
        await ScheduleSlot.insertMany(slotsToInsert);
      }

      await GenerationJob.findByIdAndUpdate(job._id, {
        status: 'DONE',
        progress: 100,
        timetableId: timetable._id,
        metrics: output.metrics,
        unplaced: output.unplaced.map((u) => ({
          offeringId: u.offeringId ? new Types.ObjectId(u.offeringId) : undefined,
          kind: u.kind,
          reason: u.reason,
        })),
      });

      emitToAll('generation:update', {
        jobId: job._id.toString(),
        status: 'DONE',
        progress: 100,
        timetableId: timetable._id.toString(),
        metrics: output.metrics,
      });
    } catch (workerErr: unknown) {
      const errMessage = workerErr instanceof Error ? workerErr.message : String(workerErr);
      await GenerationJob.findByIdAndUpdate(job._id, {
        status: 'FAILED',
        error: errMessage,
      }).catch(() => {});
    }
  })();

  sendSuccess(res, { jobId: job._id }, 'Timetable generation started', 202);
});

/**
 * Helper to convert IScheduleSlot to SolverSlot
 */
function toSolverSlot(s: IScheduleSlot): SolverSlot {
  return {
    lineageId: s.lineageId,
    offeringId: s.offeringId ? s.offeringId.toString() : '',
    courseId: s.courseId.toString(),
    batchId: s.batchId.toString(),
    professorIds: (s.professorIds || []).map((p) => p.toString()),
    classroomId: s.classroomId ? s.classroomId.toString() : null,
    dayOfWeek: s.dayOfWeek,
    slotIndex: s.slotIndex,
    durationSlots: s.durationSlots || 1,
    kind: s.kind,
    pinned: Boolean(s.pinned),
    placed: Boolean(s.placed),
    unplacedReason: s.unplacedReason,
    occupancyKeys: s.occupancyKeys || [],
  };
}

/**
 * GET /api/v1/timetables?termId=
 */
export const listTimetables = asyncHandler(async (req: Request, res: Response) => {
  const { termId } = req.query;
  const filter: Record<string, unknown> = {};
  if (termId && typeof termId === 'string') {
    filter.termId = new Types.ObjectId(termId);
  }

  const timetables = await Timetable.find(filter)
    .populate('termId', 'name academicYear semesterType startDate endDate')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  const result = await Promise.all(
    timetables.map(async (tt) => {
      const totalSlots = await ScheduleSlot.countDocuments({ timetableId: tt._id });
      const placedSlots = await ScheduleSlot.countDocuments({ timetableId: tt._id, placed: true });
      const unplacedSlots = await ScheduleSlot.countDocuments({ timetableId: tt._id, placed: false });
      return {
        ...tt.toObject(),
        totalSlots,
        placedSlots,
        unplacedSlots,
      };
    })
  );

  sendSuccess(res, result, 'Timetables fetched successfully');
});

/**
 * GET /api/v1/timetables/:id?batchId|professorId|roomId
 */
export const getTimetableDetails = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { batchId, professorId, roomId } = req.query;

  const timetable = await Timetable.findById(id)
    .populate('termId')
    .populate('createdBy', 'name email');

  if (!timetable) {
    throw new ApiError(404, 'Timetable not found');
  }

  const slotFilter: Record<string, unknown> = { timetableId: timetable._id };
  if (batchId && typeof batchId === 'string') {
    slotFilter.batchId = new Types.ObjectId(batchId);
  }
  if (professorId && typeof professorId === 'string') {
    slotFilter.professorIds = new Types.ObjectId(professorId);
  }
  if (roomId && typeof roomId === 'string') {
    slotFilter.classroomId = new Types.ObjectId(roomId);
  }

  const slots = await ScheduleSlot.find(slotFilter)
    .populate('courseId', 'code title weeklyTheoryHours weeklyLabHours')
    .populate('batchId', 'name semester section departmentId')
    .populate('professorIds', 'firstName lastName email departmentId')
    .populate('classroomId', 'name capacity type')
    .sort({ dayOfWeek: 1, slotIndex: 1 });

  // Also fetch all unplaced slots for this timetable (always visible in tray)
  const unplacedSlots = await ScheduleSlot.find({ timetableId: timetable._id, placed: false })
    .populate('courseId', 'code title')
    .populate('batchId', 'name semester section')
    .populate('professorIds', 'firstName lastName email');

  sendSuccess(
    res,
    {
      timetable,
      term: timetable.termId,
      slots,
      unplacedSlots,
    },
    'Timetable details fetched'
  );
});

/**
 * GET /api/v1/timetables/:id/slots/:slotId/drop-map
 */
export const getSlotDropMap = asyncHandler(async (req: Request, res: Response) => {
  const { id, slotId } = req.params;

  const timetable = await Timetable.findById(id);
  if (!timetable) {
    throw new ApiError(404, 'Timetable not found');
  }

  const slotDoc = await ScheduleSlot.findOne({ _id: slotId, timetableId: timetable._id });
  if (!slotDoc) {
    throw new ApiError(404, 'Slot not found in timetable');
  }

  const term = await AcademicTerm.findById(timetable.termId);
  if (!term) {
    throw new ApiError(404, 'Term not found for timetable');
  }

  const allSlots = await ScheduleSlot.find({ timetableId: timetable._id });
  const solverSlots = allSlots.map(toSolverSlot);
  const candSolver = toSolverSlot(slotDoc);

  const input = await loadSolverInput(term._id);

  const duration = candSolver.durationSlots || 1;
  const batch = input.batches.find((b) => b.id === candSolver.batchId);
  const batchSize = batch?.studentCount || 1;

  // Active rooms of suitable type and capacity
  const suitableRooms = input.rooms.filter((r) => {
    if (candSolver.kind === 'LAB') {
      return r.type === 'LABORATORY' && r.capacity >= batchSize;
    }
    return r.type !== 'LABORATORY' && r.capacity >= batchSize;
  });

  const otherSlots = solverSlots.filter((s) => s.lineageId !== candSolver.lineageId && s.placed);

  const dropMap: Record<
    string,
    {
      day: number;
      period: number;
      state: 'GREEN' | 'YELLOW' | 'RED';
      suggestedRoomId?: string;
      suggestedRoomName?: string;
      reasons: string[];
      warnings: string[];
      swapValid?: boolean;
      occupantSlotId?: string;
    }
  > = {};

  const workingDays = term.workingDays;
  const periods = term.periods;

  for (const day of workingDays) {
    for (const periodItem of periods) {
      const p = periodItem.index;
      const key = `${day}:${p}`;

      const endPeriod = p + duration - 1;
      const periodRangeBlocked = periods
        .filter((item) => item.index >= p && item.index <= endPeriod)
        .some((item) => item.blocked);

      const maxGridPeriod = Math.max(...periods.map((x) => x.index));

      if (periodRangeBlocked || endPeriod > maxGridPeriod) {
        dropMap[key] = {
          day,
          period: p,
          state: 'RED',
          reasons: periodRangeBlocked
            ? ['Overlaps blocked period or break']
            : ['Exceeds grid period boundaries'],
          warnings: [],
        };
        continue;
      }

      let chosenRoom = suitableRooms.find((r) => r.id === candSolver.classroomId);
      let roomChanged = false;

      if (chosenRoom) {
        const isOccupied = otherSlots.some(
          (s) =>
            s.dayOfWeek === day &&
            s.classroomId === chosenRoom!.id &&
            Math.max(p, s.slotIndex) <= Math.min(endPeriod, s.slotIndex + (s.durationSlots || 1) - 1)
        );
        if (isOccupied) {
          chosenRoom = undefined;
        }
      }

      if (!chosenRoom) {
        for (const room of suitableRooms) {
          const isOccupied = otherSlots.some(
            (s) =>
              s.dayOfWeek === day &&
              s.classroomId === room.id &&
              Math.max(p, s.slotIndex) <= Math.min(endPeriod, s.slotIndex + (s.durationSlots || 1) - 1)
          );
          if (!isOccupied) {
            chosenRoom = room;
            if (candSolver.classroomId && candSolver.classroomId !== room.id) {
              roomChanged = true;
            }
            break;
          }
        }
      }

      const candidate: SolverSlot = {
        ...candSolver,
        dayOfWeek: day,
        slotIndex: p,
        classroomId: chosenRoom ? chosenRoom.id : null,
        placed: true,
      };

      const violations = checkPlacement(
        { slots: otherSlots },
        candidate,
        input
      );

      if (!chosenRoom && suitableRooms.length > 0) {
        violations.push({
          type: 'ROOM_CLASH',
          message: 'No suitable classroom available at this time.',
        });
      }

      if (violations.length > 0) {
        let swapValid = false;
        let occupantSlotId: string | undefined;

        const overlappingOccupants = otherSlots.filter((s) => {
          if (s.dayOfWeek !== day) return false;
          const sOverlap = Math.max(p, s.slotIndex) <= Math.min(endPeriod, s.slotIndex + (s.durationSlots || 1) - 1);
          if (!sOverlap) return false;
          const sameBatch = s.batchId === candidate.batchId;
          const sameProf = (s.professorIds || []).some((prof) => (candidate.professorIds || []).includes(prof));
          const sameRoom = candidate.classroomId && s.classroomId === candidate.classroomId;
          return sameBatch || sameProf || sameRoom;
        });

        if (overlappingOccupants.length === 1 && candSolver.placed) {
          const occ = overlappingOccupants[0];
          const swapCand: SolverSlot = {
            ...candidate,
            classroomId: occ.classroomId || candidate.classroomId,
          };
          const swapOcc: SolverSlot = {
            ...occ,
            dayOfWeek: candSolver.dayOfWeek,
            slotIndex: candSolver.slotIndex,
            classroomId: candSolver.classroomId || occ.classroomId,
          };

          const rest = otherSlots.filter((s) => s.lineageId !== occ.lineageId);
          const v1 = checkPlacement({ slots: [...rest, swapOcc] }, swapCand, input);
          const v2 = checkPlacement({ slots: [...rest, swapCand] }, swapOcc, input);

          if (v1.length === 0 && v2.length === 0) {
            swapValid = true;
            const originalOccDoc = allSlots.find((s) => s.lineageId === occ.lineageId);
            occupantSlotId = originalOccDoc?._id.toString();
          }
        }

        dropMap[key] = {
          day,
          period: p,
          state: 'RED',
          reasons: violations.map((v) => v.message),
          warnings: [],
          swapValid,
          occupantSlotId,
        };
      } else {
        const warnings: string[] = [];

        if (roomChanged && chosenRoom) {
          warnings.push(`Room changes to ${chosenRoom.name}`);
        }

        for (const profId of candidate.professorIds || []) {
          const constraint = input.constraints.find((c) => c.professorId === profId);
          if (constraint) {
            for (let subP = p; subP <= endPeriod; subP += 1) {
              const inUnavailable = (constraint.unavailableWindows || []).some(
                (w) => w.dayOfWeek === day && subP >= w.startSlot && subP <= w.endSlot
              );
              if (inUnavailable) {
                warnings.push(`Outside Prof. preferred time (marked unavailable)`);
                break;
              }
            }
            if (constraint.preferredWindows && constraint.preferredWindows.length > 0) {
              const inPreferred = constraint.preferredWindows.some(
                (w) => w.dayOfWeek === day && p >= w.startSlot && endPeriod <= w.endSlot
              );
              if (!inPreferred) {
                warnings.push(`Outside Prof. preferred window`);
              }
            }
          }
        }

        if (candidate.kind === 'THEORY') {
          const sameDayTheory = otherSlots.some(
            (s) =>
              s.placed &&
              s.dayOfWeek === day &&
              s.batchId === candidate.batchId &&
              s.courseId === candidate.courseId
          );
          if (sameDayTheory) {
            warnings.push('Another theory class for this course is already scheduled on this day');
          }
        }

        dropMap[key] = {
          day,
          period: p,
          state: warnings.length > 0 ? 'YELLOW' : 'GREEN',
          suggestedRoomId: chosenRoom?.id,
          suggestedRoomName: chosenRoom?.name,
          reasons: [],
          warnings,
        };
      }
    }
  }

  sendSuccess(res, dropMap, 'Drop map computed');
});

/**
 * PATCH /api/v1/timetables/:id/slots/:slotId
 */
export const updateTimetableSlot = asyncHandler(async (req: Request, res: Response) => {
  const { id, slotId } = req.params;
  const { day, period, classroomId, pinned, revision } = updateSlotSchema.parse(req.body);

  const timetable = await Timetable.findById(id);
  if (!timetable) {
    throw new ApiError(404, 'Timetable not found');
  }

  if (timetable.status === 'PUBLISHED') {
    throw new ApiError(400, 'Published timetables cannot be modified. Clone to a draft first.');
  }

  if (timetable.revision !== revision) {
    throw new ApiError(
      409,
      `Conflict: Timetable revision mismatch (expected ${timetable.revision}, received ${revision}). Please reload the timetable.`
    );
  }

  const slot = await ScheduleSlot.findOne({ _id: slotId, timetableId: timetable._id });
  if (!slot) {
    throw new ApiError(404, 'Slot not found in timetable');
  }

  const term = await AcademicTerm.findById(timetable.termId);
  if (!term) {
    throw new ApiError(404, 'Term not found');
  }

  const input = await loadSolverInput(term._id);
  const allSlots = await ScheduleSlot.find({ timetableId: timetable._id });
  const otherSlots = allSlots
    .filter((s) => s._id.toString() !== slot._id.toString() && s.placed)
    .map(toSolverSlot);

  const targetRoomId =
    classroomId !== undefined
      ? classroomId || null
      : slot.classroomId
        ? slot.classroomId.toString()
        : null;

  const candidate: SolverSlot = {
    lineageId: slot.lineageId,
    offeringId: slot.offeringId ? slot.offeringId.toString() : '',
    courseId: slot.courseId.toString(),
    batchId: slot.batchId.toString(),
    professorIds: (slot.professorIds || []).map((p) => p.toString()),
    classroomId: targetRoomId,
    dayOfWeek: day,
    slotIndex: period,
    durationSlots: slot.durationSlots || 1,
    kind: slot.kind,
    pinned: pinned !== undefined ? pinned : slot.pinned,
    placed: true,
  };

  const violations = checkPlacement({ slots: otherSlots }, candidate, input);
  if (violations.length > 0) {
    throw new ApiError(
      409,
      `Cannot place slot: ${violations.map((v) => v.message).join('; ')}`,
      { violations }
    );
  }

  slot.dayOfWeek = day;
  slot.slotIndex = period;
  if (classroomId !== undefined) {
    slot.classroomId = classroomId ? new Types.ObjectId(classroomId) : null;
  }
  if (pinned !== undefined) {
    slot.pinned = pinned;
  }
  slot.placed = true;
  slot.unplacedReason = undefined;
  slot.occupancyKeys = buildOccupancyKeys({
    professorIds: slot.professorIds,
    batchId: slot.batchId,
    classroomId: slot.classroomId,
    dayOfWeek: slot.dayOfWeek,
    slotIndex: slot.slotIndex,
    durationSlots: slot.durationSlots,
  });

  await slot.save();

  timetable.revision += 1;

  const updatedSlots = await ScheduleSlot.find({ timetableId: timetable._id });
  const evalResult = evaluateSoftCost(updatedSlots.map(toSolverSlot), input);
  timetable.softScore = evalResult.softScore;
  await timetable.save();

  const populatedSlot = await ScheduleSlot.findById(slot._id)
    .populate('courseId', 'code title weeklyTheoryHours weeklyLabHours')
    .populate('batchId', 'name semester section departmentId')
    .populate('professorIds', 'firstName lastName email departmentId')
    .populate('classroomId', 'name capacity type');

  sendSuccess(
    res,
    {
      slot: populatedSlot,
      revision: timetable.revision,
      softScore: timetable.softScore,
    },
    'Slot updated successfully'
  );
});

/**
 * POST /api/v1/timetables/:id/slots/swap
 */
export const swapTimetableSlots = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { slotA: slotAId, slotB: slotBId, revision } = swapSlotsSchema.parse(req.body);

  const timetable = await Timetable.findById(id);
  if (!timetable) {
    throw new ApiError(404, 'Timetable not found');
  }

  if (timetable.status === 'PUBLISHED') {
    throw new ApiError(400, 'Published timetables cannot be modified. Clone to draft first.');
  }

  if (timetable.revision !== revision) {
    throw new ApiError(
      409,
      `Conflict: Timetable revision mismatch (expected ${timetable.revision}, received ${revision}). Please reload.`
    );
  }

  const [slotA, slotB] = await Promise.all([
    ScheduleSlot.findOne({ _id: slotAId, timetableId: timetable._id }),
    ScheduleSlot.findOne({ _id: slotBId, timetableId: timetable._id }),
  ]);

  if (!slotA || !slotB) {
    throw new ApiError(404, 'One or both slots not found in this timetable');
  }

  const term = await AcademicTerm.findById(timetable.termId);
  if (!term) {
    throw new ApiError(404, 'Term not found');
  }

  const input = await loadSolverInput(term._id);
  const allSlots = await ScheduleSlot.find({ timetableId: timetable._id });

  const backgroundSlots = allSlots
    .filter((s) => s._id.toString() !== slotAId && s._id.toString() !== slotBId && s.placed)
    .map(toSolverSlot);

  const candidateA: SolverSlot = {
    ...toSolverSlot(slotA),
    dayOfWeek: slotB.dayOfWeek,
    slotIndex: slotB.slotIndex,
    classroomId: slotA.classroomId ? slotA.classroomId.toString() : null,
    placed: true,
  };

  const candidateB: SolverSlot = {
    ...toSolverSlot(slotB),
    dayOfWeek: slotA.dayOfWeek,
    slotIndex: slotA.slotIndex,
    classroomId: slotB.classroomId ? slotB.classroomId.toString() : null,
    placed: true,
  };

  const violationsA = checkPlacement(
    { slots: [...backgroundSlots, candidateB] },
    candidateA,
    input
  );
  const violationsB = checkPlacement(
    { slots: [...backgroundSlots, candidateA] },
    candidateB,
    input
  );

  const allViolations = [...violationsA, ...violationsB];
  if (allViolations.length > 0) {
    throw new ApiError(
      409,
      `Cannot swap slots: ${allViolations.map((v) => v.message).join('; ')}`,
      { violations: allViolations }
    );
  }

  await runWithTransaction(async (session) => {
    // Step 1: Move A to TMP keys to avoid multikey collisions
    slotA.occupancyKeys = [`TMP:${slotA._id}`];
    await slotA.save({ session });

    // Step 2: Set B to A's original position
    const aDay = slotA.dayOfWeek;
    const aIndex = slotA.slotIndex;
    const bDay = slotB.dayOfWeek;
    const bIndex = slotB.slotIndex;

    slotB.dayOfWeek = aDay;
    slotB.slotIndex = aIndex;
    slotB.occupancyKeys = buildOccupancyKeys({
      professorIds: slotB.professorIds,
      batchId: slotB.batchId,
      classroomId: slotB.classroomId,
      dayOfWeek: aDay,
      slotIndex: aIndex,
      durationSlots: slotB.durationSlots,
    });
    await slotB.save({ session });

    // Step 3: Set A to B's original position
    slotA.dayOfWeek = bDay;
    slotA.slotIndex = bIndex;
    slotA.occupancyKeys = buildOccupancyKeys({
      professorIds: slotA.professorIds,
      batchId: slotA.batchId,
      classroomId: slotA.classroomId,
      dayOfWeek: bDay,
      slotIndex: bIndex,
      durationSlots: slotA.durationSlots,
    });
    await slotA.save({ session });

    // Step 4: Increment revision
    timetable.revision += 1;
    await timetable.save({ session });
  });

  const updatedSlots = await ScheduleSlot.find({ timetableId: timetable._id });
  const evalResult = evaluateSoftCost(updatedSlots.map(toSolverSlot), input);
  timetable.softScore = evalResult.softScore;
  await timetable.save();

  const [finalA, finalB] = await Promise.all([
    ScheduleSlot.findById(slotA._id)
      .populate('courseId', 'code title weeklyTheoryHours weeklyLabHours')
      .populate('batchId', 'name semester section departmentId')
      .populate('professorIds', 'firstName lastName email departmentId')
      .populate('classroomId', 'name capacity type'),
    ScheduleSlot.findById(slotB._id)
      .populate('courseId', 'code title weeklyTheoryHours weeklyLabHours')
      .populate('batchId', 'name semester section departmentId')
      .populate('professorIds', 'firstName lastName email departmentId')
      .populate('classroomId', 'name capacity type'),
  ]);

  sendSuccess(
    res,
    {
      slots: [finalA, finalB],
      revision: timetable.revision,
      softScore: timetable.softScore,
    },
    'Slots swapped successfully'
  );
});

/**
 * POST /api/v1/timetables/:id/clone
 */
export const cloneTimetable = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const sourceTimetable = await Timetable.findById(id);
  if (!sourceTimetable) {
    throw new ApiError(404, 'Source timetable not found');
  }

  const draftCount = await Timetable.countDocuments({ termId: sourceTimetable.termId });
  const newTitle = `${sourceTimetable.title} (Draft ${draftCount + 1})`;

  const newTimetable = await Timetable.create({
    title: newTitle,
    termId: sourceTimetable.termId,
    status: 'DRAFT',
    revision: 1,
    basedOnTimetableId: sourceTimetable._id,
    generationJobId: sourceTimetable.generationJobId,
    softScore: sourceTimetable.softScore,
    createdBy: userId,
  });

  const slots = await ScheduleSlot.find({ timetableId: sourceTimetable._id });
  const clonedSlots = slots.map((s) => ({
    timetableId: newTimetable._id,
    lineageId: s.lineageId,
    offeringId: s.offeringId,
    courseId: s.courseId,
    batchId: s.batchId,
    professorIds: s.professorIds,
    classroomId: s.classroomId,
    dayOfWeek: s.dayOfWeek,
    slotIndex: s.slotIndex,
    durationSlots: s.durationSlots,
    kind: s.kind,
    pinned: s.pinned,
    placed: s.placed,
    unplacedReason: s.unplacedReason,
    occupancyKeys: s.occupancyKeys,
  }));

  if (clonedSlots.length > 0) {
    await ScheduleSlot.insertMany(clonedSlots);
  }

  sendSuccess(res, newTimetable, 'Timetable cloned to draft successfully', 201);
});

/**
 * POST /api/v1/timetables/:id/validate
 */
export const validateTimetable = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const timetable = await Timetable.findById(id);
  if (!timetable) {
    throw new ApiError(404, 'Timetable not found');
  }

  const term = await AcademicTerm.findById(timetable.termId);
  if (!term) {
    throw new ApiError(404, 'Term not found');
  }

  const slots = await ScheduleSlot.find({ timetableId: timetable._id });
  const unplacedCount = slots.filter((s) => !s.placed).length;

  const input = await loadSolverInput(term._id);
  const solverSlots = slots.map(toSolverSlot);
  const placedSlots = solverSlots.filter((s) => s.placed);

  const violations: string[] = [];

  for (let i = 0; i < placedSlots.length; i += 1) {
    const candidate = placedSlots[i];
    const prevSlots = placedSlots.slice(0, i);
    const v = checkPlacement({ slots: prevSlots }, candidate, input);
    for (const item of v) {
      violations.push(item.message);
    }
  }

  const evalResult = evaluateSoftCost(solverSlots, input);

  sendSuccess(
    res,
    {
      valid: violations.length === 0 && unplacedCount === 0,
      violations,
      warnings: evalResult.warnings,
      softScore: evalResult.softScore,
      unplacedCount,
    },
    'Timetable validation complete'
  );
});

/**
 * POST /api/v1/timetables/:id/publish
 */
export const publishTimetable = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { effectiveFrom } = publishSchema.parse(req.body || {});

  const timetable = await Timetable.findById(id);
  if (!timetable) {
    throw new ApiError(404, 'Timetable not found');
  }

  if (timetable.status === 'PUBLISHED') {
    throw new ApiError(400, 'Timetable is already published');
  }

  const term = await AcademicTerm.findById(timetable.termId);
  if (!term) {
    throw new ApiError(404, 'Term not found for timetable');
  }

  const slots = await ScheduleSlot.find({ timetableId: timetable._id });
  const unplacedSlots = slots.filter((s) => !s.placed);
  if (unplacedSlots.length > 0) {
    throw new ApiError(
      409,
      `Cannot publish timetable with ${unplacedSlots.length} unplaced classes. All classes must be placed.`
    );
  }

  const input = await loadSolverInput(term._id);
  const solverSlots = slots.map(toSolverSlot);
  const violations: string[] = [];

  for (let i = 0; i < solverSlots.length; i += 1) {
    const candidate = solverSlots[i];
    const prev = solverSlots.slice(0, i);
    const v = checkPlacement({ slots: prev }, candidate, input);
    if (v.length > 0) {
      violations.push(...v.map((x) => x.message));
    }
  }

  if (violations.length > 0) {
    throw new ApiError(
      409,
      `Cannot publish timetable due to hard conflicts: ${violations.join('; ')}`,
      { violations }
    );
  }

  const effectiveDateKey = effectiveFrom || (today() > term.startDate ? today() : term.startDate);

  await runWithTransaction(async (session) => {
    // 1. Expand weekly to Booking arbiter
    await BookingService.expandWeeklyToBookings(term, slots, effectiveDateKey, session);

    // 2. Add version to term
    term.versions.push({
      timetableId: timetable._id,
      effectiveFrom: effectiveDateKey,
    });
    await term.save({ session });

    // 3. Update timetable status
    timetable.status = 'PUBLISHED';
    timetable.publishedAt = new Date();
    await timetable.save({ session });

    // 4. Notify affected students and professors
    const professorIds = Array.from(
      new Set(
        slots.flatMap((s) => (s.professorIds || []).map((p) => p.toString()))
      )
    );
    const batchIds = Array.from(new Set(slots.map((s) => s.batchId.toString())));

    const students = await User.find({
      batchId: { $in: batchIds },
      role: 'STUDENT',
      isActive: true,
    });

    const notificationsToInsert = [
      ...professorIds.map((profId) => ({
        recipientId: new Types.ObjectId(profId),
        type: 'TIMETABLE_PUBLISHED' as const,
        title: 'Timetable Published',
        body: `The timetable for ${term.name} has been published.`,
        link: '/professor/schedule',
        dedupeKey: `timetable:publish:${timetable._id}:${profId}`,
      })),
      ...students.map((student) => ({
        recipientId: student._id,
        type: 'TIMETABLE_PUBLISHED' as const,
        title: 'Timetable Published',
        body: `The timetable for ${term.name} has been published.`,
        link: '/student/timetable',
        dedupeKey: `timetable:publish:${timetable._id}:${student._id}`,
      })),
    ];

    if (notificationsToInsert.length > 0) {
      await NotificationService.notifyMany(session, notificationsToInsert);
    }
  });

  sendSuccess(res, timetable, 'Timetable published successfully');
});

/**
 * DELETE /api/v1/timetables/:id
 */
export const deleteTimetable = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const timetable = await Timetable.findById(id);
  if (!timetable) {
    throw new ApiError(404, 'Timetable not found');
  }

  if (timetable.status === 'PUBLISHED') {
    throw new ApiError(400, 'Cannot delete a published timetable. Clone to draft or archive instead.');
  }

  await ScheduleSlot.deleteMany({ timetableId: timetable._id });
  await Timetable.findByIdAndDelete(timetable._id);

  sendSuccess(res, null, 'Draft timetable deleted successfully');
});
