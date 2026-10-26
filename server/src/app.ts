import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ENV } from './config/env';
import { errorHandler } from './middlewares/error.middleware';
import authRoutes from './routes/auth.routes';

export const createApp = (): Application => {
  const app: Application = express();

  // Security & utility middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: [ENV.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (ENV.NODE_ENV !== 'test') {
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
