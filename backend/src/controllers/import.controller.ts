import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as importService from '../services/import.service';
import { successResponse, errorResponse } from '../utils/response';

export async function previewImport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return errorResponse(res, 'No Excel or CSV file provided', 'FILE_REQUIRED', 400);
    }

    const originalFileName = req.file.originalname;
    const buffer = req.file.buffer;
    const targetSheetName = (req.query.sheetName as string) || (req.body.sheetName as string);

    const result = await importService.parseAndPreviewExcel(buffer, originalFileName, targetSheetName);
    return successResponse(res, 'File parsed and validated successfully', result);
  } catch (error) {
    next(error);
  }
}

export async function downloadInvalidRows(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { invalidRows } = req.body;
    if (!invalidRows || !Array.isArray(invalidRows) || invalidRows.length === 0) {
      return errorResponse(res, 'No invalid rows provided for export', 'NO_DATA', 400);
    }

    const buffer = await importService.exportInvalidRowsExcel(invalidRows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Invalid_Rows_Report_${Date.now()}.xlsx`);
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function confirmImport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { originalFileName, fileHash, validRows, invalidRowsSummary } = req.body;

    if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
      return errorResponse(res, 'Valid rows are required to confirm import', 'VALID_ROWS_REQUIRED', 400);
    }

    const result = await importService.confirmImport(
      req.user.id,
      originalFileName || 'Import.xlsx',
      fileHash || 'manual_hash',
      validRows,
      invalidRowsSummary || []
    );

    return successResponse(res, 'Import completed successfully', result, 201);
  } catch (error) {
    next(error);
  }
}

export async function listImports(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const result = await importService.listImportBatches(page, limit);
    return successResponse(res, 'Import history retrieved', result);
  } catch (error) {
    next(error);
  }
}

export async function getImportById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const batch = await importService.getImportBatchById(id);
    return successResponse(res, 'Import batch details retrieved', batch);
  } catch (error) {
    next(error);
  }
}

export async function getImportErrors(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const batch = await importService.getImportBatchById(id);
    return successResponse(res, 'Import error summary retrieved', {
      errorSummary: batch.errorSummary || [],
      invalidRows: batch.invalidRows,
    });
  } catch (error) {
    next(error);
  }
}
