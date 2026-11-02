import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError, sendError } from '../utils/response';
import { ENV } from '../config/env';

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  code?: number | string;
  keyValue?: Record<string, unknown>;
  value?: unknown;
  errors?: Record<string, { message: string; path?: string }>;
}

export const errorHandler: ErrorRequestHandler = (
  err: HttpError,
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

  // 3. Mongoose Validation Error
  if (err.name === 'ValidationError' && err.errors) {
    const formattedErrors = Object.entries(err.errors).map(([field, errorObj]) => ({
      field,
      message: errorObj.message,
    }));
    sendError(res, err.message || 'Validation error', 400, formattedErrors);
    return;
  }

  // 4. Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    sendError(res, `Duplicate value '${String(value)}' for field '${field}'. Must be unique.`, 409);
    return;
  }

  // 5. Mongoose Cast Error (Invalid ObjectId)
  if (err.name === 'CastError') {
    sendError(res, `Resource not found with id: ${String(err.value)}`, 404);
    return;
  }

  // 6. JWT Errors
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'Invalid token. Please authenticate again.', 401);
    return;
  }
  if (err.name === 'TokenExpiredError') {
    sendError(res, 'Token expired. Please login again.', 401);
    return;
  }

  // 7. Express body-parser / HTTP errors (e.g., bad JSON has status 400, oversized body has 413)
  const explicitStatus = err.status || err.statusCode;
  if (
    explicitStatus &&
    typeof explicitStatus === 'number' &&
    explicitStatus >= 400 &&
    explicitStatus < 500
  ) {
    sendError(res, err.message || 'Bad Request', explicitStatus);
    return;
  }

  // 8. Generic / Internal Server Error
  console.error('Unhandled Server Error:', err);
  const message = ENV.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  sendError(res, message, 500, ENV.NODE_ENV === 'development' ? err.stack : undefined);
};
