import mongoose from 'mongoose';
import { Order, DispatchLog, ImportBatch, VerificationAttempt } from '../models';
import { logAudit } from '../utils/audit';
import { parseDateFilter } from '../utils/date';
import { sendOrderEmail } from './email.service';
import { sendOrderWhatsAppMessage } from './whatsapp.service';

export type ItemStatus = 'PENDING' | 'PARTIALLY_DISPATCHED' | 'COMPLETED';
export type OrderStatus = 'PENDING' | 'PARTIALLY_DISPATCHED' | 'COMPLETED';

export function computeItemStatus(required: number, dispatched: number): ItemStatus {
  if (dispatched === 0) return 'PENDING';
  if (dispatched < required) return 'PARTIALLY_DISPATCHED';
  return 'COMPLETED';
}

export function computeOrderStatus(items: { requiredQuantity: number; dispatchedQuantity: number }[]): OrderStatus {
  if (!items || items.length === 0) return 'PENDING';
  const allCompleted = items.every((i) => i.dispatchedQuantity >= i.requiredQuantity);
  if (allCompleted) return 'COMPLETED';
  const noneDispatched = items.every((i) => i.dispatchedQuantity === 0);
  if (noneDispatched) return 'PENDING';
  return 'PARTIALLY_DISPATCHED';
}

export interface ListOrdersParams {
  search?: string;
  status?: string;
  bookCode?: string;
  batchId?: string;
  dateFilter?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  outgoingOnly?: boolean;
}

export async function listOrders(params: ListOrdersParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 10));
  const skip = (page - 1) * limit;

  const { startDate, endDate } = parseDateFilter(params.dateFilter, params.startDate, params.endDate);

  const query: any = {};

  if (params.outgoingOnly) {
    query.emailSentAt = null;
  }

  if (params.batchId && params.batchId.trim()) {
    try {
      const mongoose = require('mongoose');
      query.importBatchId = new mongoose.Types.ObjectId(params.batchId.trim());
    } catch {
      query.importBatchId = params.batchId.trim();
    }
  }

  if (startDate && endDate) {
    query.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    const regex = new RegExp(q, 'i');
    query.$or = [
      { orderCode: regex },
      { studentName: regex },
      { mobileNumber: regex },
      { email: regex },
      { trackingId: regex },
      { productCode: regex },
      { 'items.bookCode': regex },
      { 'items.bookName': regex },
    ];
  }

  if (params.bookCode && params.bookCode.trim()) {
    query['items.bookCode'] = params.bookCode.trim().toUpperCase();
  }

  const allMatchingOrders = await Order.find(query)
    .populate('importBatchId', 'originalFileName uploadedAt')
    .sort({ createdAt: -1 });

  // Map orders with computed status and totals
  const mappedOrders = allMatchingOrders.map((order: any) => {
    const totalRequired = order.items.reduce((acc: number, item: any) => acc + item.requiredQuantity, 0);
    const totalDispatched = order.items.reduce((acc: number, item: any) => acc + item.dispatchedQuantity, 0);
    const totalPending = Math.max(0, totalRequired - totalDispatched);
    const status = computeOrderStatus(order.items);

    const itemsWithStatus = order.items.map((item: any) => ({
      id: item._id.toString(),
      orderId: order._id.toString(),
      productCode: item.productCode || order.productCode,
      productName: item.productName || 'Product',
      bookCode: item.bookCode,
      bookName: item.bookName,
      requiredQuantity: item.requiredQuantity,
      dispatchedQuantity: item.dispatchedQuantity,
      pendingQuantity: Math.max(0, item.requiredQuantity - item.dispatchedQuantity),
      status: computeItemStatus(item.requiredQuantity, item.dispatchedQuantity),
    }));

    return {
      id: order._id.toString(),
      orderCode: order.orderCode || order.productCode,
      productCode: order.productCode,
      studentName: order.studentName,
      mobileNumber: order.mobileNumber,
      email: order.email,
      emailSentAt: order.emailSentAt,
      trackingId: order.trackingId,
      importBatchId: order.importBatchId?._id?.toString() || order.importBatchId?.toString(),
      importBatch: order.importBatchId && typeof order.importBatchId === 'object'
        ? {
            id: order.importBatchId._id?.toString(),
            originalFileName: order.importBatchId.originalFileName,
            uploadedAt: order.importBatchId.uploadedAt,
          }
        : undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      totalRequired,
      totalDispatched,
      totalPending,
      status,
      items: itemsWithStatus,
    };
  });

  // Filter for computed order status
  let filtered = mappedOrders;
  if (params.status && params.status !== 'ALL') {
    filtered = filtered.filter((o) => o.status === params.status);
  } else if (params.outgoingOnly) {
    filtered = filtered.filter((o) => o.status !== 'COMPLETED');
  }

  const paginatedOrders = filtered.slice(skip, skip + limit);

  // Compute accurate batch & queue totals across all matching orders
  const allRequired = mappedOrders.reduce((acc, o) => acc + o.totalRequired, 0);
  const allDispatched = mappedOrders.reduce((acc, o) => acc + o.totalDispatched, 0);
  const allPending = Math.max(0, allRequired - allDispatched);

  const stats = {
    totalOrders: filtered.length,
    allOrdersCount: mappedOrders.length,
    ordersInQueue: filtered.length,
    totalRequiredCopies: allRequired,
    totalDispatchedCopies: allDispatched,
    totalPendingCopies: allPending,
  };

  return {
    orders: paginatedOrders,
    pagination: {
      page,
      limit,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / limit),
    },
    stats,
  };
}

