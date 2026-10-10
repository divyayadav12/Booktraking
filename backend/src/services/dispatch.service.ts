import mongoose from 'mongoose';
import { Order, DispatchLog, VerificationAttempt, User } from '../models';
import { normalizeBookCode } from '../utils/normalize';
import { logAudit } from '../utils/audit';
import { computeItemStatus, computeOrderStatus } from './order.service';

export interface VerifyDispatchParams {
  orderItemId: string;
  enteredBookCode: string;
  employeeId: string;
  requestId?: string;
}

export async function verifyAndDispatchBook(params: {
  orderItemId: string;
  enteredBookCode: string;
  employeeId: string;
  requestId?: string;
}) {
  const { orderItemId, enteredBookCode, employeeId, requestId } = params;

  // Check idempotency if requestId provided
  if (requestId) {
    const existingLog = await DispatchLog.findOne({ requestId });
    if (existingLog) {
      const order = await Order.findById(existingLog.orderId);
      const item = order?.items.find((i) => i._id.toString() === orderItemId);
      if (item) {
        const pendingQuantity = Math.max(0, item.requiredQuantity - item.dispatchedQuantity);
        return {
          alreadyProcessed: true,
          success: true,
          message: 'This dispatch request was already processed successfully.',
          orderItem: {
            id: item._id.toString(),
            bookCode: item.bookCode,
            bookName: item.bookName,
            requiredQuantity: item.requiredQuantity,
            dispatchedQuantity: item.dispatchedQuantity,
            pendingQuantity,
            status: computeItemStatus(item.requiredQuantity, item.dispatchedQuantity),
          },
        };
      }
    }
  }

  // Find order containing this item
  const order = await Order.findOne({ 'items._id': new mongoose.Types.ObjectId(orderItemId) });

  if (!order) {
    throw { statusCode: 404, message: 'Order item not found', code: 'ITEM_NOT_FOUND' };
  }

  const currentItem = order.items.find((i) => i._id.toString() === orderItemId);
  if (!currentItem) {
    throw { statusCode: 404, message: 'Order item not found in order', code: 'ITEM_NOT_FOUND' };
  }

  const normalizedEnteredCode = normalizeBookCode(enteredBookCode);
  const normalizedExpectedCode = normalizeBookCode(currentItem.bookCode);

  // Check Book Code Mismatch
  if (normalizedEnteredCode !== normalizedExpectedCode) {
    const mismatchWarning = 'Warning: Book code does not match this order. Please verify the book.';

    await VerificationAttempt.create({
      orderId: order._id,
      orderItemId,
      employeeId: new mongoose.Types.ObjectId(employeeId),
      enteredBookCode: enteredBookCode.trim(),
      success: false,
      failureReason: mismatchWarning,
    });

    throw {
      statusCode: 400,
      message: mismatchWarning,
      code: 'BOOK_CODE_MISMATCH',
      expectedCode: currentItem.bookCode,
      enteredCode: enteredBookCode,
    };
  }

  // Check pending quantity
  const pendingQuantity = currentItem.requiredQuantity - currentItem.dispatchedQuantity;
  if (pendingQuantity <= 0) {
    throw {
      statusCode: 400,
      message: 'All copies for this book item have already been dispatched. No copies remaining.',
      code: 'NO_PENDING_QUANTITY',
    };
  }

  // Atomically increment dispatchedQuantity ensuring it doesn't exceed requiredQuantity
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      items: {
        $elemMatch: {
          _id: new mongoose.Types.ObjectId(orderItemId),
          dispatchedQuantity: { $lt: currentItem.requiredQuantity },
        },
      },
    },
    {
      $inc: { 'items.$.dispatchedQuantity': 1 },
    },
    { returnDocument: 'after' }
  );

  if (!updatedOrder) {
    throw {
      statusCode: 400,
      message: 'Dispatch rejected: Copies have already been fully dispatched.',
      code: 'NO_PENDING_QUANTITY',
    };
  }

  const updatedItem = updatedOrder.items.find((i) => i._id.toString() === orderItemId)!;

  // Create immutable dispatch log
  const dispatchLog = await DispatchLog.create({
    orderId: order._id,
    orderItemId,
    employeeId: new mongoose.Types.ObjectId(employeeId),
    verifiedBookCode: normalizedExpectedCode,
    quantity: 1,
    requestId: requestId || undefined,
    result: 'SUCCESS',
  });

  // Record successful verification attempt
  await VerificationAttempt.create({
    orderId: order._id,
    orderItemId,
    employeeId: new mongoose.Types.ObjectId(employeeId),
    enteredBookCode: normalizedEnteredCode,
    success: true,
  });

  // Log Audit
  await logAudit({
    actorUserId: employeeId,
    action: 'BOOK_DISPATCHED',
    entityType: 'OrderItem',
    entityId: orderItemId,
    metadata: {
      bookCode: currentItem.bookCode,
      bookName: currentItem.bookName,
      orderId: order._id.toString(),
      newDispatchedQuantity: updatedItem.dispatchedQuantity,
      requiredQuantity: updatedItem.requiredQuantity,
    },
  });

  const orderStatus = computeOrderStatus(updatedOrder.items);
  const newPending = Math.max(0, updatedItem.requiredQuantity - updatedItem.dispatchedQuantity);

  return {
    success: true,
    message: 'Book code verified. One copy dispatched successfully.',
    orderItem: {
      id: updatedItem._id.toString(),
      bookCode: updatedItem.bookCode,
      bookName: updatedItem.bookName,
      requiredQuantity: updatedItem.requiredQuantity,
      dispatchedQuantity: updatedItem.dispatchedQuantity,
      pendingQuantity: newPending,
      status: computeItemStatus(updatedItem.requiredQuantity, updatedItem.dispatchedQuantity),
    },
    orderStatus,
    dispatchLogId: dispatchLog._id.toString(),
  };
}

