import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  cancelOccurrence,
  getRescheduleOptions,
  rescheduleOccurrence,
  revertOccurrence,
  cancelOccurrenceSchema,
  rescheduleOptionsQuerySchema,
  rescheduleOccurrenceSchema,
} from '../controllers/occurrence.controller';

const router = Router();

// Endpoints accessible by PROFESSOR (own class) and ADMIN
router.use(authenticate);
router.use(authorize(['ADMIN', 'PROFESSOR']));

router.post(
  '/:lineageId/:dateKey/cancel',
  validateRequest(z.object({ body: cancelOccurrenceSchema })),
  cancelOccurrence
);

router.get(
  '/:lineageId/:dateKey/reschedule-options',
  validateRequest(z.object({ query: rescheduleOptionsQuerySchema })),
  getRescheduleOptions
);

router.post(
  '/:lineageId/:dateKey/reschedule',
  validateRequest(z.object({ body: rescheduleOccurrenceSchema })),
  rescheduleOccurrence
);

router.post('/:lineageId/:dateKey/revert', revertOccurrence);

export default router;
