import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env';
import { errorHandler } from './middlewares/error.middleware';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import professorRoutes from './routes/professor.routes';
import settingsRoutes from './routes/settings.routes';
import termRoutes from './routes/term.routes';
import offeringRoutes from './routes/offering.routes';
import constraintRoutes from './routes/constraint.routes';

export const createApp = (): Application => {
  const app: Application = express();

  // Security & utility middlewares
  app.use(helmet());

  const allowedOrigins =
    ENV.NODE_ENV === 'production'
      ? [ENV.CLIENT_URL]
      : [
          ENV.CLIENT_URL,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
        ];

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  if (ENV.NODE_ENV === 'production') {
    app.use(morgan('combined'));
  } else if (ENV.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'Smart Academic Manager Backend',
      version: '1.0.0',
    });
  });

  // API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/professor', professorRoutes);
  app.use('/api/v1/settings', settingsRoutes);
  app.use('/api/v1/terms', termRoutes);
  app.use('/api/v1/offerings', offeringRoutes);
  app.use('/api/v1/constraints', constraintRoutes);

  // Fallback 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  });

  // Global Centralized Error Handler
  app.use(errorHandler);

  return app;
};
