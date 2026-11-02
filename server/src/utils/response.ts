import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}

export class ApiError extends Error {
  public statusCode: number;
  public errors?: unknown;

  constructor(statusCode: number, message: string, errors?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message = 'Operation successful',
  statusCode = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (
  res: Response,
  message = 'An unexpected error occurred',
  statusCode = 500,
  errors?: unknown
): Response => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};
