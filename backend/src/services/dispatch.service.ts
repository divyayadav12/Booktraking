import mongoose from 'mongoose';
import { Order, DispatchLog, VerificationAttempt, User } from '../models';
import { normalizeBookCode } from '../utils/normalize';
import { logAudit } from '../utils/audit';
import { computeItemStatus, computeOrderStatus } from './order.service';

export interface VerifyDispatchParams {
  orderItemId?: string;
  orderId?: string;
  enteredCode: string;       // Could be product code OR book code
  employeeId: string;
  requestId?: string;
}

export async function verifyAndDispatchBook(params: {
  orderItemId?: string;
  orderId?: string;
  enteredBookCode: string;
  employeeId: string;
  requestId?: string;
}) {
  const { orderItemId, orderId, enteredBookCode, employeeId, requestId } = params;

  // Check idempotency if requestId provided
  if (requestId) {
    const existingLog = await DispatchLog.findOne({ requestId });
    if (existingLog) {
      const order = await Order.findById(existingLog.orderId);
      const item = order?.items.find((i) =>
        orderItemId ? i._id.toString() === orderItemId : i._id.toString() === existingLog.orderItemId
      );
      if (item && order) {
        const pendingQuantity = Math.max(0, item.requiredQuantity - item.dispatchedQuantity);
        const totalRequired = order.items.reduce((acc, i) => acc + i.requiredQuantity, 0);
        const totalDispatched = order.items.reduce((acc, i) => acc + i.dispatchedQuantity, 0);
        const totalPending = Math.max(0, totalRequired - totalDispatched);
        const orderStatus = computeOrderStatus(order.items);
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
          order: {
            id: order._id.toString(),
            studentName: order.studentName,
            trackingId: order.trackingId,
            mobileNumber: order.mobileNumber,
            totalRequired,
            totalDispatched,
            totalPending,
            status: orderStatus,
            items: order.items.map((i) => ({
              id: i._id.toString(),
              bookCode: i.bookCode,
              bookName: i.bookName,
              requiredQuantity: i.requiredQuantity,
              dispatchedQuantity: i.dispatchedQuantity,
              pendingQuantity: Math.max(0, i.requiredQuantity - i.dispatchedQuantity),
              status: computeItemStatus(i.requiredQuantity, i.dispatchedQuantity),
            })),
          },
          orderStatus,
        };
      }
    }
  }

  // Find order
  let order: any;
  if (orderItemId) {
    order = await Order.findOne({ 'items._id': new mongoose.Types.ObjectId(orderItemId) });
    if (!order) {
      throw { statusCode: 404, message: 'Order item not found', code: 'ITEM_NOT_FOUND' };
    }
  } else if (orderId) {
    order = await Order.findById(orderId);
    if (!order) {
      throw { statusCode: 404, message: 'Order not found', code: 'ORDER_NOT_FOUND' };
    }
  } else {
    throw { statusCode: 400, message: 'Either orderItemId or orderId must be provided', code: 'MISSING_PARAMS' };
  }

  const normalizedEnteredCode = normalizeBookCode(enteredBookCode);

  // Match item in order
  let currentItem: any;
  let resolvedItemId: string;

  if (orderItemId) {
    currentItem = order.items.find((i: any) => i._id.toString() === orderItemId);
    if (!currentItem) {
      throw { statusCode: 404, message: 'Order item not found in order', code: 'ITEM_NOT_FOUND' };
    }
    const normalizedExpectedCode = normalizeBookCode(currentItem.bookCode);
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
    resolvedItemId = orderItemId;
  } else {
    // Look up item in order.items matching the code
    const matchingItems = order.items.filter(
      (i: any) => normalizeBookCode(i.bookCode) === normalizedEnteredCode
    );

    if (matchingItems.length === 0) {
      const mismatchWarning = 'Warning: Book code does not match this order. Please verify the book.';
      await VerificationAttempt.create({
        orderId: order._id,
        employeeId: new mongoose.Types.ObjectId(employeeId),
        enteredBookCode: enteredBookCode.trim(),
        success: false,
        failureReason: mismatchWarning,
      });
      throw {
        statusCode: 400,
        message: mismatchWarning,
        code: 'BOOK_CODE_MISMATCH',
        enteredCode: enteredBookCode,
      };
    }

    // Find the item with pending copies
    currentItem = matchingItems.find((i: any) => i.requiredQuantity > i.dispatchedQuantity);
    if (!currentItem) {
      // All copies of this book are already dispatched!
      throw {
        statusCode: 400,
        message: `All copies of book code "${enteredBookCode}" have already been dispatched for this student.`,
        code: 'NO_PENDING_QUANTITY',
        enteredCode: enteredBookCode,
      };
    }
    resolvedItemId = currentItem._id.toString();
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
          _id: new mongoose.Types.ObjectId(resolvedItemId),
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

  const updatedItem = updatedOrder.items.find((i: any) => i._id.toString() === resolvedItemId)!;

  // Create immutable dispatch log
  const dispatchLog = await DispatchLog.create({
    orderId: order._id,
    orderItemId: resolvedItemId,
    employeeId: new mongoose.Types.ObjectId(employeeId),
    verifiedBookCode: normalizeBookCode(updatedItem.bookCode),
    quantity: 1,
    requestId: requestId || undefined,
    result: 'SUCCESS',
  });

  // Record successful verification attempt
  await VerificationAttempt.create({
    orderId: order._id,
    orderItemId: resolvedItemId,
    employeeId: new mongoose.Types.ObjectId(employeeId),
    enteredBookCode: normalizedEnteredCode,
    success: true,
  });

  // Log Audit
  await logAudit({
    actorUserId: employeeId,
    action: 'BOOK_DISPATCHED',
    entityType: 'OrderItem',
    entityId: resolvedItemId,
    metadata: {
      bookCode: currentItem.bookCode,
      bookName: currentItem.bookName,
      orderId: order._id.toString(),
      newDispatchedQuantity: updatedItem.dispatchedQuantity,
      requiredQuantity: updatedItem.requiredQuantity,
    },
  });

  const totalRequired = updatedOrder.items.reduce((acc: number, i: any) => acc + i.requiredQuantity, 0);
  const totalDispatched = updatedOrder.items.reduce((acc: number, i: any) => acc + i.dispatchedQuantity, 0);
  const totalPending = Math.max(0, totalRequired - totalDispatched);
  const orderStatus = computeOrderStatus(updatedOrder.items);
  const newPending = Math.max(0, updatedItem.requiredQuantity - updatedItem.dispatchedQuantity);

  const itemsWithStatus = updatedOrder.items.map((i: any) => ({
    id: i._id.toString(),
    bookCode: i.bookCode,
    bookName: i.bookName,
    requiredQuantity: i.requiredQuantity,
    dispatchedQuantity: i.dispatchedQuantity,
    pendingQuantity: Math.max(0, i.requiredQuantity - i.dispatchedQuantity),
    status: computeItemStatus(i.requiredQuantity, i.dispatchedQuantity),
  }));

  const copyInfo =
    updatedItem.requiredQuantity > 1
      ? ` (Copy ${updatedItem.dispatchedQuantity} of ${updatedItem.requiredQuantity})`
      : '';

  return {
    success: true,
    message: `Book code "${updatedItem.bookCode}" verified! 1 copy dispatched successfully.${copyInfo}`,
    orderItem: {
      id: updatedItem._id.toString(),
      bookCode: updatedItem.bookCode,
      bookName: updatedItem.bookName,
      requiredQuantity: updatedItem.requiredQuantity,
      dispatchedQuantity: updatedItem.dispatchedQuantity,
      pendingQuantity: newPending,
      status: computeItemStatus(updatedItem.requiredQuantity, updatedItem.dispatchedQuantity),
    },
    order: {
      id: updatedOrder._id.toString(),
      studentName: updatedOrder.studentName,
      trackingId: updatedOrder.trackingId,
      mobileNumber: updatedOrder.mobileNumber,
      email: updatedOrder.email,
      totalRequired,
      totalDispatched,
      totalPending,
      status: orderStatus,
      items: itemsWithStatus,
    },
    orderStatus,
    dispatchLogId: dispatchLog._id.toString(),
  };
}

