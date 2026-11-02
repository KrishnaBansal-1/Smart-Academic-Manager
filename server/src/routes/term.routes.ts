import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  getActiveTerm,
  listTerms,
  createTerm,
  updateTerm,
  previewHoliday,
  addHoliday,
  createTermSchema,
  updateTermSchema,
  holidaySchema,
} from '../controllers/term.controller';

const router = Router();

// Active term is readable by all authenticated roles (Admin, Professor, Student)
router.get('/active', authenticate, getActiveTerm);

// All subsequent term routes are Admin-only
router.use(authenticate, authorize(['ADMIN']));

router.get('/', listTerms);
router.post('/', validateRequest(z.object({ body: createTermSchema })), createTerm);
router.patch(
  '/:id',
  validateRequest(
    z.object({
      params: z.object({ id: z.string().min(1) }),
      body: updateTermSchema,
    })
  ),
  updateTerm
);
router.post(
  '/:id/holidays/preview',
  validateRequest(
    z.object({
      params: z.object({ id: z.string().min(1) }),
      body: holidaySchema,
    })
  ),
  previewHoliday
);
router.post(
  '/:id/holidays',
  validateRequest(
    z.object({
      params: z.object({ id: z.string().min(1) }),
      body: holidaySchema,
    })
  ),
  addHoliday
);

export default router;
