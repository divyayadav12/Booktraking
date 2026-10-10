import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as orderService from '../services/order.service';
import { successResponse } from '../utils/response';

export async function getOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const {
      search,
      status,
      bookCode,
      dateFilter,
      startDate,
      endDate,
      page,
      limit,
    } = req.query;

    const result = await orderService.listOrders({
      search: search as string,
      status: status as string,
      bookCode: bookCode as string,
      dateFilter: dateFilter as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      outgoingOnly: false,
    });

    return successResponse(res, 'Orders retrieved', result);
  } catch (error) {
    next(error);
  }
}

export async function getOutgoingOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const {
      search,
      status,
      bookCode,
      dateFilter,
      startDate,
      endDate,
      page,
      limit,
    } = req.query;

    const result = await orderService.listOrders({
      search: search as string,
      status: status as string,
      bookCode: bookCode as string,
      dateFilter: dateFilter as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      outgoingOnly: true,
    });

    return successResponse(res, 'Outgoing orders retrieved', result);
  } catch (error) {
    next(error);
  }
}

export async function getOrderById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const order = await orderService.getOrderById(id);
    return successResponse(res, 'Order details retrieved', order);
  } catch (error) {
    next(error);
  }
}

export async function getOrderItems(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const order = await orderService.getOrderById(id);
    return successResponse(res, 'Order items retrieved', order.items);
  } catch (error) {
    next(error);
  }
}
