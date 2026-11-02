import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, ApiError } from '../utils/response';
import { CalendarService, IScheduleScope } from '../services/calendar.service';
import { User } from '../models/User';
import { isValidDateKey } from '../utils/dateKey';

const weekQuerySchema = z.object({
  weekOf: z.string().optional(),
  batchId: z.string().optional(),
  professorId: z.string().optional(),
  roomId: z.string().optional(),
});

const todayQuerySchema = z.object({
  batchId: z.string().optional(),
  professorId: z.string().optional(),
  roomId: z.string().optional(),
});

/**
 * Validates access control and resolves scope based on user role and query parameters.
 */
async function buildScheduleScope(req: Request, query: { batchId?: string; professorId?: string; roomId?: string }): Promise<IScheduleScope> {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const scope: IScheduleScope = {};

  if (user.role === 'STUDENT') {
    const studentBatchId = user.batchId?._id
      ? user.batchId._id.toString()
      : user.batchId?.toString();

    if (!studentBatchId) {
      throw new ApiError(400, 'Student profile has no assigned batch/section');
    }

    if (query.batchId && query.batchId !== studentBatchId) {
      throw new ApiError(403, 'Students can only view their own section schedule');
    }

    if (query.professorId || query.roomId) {
      throw new ApiError(403, 'Students can only view their own section schedule');
    }

    scope.batchId = studentBatchId;
    return scope;
  }

  if (user.role === 'PROFESSOR') {
    if (query.professorId) {
      const currentProfId = user._id.toString();
      if (query.professorId !== currentProfId) {
        // Must belong to the same department
        const targetProf = await User.findById(query.professorId);
        if (!targetProf || targetProf.role !== 'PROFESSOR') {
          throw new ApiError(404, 'Faculty member not found');
        }

        const userDeptId = user.departmentId?._id
          ? user.departmentId._id.toString()
          : user.departmentId?.toString();
        const targetDeptId = targetProf.departmentId?._id
          ? targetProf.departmentId._id.toString()
          : targetProf.departmentId?.toString();

        if (!userDeptId || !targetDeptId || userDeptId !== targetDeptId) {
          throw new ApiError(
            403,
            'Professors can only view faculty schedules in their own department'
          );
        }
      }
      scope.professorId = query.professorId;
    } else if (query.batchId) {
      scope.batchId = query.batchId;
    } else if (query.roomId) {
      scope.roomId = query.roomId;
    } else {
      // Default to own schedule
      scope.professorId = user._id.toString();
    }

    return scope;
  }

  if (user.role === 'ADMIN') {
    if (query.batchId) scope.batchId = query.batchId;
    if (query.professorId) scope.professorId = query.professorId;
    if (query.roomId) scope.roomId = query.roomId;
    return scope;
  }

  throw new ApiError(403, 'Forbidden role');
}

/**
 * GET /api/v1/schedule/week
 */
export const getWeekSchedule = asyncHandler(async (req: Request, res: Response) => {
  const query = weekQuerySchema.parse(req.query);

  if (query.weekOf && !isValidDateKey(query.weekOf)) {
    throw new ApiError(400, 'Invalid weekOf format: must be YYYY-MM-DD');
  }

  const scope = await buildScheduleScope(req, query);
  const result = await CalendarService.getWeek(query.weekOf, scope);

  sendSuccess(res, result, result.published ? 'Week schedule retrieved' : 'No published timetable for this term');
});

/**
 * GET /api/v1/schedule/today
 */
export const getTodaySchedule = asyncHandler(async (req: Request, res: Response) => {
  const query = todayQuerySchema.parse(req.query);
  const scope = await buildScheduleScope(req, query);
  const result = await CalendarService.getToday(scope);

  sendSuccess(res, result, result.published ? "Today's schedule retrieved" : 'No published timetable for this term');
});
