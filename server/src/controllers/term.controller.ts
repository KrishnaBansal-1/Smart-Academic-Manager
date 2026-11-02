import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, ApiError } from '../utils/response';
import { AcademicTerm } from '../models/AcademicTerm';
import { Timetable } from '../models/Timetable';
import { ScheduleSlot } from '../models/ScheduleSlot';
import { isValidDateKey, getISODayOfWeek, IPeriodGridItem } from '../utils/dateKey';

const periodSchema = z.object({
  index: z.number().int().positive(),
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:mm format'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:mm format'),
  blocked: z.boolean().optional().default(false),
  label: z.string().min(1),
});

export const createTermSchema = z
  .object({
    name: z.string().min(1),
    academicYear: z.string().min(1),
    semesterType: z.enum(['ODD', 'EVEN']),
    startDate: z.string().refine(isValidDateKey, 'Invalid startDate dateKey (YYYY-MM-DD)'),
    endDate: z.string().refine(isValidDateKey, 'Invalid endDate dateKey (YYYY-MM-DD)'),
    workingDays: z.array(z.number().int().min(1).max(7)).min(1),
    periods: z.array(periodSchema).min(1),
    holidays: z
      .array(
        z.object({
          dateKey: z.string().refine(isValidDateKey, 'Invalid holiday dateKey'),
          label: z.string().min(1),
        })
      )
      .optional()
      .default([]),
    isActive: z.boolean().optional().default(false),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: 'startDate must be before or equal to endDate',
    path: ['startDate'],
  });

export const updateTermSchema = z
  .object({
    name: z.string().min(1).optional(),
    academicYear: z.string().min(1).optional(),
    semesterType: z.enum(['ODD', 'EVEN']).optional(),
    startDate: z.string().refine(isValidDateKey, 'Invalid startDate dateKey (YYYY-MM-DD)').optional(),
    endDate: z.string().refine(isValidDateKey, 'Invalid endDate dateKey (YYYY-MM-DD)').optional(),
    workingDays: z.array(z.number().int().min(1).max(7)).min(1).optional(),
    periods: z.array(periodSchema).min(1).optional(),
    holidays: z
      .array(
        z.object({
          dateKey: z.string().refine(isValidDateKey, 'Invalid holiday dateKey'),
          label: z.string().min(1),
        })
      )
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    {
      message: 'startDate must be before or equal to endDate',
      path: ['startDate'],
    }
  );

export const holidaySchema = z.object({
  dateKey: z.string().refine(isValidDateKey, 'Invalid dateKey for holiday (YYYY-MM-DD)'),
  label: z.string().min(1, 'Holiday label is required'),
});

function validatePeriodGrid(periods: IPeriodGridItem[]): void {
  // Check index uniqueness
  const indices = new Set<number>();
  for (const p of periods) {
    if (indices.has(p.index)) {
      throw new ApiError(400, `Duplicate period index: ${p.index}`);
    }
    indices.add(p.index);

    if (p.start >= p.end) {
      throw new ApiError(400, `Period ${p.label || p.index}: start time (${p.start}) must be before end time (${p.end})`);
    }
  }

  // Check period overlaps
  const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < sorted.length - 1; i += 1) {
    if (sorted[i].end > sorted[i + 1].start) {
      throw new ApiError(
        400,
        `Period ${sorted[i].label} (${sorted[i].start}-${sorted[i].end}) overlaps with Period ${sorted[i + 1].label} (${sorted[i + 1].start}-${sorted[i + 1].end})`
      );
    }
  }
}

export const getActiveTerm = asyncHandler(async (_req: Request, res: Response) => {
  const activeTerm = await AcademicTerm.findOne({ isActive: true });
  if (!activeTerm) {
    sendSuccess(res, null, 'No active academic term configured');
    return;
  }
  sendSuccess(res, activeTerm, 'Active academic term retrieved');
});

export const listTerms = asyncHandler(async (_req: Request, res: Response) => {
  const terms = await AcademicTerm.find().sort({ createdAt: -1 });
  sendSuccess(res, { items: terms }, 'Terms fetched successfully');
});

