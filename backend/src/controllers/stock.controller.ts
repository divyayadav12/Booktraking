import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as stockService from '../services/stock.service';
import { successResponse, errorResponse } from '../utils/response';

export async function getAvailableStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { search, status, page, limit, sortBy, sortOrder } = req.query;

    const result = await stockService.getAvailableStock({
      search: search as string,
      status: status as any,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      sortBy: sortBy as string,
      sortOrder: sortOrder as any,
    });

    return successResponse(res, 'Available stock retrieved successfully', result);
  } catch (error) {
    next(error);
  }
}

export async function addInwardEntry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { bookCode, bookName, quantity, supplier, remarks, source, entryDate, entryTime } = req.body;

    const result = await stockService.addInwardEntry(req.user!.id, {
      bookCode,
      bookName,
      quantity,
      supplier,
      remarks,
      source,
      entryDate,
      entryTime,
    });

    return successResponse(res, `Stock entry saved! Added ${quantity} copies of "${bookName}".`, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function bulkInwardExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file || !req.file.buffer) {
      return errorResponse(res, 'No Excel file uploaded', 'FILE_REQUIRED', 400);
    }

    const result = await stockService.bulkInwardExcel(req.user!.id, req.file.buffer);

    return successResponse(
      res,
      `Excel Stock Import complete: ${result.totalImportedCopies} copies (${result.importedEntries} entries) added to stock!`,
      result,
      201
    );
  } catch (error) {
    next(error);
  }
}

export async function getInwardHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { search, startDate, endDate, page, limit } = req.query;

    const result = await stockService.getInwardHistory({
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    return successResponse(res, 'Inward history retrieved successfully', result);
  } catch (error) {
    next(error);
  }
}

export async function deleteInwardEntry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await stockService.deleteInwardEntry(req.user!.id, id);
    return successResponse(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function searchBookCatalog(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { q } = req.query;
    const result = await stockService.searchBookCatalog((q as string) || '');
    return successResponse(res, 'Catalog search results', result);
  } catch (error) {
    next(error);
  }
}

export async function exportStockExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const buffer = await stockService.exportStockExcel();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=available-stock-${new Date().toISOString().slice(0, 10)}.xlsx`);
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function exportInwardExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const buffer = await stockService.exportInwardExcel();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=inward-history-${new Date().toISOString().slice(0, 10)}.xlsx`);
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
}
