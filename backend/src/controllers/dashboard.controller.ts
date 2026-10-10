import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as orderService from '../services/order.service';
import * as reportService from '../services/report.service';
import { successResponse } from '../utils/response';

export async function getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const summary = await orderService.getDashboardSummary();
    return successResponse(res, 'Dashboard summary retrieved', summary);
  } catch (error) {
    next(error);
  }
}

export async function getDispatchTrends(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const days = parseInt(req.query.days as string, 10) || 14;
    const trends = await reportService.getDispatchTrends(days);
    return successResponse(res, 'Dispatch trends retrieved', trends);
  } catch (error) {
    next(error);
  }
}
