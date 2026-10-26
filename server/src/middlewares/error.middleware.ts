import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError, sendError } from '../utils/response';
import { ENV } from '../config/env';

export const errorHandler: ErrorRequestHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. Handled Custom ApiError
  if (err instanceof ApiError) {
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'Validation error', 400, formattedErrors);
    return;
  }

  // 3. Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    sendError(res, `Duplicate value '${value}' for field '${field}'. Must be unique.`, 409);
    return;
  }

  // 4. Mongoose Cast Error (Invalid ObjectId)
  if (err.name === 'CastError') {
    sendError(res, `Resource not found with id: ${err.value}`, 404);
    return;
  }

  // 5. JWT Errors
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'Invalid token. Please authenticate again.', 401);
    return;
  }
  if (err.name === 'TokenExpiredError') {
    sendError(res, 'Token expired. Please login again.', 401);
    return;
  }

  // 6. Generic / Internal Server Error
  console.error('Unhandled Server Error:', err);
  const message = ENV.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  sendError(res, message, 500, ENV.NODE_ENV === 'development' ? err.stack : undefined);
};
