import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, ApiError } from '../utils/response';
import { SoftConstraint, ITimeWindow } from '../models/SoftConstraint';
import { AcademicTerm } from '../models/AcademicTerm';

const timeWindowSchema = z
  .object({
    dayOfWeek: z.number().int().min(1).max(7),
    startSlot: z.number().int().min(1).max(20),
    endSlot: z.number().int().min(1).max(20),
  })
  .refine((w) => w.startSlot <= w.endSlot, {
    message: 'startSlot must be less than or equal to endSlot',
    path: ['startSlot'],
  });

export const putConstraintMeSchema = z.object({
  termId: z.string().min(1, 'termId is required'),
  preferredTimeWindows: z.array(timeWindowSchema).default([]),
  unavailableWindows: z.array(timeWindowSchema).default([]),
  maxDailyHours: z.number().int().min(1).max(12).default(4),
});

export const patchPrioritySchema = z.object({
  priorityWeight: z.number().int().min(1).max(5),
});

function validateWindowsAgainstGrid(
  windows: ITimeWindow[],
  validPeriodIndices: Set<number>,
  validWorkingDays: Set<number>,
  windowType: string
): void {
  for (const w of windows) {
    if (!validWorkingDays.has(w.dayOfWeek)) {
      throw new ApiError(400, `${windowType} contains dayOfWeek ${w.dayOfWeek} which is not a working day in this term`);
    }
    for (let slot = w.startSlot; slot <= w.endSlot; slot += 1) {
      if (!validPeriodIndices.has(slot)) {
        throw new ApiError(400, `${windowType} slot ${slot} does not exist in the term period grid`);
      }
    }
  }
}

export const getMyConstraints = asyncHandler(async (req: Request, res: Response) => {
  const professorId = req.user!._id;
  let termId = req.query.termId as string | undefined;

  if (!termId) {
    const activeTerm = await AcademicTerm.findOne({ isActive: true });
    if (!activeTerm) {
      sendSuccess(res, null, 'No active term configured');
      return;
    }
    termId = activeTerm._id.toString();
  }

  const constraint = await SoftConstraint.findOne({ professorId, termId })
    .populate('termId', 'name academicYear semesterType workingDays periods')
    .populate('professorId', 'firstName lastName email departmentId');

  sendSuccess(res, constraint, 'Professor constraints fetched');
});

export const updateMyConstraints = asyncHandler(async (req: Request, res: Response) => {
  const professorId = req.user!._id;
  const { termId, preferredTimeWindows, unavailableWindows, maxDailyHours } = req.body;

  const term = await AcademicTerm.findById(termId);
  if (!term) {
    throw new ApiError(404, 'Academic term not found');
  }

  const validPeriodIndices = new Set(term.periods.map((p) => p.index));
  const validWorkingDays = new Set(term.workingDays);

  validateWindowsAgainstGrid(preferredTimeWindows, validPeriodIndices, validWorkingDays, 'preferredTimeWindows');
  validateWindowsAgainstGrid(unavailableWindows, validPeriodIndices, validWorkingDays, 'unavailableWindows');

  let constraint = await SoftConstraint.findOne({ professorId, termId });
  if (constraint) {
    constraint.preferredTimeWindows = preferredTimeWindows;
    constraint.unavailableWindows = unavailableWindows;
    constraint.maxDailyHours = maxDailyHours;
    await constraint.save();
  } else {
    constraint = await SoftConstraint.create({
      professorId,
      termId,
      preferredTimeWindows,
      unavailableWindows,
      maxDailyHours,
      priorityWeight: 3, // Default priority set for new constraint
    });
  }

  const populated = await SoftConstraint.findById(constraint._id)
    .populate('termId', 'name academicYear semesterType workingDays periods')
    .populate('professorId', 'firstName lastName email');

  sendSuccess(res, populated, 'Teaching preferences updated successfully');
});

export const listConstraints = asyncHandler(async (req: Request, res: Response) => {
  let termId = req.query.termId as string | undefined;

  if (!termId) {
    const activeTerm = await AcademicTerm.findOne({ isActive: true });
    if (activeTerm) {
      termId = activeTerm._id.toString();
    }
  }

  const query: Record<string, unknown> = {};
  if (termId) {
    query.termId = termId;
  }

  const constraints = await SoftConstraint.find(query)
    .populate('professorId', 'firstName lastName email departmentId')
    .populate('termId', 'name academicYear')
    .sort({ priorityWeight: -1, createdAt: 1 });

  sendSuccess(res, { items: constraints }, 'Faculty constraints fetched successfully');
});

export const updateConstraintPriority = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { priorityWeight } = req.body;

  const constraint = await SoftConstraint.findById(id);
  if (!constraint) {
    throw new ApiError(404, 'Faculty constraint not found');
  }

  constraint.priorityWeight = priorityWeight;
  await constraint.save();

  const populated = await SoftConstraint.findById(constraint._id)
    .populate('professorId', 'firstName lastName email departmentId')
    .populate('termId', 'name academicYear');

  sendSuccess(res, populated, 'Constraint priority weight updated successfully');
});