export const createTerm = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body;
  validatePeriodGrid(data.periods);

  if (data.holidays && data.holidays.length > 0) {
    for (const h of data.holidays) {
      if (h.dateKey < data.startDate || h.dateKey > data.endDate) {
        throw new ApiError(400, `Holiday date ${h.dateKey} is outside term dates (${data.startDate} to ${data.endDate})`);
      }
    }
  }

  if (data.isActive) {
    await AcademicTerm.updateMany({ isActive: true }, { isActive: false });
  }

  const term = await AcademicTerm.create(data);
  sendSuccess(res, term, 'Academic term created successfully', 201);
});

export const updateTerm = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const term = await AcademicTerm.findById(id);
  if (!term) {
    throw new ApiError(404, 'Academic term not found');
  }

  const data = req.body;

  // Grid freezing check:
  if (data.periods !== undefined || data.workingDays !== undefined) {
    const hasPublished =
      (term.versions && term.versions.length > 0) ||
      (await Timetable.exists({ termId: term._id, status: 'PUBLISHED' }));

    if (hasPublished) {
      throw new ApiError(409, 'Period grid is frozen because a timetable has already been published for this term');
    }
  }

  if (data.periods) {
    validatePeriodGrid(data.periods);
  }

  const effectiveStart = data.startDate || term.startDate;
  const effectiveEnd = data.endDate || term.endDate;
  if (effectiveStart > effectiveEnd) {
    throw new ApiError(400, 'startDate cannot be after endDate');
  }

  if (data.holidays) {
    for (const h of data.holidays) {
      if (h.dateKey < effectiveStart || h.dateKey > effectiveEnd) {
        throw new ApiError(400, `Holiday date ${h.dateKey} is outside term dates (${effectiveStart} to ${effectiveEnd})`);
      }
    }
  }

  if (data.isActive && !term.isActive) {
    await AcademicTerm.updateMany({ _id: { $ne: term._id }, isActive: true }, { isActive: false });
  }

  Object.assign(term, data);
  await term.save();

  sendSuccess(res, term, 'Academic term updated successfully');
});

export const previewHoliday = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const term = await AcademicTerm.findById(id);
  if (!term) {
    throw new ApiError(404, 'Academic term not found');
  }

  const { dateKey, label } = req.body;
  if (dateKey < term.startDate || dateKey > term.endDate) {
    throw new ApiError(400, `Holiday date ${dateKey} is outside term dates (${term.startDate} to ${term.endDate})`);
  }

  const dayOfWeek = getISODayOfWeek(dateKey);

  // Find any published timetables for this term
  const publishedTimetables = await Timetable.find({ termId: term._id, status: 'PUBLISHED' }).select('_id');
  const timetableIds = publishedTimetables.map((t) => t._id);

  let affectedClasses: Array<{
    slotId: string;
    courseCode: string;
    courseTitle: string;
    batchName: string;
    periodIndex: number;
  }> = [];

  if (timetableIds.length > 0) {
    const slots = await ScheduleSlot.find({
      timetableId: { $in: timetableIds },
      dayOfWeek,
    })
      .populate('courseId', 'code title')
      .populate('batchId', 'name');

    affectedClasses = slots.map((s) => {
      const course = s.courseId as unknown as { code?: string; title?: string } | undefined;
      const batch = s.batchId as unknown as { name?: string } | undefined;
      return {
        slotId: s._id.toString(),
        courseCode: course?.code || '',
        courseTitle: course?.title || '',
        batchName: batch?.name || '',
        periodIndex: s.slotIndex,
      };
    });
  }

  sendSuccess(
    res,
    {
      dateKey,
      label,
      dayOfWeek,
      affectedClassesCount: affectedClasses.length,
      affectedClasses,
    },
    'Holiday preview generated'
  );
});

export const addHoliday = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const term = await AcademicTerm.findById(id);
  if (!term) {
    throw new ApiError(404, 'Academic term not found');
  }

  const { dateKey, label } = req.body;
  if (dateKey < term.startDate || dateKey > term.endDate) {
    throw new ApiError(400, `Holiday date ${dateKey} is outside term dates (${term.startDate} to ${term.endDate})`);
  }

  const alreadyExists = term.holidays.some((h) => h.dateKey === dateKey);
  if (alreadyExists) {
    throw new ApiError(400, `Holiday already exists on date ${dateKey}`);
  }

  term.holidays.push({ dateKey, label });
  await term.save();

  sendSuccess(res, term, 'Holiday added successfully', 201);
});
