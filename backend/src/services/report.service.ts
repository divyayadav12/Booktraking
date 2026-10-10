import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { Order, DispatchLog, VerificationAttempt, User } from '../models';
import { formatDateKolkata, parseDateFilter } from '../utils/date';
import { computeItemStatus, computeOrderStatus } from './order.service';

export interface ReportFilterParams {
  dateFilter?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  employeeId?: string;
  bookCode?: string;
}

export async function getReportSummary(params: ReportFilterParams) {
  const { startDate, endDate } = parseDateFilter(params.dateFilter, params.startDate, params.endDate);

  const dispatchQuery: any = { result: 'SUCCESS' };
  if (startDate && endDate) {
    dispatchQuery.dispatchedAt = { $gte: startDate, $lte: endDate };
  }
  if (params.employeeId) {
    dispatchQuery.employeeId = new mongoose.Types.ObjectId(params.employeeId);
  }
  if (params.bookCode) {
    dispatchQuery.verifiedBookCode = params.bookCode.toUpperCase();
  }

  const failedQuery: any = { success: false };
  if (startDate && endDate) {
    failedQuery.attemptedAt = { $gte: startDate, $lte: endDate };
  }

  const [dispatchesCount, failedAttemptsCount, distinctEmployees, distinctBooks] = await Promise.all([
    DispatchLog.countDocuments(dispatchQuery),
    VerificationAttempt.countDocuments(failedQuery),
    DispatchLog.distinct('employeeId', dispatchQuery),
    DispatchLog.distinct('verifiedBookCode', dispatchQuery),
  ]);

  return {
    totalDispatches: dispatchesCount,
    failedAttempts: failedAttemptsCount,
    activeEmployeesInPeriod: distinctEmployees.length,
    activeBooksInPeriod: distinctBooks.length,
  };
}

export async function getBookCodeSummary() {
  const orders = await Order.find();

  const summaryMap = new Map<string, {
    bookCode: string;
    bookName: string;
    totalRequired: number;
    totalDispatched: number;
    totalPending: number;
    ordersCount: number;
  }>();

  for (const o of orders) {
    for (const item of o.items) {
      const existing = summaryMap.get(item.bookCode) || {
        bookCode: item.bookCode,
        bookName: item.bookName,
        totalRequired: 0,
        totalDispatched: 0,
        totalPending: 0,
        ordersCount: 0,
      };

      existing.totalRequired += item.requiredQuantity;
      existing.totalDispatched += item.dispatchedQuantity;
      existing.totalPending += Math.max(0, item.requiredQuantity - item.dispatchedQuantity);
      existing.ordersCount += 1;
      summaryMap.set(item.bookCode, existing);
    }
  }

  return Array.from(summaryMap.values()).sort((a, b) => b.totalRequired - a.totalRequired);
}

export async function getEmployeeSummary() {
  const employees = await User.find({ role: 'EMPLOYEE' });

  return await Promise.all(
    employees.map(async (emp) => {
      const [dispatchesCount, failedCount, totalAttempts] = await Promise.all([
        DispatchLog.countDocuments({ employeeId: emp._id, result: 'SUCCESS' }),
        VerificationAttempt.countDocuments({ employeeId: emp._id, success: false }),
        VerificationAttempt.countDocuments({ employeeId: emp._id }),
      ]);

      const successRate = totalAttempts > 0 ? Math.round((dispatchesCount / totalAttempts) * 100) : 100;

      return {
        id: emp._id.toString(),
        name: emp.name,
        email: emp.email,
        isActive: emp.isActive,
        totalDispatches: dispatchesCount,
        failedAttempts: failedCount,
        successRate,
      };
    })
  );
}

export async function getDispatchTrends(days = 14) {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const logs = await DispatchLog.find({
    result: 'SUCCESS',
    dispatchedAt: { $gte: sinceDate },
  }).select('dispatchedAt');

  const dayMap = new Map<string, number>();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    dayMap.set(dateStr, 0);
  }

  logs.forEach((log) => {
    const dateStr = log.dispatchedAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (dayMap.has(dateStr)) {
      dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + 1);
    }
  });

  return Array.from(dayMap.entries()).map(([date, count]) => ({
    date,
    formattedDate: new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(`${date}T00:00:00+05:30`)),
    dispatches: count,
  }));
}

