import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, ApiError } from '../utils/response';
import { GenerationJob } from '../models/GenerationJob';

/**
 * GET /api/v1/generation-jobs/:id
 * Fetches status, progress, metrics, and result of a timetable generation job.
 */
export const getGenerationJob = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const job = await GenerationJob.findById(id).populate('timetableId', 'title status revision softScore createdAt');
  if (!job) {
    throw new ApiError(404, 'Generation job not found');
  }

  sendSuccess(res, { job }, 'Generation job fetched successfully');
});
