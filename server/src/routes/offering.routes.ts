import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  listOfferings,
  createOffering,
  updateOffering,
  deleteOffering,
  bulkFromDepartment,
  createOfferingSchema,
  updateOfferingSchema,
  bulkDepartmentSchema,
} from '../controllers/offering.controller';

const router = Router();

router.use(authenticate, authorize(['ADMIN']));

router.get('/', listOfferings);
router.post('/', validateRequest(z.object({ body: createOfferingSchema })), createOffering);
router.patch(
  '/:id',
  validateRequest(
    z.object({
      params: z.object({ id: z.string().min(1) }),
      body: updateOfferingSchema,
    })
  ),
  updateOffering
);
router.delete('/:id', deleteOffering);
router.post(
  '/bulk-from-department',
  validateRequest(z.object({ body: bulkDepartmentSchema })),
  bulkFromDepartment
);

export default router;
