import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { BookStock, IBookStock } from '../models/BookStock';
import { StockInward } from '../models/StockInward';
import { PendingBook } from '../models/PendingBook';
import { ProductCatalog } from '../models/ProductCatalog';
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

/**
 * Clear all stock master and inward history (Admin reset)
 */
export async function clearAllStock(userId: string) {
  const stockRes = await BookStock.deleteMany({});
  const inwardRes = await StockInward.deleteMany({});

  await logAudit({
    actorUserId: userId,
    action: 'ALL_STOCK_CLEARED',
    entityType: 'BookStock',
    entityId: 'ALL',
    metadata: {
      stocksDeleted: stockRes.deletedCount,
      inwardsDeleted: inwardRes.deletedCount,
    },
  });

  return {
    message: 'All stock and inward records have been cleared successfully.',
    stocksDeleted: stockRes.deletedCount,
    inwardsDeleted: inwardRes.deletedCount,
  };
}

/**
 * Delete a single book from stock master
 */
export async function deleteBookStock(userId: string, identifier: string) {
  const cleanId = identifier.trim();
  let book = null;

  if (mongoose.Types.ObjectId.isValid(cleanId)) {
    book = await BookStock.findById(cleanId);
  }
  if (!book) {
    const cleanCode = normalizeCode(cleanId);
    book = await BookStock.findOne({ bookCode: cleanCode });
  }

  if (!book) {
    throw { statusCode: 404, message: `Book "${identifier}" not found in stock master`, code: 'BOOK_NOT_FOUND' };
  }

  // Only books with 0 available stock can be deleted
  if (book.availableQuantity > 0) {
    throw {
      statusCode: 400,
      message: `Keval 0 stock wali book hi delete ho sakti hai! Is book me abhi ${book.availableQuantity} copies available hain. Pehle stock ko 0 karein.`,
      code: 'CANNOT_DELETE_ACTIVE_STOCK',
    };
  }

  const bookName = book.bookName;
  const bookCode = book.bookCode;
  const stockId = book._id.toString();

  await BookStock.findByIdAndDelete(book._id);

  await logAudit({
    actorUserId: userId,
    action: 'BOOK_STOCK_DELETED',
    entityType: 'BookStock',
    entityId: stockId,
    metadata: {
      bookCode,
      bookName,
    },
  });

  return {
    message: `Book "${bookName}" (${bookCode}) has been successfully deleted from available stock.`,
    bookCode,
    bookName,
  };
}

/**
 * Update Book details in stock master (Book Code, Book Name, Product Code, Low Stock Threshold, Available Stock)
 */
