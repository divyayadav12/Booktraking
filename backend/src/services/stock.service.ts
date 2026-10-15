import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { BookStock, IBookStock } from '../models/BookStock';
import { StockInward } from '../models/StockInward';
import { Order } from '../models/Order';
import { logAudit } from '../utils/audit';

export interface GetAvailableStockParams {
  search?: string;
  status?: 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AddInwardEntryInput {
  bookCode: string;
  bookName: string;
  quantity: number;
  supplier?: string;
  remarks?: string;
  source?: 'MANUAL' | 'EXCEL_UPLOAD' | 'BARCODE_SCAN';
  entryDate?: string;
  entryTime?: string;
}

/**
 * Normalizes book code consistently
 */
export function normalizeCode(code: string): string {
  return (code || '').trim().toUpperCase();
}

/**
 * Get available warehouse stock with aggregate summary statistics
 */
export async function getAvailableStock(params: GetAvailableStockParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 20));
  const skip = (page - 1) * limit;

  const query: any = {};

  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    const regex = new RegExp(q, 'i');
    query.$or = [{ bookCode: regex }, { bookName: regex }, { productCode: regex }];
  }

  if (params.status === 'OUT_OF_STOCK') {
    query.availableQuantity = 0;
  } else if (params.status === 'LOW_STOCK') {
    query.availableQuantity = { $gt: 0, $lte: 10 };
  } else if (params.status === 'IN_STOCK') {
    query.availableQuantity = { $gt: 10 };
  }

  const sortDirection = params.sortOrder === 'asc' ? 1 : -1;
  const sortField = params.sortBy || 'availableQuantity';
  const sort: any = { [sortField]: sortDirection };

  const [books, totalMatching, summaryAgg] = await Promise.all([
    BookStock.find(query).sort(sort).skip(skip).limit(limit).lean(),
    BookStock.countDocuments(query),
    BookStock.aggregate([
      {
        $group: {
          _id: null,
          totalTitles: { $sum: 1 },
          totalAvailableCopies: { $sum: '$availableQuantity' },
          totalInwardCopies: { $sum: '$totalInward' },
          totalDispatchedCopies: { $sum: '$totalDispatched' },
          outOfStockTitles: {
            $sum: { $cond: [{ $eq: ['$availableQuantity', 0] }, 1, 0] },
          },
          lowStockTitles: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ['$availableQuantity', 0] },
                    { $lte: ['$availableQuantity', '$lowStockThreshold'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          inStockTitles: {
            $sum: {
              $cond: [{ $gt: ['$availableQuantity', '$lowStockThreshold'] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const summary = summaryAgg[0] || {
    totalTitles: 0,
    totalAvailableCopies: 0,
    totalInwardCopies: 0,
    totalDispatchedCopies: 0,
    outOfStockTitles: 0,
    lowStockTitles: 0,
    inStockTitles: 0,
  };

  const formattedBooks = books.map((b: any) => {
    let stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
    if (b.availableQuantity === 0) {
      stockStatus = 'OUT_OF_STOCK';
    } else if (b.availableQuantity <= (b.lowStockThreshold || 10)) {
      stockStatus = 'LOW_STOCK';
    }

    return {
      id: b._id.toString(),
      bookCode: b.bookCode,
      bookName: b.bookName,
      productCode: b.productCode,
      totalInward: b.totalInward,
      totalDispatched: b.totalDispatched,
      availableQuantity: b.availableQuantity,
      lowStockThreshold: b.lowStockThreshold || 10,
      stockStatus,
      lastRestockedAt: b.lastRestockedAt,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  });

  return {
    books: formattedBooks,
    pagination: {
      page,
      limit,
      total: totalMatching,
      totalPages: Math.ceil(totalMatching / limit),
    },
    summary,
  };
}

/**
 * Add a daily inward stock entry and update available stock
 */
export async function addInwardEntry(userId: string, input: AddInwardEntryInput) {
  const cleanCode = normalizeCode(input.bookCode);
  const cleanName = (input.bookName || '').trim();
  const quantity = Math.floor(Number(input.quantity));

  if (!cleanCode) {
    throw { statusCode: 400, message: 'Book Code is required', code: 'BOOK_CODE_REQUIRED' };
  }
  if (!cleanName) {
    throw { statusCode: 400, message: 'Book Name is required', code: 'BOOK_NAME_REQUIRED' };
  }
  if (!quantity || quantity <= 0) {
    throw { statusCode: 400, message: 'Quantity must be at least 1', code: 'INVALID_QUANTITY' };
  }

  const now = new Date();
  const entryDate = input.entryDate ? new Date(input.entryDate) : now;
  const entryTime = input.entryTime || now.toLocaleTimeString('en-IN', { hour12: false });

  // 1. Record inward transaction log with date and timing
  const inwardRecord = await StockInward.create({
    entryDate,
    entryTime,
    bookCode: cleanCode,
    bookName: cleanName,
    quantity,
    supplier: (input.supplier || '').trim(),
    remarks: (input.remarks || '').trim(),
    source: input.source || 'MANUAL',
    enteredByUserId: new mongoose.Types.ObjectId(userId),
  });

  // 2. Increment live warehouse stock in BookStock master
  const updatedStock = await BookStock.findOneAndUpdate(
    { bookCode: cleanCode },
    {
      $setOnInsert: {
        bookCode: cleanCode,
        totalDispatched: 0,
      },
      $set: {
        bookName: cleanName,
        lastRestockedAt: now,
      },
      $inc: {
        availableQuantity: quantity,
        totalInward: quantity,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // 3. Log audit event
  await logAudit({
    actorUserId: userId,
    action: 'STOCK_INWARD_ADDED',
    entityType: 'StockInward',
    entityId: inwardRecord._id.toString(),
    metadata: {
      bookCode: cleanCode,
      bookName: cleanName,
      quantity,
      newAvailableQuantity: updatedStock.availableQuantity,
    },
  });

  return {
    inwardRecord,
    updatedStock: {
      bookCode: updatedStock.bookCode,
      bookName: updatedStock.bookName,
      availableQuantity: updatedStock.availableQuantity,
      totalInward: updatedStock.totalInward,
      totalDispatched: updatedStock.totalDispatched,
    },
  };
}

/**
 * Bulk Inward Stock via Excel Upload
 */
export async function bulkInwardExcel(userId: string, buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw { statusCode: 400, message: 'Excel file is empty', code: 'EMPTY_FILE' };
  }

  const rows: any[] = [];
  const headerMap = new Map<string, number>();

  // Detect header row
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    const val = (cell.text || cell.value?.toString() || '').trim().toLowerCase().replace(/[\s\-_]/g, '');
    headerMap.set(val, colNumber);
  });

  const getColVal = (row: any, ...aliases: string[]) => {
    for (const a of aliases) {
      const col = headerMap.get(a.toLowerCase().replace(/[\s\-_]/g, ''));
      if (col) {
        const c = row.getCell(col);
        return (c.text || c.value?.toString() || '').trim();
      }
    }
    return '';
  };

  const validEntries: AddInwardEntryInput[] = [];
  const errors: { row: number; error: string }[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip headers

    const bookCode = getColVal(row, 'bookcode', 'code', 'book_code', 'barcode');
    const bookName = getColVal(row, 'bookname', 'name', 'title', 'book_name');
    const rawQty = getColVal(row, 'quantity', 'qty', 'count');
    const supplier = getColVal(row, 'supplier', 'source', 'vendor', 'printer');
    const remarks = getColVal(row, 'remarks', 'notes', 'invoice', 'challan');

    if (!bookCode && !bookName && !rawQty) {
      return; // Skip empty row
    }

    const qty = parseInt(rawQty, 10);
    if (!bookCode) {
      errors.push({ row: rowNumber, error: 'Book Code is required' });
      return;
    }
    if (!bookName) {
      errors.push({ row: rowNumber, error: 'Book Name is required' });
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      errors.push({ row: rowNumber, error: 'Quantity must be a positive number' });
      return;
    }

    validEntries.push({
      bookCode,
      bookName,
      quantity: qty,
      supplier,
      remarks,
      source: 'EXCEL_UPLOAD',
    });
  });

  if (validEntries.length === 0) {
    throw {
      statusCode: 400,
      message: 'No valid rows found in Excel sheet. Please check column headers (Book Code, Book Name, Quantity).',
      code: 'NO_VALID_ROWS',
      errors,
    };
  }

  let totalImportedCopies = 0;
  const processedRecords = [];

  for (const item of validEntries) {
    const res = await addInwardEntry(userId, item);
    processedRecords.push(res.inwardRecord);
    totalImportedCopies += item.quantity;
  }

  await logAudit({
    actorUserId: userId,
    action: 'STOCK_BULK_EXCEL_IMPORTED',
    entityType: 'StockInward',
    entityId: 'BULK',
    metadata: {
      validEntriesCount: validEntries.length,
      totalImportedCopies,
      errorCount: errors.length,
    },
  });

  return {
    success: true,
    importedEntries: validEntries.length,
    totalImportedCopies,
    errors,
  };
}

/**
 * Get daily inward logs with date and timing filters
 */
export async function getInwardHistory(params: {
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 20));
  const skip = (page - 1) * limit;

  const query: any = {};

  if (params.search && params.search.trim()) {
    const regex = new RegExp(params.search.trim(), 'i');
    query.$or = [{ bookCode: regex }, { bookName: regex }, { supplier: regex }, { remarks: regex }];
  }

  if (params.startDate || params.endDate) {
    query.entryDate = {};
    if (params.startDate) {
      query.entryDate.$gte = new Date(params.startDate);
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
      query.entryDate.$lte = end;
    }
  }

  const [records, total] = await Promise.all([
    StockInward.find(query)
      .populate('enteredByUserId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockInward.countDocuments(query),
  ]);

  return {
    records: records.map((r: any) => ({
      id: r._id.toString(),
      entryDate: r.entryDate,
      entryTime: r.entryTime,
      bookCode: r.bookCode,
      bookName: r.bookName,
      quantity: r.quantity,
      supplier: r.supplier,
      remarks: r.remarks,
      source: r.source,
      enteredBy: r.enteredByUserId
        ? {
            id: r.enteredByUserId._id?.toString(),
            name: r.enteredByUserId.name,
            email: r.enteredByUserId.email,
          }
        : null,
      createdAt: r.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Delete mistakenly added inward entry and revert stock count
 */
export async function deleteInwardEntry(userId: string, inwardId: string) {
  const entry = await StockInward.findById(inwardId);
  if (!entry) {
    throw { statusCode: 404, message: 'Inward entry not found', code: 'NOT_FOUND' };
  }

  // Deduct from BookStock
  const stock = await BookStock.findOne({ bookCode: entry.bookCode });
  if (stock) {
    stock.availableQuantity = Math.max(0, stock.availableQuantity - entry.quantity);
    stock.totalInward = Math.max(0, stock.totalInward - entry.quantity);
    await stock.save();
  }

  await StockInward.findByIdAndDelete(inwardId);

  await logAudit({
    actorUserId: userId,
    action: 'STOCK_INWARD_DELETED',
    entityType: 'StockInward',
    entityId: inwardId,
    metadata: {
      bookCode: entry.bookCode,
      bookName: entry.bookName,
      quantityReverted: entry.quantity,
    },
  });

  return { message: 'Inward entry deleted and available stock adjusted successfully' };
}

/**
 * Search existing book catalog across BookStock and Orders for quick autocomplete
 */
export async function searchBookCatalog(q: string) {
  if (!q || !q.trim()) return [];
  const regex = new RegExp(q.trim(), 'i');

  const stockMatches = await BookStock.find({
    $or: [{ bookCode: regex }, { bookName: regex }],
  })
    .limit(10)
    .lean();

  if (stockMatches.length > 0) {
    return stockMatches.map((b) => ({
      bookCode: b.bookCode,
      bookName: b.bookName,
      availableQuantity: b.availableQuantity,
    }));
  }

  // Fallback to order items if not yet registered in BookStock
  const orderMatches = await Order.aggregate([
    { $unwind: '$items' },
    {
      $match: {
        $or: [{ 'items.bookCode': regex }, { 'items.bookName': regex }],
      },
    },
    {
      $group: {
        _id: '$items.bookCode',
        bookCode: { $first: '$items.bookCode' },
        bookName: { $first: '$items.bookName' },
      },
    },
    { $limit: 10 },
  ]);

  return orderMatches.map((m) => ({
    bookCode: m.bookCode,
    bookName: m.bookName,
    availableQuantity: 0,
  }));
}

/**
 * Export Available Stock Master to Excel
 */
export async function exportStockExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Available Stock Master');

  sheet.columns = [
    { header: 'Book Code / Barcode', key: 'bookCode', width: 20 },
    { header: 'Book Name', key: 'bookName', width: 35 },
    { header: 'Total Inward', key: 'totalInward', width: 15 },
    { header: 'Total Dispatched', key: 'totalDispatched', width: 16 },
    { header: 'Available Stock', key: 'availableQuantity', width: 16 },
    { header: 'Stock Status', key: 'stockStatus', width: 16 },
    { header: 'Last Restocked Date & Time', key: 'lastRestockedAt', width: 26 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };

  const stocks = await BookStock.find().sort({ availableQuantity: 1 }).lean();

  stocks.forEach((s) => {
    let status = 'In Stock';
    if (s.availableQuantity === 0) status = 'Out of Stock';
    else if (s.availableQuantity <= (s.lowStockThreshold || 10)) status = 'Low Stock';

    sheet.addRow({
      bookCode: s.bookCode,
      bookName: s.bookName,
      totalInward: s.totalInward,
      totalDispatched: s.totalDispatched,
      availableQuantity: s.availableQuantity,
      stockStatus: status,
      lastRestockedAt: s.lastRestockedAt ? new Date(s.lastRestockedAt).toLocaleString('en-IN') : 'N/A',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Export Inward History to Excel
 */
export async function exportInwardExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Inward Stock History');

  sheet.columns = [
    { header: 'Entry Date', key: 'entryDate', width: 16 },
    { header: 'Entry Timing', key: 'entryTime', width: 16 },
    { header: 'Book Code', key: 'bookCode', width: 20 },
    { header: 'Book Name', key: 'bookName', width: 35 },
    { header: 'Quantity Inwarded', key: 'quantity', width: 18 },
    { header: 'Supplier / Source', key: 'supplier', width: 22 },
    { header: 'Remarks / Invoice', key: 'remarks', width: 25 },
    { header: 'Entered By', key: 'enteredBy', width: 22 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' },
  };

  const records = await StockInward.find()
    .populate('enteredByUserId', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  records.forEach((r: any) => {
    sheet.addRow({
      entryDate: r.entryDate ? new Date(r.entryDate).toLocaleDateString('en-IN') : '',
      entryTime: r.entryTime || '',
      bookCode: r.bookCode,
      bookName: r.bookName,
      quantity: r.quantity,
      supplier: r.supplier || '-',
      remarks: r.remarks || '-',
      enteredBy: r.enteredByUserId?.name || 'System',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
