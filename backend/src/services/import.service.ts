import crypto from 'crypto';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { ImportBatch, Order } from '../models';
import { normalizeBookCode, normalizeTrackingId, normalizeMobileNumber, normalizeEmail } from '../utils/normalize';
import { logAudit } from '../utils/audit';

export interface ParsedRowData {
  rowNumber: number;
  studentName: string;
  mobileNumber: string;
  email: string | null;
  trackingId: string;
  bookCode: string;
  bookName: string;
  quantity: number;
  errors: string[];
}

export interface ImportPreviewResult {
  fileHash: string;
  originalFileName: string;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  isDuplicateFile: boolean;
  previousBatch?: {
    id: string;
    uploadedAt: Date;
    importedRows: number;
  } | null;
  validRows: ParsedRowData[];
  invalidRows: ParsedRowData[];
}

export function deriveBookCodeFromTitle(title: string): string {
  if (!title) return 'BK101';
  const clean = title.replace(/[^a-zA-Z0-9\s.-]/g, '').trim();
  const words = clean.split(/\s+/).filter(
    (w) => !['the', 'of', 'and', 'for', 'in', 'full', 'book', 'module', 'set'].includes(w.toLowerCase())
  );
  if (words.length === 0) return 'BK101';
  return words.slice(0, 3).map((w) => w.toUpperCase()).join('-');
}

export async function parseAndPreviewExcel(
  buffer: Buffer,
  originalFileName: string
): Promise<ImportPreviewResult> {
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Check if this exact file hash was already uploaded
  const existingBatch = await ImportBatch.findOne({ fileHash, status: 'COMPLETED' })
    .select('_id uploadedAt importedRows')
    .sort({ uploadedAt: -1 });

  const workbook = new ExcelJS.Workbook();
  if (originalFileName.toLowerCase().endsWith('.csv')) {
    const stream = require('stream');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);
    await workbook.csv.read(bufferStream);
  } else {
    await workbook.xlsx.load(buffer as any);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw { statusCode: 400, message: 'Uploaded file contains no worksheets', code: 'EMPTY_FILE' };
  }

  // Header row mappings
  const headerRow = worksheet.getRow(1);
  const columnMap: Record<string, number> = {};

  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value || '').trim().toLowerCase();
    
    // Student Name: matches student name, customer name, or simple "name"
    if ((val.includes('student') || val.includes('customer') || val.includes('client')) && val.includes('name')) {
      columnMap['studentName'] = colNumber;
    } else if (val === 'name' || val === 'student' || val === 'student_name' || val === 'customer_name') {
      columnMap['studentName'] = colNumber;
    }
    // Mobile Number: matches mobile, phone, contact, tel
    else if (val.includes('mobile') || val.includes('phone') || val.includes('contact') || val === 'tel') {
      columnMap['mobileNumber'] = colNumber;
    }
    // Email: matches email, mail
    else if (val.includes('email') || val.includes('mail')) {
      columnMap['email'] = colNumber;
    }
    // Tracking ID: matches tracking, awb, docket, waybill, consignment
    else if (
      val.includes('tracking') ||
      val.includes('awb') ||
      val.includes('docket') ||
      val.includes('waybill') ||
      val.includes('consignment')
    ) {
      columnMap['trackingId'] = colNumber;
    }
    // Book Code: matches book code, item code, sku, isbn, code
    else if (val.includes('book') && val.includes('code')) {
      columnMap['bookCode'] = colNumber;
    } else if (val === 'book_code' || val === 'item_code' || val === 'sku' || val === 'isbn' || val === 'code') {
      columnMap['bookCode'] = colNumber;
    }
    // Book Name: matches book name, product name, item name, title
    else if (val.includes('book') && val.includes('name')) {
      columnMap['bookName'] = colNumber;
    } else if (
      val.includes('product') ||
      val.includes('item') ||
      val.includes('title') ||
      val === 'book' ||
      val === 'description'
    ) {
      columnMap['bookName'] = colNumber;
    }
    // Quantity: matches quantity, qty, pcs, count
    else if (val.includes('quantity') || val.includes('qty') || val === 'count' || val === 'pcs') {
      columnMap['quantity'] = colNumber;
    }
  });

  const requiredCols = ['studentName', 'mobileNumber', 'trackingId', 'bookName'];
  const missingCols = requiredCols.filter((col) => !columnMap[col]);

  if (missingCols.length > 0) {
    throw {
      statusCode: 400,
      message: `Missing required Excel columns: ${missingCols.join(', ')}. Required columns are: Student Name (or Name), Mobile Number (or Phone), Tracking ID (or Tracking Number), and Book Name (or Product Name).`,
      code: 'MISSING_COLUMNS',
    };
  }

  const validRows: ParsedRowData[] = [];
  const invalidRows: ParsedRowData[] = [];
  const seenRowKeys = new Set<string>();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const mobileRegex = /^[0-9+ -]{7,15}$/;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    let hasAnyData = false;
    row.eachCell(() => { hasAnyData = true; });
    if (!hasAnyData) return;

    const rowErrors: string[] = [];

    const rawStudentName = row.getCell(columnMap['studentName']).value;
    const rawMobile = row.getCell(columnMap['mobileNumber']).value;
    const rawEmail = columnMap['email'] ? row.getCell(columnMap['email']).value : null;
    const rawTrackingId = row.getCell(columnMap['trackingId']).value;
    const rawBookName = row.getCell(columnMap['bookName']).value;
    const bookName = rawBookName ? String(rawBookName).trim() : '';

    const rawBookCode = columnMap['bookCode'] ? row.getCell(columnMap['bookCode']).value : null;
    const bookCode = rawBookCode ? normalizeBookCode(rawBookCode as any) : deriveBookCodeFromTitle(bookName);

    const rawQuantity = columnMap['quantity'] ? row.getCell(columnMap['quantity']).value : 1;

    const studentName = rawStudentName ? String(rawStudentName).trim() : '';
    const mobileNumber = normalizeMobileNumber(rawMobile as any);
    const email = rawEmail ? normalizeEmail(String(rawEmail)) : null;
    const trackingId = normalizeTrackingId(rawTrackingId as any);

    let quantity = 1;
    if (typeof rawQuantity === 'number') {
      quantity = Math.floor(rawQuantity);
    } else if (rawQuantity) {
      const parsed = parseInt(String(rawQuantity).trim(), 10);
      quantity = isNaN(parsed) || parsed <= 0 ? 1 : parsed;
    }

    if (!studentName) rowErrors.push('Student name is required.');
    if (!mobileNumber) {
      rowErrors.push('Mobile number is required.');
    } else if (!mobileRegex.test(mobileNumber)) {
      rowErrors.push('Invalid mobile number format.');
    }

    if (rawEmail && email && !emailRegex.test(email)) {
      rowErrors.push('Invalid email format.');
    }

    if (!trackingId) rowErrors.push('Tracking ID is required.');
    if (!bookCode) rowErrors.push('Book code is required.');
    if (!bookName) rowErrors.push('Book name is required.');
    if (quantity <= 0) rowErrors.push('Quantity must be a positive integer greater than 0.');

    const duplicateKey = `${trackingId}:::${bookCode}`;
    if (seenRowKeys.has(duplicateKey)) {
      rowErrors.push(`Duplicate row in file: Tracking ID "${trackingId}" already has an entry for Book Code "${bookCode}".`);
    } else if (trackingId && bookCode) {
      seenRowKeys.add(duplicateKey);
    }

    const rowItem: ParsedRowData = {
      rowNumber,
      studentName,
      mobileNumber,
      email,
      trackingId,
      bookCode,
      bookName,
      quantity,
      errors: rowErrors,
    };

    if (rowErrors.length > 0) {
      invalidRows.push(rowItem);
    } else {
      validRows.push(rowItem);
    }
  });

  return {
    fileHash,
    originalFileName,
    totalRows: validRows.length + invalidRows.length,
    validRowsCount: validRows.length,
    invalidRowsCount: invalidRows.length,
    isDuplicateFile: !!existingBatch,
    previousBatch: existingBatch
      ? {
          id: existingBatch._id.toString(),
          uploadedAt: existingBatch.uploadedAt,
          importedRows: existingBatch.importedRows,
        }
      : null,
    validRows,
    invalidRows,
  };
}

