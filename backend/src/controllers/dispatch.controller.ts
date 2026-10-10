import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { verifyDispatchSchema } from '../validators/dispatch.validator';
import * as dispatchService from '../services/dispatch.service';
import { successResponse, errorResponse } from '../utils/response';

export async function verifyAndDispatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const validated = verifyDispatchSchema.parse(req.body);

    const result = await dispatchService.verifyAndDispatchBook({
      orderItemId: validated.orderItemId,
      enteredBookCode: validated.enteredBookCode,
      employeeId: req.user.id,
      requestId: validated.requestId,
    });

    return successResponse(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { employeeId, bookCode, dateFilter, startDate, endDate, page, limit } = req.query;

    const result = await dispatchService.getDispatchHistory({
      employeeId: employeeId as string,
      bookCode: bookCode as string,
      dateFilter: dateFilter as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
    });

    return successResponse(res, 'Dispatch history retrieved', result);
  } catch (error) {
    next(error);
  }
}

export async function getMyHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { dateFilter, startDate, endDate, page, limit } = req.query;

    const result = await dispatchService.getDispatchHistory({
      employeeId: req.user.id,
      dateFilter: dateFilter as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
    });

    return successResponse(res, 'My dispatch history retrieved', result);
  } catch (error) {
    next(error);
  }
}

export async function getFailedAttempts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { employeeId, dateFilter, startDate, endDate, page, limit } = req.query;

    const result = await dispatchService.getFailedAttempts({
      employeeId: employeeId as string,
      dateFilter: dateFilter as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
    });

    return successResponse(res, 'Failed verification attempts retrieved', result);
  } catch (error) {
    next(error);
  }
}