export async function markOrderEmailSent(orderId: string, actorUserId: string) {
  const order = await Order.findById(orderId);

  if (!order) {
    throw { statusCode: 404, message: 'Order not found', code: 'ORDER_NOT_FOUND' };
  }

  const dispatchItems = order.items.map((item: any) => ({
    bookCode: item.bookCode,
    bookName: item.bookName,
    requiredQuantity: item.requiredQuantity,
    dispatchedQuantity: item.dispatchedQuantity,
  }));

  const emailResult = await sendOrderEmail(
    {
      name: order.studentName,
      email: order.email,
      trackingId: order.trackingId,
      orderCode: order.orderCode,
    },
    dispatchItems
  );

  const whatsappResult = await sendOrderWhatsAppMessage(
    {
      name: order.studentName,
      mobileNumber: order.mobileNumber,
      trackingId: order.trackingId,
      orderCode: order.orderCode,
    },
    dispatchItems
  );

  if (!order.emailSentAt) {
    order.emailSentAt = new Date();
    await order.save();
  }

  await logAudit({
    actorUserId,
    action: 'ORDER_EMAIL_SENT',
    entityType: 'Order',
    entityId: order._id.toString(),
    metadata: {
      studentName: order.studentName,
      email: order.email,
      mobileNumber: order.mobileNumber,
      trackingId: order.trackingId,
      emailSentAt: order.emailSentAt,
      emailDelivery: emailResult,
      whatsappDelivery: whatsappResult,
    },
  });

  return {
    id: order._id.toString(),
    emailSentAt: order.emailSentAt,
    studentName: order.studentName,
    trackingId: order.trackingId,
    emailDelivery: emailResult,
    whatsappDelivery: whatsappResult,
  };
}

