import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, ApiError } from '../utils/response';
import { OverrideService } from '../services/override.service';

export const cancelOccurrenceSchema = z.object({
  reason: z.string().trim().optional(),
});

export const rescheduleOptionsQuerySchema = z.object({
  targetDate: z.string().min(1, 'targetDate query parameter is required (YYYY-MM-DD)'),
});

export const rescheduleOccurrenceSchema = z.object({
  targetDate: z.string().min(1, 'targetDate is required (YYYY-MM-DD)'),
  period: z.number().int().positive('period must be a positive integer'),
  classroomId: z.string().min(1, 'classroomId is required'),
  reason: z.string().trim().optional(),
});

/**
 * POST /api/v1/occurrences/:lineageId/:dateKey/cancel
 */
export const cancelOccurrence = asyncHandler(async (req: Request, res: Response) => {
  const { lineageId, dateKey } = req.params;
  const user = req.user;

  if (!user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { reason } = req.body || {};
  const result = await OverrideService.cancelOccurrence(lineageId, dateKey, reason, user as any);

  sendSuccess(res, result.override, result.message);
});

/**
 * GET /api/v1/occurrences/:lineageId/:dateKey/reschedule-options?targetDate=
 */
export const getRescheduleOptions = asyncHandler(async (req: Request, res: Response) => {
  const { lineageId, dateKey } = req.params;
  const user = req.user;

  if (!user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { targetDate } = req.query as { targetDate: string };
  if (!targetDate) {
    throw new ApiError(400, 'targetDate query parameter is required (YYYY-MM-DD)');
  }

  const result = await OverrideService.getRescheduleOptions(lineageId, dateKey, targetDate, user as any);

  sendSuccess(res, result, 'Reschedule options retrieved successfully');
});

/**
 * POST /api/v1/occurrences/:lineageId/:dateKey/reschedule
 */
export const rescheduleOccurrence = asyncHandler(async (req: Request, res: Response) => {
  const { lineageId, dateKey } = req.params;
  const user = req.user;

  if (!user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { targetDate, period, classroomId, reason } = req.body;
  const result = await OverrideService.rescheduleOccurrence(
    lineageId,
    dateKey,
    { targetDate, period, classroomId, reason },
    user as any
  );

  sendSuccess(res, result.override, result.message);
});

/**
 * POST /api/v1/occurrences/:lineageId/:dateKey/revert
 */
export const revertOccurrence = asyncHandler(async (req: Request, res: Response) => {
  const { lineageId, dateKey } = req.params;
  const user = req.user;

  if (!user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const result = await OverrideService.revertOccurrence(lineageId, dateKey, user as any);

  sendSuccess(res, null, result.message);
});
