import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  preflightTimetable,
  generateTimetable,
  listTimetables,
  getTimetableDetails,
  getSlotDropMap,
  updateTimetableSlot,
  swapTimetableSlots,
  cloneTimetable,
  validateTimetable,
  publishTimetable,
  deleteTimetable,
  preflightSchema,
  generateSchema,
  updateSlotSchema,
  swapSlotsSchema,
  publishSchema,
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

// Timetable visual editor and management API
router.get('/', authorize(['ADMIN']), listTimetables);
router.get('/:id', authorize(['ADMIN']), getTimetableDetails);
router.get('/:id/slots/:slotId/drop-map', authorize(['ADMIN']), getSlotDropMap);

router.patch(
  '/:id/slots/:slotId',
  authorize(['ADMIN']),
  validateRequest(z.object({ body: updateSlotSchema })),
  updateTimetableSlot
);

router.post(
  '/:id/slots/swap',
  authorize(['ADMIN']),
  validateRequest(z.object({ body: swapSlotsSchema })),
  swapTimetableSlots
);

router.post('/:id/clone', authorize(['ADMIN']), cloneTimetable);
router.post('/:id/validate', authorize(['ADMIN']), validateTimetable);

router.post(
  '/:id/publish',
  authorize(['ADMIN']),
  validateRequest(z.object({ body: publishSchema })),
  publishTimetable
);

router.delete('/:id', authorize(['ADMIN']), deleteTimetable);

export default router;
