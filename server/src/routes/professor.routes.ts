import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { getAssignedCourses, getDepartmentFaculty } from '../controllers/professor.controller';
import { getProfessorOfferings } from '../controllers/offering.controller';

const router = Router();
router.use(authenticate, authorize(['PROFESSOR']));

router.get('/courses', getAssignedCourses);
router.get('/offerings', getProfessorOfferings);
router.get('/department-faculty', getDepartmentFaculty);

export default router;
