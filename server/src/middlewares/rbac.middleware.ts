import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';
import { ApiError } from '../utils/response';

export const authorize = (allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ApiError(401, 'Unauthenticated: Please login first'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Access Denied: Role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};
