import { Request, Response, NextFunction, RequestHandler } from 'express';

export const asyncHandler = (
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
};
