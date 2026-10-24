import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import { Order, DispatchLog, VerificationAttempt } from '../src/models';
import ExcelJS from 'exceljs';

describe('FAST DISPATCH PRO Backend API Tests (MongoDB & Mongoose)', () => {
  let adminToken = '';
  let employeeToken = '';

  beforeAll(async () => {
    await connectDatabase();

    // Log in as Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin@123' });

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.token).toBeDefined();
    adminToken = adminRes.body.data.token;

    // Log in as Employee
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'emp1@example.com', password: 'Emp@123' });

    expect(empRes.status).toBe(200);
    expect(empRes.body.data.token).toBeDefined();
    employeeToken = empRes.body.data.token;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('1. Authentication & Role Permissions', () => {
    it('should reject invalid credentials with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should allow Admin to access admin-only endpoints', async () => {
      const res = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should block Employee from accessing admin-only endpoints with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('should block Employee from viewing all orders endpoint', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow Employee to view outgoing orders', async () => {
      const res = await request(app)
        .get('/api/orders/outgoing')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.orders)).toBe(true);
    });
  });

  describe('2. Dashboard & Quantity Summary Calculation', () => {
    it('should return accurate dashboard statistics', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalOrders');
      expect(res.body.data).toHaveProperty('totalBookTypes');
      expect(res.body.data).toHaveProperty('totalRequiredCopies');
      expect(res.body.data).toHaveProperty('totalDispatchedCopies');
      expect(res.body.data).toHaveProperty('totalPendingCopies');

      const data = res.body.data;
      expect(data.totalRequiredCopies).toBe(data.totalDispatchedCopies + data.totalPendingCopies);
    });
  });

  describe('3. Excel Import & Validation', () => {
    it('should validate and preview an Excel file with valid records', async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Orders');

      worksheet.columns = [
        { header: 'Student Name', key: 'studentName' },
        { header: 'Mobile Number', key: 'mobileNumber' },
        { header: 'Email', key: 'email' },
        { header: 'Tracking ID', key: 'trackingId' },
        { header: 'Book Code', key: 'bookCode' },
        { header: 'Book Name', key: 'bookName' },
        { header: 'Quantity', key: 'quantity' },
      ];

      worksheet.addRow({
        studentName: 'Test Student One',
        mobileNumber: '9988776655',
        email: 'test1@example.com',
        trackingId: 'TR999',
        bookCode: 'MATH101',
        bookName: 'Mathematics Part 1',
        quantity: 2,
      });

      worksheet.addRow({
        studentName: 'Invalid Quantity Student',
        mobileNumber: '9988776656',
        email: 'test2@example.com',
        trackingId: 'TR1000',
        bookCode: 'ENG201',
        bookName: 'English Literature',
        quantity: -1,
      });

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const res = await request(app)
        .post('/api/imports/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buffer, 'test_orders.xlsx');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.validRowsCount).toBe(1);
      expect(res.body.data.invalidRowsCount).toBe(1);
      expect(res.body.data.invalidRows[0].errors).toContain('Quantity must be a positive integer greater than 0.');
    });
  });

  describe('4. Server-Side Book Dispatch Verification', () => {
    it('should reject wrong book code and not change quantities', async () => {
      const allOrders = await Order.find();
      const order = allOrders.find((o) => o.items.some((i) => i.dispatchedQuantity < i.requiredQuantity));
      expect(order).toBeDefined();

      const item = order!.items.find((i) => i.dispatchedQuantity < i.requiredQuantity)!;
      const initialDispatched = item.dispatchedQuantity;
      const itemId = item._id.toString();

      const res = await request(app)
        .post('/api/dispatch/verify')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          orderItemId: itemId,
          enteredBookCode: 'WRONG_CODE_XYZ',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Warning: Book code does not match this order. Please verify the book.');

      // Check DB unchanged
      const refreshedOrder = await Order.findById(order!._id);
      const refreshedItem = refreshedOrder!.items.find((i) => i._id.toString() === itemId);
      expect(refreshedItem!.dispatchedQuantity).toBe(initialDispatched);

      // Verify failed attempt recorded
      const failedAttempt = await VerificationAttempt.findOne({
        orderItemId: itemId,
        enteredBookCode: 'WRONG_CODE_XYZ',
        success: false,
      });
      expect(failedAttempt).toBeDefined();
    });

    it('should dispatch exactly 1 copy when correct book code is provided', async () => {
      const allOrders = await Order.find();
      const order = allOrders.find((o) => o.items.some((i) => i.dispatchedQuantity < i.requiredQuantity));
      expect(order).toBeDefined();

      const item = order!.items.find((i) => i.dispatchedQuantity < i.requiredQuantity)!;
      const initialDispatched = item.dispatchedQuantity;
      const itemId = item._id.toString();

      const res = await request(app)
        .post('/api/dispatch/verify')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          orderItemId: itemId,
          enteredBookCode: item.bookCode.toLowerCase(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('dispatched successfully');
      expect(res.body.data.orderItem.dispatchedQuantity).toBe(initialDispatched + 1);

      // Check DB updated
      const refreshedOrder = await Order.findById(order!._id);
      const refreshedItem = refreshedOrder!.items.find((i) => i._id.toString() === itemId);
      expect(refreshedItem!.dispatchedQuantity).toBe(initialDispatched + 1);
    });

    it('should dispatch by orderId and enteredBookCode directly from Order Dispatch Box', async () => {
      const allOrders = await Order.find();
      const order = allOrders.find((o) => o.items.some((i) => i.dispatchedQuantity < i.requiredQuantity));
      expect(order).toBeDefined();

      const item = order!.items.find((i) => i.dispatchedQuantity < i.requiredQuantity)!;
      const initialDispatched = item.dispatchedQuantity;
      const initialOrderPending = order!.items.reduce(
        (acc, i) => acc + Math.max(0, i.requiredQuantity - i.dispatchedQuantity),
        0
      );

      const res = await request(app)
        .post('/api/dispatch/verify')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          orderId: order!._id.toString(),
          enteredBookCode: item.bookCode.toLowerCase(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderItem.bookCode).toBe(item.bookCode);
      expect(res.body.data.orderItem.dispatchedQuantity).toBe(initialDispatched + 1);
      expect(res.body.data.order.totalPending).toBe(initialOrderPending - 1);

      // Check wrong code rejection at order level
      const wrongRes = await request(app)
        .post('/api/dispatch/verify')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          orderId: order!._id.toString(),
          enteredBookCode: 'INVALID_ORDER_CODE_999',
        });

      expect(wrongRes.status).toBe(400);
      expect(wrongRes.body.success).toBe(false);
      expect(wrongRes.body.code).toBe('BOOK_CODE_MISMATCH');
    });

    it('should support idempotency key to prevent duplicate submissions', async () => {
      const allOrders = await Order.find();
      const order = allOrders.find((o) => o.items.some((i) => i.dispatchedQuantity < i.requiredQuantity));
      expect(order).toBeDefined();

      const item = order!.items.find((i) => i.dispatchedQuantity < i.requiredQuantity)!;
      const itemId = item._id.toString();
      const bookCode = item.bookCode;

      const idempotencyKey = `req-idemp-${Date.now()}`;

      // First dispatch
      const res1 = await request(app)
        .post('/api/dispatch/verify')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          orderItemId: itemId,
          enteredBookCode: bookCode,
          requestId: idempotencyKey,
        });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      // Second dispatch with same idempotency key
      const res2 = await request(app)
        .post('/api/dispatch/verify')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          orderItemId: itemId,
          enteredBookCode: bookCode,
          requestId: idempotencyKey,
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.alreadyProcessed).toBe(true);
      expect(res2.body.data.orderItem.dispatchedQuantity).toBe(res1.body.data.orderItem.dispatchedQuantity);
    });
  });

  describe('5. Reports & Excel Export', () => {
    it('should export dispatch report Excel file', async () => {
      const res = await request(app)
        .get('/api/reports/export?type=dispatches')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.body).toBeDefined();
    });

    it('should retrieve book code summary', async () => {
      const res = await request(app)
        .get('/api/reports/book-summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('bookCode');
      expect(res.body.data[0]).toHaveProperty('totalRequired');
      expect(res.body.data[0]).toHaveProperty('totalDispatched');
      expect(res.body.data[0]).toHaveProperty('totalPending');
    });
  });
});
