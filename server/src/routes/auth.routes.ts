import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { login, refreshToken, logout, getMe } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { ENV } from '../config/env';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: ENV.NODE_ENV === 'test' ? 1000 : 10,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: ENV.NODE_ENV === 'test' ? 1000 : 30,
  message: { success: false, message: 'Too many token refresh attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Please provide a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(72, 'Password cannot exceed 72 characters'),
  }),
});

const refreshSchema = z.object({
  body: z
    .object({
      refreshToken: z.string().optional(),
    })
    .optional(),
});

router.post('/login', loginLimiter, validateRequest(loginSchema), login);
router.post('/refresh', refreshLimiter, validateRequest(refreshSchema), refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);

export default router;