export async function generateExcelReport(
  type: 'dispatches' | 'orders' | 'failed-attempts' | 'book-summary' | 'employees',
  params: ReportFilterParams
): Promise<{ buffer: Buffer; fileName: string }> {
  const workbook = new ExcelJS.Workbook();
  const { startDate, endDate } = parseDateFilter(params.dateFilter, params.startDate, params.endDate);

  const applyHeaderStyle = (row: ExcelJS.Row, bgColorHex = 'FF1E3A8A') => {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColorHex },
    };
  };

  if (type === 'dispatches') {
    const sheet = workbook.addWorksheet('Successful Dispatches');
    sheet.columns = [
      { header: 'Dispatch Date & Time (IST)', key: 'dispatchedAt', width: 25 },
      { header: 'Tracking ID', key: 'trackingId', width: 16 },
      { header: 'Student Name', key: 'studentName', width: 25 },
      { header: 'Mobile Number', key: 'mobileNumber', width: 18 },
      { header: 'Book Code', key: 'bookCode', width: 14 },
      { header: 'Book Name', key: 'bookName', width: 28 },
      { header: 'Quantity Dispatched', key: 'quantity', width: 20 },
      { header: 'Dispatched By (Employee)', key: 'employeeName', width: 25 },
      { header: 'Status', key: 'result', width: 14 },
    ];
    applyHeaderStyle(sheet.getRow(1));

    const query: any = { result: 'SUCCESS' };
    if (startDate && endDate) query.dispatchedAt = { $gte: startDate, $lte: endDate };
    if (params.employeeId) query.employeeId = new mongoose.Types.ObjectId(params.employeeId);
    if (params.bookCode) query.verifiedBookCode = params.bookCode.toUpperCase();

    const logs = await DispatchLog.find(query)
      .populate('employeeId', 'name email')
      .populate('orderId', 'studentName trackingId mobileNumber items')
      .sort({ dispatchedAt: -1 });

    logs.forEach((log: any) => {
      const item = log.orderId?.items?.find((i: any) => i._id.toString() === log.orderItemId);
      sheet.addRow({
        dispatchedAt: formatDateKolkata(log.dispatchedAt),
        trackingId: log.orderId?.trackingId,
        studentName: log.orderId?.studentName,
        mobileNumber: log.orderId?.mobileNumber,
        bookCode: log.verifiedBookCode,
        bookName: item?.bookName || 'Book',
        quantity: log.quantity,
        employeeName: log.employeeId?.name || 'Employee',
        result: log.result,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), fileName: `Dispatch_Report_${Date.now()}.xlsx` };
  }

  if (type === 'failed-attempts') {
    const sheet = workbook.addWorksheet('Failed Verification Attempts');
    sheet.columns = [
      { header: 'Attempted Date & Time (IST)', key: 'attemptedAt', width: 25 },
      { header: 'Tracking ID', key: 'trackingId', width: 16 },
      { header: 'Student Name', key: 'studentName', width: 25 },
      { header: 'Expected Book Code', key: 'expectedCode', width: 18 },
      { header: 'Entered Book Code', key: 'enteredCode', width: 18 },
      { header: 'Employee', key: 'employeeName', width: 25 },
      { header: 'Failure Reason', key: 'reason', width: 45 },
    ];
    applyHeaderStyle(sheet.getRow(1), 'FFB91C1C');

    const query: any = { success: false };
    if (startDate && endDate) query.attemptedAt = { $gte: startDate, $lte: endDate };
    if (params.employeeId) query.employeeId = new mongoose.Types.ObjectId(params.employeeId);

    const attempts = await VerificationAttempt.find(query)
      .populate('employeeId', 'name email')
      .populate('orderId', 'studentName trackingId items')
      .sort({ attemptedAt: -1 });

    attempts.forEach((att: any) => {
      const item = att.orderId?.items?.find((i: any) => i._id.toString() === att.orderItemId);
      sheet.addRow({
        attemptedAt: formatDateKolkata(att.attemptedAt),
        trackingId: att.orderId?.trackingId,
        studentName: att.orderId?.studentName,
        expectedCode: item?.bookCode || '-',
        enteredCode: att.enteredBookCode,
        employeeName: att.employeeId?.name || 'Employee',
        reason: att.failureReason || 'Code mismatch',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), fileName: `Failed_Verification_Report_${Date.now()}.xlsx` };
  }

  if (type === 'book-summary') {
    const sheet = workbook.addWorksheet('Book Code Summary');
    sheet.columns = [
      { header: 'Book Code', key: 'bookCode', width: 15 },
      { header: 'Book Name', key: 'bookName', width: 30 },
      { header: 'Total Orders', key: 'ordersCount', width: 15 },
      { header: 'Total Required Copies', key: 'totalRequired', width: 22 },
      { header: 'Total Dispatched Copies', key: 'totalDispatched', width: 22 },
      { header: 'Total Pending Copies', key: 'totalPending', width: 22 },
    ];
    applyHeaderStyle(sheet.getRow(1));

    const summary = await getBookCodeSummary();
    summary.forEach((item) => {
      sheet.addRow(item);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), fileName: `Book_Code_Summary_${Date.now()}.xlsx` };
  }

  if (type === 'employees') {
    const sheet = workbook.addWorksheet('Employee Performance');
    sheet.columns = [
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Account Status', key: 'status', width: 16 },
      { header: 'Successful Dispatches', key: 'totalDispatches', width: 22 },
      { header: 'Failed Verification Attempts', key: 'failedAttempts', width: 25 },
      { header: 'Accuracy Rate (%)', key: 'successRate', width: 18 },
    ];
    applyHeaderStyle(sheet.getRow(1));

    const empSummary = await getEmployeeSummary();
    empSummary.forEach((emp) => {
      sheet.addRow({
        name: emp.name,
        email: emp.email,
        status: emp.isActive ? 'Active' : 'Deactivated',
        totalDispatches: emp.totalDispatches,
        failedAttempts: emp.failedAttempts,
        successRate: `${emp.successRate}%`,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), fileName: `Employee_Dispatch_Report_${Date.now()}.xlsx` };
  }

  // Default: orders
  const sheet = workbook.addWorksheet('Orders Report');
  sheet.columns = [
    { header: 'Order Date (IST)', key: 'createdAt', width: 22 },
    { header: 'Tracking ID', key: 'trackingId', width: 16 },
    { header: 'Student Name', key: 'studentName', width: 25 },
    { header: 'Mobile Number', key: 'mobileNumber', width: 18 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Book Code', key: 'bookCode', width: 14 },
    { header: 'Book Name', key: 'bookName', width: 28 },
    { header: 'Required Qty', key: 'requiredQuantity', width: 15 },
    { header: 'Dispatched Qty', key: 'dispatchedQuantity', width: 15 },
    { header: 'Pending Qty', key: 'pendingQuantity', width: 15 },
    { header: 'Item Status', key: 'itemStatus', width: 20 },
    { header: 'Overall Order Status', key: 'orderStatus', width: 22 },
  ];
  applyHeaderStyle(sheet.getRow(1));

  const orders = await Order.find().sort({ createdAt: -1 });

  for (const order of orders) {
    const oStatus = computeOrderStatus(order.items);
    if (params.status && params.status !== 'ALL' && oStatus !== params.status) {
      continue;
    }

    for (const item of order.items) {
      const iStatus = computeItemStatus(item.requiredQuantity, item.dispatchedQuantity);
      sheet.addRow({
        createdAt: formatDateKolkata(order.createdAt),
        trackingId: order.trackingId,
        studentName: order.studentName,
        mobileNumber: order.mobileNumber,
        email: order.email || '',
        bookCode: item.bookCode,
        bookName: item.bookName,
        requiredQuantity: item.requiredQuantity,
        dispatchedQuantity: item.dispatchedQuantity,
        pendingQuantity: Math.max(0, item.requiredQuantity - item.dispatchedQuantity),
        itemStatus: iStatus,
        orderStatus: oStatus,
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), fileName: `Orders_Report_${Date.now()}.xlsx` };
}
