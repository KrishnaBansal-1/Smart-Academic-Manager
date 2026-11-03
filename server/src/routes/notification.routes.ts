import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification.controller';

const router = Router();

// All routes require authentication (available to ALL authenticated users)
router.use(authenticate);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markAsRead);
router.post('/read-all', markAllAsRead);

export default router;
