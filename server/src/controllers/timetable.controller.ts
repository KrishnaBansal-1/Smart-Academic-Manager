import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, ApiError } from '../utils/response';
import { loadSolverInput } from '../services/scheduler/dataLoader';
import { runPreflight } from '../services/scheduler/preflight';
import { runSolverJob } from '../services/scheduler/worker';
import { GenerationJob } from '../models/GenerationJob';
import { Timetable } from '../models/Timetable';
import { ScheduleSlot } from '../models/ScheduleSlot';
import { AcademicTerm } from '../models/AcademicTerm';
import { Types } from 'mongoose';

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

/**
 * POST /api/v1/timetables/preflight
 * Runs preflight validation on academic term, offerings, rooms, constraints.
 */
export const preflightTimetable = asyncHandler(async (req: Request, res: Response) => {
  const { termId, pinnedTimetableId } = preflightSchema.parse(req.body);

  const input = await loadSolverInput(termId, pinnedTimetableId);
  const result = runPreflight(input);

  sendSuccess(res, result, result.valid ? 'Preflight checks passed' : 'Preflight checks failed with errors');
});

/**
 * POST /api/v1/timetables/generate
 * Initiates an asynchronous timetable generation job running inside a worker thread.
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

  // Check if a generation job is already running for this term
  const runningJob = await GenerationJob.findOne({ termId: term._id, status: 'RUNNING' });
  if (runningJob) {
    throw new ApiError(409, 'A timetable generation job is already running for this term.');
  }

  const seed = config?.seed ?? Math.floor(Math.random() * 1000000);

  // Load input synchronously to validate existence before creating job
  const input = await loadSolverInput(term._id, pinnedTimetableId, { ...config, seed });

  // Create RUNNING job record
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

  // Trigger worker asynchronously in the background
  (async () => {
    try {
      const output = await runSolverJob(input, async (progress, _message) => {
        try {
          await GenerationJob.findByIdAndUpdate(job._id, { progress });
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
        return;
      }

      // Generation succeeded: Create a new DRAFT timetable
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

      // Insert all slots
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

      // Mark job as DONE
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
