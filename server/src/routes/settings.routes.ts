import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { getSettings, updateSettings, updateSettingsSchema } from '../controllers/settings.controller';

const router = Router();

router.use(authenticate, authorize(['ADMIN']));

router.get('/', getSettings);
router.patch(
  '/',
  validateRequest(z.object({ body: updateSettingsSchema })),
  updateSettings
);

export default router;
