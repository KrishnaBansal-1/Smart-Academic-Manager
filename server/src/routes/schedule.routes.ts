import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getWeekSchedule, getTodaySchedule } from '../controllers/schedule.controller';

const router = Router();

// All schedule endpoints require authentication (RBAC handled within controller based on role)
router.use(authenticate);

router.get('/week', getWeekSchedule);
router.get('/today', getTodaySchedule);

export default router;
