import { Request, Response, NextFunction, CookieOptions } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, IUser } from '../models/User';
import { ENV } from '../config/env';
import { ApiError, sendSuccess } from '../utils/response';
import { JwtPayload } from '../middlewares/auth.middleware';

// Fixed 12-round dummy hash to ensure constant-time response when user is not found
const DUMMY_HASH = '$2a$12$e8Y6e99z240eKjMtzh4m2.tq4tDmsxI2z2v/fVqf4c7Z4Y68g4z2u';

export const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: ENV.NODE_ENV === 'production',
  sameSite: ENV.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const formatAuthUser = (user: IUser) => ({
  id: user._id.toString(),
  _id: user._id.toString(),
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  departmentId: user.departmentId,
  batchId: user.batchId,
  rollNumber: user.rollNumber,
  tokenVersion: user.tokenVersion,
});

export const generateTokens = (user: IUser) => {
  const accessPayload: JwtPayload = {
    id: user._id.toString(),
    role: user.role,
    email: user.email,
    departmentId: user.departmentId?.toString(),
    batchId: user.batchId?.toString(),
  };

  const refreshPayload = {
    id: user._id.toString(),
    tokenVersion: user.tokenVersion,
  };

  const accessToken = jwt.sign(accessPayload, ENV.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: ENV.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });

  const refreshToken = jwt.sign(refreshPayload, ENV.REFRESH_TOKEN_SECRET, {
    algorithm: 'HS256',
    expiresIn: ENV.REFRESH_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
  });

  return { accessToken, refreshToken };
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .populate('departmentId', 'name code')
      .populate('batchId', 'name semester academicYear');

    if (!user) {
      // Run dummy compare to equalize timing path against non-existent user
      await bcrypt.compare(password, DUMMY_HASH);
      throw new ApiError(401, 'Invalid email or password');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'Account is inactive. Please contact the administrator.');
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Set refresh token into HTTP-only cookie
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

    sendSuccess(
      res,
      {
        user: formatAuthUser(user),
        accessToken,
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Read token from HTTP-only cookie or fallback to request body
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      throw new ApiError(401, 'Refresh token is required');
    }

    let decoded: { id: string; tokenVersion: number };
    try {
      decoded = jwt.verify(token, ENV.REFRESH_TOKEN_SECRET, {
        algorithms: ['HS256'],
      }) as { id: string; tokenVersion: number };
    } catch {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }

    const user = await User.findById(decoded.id)
      .populate('departmentId', 'name code')
      .populate('batchId', 'name semester academicYear');

    if (!user || !user.isActive) {
      throw new ApiError(401, 'User account not found or deactivated');
    }

    // Token revocation / reuse detection: tokenVersion must match
    if (user.tokenVersion !== decoded.tokenVersion) {
      throw new ApiError(401, 'Refresh token has been revoked or expired');
    }

    // Rotate refresh token: increment tokenVersion
    user.tokenVersion += 1;
    await user.save();

    const tokens = generateTokens(user);

    // Set new rotated refresh token in cookie
    res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

    sendSuccess(
      res,
      {
        accessToken: tokens.accessToken,
        user: formatAuthUser(user),
      },
      'Tokens refreshed successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { maxAge: _unused, ...clearOptions } = REFRESH_COOKIE_OPTIONS;
    res.clearCookie('refreshToken', clearOptions);
    sendSuccess(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id)
      .populate('departmentId', 'name code')
      .populate('batchId', 'name semester academicYear');

    if (!user || !user.isActive) {
      throw new ApiError(401, 'User account not found or deactivated');
    }

    sendSuccess(res, { user: formatAuthUser(user) }, 'User profile fetched successfully');
  } catch (error) {
    next(error);
  }
};