export async function getDispatchHistory(params: {
  employeeId?: string;
  bookCode?: string;
  dateFilter?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 10));
  const skip = (page - 1) * limit;

  const { startDate, endDate } = require('../utils/date').parseDateFilter(
    params.dateFilter,
    params.startDate,
    params.endDate
  );

  const query: any = { result: 'SUCCESS' };

  if (params.employeeId) {
    query.employeeId = new mongoose.Types.ObjectId(params.employeeId);
  }

  if (startDate && endDate) {
    query.dispatchedAt = { $gte: startDate, $lte: endDate };
  }

  if (params.bookCode) {
    query.verifiedBookCode = params.bookCode.toUpperCase();
  }

  const [logs, total] = await Promise.all([
    DispatchLog.find(query)
      .populate('employeeId', 'name email')
      .populate('orderId', 'studentName trackingId mobileNumber items')
      .sort({ dispatchedAt: -1 })
      .skip(skip)
      .limit(limit),
    DispatchLog.countDocuments(query),
  ]);

  const mapped = logs.map((log: any) => {
    const item = log.orderId?.items?.find((i: any) => i._id.toString() === log.orderItemId);
    return {
      id: log._id.toString(),
      orderItemId: log.orderItemId,
      employeeId: log.employeeId?._id?.toString(),
      employee: log.employeeId,
      verifiedBookCode: log.verifiedBookCode,
      quantity: log.quantity,
      dispatchedAt: log.dispatchedAt,
      result: log.result,
      orderItem: {
        id: log.orderItemId,
        bookCode: log.verifiedBookCode,
        bookName: item?.bookName || 'Book',
        order: {
          id: log.orderId?._id?.toString(),
          studentName: log.orderId?.studentName,
          trackingId: log.orderId?.trackingId,
          mobileNumber: log.orderId?.mobileNumber,
        },
      },
    };
  });

  return {
    logs: mapped,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getFailedAttempts(params: {
  employeeId?: string;
  dateFilter?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 10));
  const skip = (page - 1) * limit;

  const { startDate, endDate } = require('../utils/date').parseDateFilter(
    params.dateFilter,
    params.startDate,
    params.endDate
  );

  const query: any = { success: false };

  if (params.employeeId) {
    query.employeeId = new mongoose.Types.ObjectId(params.employeeId);
  }

  if (startDate && endDate) {
    query.attemptedAt = { $gte: startDate, $lte: endDate };
  }

  const [attempts, total] = await Promise.all([
    VerificationAttempt.find(query)
      .populate('employeeId', 'name email')
      .populate('orderId', 'studentName trackingId items')
      .sort({ attemptedAt: -1 })
      .skip(skip)
      .limit(limit),
    VerificationAttempt.countDocuments(query),
  ]);

  const mapped = attempts.map((att: any) => {
    const item = att.orderId?.items?.find((i: any) => i._id.toString() === att.orderItemId);
    return {
      id: att._id.toString(),
      orderItemId: att.orderItemId,
      employeeId: att.employeeId?._id?.toString(),
      employee: att.employeeId,
      enteredBookCode: att.enteredBookCode,
      success: att.success,
      failureReason: att.failureReason,
      attemptedAt: att.attemptedAt,
      orderItem: {
        id: att.orderItemId,
        bookCode: item?.bookCode || '-',
        bookName: item?.bookName || '-',
        order: {
          id: att.orderId?._id?.toString(),
          studentName: att.orderId?.studentName,
          trackingId: att.orderId?.trackingId,
        },
      },
    };
  });

  return {
    attempts: mapped,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
