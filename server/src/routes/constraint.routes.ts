import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  getMyConstraints,
  updateMyConstraints,
  listConstraints,
  updateConstraintPriority,
  putConstraintMeSchema,
  patchPrioritySchema,
} from '../controllers/constraint.controller';

const router = Router();

// Professor preference endpoints
router.get('/me', authenticate, authorize(['PROFESSOR']), getMyConstraints);
router.put(
  '/me',
  authenticate,
  authorize(['PROFESSOR']),
  validateRequest(z.object({ body: putConstraintMeSchema })),
  updateMyConstraints
);

// Admin constraint management endpoints
router.get('/', authenticate, authorize(['ADMIN']), listConstraints);
router.patch(
  '/:id/priority',
  authenticate,
  authorize(['ADMIN']),
  validateRequest(
    z.object({
      params: z.object({ id: z.string().min(1) }),
      body: patchPrioritySchema,
    })
  ),
  updateConstraintPriority
);

export default router;
