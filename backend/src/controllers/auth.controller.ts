import { Request, Response, NextFunction } from 'express';
import { loginSchema, changePasswordSchema } from '../validators/auth.validator';
import * as authService from '../services/auth.service';
import { successResponse, errorResponse } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await authService.loginUser(validated.email, validated.password);
    return successResponse(res, 'Login successful', result);
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response) {
  return successResponse(res, 'Logged out successfully', null);
}

export async function getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }
    const user = await authService.getCurrentUser(req.user.id);
    return successResponse(res, 'Profile retrieved', user);
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }
    const validated = changePasswordSchema.parse(req.body);
    const result = await authService.changeUserPassword(
      req.user.id,
      validated.currentPassword,
      validated.newPassword
    );
    return successResponse(res, result.message, null);
  } catch (error) {
    next(error);
  }
}