export async function getOrderById(orderId: string) {
  const order = await Order.findById(orderId).populate('importBatchId', 'originalFileName uploadedAt');

  if (!order) {
    throw { statusCode: 404, message: 'Order not found', code: 'ORDER_NOT_FOUND' };
  }

  const totalRequired = order.items.reduce((acc, item) => acc + item.requiredQuantity, 0);
  const totalDispatched = order.items.reduce((acc, item) => acc + item.dispatchedQuantity, 0);
  const totalPending = Math.max(0, totalRequired - totalDispatched);
  const status = computeOrderStatus(order.items);

  // Fetch dispatch logs and verification attempts for this order
  const logs = await DispatchLog.find({ orderId: order._id })
    .populate('employeeId', 'name email')
    .sort({ dispatchedAt: -1 });

  const items = order.items.map((item) => {
    const itemLogs = logs
      .filter((l) => l.orderItemId === item._id.toString())
      .map((l) => ({
        id: l._id.toString(),
        verifiedBookCode: l.verifiedBookCode,
        quantity: l.quantity,
        dispatchedAt: l.dispatchedAt,
        result: l.result,
        employee: l.employeeId,
      }));

    return {
      id: item._id.toString(),
      orderId: order._id.toString(),
      productCode: item.productCode || order.productCode,
      productName: item.productName || 'Product',
      bookCode: item.bookCode,
      bookName: item.bookName,
      requiredQuantity: item.requiredQuantity,
      dispatchedQuantity: item.dispatchedQuantity,
      pendingQuantity: Math.max(0, item.requiredQuantity - item.dispatchedQuantity),
      status: computeItemStatus(item.requiredQuantity, item.dispatchedQuantity),
      dispatchLogs: itemLogs,
    };
  });

  return {
    id: order._id.toString(),
    orderCode: order.orderCode || order.productCode,
    productCode: order.productCode,
    studentName: order.studentName,
    mobileNumber: order.mobileNumber,
    email: order.email,
    emailSentAt: order.emailSentAt,
    trackingId: order.trackingId,
    importBatchId: order.importBatchId?._id?.toString() || order.importBatchId?.toString(),
    importBatch: order.importBatchId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    totalRequired,
    totalDispatched,
    totalPending,
    status,
    items,
  };
}

export async function getDashboardSummary() {
  const [allOrders, totalBatches] = await Promise.all([
    Order.find(),
    ImportBatch.countDocuments({ status: 'COMPLETED' }),
  ]);

  let totalRequired = 0;
  let totalDispatched = 0;
  let completedOrders = 0;
  let partiallyDispatchedOrders = 0;
  let pendingOrders = 0;
  const distinctBookCodes = new Set<string>();

  for (const o of allOrders) {
    const oStatus = computeOrderStatus(o.items);
    if (oStatus === 'COMPLETED') completedOrders++;
    else if (oStatus === 'PARTIALLY_DISPATCHED') partiallyDispatchedOrders++;
    else pendingOrders++;

    for (const item of o.items) {
      totalRequired += item.requiredQuantity;
      totalDispatched += item.dispatchedQuantity;
      distinctBookCodes.add(item.bookCode);
    }
  }

  const totalPending = Math.max(0, totalRequired - totalDispatched);

  // Today's dispatches count
  const todayRange = parseDateFilter('today');
  const todayDispatches = await DispatchLog.countDocuments({
    result: 'SUCCESS',
    dispatchedAt: {
      $gte: todayRange.startDate,
      $lte: todayRange.endDate,
    },
  });

  return {
    totalOrders: allOrders.length,
    totalStudents: allOrders.length,
    totalBookTypes: distinctBookCodes.size,
    totalRequiredCopies: totalRequired,
    totalDispatchedCopies: totalDispatched,
    totalPendingCopies: totalPending,
    completedOrders,
    partiallyDispatchedOrders,
    pendingOrders,
    todayDispatches,
    totalImportBatches: totalBatches,
  };
}

