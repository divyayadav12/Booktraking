import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as reportService from '../services/report.service';
import { successResponse, errorResponse } from '../utils/response';

export async function getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { dateFilter, startDate, endDate, employeeId, bookCode } = req.query;
    const summary = await reportService.getReportSummary({
      dateFilter: dateFilter as string,
      startDate: startDate as string,
      endDate: endDate as string,
      employeeId: employeeId as string,
      bookCode: bookCode as string,
    });
    return successResponse(res, 'Report summary retrieved', summary);
  } catch (error) {
    next(error);
  }
}

export async function getBookSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const summary = await reportService.getBookCodeSummary();
    return successResponse(res, 'Book code summary retrieved', summary);
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const summary = await reportService.getEmployeeSummary();
    return successResponse(res, 'Employee dispatch summary retrieved', summary);
  } catch (error) {
    next(error);
  }
}

export async function exportReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const type = (req.query.type as any) || 'dispatches';
    const validTypes = ['dispatches', 'orders', 'failed-attempts', 'book-summary', 'employees'];

    if (!validTypes.includes(type)) {
      return errorResponse(res, `Invalid report type. Must be one of: ${validTypes.join(', ')}`, 'INVALID_REPORT_TYPE', 400);
    }

    const { dateFilter, startDate, endDate, status, employeeId, bookCode } = req.query;

    const { buffer, fileName } = await reportService.generateExcelReport(type, {
      dateFilter: dateFilter as string,
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as string,
      employeeId: employeeId as string,
      bookCode: bookCode as string,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
}
