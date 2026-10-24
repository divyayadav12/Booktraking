import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ENV } from './config/env';
import { User, ImportBatch, Order, DispatchLog, VerificationAttempt, AuditLog } from './models';

async function main() {
  console.log('🌱 Connecting to MongoDB for seeding...');
  await mongoose.connect(ENV.MONGODB_URI);

  console.log('🧹 Cleaning existing collections...');
  await DispatchLog.deleteMany({});
  await VerificationAttempt.deleteMany({});
  await AuditLog.deleteMany({});
  await Order.deleteMany({});
  await ImportBatch.deleteMany({});
  await User.deleteMany({});

  // 1. Create Users
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const employeePassword = await bcrypt.hash('Emp@123', 10);

  const admin = await User.create({
    name: 'System Administrator',
    email: 'admin@example.com',
    passwordHash: adminPassword,
    role: 'ADMIN',
    isActive: true,
  });

  const emp1 = await User.create({
    name: 'Rohan Sharma',
    email: 'emp1@example.com',
    passwordHash: employeePassword,
    role: 'EMPLOYEE',
    isActive: true,
  });

  const emp2 = await User.create({
    name: 'Pooja Verma',
    email: 'emp2@example.com',
    passwordHash: employeePassword,
    role: 'EMPLOYEE',
    isActive: true,
  });

  console.log('✅ Created users: Admin, Rohan (Employee), Pooja (Employee)');

  // 2. Create Initial ImportBatch
  const initialBatch = await ImportBatch.create({
    originalFileName: 'Initial_Seed_Orders.xlsx',
    uploadedByUserId: admin._id,
    status: 'COMPLETED',
    totalRows: 6,
    validRows: 6,
    invalidRows: 0,
    importedRows: 6,
    fileHash: 'seed_batch_initial_hash_101',
    errorSummary: [],
  });

  // 3. Create Sample Orders
  // Order 1: Rahul Sharma - TR101 (QB101: 2 req, 1 disp; MCQ201: 1 req, 1 disp)
  const order1 = await Order.create({
    orderCode: 'ORD-0001',
    studentName: 'Rahul Sharma',
    mobileNumber: '9876543210',
    email: 'rahul@example.com',
    trackingId: 'TR101',
    importBatchId: initialBatch._id,
    items: [
      {
        bookCode: 'QB101',
        bookName: 'Quantitative Bank',
        requiredQuantity: 2,
        dispatchedQuantity: 1,
      },
      {
        bookCode: 'MCQ201',
        bookName: 'MCQ Book',
        requiredQuantity: 1,
        dispatchedQuantity: 1,
      },
    ],
  });

  // Order 2: Priya Verma - TR102 (QB101: 3 req, 0 disp) - Fully Pending
  const order2 = await Order.create({
    orderCode: 'ORD-0002',
    studentName: 'Priya Verma',
    mobileNumber: '9876543211',
    email: 'priya@example.com',
    trackingId: 'TR102',
    importBatchId: initialBatch._id,
    items: [
      {
        bookCode: 'QB101',
        bookName: 'Quantitative Bank',
        requiredQuantity: 3,
        dispatchedQuantity: 0,
      },
    ],
  });

  // Order 3: Amit Patel - TR103 (MCQ201: 2 req, 2 disp) - Fully Completed
  const order3 = await Order.create({
    orderCode: 'ORD-0003',
    studentName: 'Amit Patel',
    mobileNumber: '9876543212',
    email: 'amit@example.com',
    trackingId: 'TR103',
    importBatchId: initialBatch._id,
    items: [
      {
        bookCode: 'MCQ201',
        bookName: 'MCQ Book',
        requiredQuantity: 2,
        dispatchedQuantity: 2,
      },
    ],
  });

  // Order 4: Sneha Roy - TR104 (QB101: 1 req, CS301: 1 req, 0 disp) - Fully Pending
  const order4 = await Order.create({
    orderCode: 'ORD-0004',
    studentName: 'Sneha Roy',
    mobileNumber: '9876543213',
    email: 'sneha@example.com',
    trackingId: 'TR104',
    importBatchId: initialBatch._id,
    items: [
      {
        bookCode: 'QB101',
        bookName: 'Quantitative Bank',
        requiredQuantity: 1,
        dispatchedQuantity: 0,
      },
      {
        bookCode: 'CS301',
        bookName: 'Computer Science Handbook',
        requiredQuantity: 1,
        dispatchedQuantity: 0,
      },
    ],
  });

  console.log('✅ Created 4 sample orders with various statuses');

  const order1Qb101 = order1.items.find((i) => i.bookCode === 'QB101')!;
  const order1Mcq201 = order1.items.find((i) => i.bookCode === 'MCQ201')!;
  const order3Mcq201 = order3.items.find((i) => i.bookCode === 'MCQ201')!;

  // 4. Create Dispatch Logs
  await DispatchLog.create({
    orderId: order1._id,
    orderItemId: order1Qb101._id.toString(),
    employeeId: emp1._id,
    verifiedBookCode: 'QB101',
    quantity: 1,
    result: 'SUCCESS',
    requestId: 'req-seed-001',
    dispatchedAt: new Date(Date.now() - 3600 * 1000 * 2),
  });

  await DispatchLog.create({
    orderId: order1._id,
    orderItemId: order1Mcq201._id.toString(),
    employeeId: emp1._id,
    verifiedBookCode: 'MCQ201',
    quantity: 1,
    result: 'SUCCESS',
    requestId: 'req-seed-002',
    dispatchedAt: new Date(Date.now() - 3600 * 1000 * 1.5),
  });

  await DispatchLog.create({
    orderId: order3._id,
    orderItemId: order3Mcq201._id.toString(),
    employeeId: emp2._id,
    verifiedBookCode: 'MCQ201',
    quantity: 1,
    result: 'SUCCESS',
    requestId: 'req-seed-003',
    dispatchedAt: new Date(Date.now() - 3600 * 1000 * 1),
  });

  await DispatchLog.create({
    orderId: order3._id,
    orderItemId: order3Mcq201._id.toString(),
    employeeId: emp2._id,
    verifiedBookCode: 'MCQ201',
    quantity: 1,
    result: 'SUCCESS',
    requestId: 'req-seed-004',
    dispatchedAt: new Date(Date.now() - 3600 * 1000 * 0.5),
  });

  // 5. Create Verification Attempts
  await VerificationAttempt.insertMany([
    {
      orderId: order1._id,
      orderItemId: order1Qb101._id.toString(),
      employeeId: emp1._id,
      enteredBookCode: 'QB101',
      success: true,
      attemptedAt: new Date(Date.now() - 3600 * 1000 * 2),
    },
    {
      orderId: order1._id,
      orderItemId: order1Qb101._id.toString(),
      employeeId: emp1._id,
      enteredBookCode: 'WRONG_CODE_99',
      success: false,
      failureReason: 'Entered book code "WRONG_CODE_99" does not match expected "QB101"',
      attemptedAt: new Date(Date.now() - 3600 * 1000 * 2.1),
    },
    {
      orderId: order1._id,
      orderItemId: order1Mcq201._id.toString(),
      employeeId: emp1._id,
      enteredBookCode: 'MCQ201',
      success: true,
      attemptedAt: new Date(Date.now() - 3600 * 1000 * 1.5),
    },
    {
      orderId: order2._id,
      orderItemId: order2.items[0]._id.toString(),
      employeeId: emp2._id,
      enteredBookCode: 'MCQ201',
      success: false,
      failureReason: 'Entered book code "MCQ201" does not match expected "QB101"',
      attemptedAt: new Date(Date.now() - 3600 * 1000 * 0.8),
    },
  ]);

  // 6. Create Audit Logs
  await AuditLog.insertMany([
    {
      actorUserId: admin._id,
      action: 'IMPORT_BATCH_CREATED',
      entityType: 'ImportBatch',
      entityId: initialBatch._id.toString(),
      metadata: { fileName: 'Initial_Seed_Orders.xlsx', totalRows: 6 },
    },
    {
      actorUserId: emp1._id,
      action: 'BOOK_DISPATCHED',
      entityType: 'OrderItem',
      entityId: order1Qb101._id.toString(),
      metadata: { bookCode: 'QB101', quantity: 1, student: 'Rahul Sharma' },
    },
    {
      actorUserId: emp2._id,
      action: 'BOOK_DISPATCHED',
      entityType: 'OrderItem',
      entityId: order3Mcq201._id.toString(),
      metadata: { bookCode: 'MCQ201', quantity: 1, student: 'Amit Patel' },
    },
  ]);

  console.log('✅ Created dispatch logs, verification attempts, and audit logs');
  console.log('🎉 MongoDB Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