export async function exportInvalidRowsExcel(invalidRows: ParsedRowData[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Invalid Rows');

  worksheet.columns = [
    { header: 'Row #', key: 'rowNumber', width: 10 },
    { header: 'Student Name', key: 'studentName', width: 25 },
    { header: 'Mobile Number', key: 'mobileNumber', width: 18 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Tracking ID', key: 'trackingId', width: 16 },
    { header: 'Book Code', key: 'bookCode', width: 15 },
    { header: 'Book Name', key: 'bookName', width: 25 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Validation Errors', key: 'errors', width: 45 },
  ];

  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD32F2F' },
  };

  invalidRows.forEach((row) => {
    worksheet.addRow({
      rowNumber: row.rowNumber,
      studentName: row.studentName,
      mobileNumber: row.mobileNumber,
      email: row.email || '',
      trackingId: row.trackingId,
      bookCode: row.bookCode,
      bookName: row.bookName,
      quantity: row.quantity,
      errors: row.errors.join(' | '),
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function confirmImport(
  userId: string,
  originalFileName: string,
  fileHash: string,
  validRows: ParsedRowData[],
  invalidRowsSummary: any[] = []
) {
  if (!validRows || validRows.length === 0) {
    throw { statusCode: 400, message: 'No valid rows to import', code: 'NO_VALID_ROWS' };
  }

  const batch = await ImportBatch.create({
    originalFileName,
    uploadedByUserId: new mongoose.Types.ObjectId(userId),
    status: 'COMPLETED',
    totalRows: validRows.length + invalidRowsSummary.length,
    validRows: validRows.length,
    invalidRows: invalidRowsSummary.length,
    importedRows: validRows.length,
    fileHash,
    errorSummary: invalidRowsSummary,
  });

  // Group rows by Tracking ID + Student Name to create unified Orders
  const orderGroups = new Map<string, {
    studentName: string;
    mobileNumber: string;
    email: string | null;
    trackingId: string;
    items: {
      bookCode: string;
      bookName: string;
      requiredQuantity: number;
    }[];
  }>();

  for (const row of validRows) {
    const orderKey = `${row.trackingId}:::${row.studentName}`;
    if (!orderGroups.has(orderKey)) {
      orderGroups.set(orderKey, {
        studentName: row.studentName,
        mobileNumber: row.mobileNumber,
        email: row.email,
        trackingId: row.trackingId,
        items: [],
      });
    }

    const group = orderGroups.get(orderKey)!;
    group.items.push({
      bookCode: row.bookCode,
      bookName: row.bookName,
      requiredQuantity: row.quantity,
    });
  }

  let createdOrdersCount = 0;
  let createdItemsCount = 0;
  let productCodeCounter = 1;

  // Get current month/year for product code prefix
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `PRD-${yy}${mm}`;

  // Get latest productCode counter to avoid collisions with existing orders
  const lastOrder = await Order.findOne(
    { productCode: { $regex: `^${prefix}-` } },
    { productCode: 1 }
  ).sort({ productCode: -1 });

  if (lastOrder?.productCode) {
    const lastNum = parseInt(lastOrder.productCode.split('-').pop() || '0', 10);
    productCodeCounter = lastNum + 1;
  }

  for (const orderData of orderGroups.values()) {
    const productCode = `${prefix}-${String(productCodeCounter).padStart(5, '0')}`;
    productCodeCounter++;

    await Order.create({
      productCode,
      studentName: orderData.studentName,
      mobileNumber: orderData.mobileNumber,
      email: orderData.email,
      trackingId: orderData.trackingId,
      importBatchId: batch._id,
      items: orderData.items.map((item) => ({
        bookCode: item.bookCode,
        bookName: item.bookName,
        requiredQuantity: item.requiredQuantity,
        dispatchedQuantity: 0,
      })),
    });

    createdOrdersCount += 1;
    createdItemsCount += orderData.items.length;
  }

  await logAudit({
    actorUserId: userId,
    action: 'EXCEL_IMPORT_COMPLETED',
    entityType: 'ImportBatch',
    entityId: batch._id.toString(),
    metadata: {
      fileName: originalFileName,
      totalRows: batch.totalRows,
      importedRows: batch.importedRows,
      createdOrdersCount,
      createdItemsCount,
    },
  });

  return {
    batchId: batch._id.toString(),
    fileName: originalFileName,
    importedOrders: createdOrdersCount,
    importedItems: createdItemsCount,
    totalRows: batch.totalRows,
    validRows: batch.validRows,
    invalidRows: batch.invalidRows,
  };
}

export async function listImportBatches(page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  const [batches, total] = await Promise.all([
    ImportBatch.find()
      .populate('uploadedByUserId', 'name email')
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit),
    ImportBatch.countDocuments(),
  ]);

  const mapped = await Promise.all(
    batches.map(async (b) => {
      const orderCount = await Order.countDocuments({ importBatchId: b._id });
      return {
        id: b._id.toString(),
        originalFileName: b.originalFileName,
        uploadedByUserId: b.uploadedByUserId,
        uploadedByUser: b.uploadedByUserId,
        uploadedAt: b.uploadedAt,
        status: b.status,
        totalRows: b.totalRows,
        validRows: b.validRows,
        invalidRows: b.invalidRows,
        importedRows: b.importedRows,
        fileHash: b.fileHash,
        errorSummary: b.errorSummary,
        _count: { orders: orderCount },
      };
    })
  );

  return {
    batches: mapped,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getImportBatchById(batchId: string) {
  const batch = await ImportBatch.findById(batchId).populate('uploadedByUserId', 'name email');

  if (!batch) {
    throw { statusCode: 404, message: 'Import batch not found', code: 'BATCH_NOT_FOUND' };
  }

  const orders = await Order.find({ importBatchId: batch._id }).limit(50);

  return {
    id: batch._id.toString(),
    originalFileName: batch.originalFileName,
    uploadedByUser: batch.uploadedByUserId,
    uploadedAt: batch.uploadedAt,
    status: batch.status,
    totalRows: batch.totalRows,
    validRows: batch.validRows,
    invalidRows: batch.invalidRows,
    importedRows: batch.importedRows,
    errorSummary: batch.errorSummary,
    orders: orders.map((o) => ({
      id: o._id.toString(),
      studentName: o.studentName,
      trackingId: o.trackingId,
      items: o.items.map((i) => ({
        id: i._id.toString(),
        bookCode: i.bookCode,
        bookName: i.bookName,
        requiredQuantity: i.requiredQuantity,
        dispatchedQuantity: i.dispatchedQuantity,
      })),
    })),
  };
}
