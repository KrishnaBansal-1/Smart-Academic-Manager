import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  preflightTimetable,
  generateTimetable,
  preflightSchema,
  generateSchema,
} from '../controllers/timetable.controller';

const router = Router();

router.use(authenticate);

// Admin-only timetable generation pipeline
router.post(
  '/preflight',
  authorize(['ADMIN']),
  validateRequest(z.object({ body: preflightSchema })),
  preflightTimetable
);

router.post(
  '/generate',
  authorize(['ADMIN']),
  validateRequest(z.object({ body: generateSchema })),
  generateTimetable
);

export default router;
