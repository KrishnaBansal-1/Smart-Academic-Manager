import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { getAssignedCourses } from '../controllers/professor.controller';

const router = Router();
router.use(authenticate, authorize(['PROFESSOR']));
router.get('/courses', getAssignedCourses);

export default router;
