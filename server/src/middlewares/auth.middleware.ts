import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { ApiError } from '../utils/response';
import { User, IUser, UserRole } from '../models/User';
import { Types } from 'mongoose';

export interface JwtPayload {
  id: string;
  role: UserRole;
  email: string;
  departmentId?: string;
  batchId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication token missing or invalid');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;

    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      throw new ApiError(401, 'User account not found or has been deactivated');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