export async function updateBookDetails(
  userId: string,
  identifier: string,
  updateData: {
    bookCode?: string;
    bookName?: string;
    productCode?: string;
    lowStockThreshold?: number;
    availableQuantity?: number;
  }
) {
  const cleanId = identifier.trim();
  let book = null;

  if (mongoose.Types.ObjectId.isValid(cleanId)) {
    book = await BookStock.findById(cleanId);
  }
  if (!book) {
    const cleanCode = normalizeCode(cleanId);
    book = await BookStock.findOne({ bookCode: cleanCode });
  }

  if (!book) {
    throw { statusCode: 404, message: `Book "${identifier}" not found in stock master`, code: 'BOOK_NOT_FOUND' };
  }

  const oldCode = book.bookCode;
  const oldName = book.bookName;
  const oldProductCode = book.productCode || '';
  const oldThreshold = book.lowStockThreshold || 10;
  const oldAvailable = book.availableQuantity;

  let newCode = oldCode;
  if (updateData.bookCode && updateData.bookCode.trim()) {
    newCode = normalizeCode(updateData.bookCode);
    if (newCode !== oldCode) {
      // Check if newCode already belongs to another book
      const existing = await BookStock.findOne({ bookCode: newCode });
      if (existing && existing._id.toString() !== book._id.toString()) {
        throw {
          statusCode: 400,
          message: `Book code "${newCode}" already exists for another book (${existing.bookName})! Duplicate code not allowed.`,
          code: 'DUPLICATE_BOOK_CODE',
        };
      }
    }
  }

  const newName = updateData.bookName && updateData.bookName.trim() ? updateData.bookName.trim() : oldName;
  const newProductCode = updateData.productCode !== undefined ? updateData.productCode.trim().toUpperCase() : oldProductCode;
  const newThreshold =
    updateData.lowStockThreshold !== undefined && Number(updateData.lowStockThreshold) > 0
      ? Number(updateData.lowStockThreshold)
      : oldThreshold;

  book.bookCode = newCode;
  book.bookName = newName;
  book.productCode = newProductCode;
  book.lowStockThreshold = newThreshold;

  // If availableQuantity is also updated
  if (
    updateData.availableQuantity !== undefined &&
    !isNaN(Number(updateData.availableQuantity)) &&
    Number(updateData.availableQuantity) >= 0
  ) {
    const newQty = Number(updateData.availableQuantity);
    book.availableQuantity = newQty;
    // Align totalInward if needed so totalInward >= totalDispatched + availableQuantity
    if (book.totalInward < book.totalDispatched + newQty) {
      book.totalInward = book.totalDispatched + newQty;
    }
  }

  await book.save();

  // If bookCode or bookName changed, also sync across StockInward and PendingBook so records match
  if (newCode !== oldCode || newName !== oldName) {
    await StockInward.updateMany(
      { bookCode: oldCode },
      { $set: { bookCode: newCode, bookName: newName } }
    );
    await PendingBook.updateMany(
      { bookCode: oldCode },
      { $set: { bookCode: newCode, bookName: newName } }
    );
  }

  await logAudit({
    actorUserId: userId,
    action: 'BOOK_STOCK_UPDATED',
    entityType: 'BookStock',
    entityId: book._id.toString(),
    metadata: {
      old: { bookCode: oldCode, bookName: oldName, productCode: oldProductCode, lowStockThreshold: oldThreshold, availableQuantity: oldAvailable },
      new: { bookCode: newCode, bookName: newName, productCode: newProductCode, lowStockThreshold: newThreshold, availableQuantity: book.availableQuantity },
    },
  });

  return {
    message: `Book "${newName}" (${newCode}) ki details successfully update ho gayi hain!`,
    book,
  };
}

export interface AdjustStockInput {
  bookCode: string;
  bookName?: string;
  mode: 'SET' | 'ADD' | 'REDUCE';
  quantity: number;
  reason?: string;
  lowStockThreshold?: number;
}

/**
 * Update, increase, or reduce stock for a book
 */
export async function adjustStock(userId: string, input: AdjustStockInput) {
  const cleanCode = normalizeCode(input.bookCode);
  const stock = await BookStock.findOne({ bookCode: cleanCode });
  if (!stock) {
    throw { statusCode: 404, message: `Book with code "${cleanCode}" not found in stock master`, code: 'BOOK_NOT_FOUND' };
  }

  const oldAvailable = stock.availableQuantity;
  let newAvailable = oldAvailable;
  const qty = Math.max(0, Math.floor(input.quantity ?? 0));

  if (input.mode === 'SET') {
    newAvailable = qty;
  } else if (input.mode === 'ADD') {
    newAvailable = oldAvailable + qty;
  } else if (input.mode === 'REDUCE') {
    if (qty > oldAvailable) {
      throw { statusCode: 400, message: `Cannot reduce ${qty} copies: only ${oldAvailable} available in warehouse!`, code: 'INSUFFICIENT_STOCK' };
    }
    newAvailable = oldAvailable - qty;
  } else {
    throw { statusCode: 400, message: 'Invalid mode. Mode must be SET, ADD, or REDUCE', code: 'INVALID_MODE' };
  }

  const diff = newAvailable - oldAvailable;

  stock.availableQuantity = newAvailable;
  stock.totalInward = Math.max(0, stock.totalDispatched + newAvailable);
  if (input.bookName && input.bookName.trim()) {
    stock.bookName = input.bookName.trim();
  }
  if (input.lowStockThreshold && input.lowStockThreshold >= 1) {
    stock.lowStockThreshold = input.lowStockThreshold;
  }
  stock.lastRestockedAt = new Date();
  await stock.save();

  // Log in StockInward for record keeping
  const now = new Date();
  const entryDate = now.toISOString().slice(0, 10);
  const entryTime = now.toLocaleTimeString('en-IN', { hour12: false });

  await StockInward.create({
    bookCode: cleanCode,
    bookName: stock.bookName,
    quantity: diff !== 0 ? diff : 0,
    supplier: diff < 0 ? 'Stock Reduction (स्टॉक कटौती)' : 'Stock Adjustment (स्टॉक समायोजन)',
    remarks: input.reason || (input.mode === 'REDUCE' ? `Reduced by ${qty} copies` : input.mode === 'SET' ? `Stock set directly to ${newAvailable}` : `Added ${qty} copies`),
    entryDate: now,
    entryTime,
    enteredByUserId: new mongoose.Types.ObjectId(userId),
    source: 'MANUAL',
  });

  await logAudit({
    actorUserId: userId,
    action: 'STOCK_ADJUSTED',
    entityType: 'BookStock',
    entityId: stock._id.toString(),
    metadata: {
      bookCode: cleanCode,
      mode: input.mode,
      oldQuantity: oldAvailable,
      newQuantity: newAvailable,
      diff,
      reason: input.reason,
    },
  });

  return {
    message: `Stock for "${stock.bookName}" (${cleanCode}) updated successfully from ${oldAvailable} to ${newAvailable} copies.`,
    book: {
      id: stock._id.toString(),
      bookCode: stock.bookCode,
      bookName: stock.bookName,
      availableQuantity: stock.availableQuantity,
      totalInward: stock.totalInward,
      totalDispatched: stock.totalDispatched,
      lowStockThreshold: stock.lowStockThreshold,
      stockStatus: stock.availableQuantity === 0 ? 'OUT_OF_STOCK' : stock.availableQuantity <= stock.lowStockThreshold ? 'LOW_STOCK' : 'IN_STOCK',
      lastRestockedAt: stock.lastRestockedAt,
    },
  };
}

