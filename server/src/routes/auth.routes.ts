import { Router } from 'express';
import { z } from 'zod';
import { login, refreshToken, getMe } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';

const router = Router();

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Please provide a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

router.post('/login', validateRequest(loginSchema), login);
router.post('/refresh', validateRequest(refreshSchema), refreshToken);
router.get('/me', authenticate, getMe);

export default router;
