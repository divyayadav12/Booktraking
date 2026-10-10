import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, Role } from '../models';
import { ENV } from '../config/env';
import { errorResponse } from '../utils/response';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Authentication required. No token provided.', 'UNAUTHORIZED', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { id: string; email: string; role: Role };

    const user = await User.findById(decoded.id).select('name email role isActive');

    if (!user) {
      return errorResponse(res, 'User not found.', 'USER_NOT_FOUND', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'User account is deactivated. Contact administrator.', 'ACCOUNT_DEACTIVATED', 403);
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Session token expired. Please log in again.', 'TOKEN_EXPIRED', 401);
    }
    return errorResponse(res, 'Invalid authentication token.', 'INVALID_TOKEN', 401);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized access.', 'UNAUTHORIZED', 401);
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Access denied. Requires one of: ${roles.join(', ')}`,
        'FORBIDDEN',
        403
      );
    }

    next();
  };
}
