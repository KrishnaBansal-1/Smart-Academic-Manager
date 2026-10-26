import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser, UserRole } from '../models/User';
import { ENV } from '../config/env';
import { ApiError, sendSuccess } from '../utils/response';
import { JwtPayload } from '../middlewares/auth.middleware';

export const generateTokens = (user: IUser) => {
  const payload: JwtPayload = {
    id: user._id.toString(),
    role: user.role,
    email: user.email,
    departmentId: user.departmentId?.toString(),
    batchId: user.batchId?.toString(),
  };

  const accessToken = jwt.sign(payload, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(payload, ENV.REFRESH_TOKEN_SECRET, {
    expiresIn: ENV.REFRESH_TOKEN_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'Account is inactive. Please contact the administrator.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const tokens = generateTokens(user);

    sendSuccess(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          departmentId: user.departmentId,
          batchId: user.batchId,
          rollNumber: user.rollNumber,
        },
        ...tokens,
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ApiError(400, 'Refresh token is required');
    }

    const decoded = jwt.verify(refreshToken, ENV.REFRESH_TOKEN_SECRET) as JwtPayload;
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      throw new ApiError(401, 'Invalid refresh token or inactive user');
    }

    const tokens = generateTokens(user);

    sendSuccess(res, tokens, 'Tokens refreshed successfully');
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id)
      .populate('departmentId', 'name code')
      .populate('batchId', 'name semester academicYear');

    sendSuccess(res, { user }, 'User profile fetched successfully');
  } catch (error) {
    next(error);
  }
};
