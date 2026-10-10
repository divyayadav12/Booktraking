import { PrismaClient, Role, ImportStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data in reverse order of foreign keys
  await prisma.dispatchLog.deleteMany();
  await prisma.verificationAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const employeePassword = await bcrypt.hash('Emp@123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'System Administrator',
      email: 'admin@example.com',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const emp1 = await prisma.user.create({
    data: {
      name: 'Rohan Sharma',
      email: 'emp1@example.com',
      passwordHash: employeePassword,
      role: Role.EMPLOYEE,
      isActive: true,
    },
  });

  const emp2 = await prisma.user.create({
    data: {
      name: 'Pooja Verma',
      email: 'emp2@example.com',
      passwordHash: employeePassword,
      role: Role.EMPLOYEE,
      isActive: true,
    },
  });

  console.log('✅ Created users: Admin, Rohan (Employee), Pooja (Employee)');

  // Create an initial ImportBatch
  const initialBatch = await prisma.importBatch.create({
    data: {
      originalFileName: 'Initial_Seed_Orders.xlsx',
      uploadedByUserId: admin.id,
      status: ImportStatus.COMPLETED,
      totalRows: 6,
      validRows: 6,
      invalidRows: 0,
      importedRows: 6,
      fileHash: 'seed_batch_initial_hash_101',
      errorSummary: [],
    },
  });

  // Create Sample Orders
  // Order 1: Rahul Sharma - TR101 (Partially Dispatched overall: 1 of QB101 dispatched out of 2, 1 of MCQ201 dispatched out of 1)
  const order1 = await prisma.order.create({
    data: {
      studentName: 'Rahul Sharma',
      mobileNumber: '9876543210',
      email: 'rahul@example.com',
      trackingId: 'TR101',
      importBatchId: initialBatch.id,
      items: {
        create: [
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
      },
    },
    include: { items: true },
  });

  // Order 2: Priya Verma - TR102 (Fully Pending: QB101 - 3 copies)
  const order2 = await prisma.order.create({
    data: {
      studentName: 'Priya Verma',
      mobileNumber: '9876543211',
      email: 'priya@example.com',
      trackingId: 'TR102',
      importBatchId: initialBatch.id,
      items: {
        create: [
          {
            bookCode: 'QB101',
            bookName: 'Quantitative Bank',
            requiredQuantity: 3,
            dispatchedQuantity: 0,
          },
        ],
      },
    },
    include: { items: true },
  });

  // Order 3: Amit Patel - TR103 (Fully Completed: MCQ201 - 2 copies)
  const order3 = await prisma.order.create({
    data: {
      studentName: 'Amit Patel',
      mobileNumber: '9876543212',
      email: 'amit@example.com',
      trackingId: 'TR103',
      importBatchId: initialBatch.id,
      items: {
        create: [
          {
            bookCode: 'MCQ201',
            bookName: 'MCQ Book',
            requiredQuantity: 2,
            dispatchedQuantity: 2,
          },
        ],
      },
    },
    include: { items: true },
  });

  // Order 4: Sneha Roy - TR104 (Fully Pending: QB101 - 1, CS301 - 1)
  const order4 = await prisma.order.create({
    data: {
      studentName: 'Sneha Roy',
      mobileNumber: '9876543213',
      email: 'sneha@example.com',
      trackingId: 'TR104',
      importBatchId: initialBatch.id,
      items: {
        create: [
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
      },
    },
    include: { items: true },
  });

  console.log('✅ Created 4 sample orders with various statuses');

  // Add Dispatch Logs corresponding to dispatched quantities
  const order1Qb101 = order1.items.find((i) => i.bookCode === 'QB101')!;
  const order1Mcq201 = order1.items.find((i) => i.bookCode === 'MCQ201')!;
  const order3Mcq201 = order3.items.find((i) => i.bookCode === 'MCQ201')!;

  // Log 1: Rohan dispatched 1 QB101 for Rahul
  await prisma.dispatchLog.create({
    data: {
      orderItemId: order1Qb101.id,
      employeeId: emp1.id,
      verifiedBookCode: 'QB101',
      quantity: 1,
      result: 'SUCCESS',
      requestId: 'req-seed-001',
      dispatchedAt: new Date(Date.now() - 3600 * 1000 * 2), // 2 hours ago
    },
  });

  // Log 2: Rohan dispatched 1 MCQ201 for Rahul
  await prisma.dispatchLog.create({
    data: {
      orderItemId: order1Mcq201.id,
      employeeId: emp1.id,
      verifiedBookCode: 'MCQ201',
      quantity: 1,
      result: 'SUCCESS',
      requestId: 'req-seed-002',
      dispatchedAt: new Date(Date.now() - 3600 * 1000 * 1.5),
    },
  });

  // Log 3 & 4: Pooja dispatched 2 MCQ201 for Amit (one by one)
  await prisma.dispatchLog.create({
    data: {
      orderItemId: order3Mcq201.id,
      employeeId: emp2.id,
      verifiedBookCode: 'MCQ201',
      quantity: 1,
      result: 'SUCCESS',
      requestId: 'req-seed-003',
      dispatchedAt: new Date(Date.now() - 3600 * 1000 * 1),
    },
  });

  await prisma.dispatchLog.create({
    data: {
      orderItemId: order3Mcq201.id,
      employeeId: emp2.id,
      verifiedBookCode: 'MCQ201',
      quantity: 1,
      result: 'SUCCESS',
      requestId: 'req-seed-004',
      dispatchedAt: new Date(Date.now() - 3600 * 1000 * 0.5),
    },
  });

  // Add Verification Attempts (some success, some failed)
  await prisma.verificationAttempt.createMany({
    data: [
      {
        orderItemId: order1Qb101.id,
        employeeId: emp1.id,
        enteredBookCode: 'QB101',
        success: true,
        attemptedAt: new Date(Date.now() - 3600 * 1000 * 2),
      },
      {
        orderItemId: order1Qb101.id,
        employeeId: emp1.id,
        enteredBookCode: 'WRONG_CODE_99',
        success: false,
        failureReason: 'Entered book code "WRONG_CODE_99" does not match expected "QB101"',
        attemptedAt: new Date(Date.now() - 3600 * 1000 * 2.1),
      },
      {
        orderItemId: order1Mcq201.id,
        employeeId: emp1.id,
        enteredBookCode: 'MCQ201',
        success: true,
        attemptedAt: new Date(Date.now() - 3600 * 1000 * 1.5),
      },
      {
        orderItemId: order2.items[0].id,
        employeeId: emp2.id,
        enteredBookCode: 'MCQ201',
        success: false,
        failureReason: 'Entered book code "MCQ201" does not match expected "QB101"',
        attemptedAt: new Date(Date.now() - 3600 * 1000 * 0.8),
      },
    ],
  });

  // Add Initial Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        actorUserId: admin.id,
        action: 'IMPORT_BATCH_CREATED',
        entityType: 'ImportBatch',
        entityId: initialBatch.id,
        metadata: { fileName: 'Initial_Seed_Orders.xlsx', totalRows: 6 },
      },
      {
        actorUserId: emp1.id,
        action: 'BOOK_DISPATCHED',
        entityType: 'OrderItem',
        entityId: order1Qb101.id,
        metadata: { bookCode: 'QB101', quantity: 1, student: 'Rahul Sharma' },
      },
      {
        actorUserId: emp2.id,
        action: 'BOOK_DISPATCHED',
        entityType: 'OrderItem',
        entityId: order3Mcq201.id,
        metadata: { bookCode: 'MCQ201', quantity: 1, student: 'Amit Patel' },
      },
    ],
  });

  console.log('✅ Created dispatch logs, verification attempts, and audit logs');
  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
