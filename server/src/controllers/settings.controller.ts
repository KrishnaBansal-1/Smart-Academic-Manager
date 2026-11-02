import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { getOrCreateSettings } from '../models/InstitutionSettings';

export const updateSettingsSchema = z.object({
  timezone: z.string().min(1).optional(),
  defaultWorkingDays: z.array(z.number().int().min(1).max(7)).min(1).optional(),
  defaultGrid: z
    .array(
      z.object({
        index: z.number().int().positive(),
        start: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:mm format'),
        end: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:mm format'),
        blocked: z.boolean().optional(),
        label: z.string().min(1),
      })
    )
    .min(1)
    .optional(),
  attendanceGood: z.number().min(0).max(100).optional(),
  attendanceWarning: z.number().min(0).max(100).optional(),
  attendanceLockHours: z.number().int().min(1).optional(),
  minorNoticeDays: z.number().int().min(0).optional(),
  examReminderHours: z.number().int().min(1).optional(),
});

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getOrCreateSettings();
  sendSuccess(res, settings, 'Institution settings fetched successfully');
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getOrCreateSettings();
  Object.assign(settings, req.body);
  await settings.save();
  sendSuccess(res, settings, 'Institution settings updated successfully');
});