// ─── Dispatch by Product Code ────────────────────────────────────────────────
// When employee scans a Product Code (PRD-YYMM-NNNNN), ALL pending book items
// in that order are dispatched atomically.
export async function dispatchByProductCode(params: {
  productCode: string;
  employeeId: string;
  requestId?: string;
}) {
  const { productCode, employeeId, requestId } = params;
  const normalizedProductCode = productCode.trim().toUpperCase();

  // Idempotency check
  if (requestId) {
    const existing = await DispatchLog.findOne({ requestId });
    if (existing) {
      return { alreadyProcessed: true, success: true, message: 'Already processed.' };
    }
  }

  const order = await Order.findOne({ productCode: normalizedProductCode });
  if (!order) {
    throw {
      statusCode: 404,
      message: `No order found with Product Code "${normalizedProductCode}". Please verify the barcode.`,
      code: 'PRODUCT_CODE_NOT_FOUND',
    };
  }

  // Find all pending items
  const pendingItems = order.items.filter((i: any) => i.dispatchedQuantity < i.requiredQuantity);
  if (pendingItems.length === 0) {
    throw {
      statusCode: 400,
      message: `All books in order "${normalizedProductCode}" have already been dispatched.`,
      code: 'ORDER_FULLY_DISPATCHED',
    };
  }

  // Dispatch all pending items — set dispatchedQuantity = requiredQuantity for each
  const dispatchLogs = [];
  for (const item of pendingItems) {
    const remaining = item.requiredQuantity - item.dispatchedQuantity;

    // Atomically update this item
    await Order.updateOne(
      { _id: order._id, 'items._id': item._id },
      { $set: { 'items.$.dispatchedQuantity': item.requiredQuantity } }
    );

    // Create one dispatch log per book item (with quantity = remaining copies)
    const log = await DispatchLog.create({
      orderId: order._id,
      orderItemId: item._id.toString(),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      verifiedBookCode: item.bookCode,
      quantity: remaining,
      requestId: requestId ? `${requestId}-${item._id}` : undefined,
      result: 'SUCCESS',
      dispatchMode: 'PRODUCT_SCAN',
    });
    dispatchLogs.push(log);

    await VerificationAttempt.create({
      orderId: order._id,
      orderItemId: item._id.toString(),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      enteredBookCode: normalizedProductCode,
      success: true,
    });
  }

  // Reload updated order
  const updatedOrder = await Order.findById(order._id);
  const totalRequired = updatedOrder!.items.reduce((acc: number, i: any) => acc + i.requiredQuantity, 0);
  const totalDispatched = updatedOrder!.items.reduce((acc: number, i: any) => acc + i.dispatchedQuantity, 0);

  await logAudit({
    actorUserId: employeeId,
    action: 'ORDER_DISPATCHED_BY_PRODUCT_CODE',
    entityType: 'Order',
    entityId: order._id.toString(),
    metadata: {
      productCode: normalizedProductCode,
      student: order.studentName,
      itemsDispatched: pendingItems.length,
      totalQuantityDispatched: pendingItems.reduce((a, i) => a + (i.requiredQuantity - i.dispatchedQuantity), 0),
    },
  });

  return {
    success: true,
    message: `Product Code "${normalizedProductCode}" matched! All ${pendingItems.length} book(s) dispatched for ${order.studentName}.`,
    productCode: normalizedProductCode,
    order: {
      id: order._id.toString(),
      studentName: order.studentName,
      trackingId: order.trackingId,
      mobileNumber: order.mobileNumber,
      totalRequired,
      totalDispatched,
      totalPending: Math.max(0, totalRequired - totalDispatched),
      status: 'COMPLETED',
      items: updatedOrder!.items.map((i: any) => ({
        id: i._id.toString(),
        bookCode: i.bookCode,
        bookName: i.bookName,
        requiredQuantity: i.requiredQuantity,
        dispatchedQuantity: i.dispatchedQuantity,
        pendingQuantity: 0,
        status: 'COMPLETED',
      })),
    },
    itemsDispatched: pendingItems.length,
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
