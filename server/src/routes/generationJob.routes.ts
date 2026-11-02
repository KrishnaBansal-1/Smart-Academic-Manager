import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { getGenerationJob } from '../controllers/generationJob.controller';

const router = Router();

router.use(authenticate);

// Admin-only polling fallback for generation jobs
router.get('/:id', authorize(['ADMIN']), getGenerationJob);

export default router;