/* =========================================================================
   PENDING BOOKS MANAGEMENT (पेंडिंग बुक स्टॉक)
========================================================================= */

export interface GetPendingBooksParams {
  search?: string;
  status?: 'ALL' | 'PENDING' | 'RECEIVED' | 'CANCELLED';
  priority?: 'ALL' | 'NORMAL' | 'HIGH' | 'URGENT';
  page?: number;
  limit?: number;
}

export interface AddPendingBookInput {
  bookCode: string;
  bookName: string;
  pendingQuantity: number;
  printerOrVendor?: string;
  expectedDate?: string | Date;
  priority?: 'NORMAL' | 'HIGH' | 'URGENT';
  remarks?: string;
}

export async function getPendingBooks(params: GetPendingBooksParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 20));
  const skip = (page - 1) * limit;

  const query: any = {};
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    const regex = new RegExp(q, 'i');
    query.$or = [{ bookCode: regex }, { bookName: regex }, { printerOrVendor: regex }];
  }

  if (params.status && params.status !== 'ALL') {
    query.status = params.status;
  }
  if (params.priority && params.priority !== 'ALL') {
    query.priority = params.priority;
  }

  const [items, total, summaryAgg] = await Promise.all([
    PendingBook.find(query)
      .populate('addedByUserId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PendingBook.countDocuments(query),
    PendingBook.aggregate([
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          totalPendingCopies: {
            $sum: {
              $cond: [{ $eq: ['$status', 'PENDING'] }, '$pendingQuantity', 0],
            },
          },
          totalReceivedCopies: {
            $sum: '$receivedQuantity',
          },
          urgentCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'PENDING'] },
                    { $in: ['$priority', ['HIGH', 'URGENT']] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const summary = summaryAgg[0] || {
    totalEntries: 0,
    totalPendingCopies: 0,
    totalReceivedCopies: 0,
    urgentCount: 0,
  };

  return {
    items: items.map((item: any) => ({
      id: item._id.toString(),
      bookCode: item.bookCode,
      bookName: item.bookName,
      pendingQuantity: item.pendingQuantity,
      receivedQuantity: item.receivedQuantity || 0,
      printerOrVendor: item.printerOrVendor || '-',
      expectedDate: item.expectedDate,
      priority: item.priority || 'NORMAL',
      status: item.status || 'PENDING',
      remarks: item.remarks || '',
      addedBy: item.addedByUserId ? { name: item.addedByUserId.name, email: item.addedByUserId.email } : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function addPendingBook(userId: string, input: AddPendingBookInput) {
  const cleanCode = normalizeCode(input.bookCode);
  const cleanName = (input.bookName || '').trim();
  const qty = parseInt(String(input.pendingQuantity), 10);

  if (!cleanCode) {
    throw { statusCode: 400, message: 'Book Code / Barcode is required', code: 'BOOK_CODE_REQUIRED' };
  }
  if (!cleanName) {
    throw { statusCode: 400, message: 'Book Name is required', code: 'BOOK_NAME_REQUIRED' };
  }
  if (isNaN(qty) || qty <= 0) {
    throw { statusCode: 400, message: 'Pending Quantity must be at least 1', code: 'INVALID_QUANTITY' };
  }

  const pendingBook = await PendingBook.create({
    bookCode: cleanCode,
    bookName: cleanName,
    pendingQuantity: qty,
    receivedQuantity: 0,
    printerOrVendor: (input.printerOrVendor || '').trim(),
    expectedDate: input.expectedDate ? new Date(input.expectedDate) : undefined,
    priority: input.priority || 'NORMAL',
    status: 'PENDING',
    remarks: (input.remarks || '').trim(),
    addedByUserId: new mongoose.Types.ObjectId(userId),
  });

  await logAudit({
    actorUserId: userId,
    action: 'PENDING_BOOK_ADDED',
    entityType: 'PendingBook',
    entityId: pendingBook._id.toString(),
    metadata: {
      bookCode: cleanCode,
      bookName: cleanName,
      pendingQuantity: qty,
      printerOrVendor: pendingBook.printerOrVendor,
    },
  });

  return {
    message: `Pending entry for "${cleanName}" (${cleanCode}) created successfully!`,
    pendingBook,
  };
}

export async function updatePendingBook(userId: string, id: string, input: Partial<AddPendingBookInput & { status: string }>) {
  const pendingBook = await PendingBook.findById(id);
  if (!pendingBook) {
    throw { statusCode: 404, message: 'Pending book record not found', code: 'NOT_FOUND' };
  }

  if (input.bookCode) pendingBook.bookCode = normalizeCode(input.bookCode);
  if (input.bookName) pendingBook.bookName = input.bookName.trim();
  if (input.pendingQuantity !== undefined) {
    const qty = parseInt(String(input.pendingQuantity), 10);
    if (!isNaN(qty) && qty > 0) pendingBook.pendingQuantity = qty;
  }
  if (input.printerOrVendor !== undefined) pendingBook.printerOrVendor = input.printerOrVendor.trim();
  if (input.expectedDate !== undefined) pendingBook.expectedDate = input.expectedDate ? new Date(input.expectedDate) : undefined;
  if (input.priority) pendingBook.priority = input.priority as any;
  if (input.status) pendingBook.status = input.status as any;
  if (input.remarks !== undefined) pendingBook.remarks = input.remarks.trim();

  await pendingBook.save();

  return {
    message: `Pending book record updated successfully!`,
    pendingBook,
  };
}

export async function deletePendingBook(userId: string, id: string) {
  const pendingBook = await PendingBook.findById(id);
  if (!pendingBook) {
    throw { statusCode: 404, message: 'Pending book record not found', code: 'NOT_FOUND' };
  }

  await PendingBook.findByIdAndDelete(id);

  await logAudit({
    actorUserId: userId,
    action: 'PENDING_BOOK_DELETED',
    entityType: 'PendingBook',
    entityId: id,
    metadata: {
      bookCode: pendingBook.bookCode,
      bookName: pendingBook.bookName,
    },
  });

  return {
    message: `Pending book record for "${pendingBook.bookName}" deleted successfully!`,
  };
}

export async function receivePendingBook(userId: string, id: string, input: { receivedQuantity?: number; remarks?: string }) {
  const pendingBook = await PendingBook.findById(id);
  if (!pendingBook) {
    throw { statusCode: 404, message: 'Pending book record not found', code: 'NOT_FOUND' };
  }

  const qty = input.receivedQuantity && input.receivedQuantity > 0 ? input.receivedQuantity : pendingBook.pendingQuantity;

  // 1. Add to live warehouse Stock Inward
  await addInwardEntry(userId, {
    bookCode: pendingBook.bookCode,
    bookName: pendingBook.bookName,
    quantity: qty,
    supplier: pendingBook.printerOrVendor || 'Pending Order Arrival',
    remarks: input.remarks || `Received from Pending Book Order (${qty} copies arrived)`,
    source: 'MANUAL',
  });

  // 2. Mark pending record as received
  pendingBook.receivedQuantity = (pendingBook.receivedQuantity || 0) + qty;
  pendingBook.status = 'RECEIVED';
  await pendingBook.save();

  await logAudit({
    actorUserId: userId,
    action: 'PENDING_BOOK_RECEIVED_TO_STOCK',
    entityType: 'PendingBook',
    entityId: id,
    metadata: {
      bookCode: pendingBook.bookCode,
      bookName: pendingBook.bookName,
      receivedQuantity: qty,
    },
  });

    return {
      message: `${qty} copies of "${pendingBook.bookName}" received and added to Available Warehouse Stock!`,
      pendingBook,
    };
  }

  /**
   * Get comprehensive Barcode Directory for all Books and Products
   */
  export async function getBarcodeCatalog() {
    // 1. All Books in BookStock
    const booksStock = await BookStock.find({}).sort({ bookCode: 1 }).lean();

    // Pending books count map
    const pendingRecords = await PendingBook.find({ status: { $ne: 'RECEIVED' } }).lean();
    const pendingMap = new Map<string, number>();
    pendingRecords.forEach((pb) => {
      const code = (pb.bookCode || '').toUpperCase().trim();
      const remaining = Math.max(0, (pb.pendingQuantity || 0) - (pb.receivedQuantity || 0));
      pendingMap.set(code, (pendingMap.get(code) || 0) + remaining);
    });

    const booksList = booksStock.map((b) => ({
      id: b._id.toString(),
      bookCode: b.bookCode,
      bookName: b.bookName,
      productCode: b.productCode || '',
      availableQuantity: b.availableQuantity,
      totalInward: b.totalInward,
      totalDispatched: b.totalDispatched,
      pendingQuantity: pendingMap.get(b.bookCode.toUpperCase()) || 0,
      type: 'BOOK' as const,
    }));

    // 2. Query ProductCatalog first
    let catalogProducts = await ProductCatalog.find({}).sort({ productCode: 1 }).lean();

    // 3. Aggregate products from Orders
    const productAgg = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productCode',
          productName: { $first: '$items.productName' },
          books: { $addToSet: '$items.bookCode' },
          totalOrdersCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Build order counts & aggregated books map
    const orderCountMap = new Map<string, number>();
    const orderBooksMap = new Map<string, string[]>();
    productAgg.forEach((p) => {
      if (p._id) {
        const c = p._id.toUpperCase().trim();
        orderCountMap.set(c, p.totalOrdersCount || 0);
        orderBooksMap.set(c, (p.books || []).map((b: string) => b.toUpperCase().trim()));
      }
    });

    // If ProductCatalog is empty, seed it with orders and bookStock combos!
    if (catalogProducts.length === 0) {
      const seedMap = new Map<string, { code: string; name: string; books: Set<string> }>();
      productAgg.forEach((p) => {
        if (p._id) {
          const c = p._id.toUpperCase().trim();
          seedMap.set(c, {
            code: c,
            name: p.productName || c,
            books: new Set((p.books || []).map((b: string) => b.toUpperCase().trim())),
          });
        }
      });
      booksStock.forEach((b) => {
        const pCode = (b.productCode || '').toUpperCase().trim();
        if (pCode) {
          if (!seedMap.has(pCode)) {
            seedMap.set(pCode, { code: pCode, name: `${pCode} Course Bundle`, books: new Set([b.bookCode]) });
          } else {
            seedMap.get(pCode)!.books.add(b.bookCode);
          }
        }
      });

      if (seedMap.size > 0) {
        const docs = Array.from(seedMap.values()).map((it) => ({
          productCode: it.code,
          productName: it.name,
          books: Array.from(it.books).sort(),
        }));
        await ProductCatalog.insertMany(docs, { ordered: false }).catch(() => {});
        catalogProducts = await ProductCatalog.find({}).sort({ productCode: 1 }).lean();
      }
    }

    // Merge any products from Orders or BookStock that might not yet be in ProductCatalog
    const knownCodes = new Set(catalogProducts.map((p) => p.productCode.toUpperCase().trim()));
    const missingDocs: any[] = [];
    productAgg.forEach((p) => {
      if (p._id) {
        const c = p._id.toUpperCase().trim();
        if (!knownCodes.has(c)) {
          knownCodes.add(c);
          missingDocs.push({
            productCode: c,
            productName: p.productName || c,
            books: (p.books || []).sort(),
          });
        }
      }
    });
    booksStock.forEach((b) => {
      const pCode = (b.productCode || '').toUpperCase().trim();
      if (pCode && !knownCodes.has(pCode)) {
        knownCodes.add(pCode);
        missingDocs.push({
          productCode: pCode,
          productName: `${pCode} Course Bundle`,
          books: [b.bookCode],
        });
      }
    });

    if (missingDocs.length > 0) {
      await ProductCatalog.insertMany(missingDocs, { ordered: false }).catch(() => {});
      catalogProducts = await ProductCatalog.find({}).sort({ productCode: 1 }).lean();
    }

    // Map all catalog products with live order counts
    const productsList = catalogProducts.map((p) => {
      const c = p.productCode.toUpperCase().trim();
      const stockBooks = booksStock
        .filter((b) => (b.productCode || '').toUpperCase().trim() === c)
        .map((b) => b.bookCode);
      const combinedBooks = Array.from(new Set([...(p.books || []), ...stockBooks, ...(orderBooksMap.get(c) || [])])).sort();

      return {
        id: p._id.toString(),
        productCode: c,
        productName: p.productName || c,
        books: combinedBooks,
        totalBooksCount: combinedBooks.length,
        totalOrdersCount: orderCountMap.get(c) || 0,
        type: 'PRODUCT' as const,
      };
    });

    return {
      books: booksList,
      products: productsList,
      summary: {
        totalBooks: booksList.length,
        totalProducts: productsList.length,
        totalInStockBooks: booksList.filter((b) => b.availableQuantity > 0).length,
        totalOutOfStockBooks: booksList.filter((b) => b.availableQuantity === 0).length,
      },
    };
  }

  /**
   * Update Product details (Product Code, Course Name, Books Bundle)
   */
  export async function updateProductDetails(
    userId: string,
    identifier: string,
    updateData: {
      productCode?: string;
      productName?: string;
      books?: string[];
    }
  ) {
    const cleanId = identifier.trim().toUpperCase();
    let product = await ProductCatalog.findOne({
      $or: [
        { productCode: cleanId },
        ...(mongoose.Types.ObjectId.isValid(identifier) ? [{ _id: identifier }] : []),
      ],
    });

    const oldCode = product ? product.productCode : cleanId;
    const oldName = product ? product.productName : cleanId;

    let newCode = oldCode;
    if (updateData.productCode && updateData.productCode.trim()) {
      newCode = updateData.productCode.trim().toUpperCase();
    }

    const newName = updateData.productName && updateData.productName.trim() ? updateData.productName.trim() : oldName;
    const newBooks = Array.isArray(updateData.books)
      ? Array.from(new Set(updateData.books.map((b) => b.trim().toUpperCase()).filter(Boolean))).sort()
      : (product ? product.books : []);

    if (!product) {
      product = new ProductCatalog({
        productCode: newCode,
        productName: newName,
        books: newBooks,
      });
    } else {
      product.productCode = newCode;
      product.productName = newName;
      product.books = newBooks;
    }
    await product.save();

    // 1. Sync across Orders (items.productCode & items.productName, and root productCode)
    await Order.updateMany(
      { 'items.productCode': oldCode },
      { $set: { 'items.$[elem].productCode': newCode, 'items.$[elem].productName': newName } },
      { arrayFilters: [{ 'elem.productCode': oldCode }] }
    );
    await Order.updateMany(
      { productCode: oldCode },
      { $set: { productCode: newCode } }
    );

    // 2. Sync across BookStock:
    await BookStock.updateMany(
      { productCode: oldCode },
      { $set: { productCode: newCode } }
    );
    if (newBooks.length > 0) {
      await BookStock.updateMany(
        { bookCode: { $in: newBooks } },
        { $set: { productCode: newCode } }
      );
    }

    await logAudit({
      actorUserId: userId,
      action: 'PRODUCT_UPDATED',
      entityType: 'ProductCatalog',
      entityId: product._id.toString(),
      metadata: {
        old: { productCode: oldCode, productName: oldName },
        new: { productCode: newCode, productName: newName, books: newBooks },
      },
    });

    return {
      message: `Product "${newName}" (${newCode}) successfully update ho gaya!`,
      product: {
        id: product._id.toString(),
        productCode: newCode,
        productName: newName,
        books: newBooks,
      },
    };
  }