// ─── Barcode Sheet Data ───────────────────────────────────────────────────────
// Returns all orders with productCode + bookCodes for barcode print/download page
export async function getBarcodeSheetData(params: {
  batchId?: string;
  search?: string;
}) {
  const query: any = {};
  if (params.batchId) {
    const mongoose = require('mongoose');
    query.importBatchId = new mongoose.Types.ObjectId(params.batchId);
  }
  if (params.search) {
    const regex = new RegExp(params.search, 'i');
    query.$or = [
      { orderCode: regex },
      { studentName: regex },
      { trackingId: regex },
      { productCode: regex },
      { mobileNumber: regex },
    ];
  }

  const orders = await Order.find(query)
    .select('orderCode productCode studentName mobileNumber email trackingId items createdAt')
    .sort({ orderCode: 1 });

  return orders.map((order: any) => {
    // Extract distinct products in this order
    const productsMap = new Map<string, string>();
    order.items.forEach((item: any) => {
      const pCode = item.productCode || order.productCode || 'PRD-01';
      const pName = item.productName || 'Product';
      if (!productsMap.has(pCode)) {
        productsMap.set(pCode, pName);
      }
    });

    const products = Array.from(productsMap.entries()).map(([code, name]) => ({
      productCode: code,
      productName: name,
    }));

    return {
      id: order._id.toString(),
      orderCode: order.orderCode || order.productCode,
      productCode: order.productCode,
      products,
      studentName: order.studentName,
      mobileNumber: order.mobileNumber,
      email: order.email,
      trackingId: order.trackingId,
      createdAt: order.createdAt,
      totalRequired: order.items.reduce((s: number, i: any) => s + i.requiredQuantity, 0),
      totalDispatched: order.items.reduce((s: number, i: any) => s + i.dispatchedQuantity, 0),
      status: computeOrderStatus(order.items),
      items: order.items.map((item: any) => ({
        id: item._id.toString(),
        productCode: item.productCode || order.productCode,
        productName: item.productName || 'Product',
        bookCode: item.bookCode,
        bookName: item.bookName,
        requiredQuantity: item.requiredQuantity,
        dispatchedQuantity: item.dispatchedQuantity,
        pendingQuantity: Math.max(0, item.requiredQuantity - item.dispatchedQuantity),
        status: computeItemStatus(item.requiredQuantity, item.dispatchedQuantity),
      })),
    };
  });
}

export async function clearAllOrders(userId: string) {
  try {
    await Order.collection.dropIndex('productCode_1');
  } catch (e) {}

  const deletedOrders = await Order.deleteMany({});
  const deletedBatches = await ImportBatch.deleteMany({});
  const deletedLogs = await DispatchLog.deleteMany({});
  const deletedAttempts = await VerificationAttempt.deleteMany({});

  await logAudit({
    actorUserId: userId,
    action: 'ALL_ORDERS_CLEARED',
    entityType: 'Order',
    entityId: 'ALL',
    metadata: {
      ordersRemoved: deletedOrders.deletedCount,
      batchesRemoved: deletedBatches.deletedCount,
      logsRemoved: deletedLogs.deletedCount,
      attemptsRemoved: deletedAttempts.deletedCount,
    },
  });

  return {
    message: 'All orders, batches, and dispatch history have been deleted successfully.',
    ordersRemoved: deletedOrders.deletedCount,
    batchesRemoved: deletedBatches.deletedCount,
  };
}

export async function deleteOrders(userId: string, orderIds: string[]) {
  const uniqueIds = Array.from(new Set(orderIds.map((id) => id.trim())));
  if (uniqueIds.length === 0 || uniqueIds.length > 500 || uniqueIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw {
      statusCode: 400,
      message: 'Select between 1 and 500 valid orders to delete.',
      code: 'INVALID_ORDER_IDS',
    };
  }

  const objectIds = uniqueIds.map((id) => new mongoose.Types.ObjectId(id));
  const orders = await Order.find({ _id: { $in: objectIds } }).select('_id');
  if (orders.length !== objectIds.length) {
    throw {
      statusCode: 404,
      message: 'One or more selected orders were not found. Refresh the page and try again.',
      code: 'ORDERS_NOT_FOUND',
    };
  }

  const existingIds = orders.map((order) => order._id);
  const [deletedLogs, deletedAttempts] = await Promise.all([
    DispatchLog.deleteMany({ orderId: { $in: existingIds } }),
    VerificationAttempt.deleteMany({ orderId: { $in: existingIds } }),
  ]);
  const deletedOrders = await Order.deleteMany({ _id: { $in: existingIds } });

  await logAudit({
    actorUserId: userId,
    action: 'ORDERS_BULK_DELETED',
    entityType: 'Order',
    entityId: 'BULK',
    metadata: {
      orderIds: uniqueIds,
      ordersRemoved: deletedOrders.deletedCount,
      logsRemoved: deletedLogs.deletedCount,
      attemptsRemoved: deletedAttempts.deletedCount,
    },
  });

  return {
    message: `${deletedOrders.deletedCount} selected order(s) and their dispatch history deleted. Physical dispatch stock was not restored.`,
    ordersRemoved: deletedOrders.deletedCount,
    logsRemoved: deletedLogs.deletedCount,
    attemptsRemoved: deletedAttempts.deletedCount,
  };
}
