const mongoose = require('./backend/node_modules/mongoose');

const openingStockRaw = [
  // CA Final - FR
  { bookName: 'FR Brahmastra Vol 1', bookCode: 'FRBR1-001', quantity: 8 },
  { bookName: 'FR Brahmastra Vol 2', bookCode: 'FRBR2-001', quantity: 290 },
  { bookName: 'Striker Vol 1', bookCode: 'FRST1-001', quantity: 81 },
  { bookName: 'Striker Vol 2', bookCode: 'FRST2-001', quantity: 74 },
  { bookName: 'Striker Vol 1 New', bookCode: 'FRST1-NEW', quantity: 6 },
  { bookName: 'Striker Vol 2 New', bookCode: 'FRST2-NEW', quantity: 6 },
  { bookName: 'FR Sure Shot Notes', bookCode: 'FRSS-001', quantity: 17 },
  { bookName: 'FR Explainer', bookCode: 'FRE-001', quantity: 6 },
  { bookName: 'FR Solver Vol 1', bookCode: 'FRSV1-001', quantity: 11 },
  { bookName: 'FR Solver Vol 2', bookCode: 'FRSV2-001', quantity: 11 },
  { bookName: 'FR Builder', bookCode: 'FRB-001', quantity: 6 },
  { bookName: 'FR Aimer', bookCode: 'FRA-001', quantity: 19 },

  // CA Final - Audit
  { bookName: 'Audit crush Full Book', bookCode: 'ACR-001', quantity: 1 },
  { bookName: 'Audit MCQ', bookCode: 'AMCQ-001', quantity: 418 },
  { bookName: 'Audit Drone Charts Full (270 Pg)', bookCode: 'ADC-001', quantity: 6 },
  { bookName: 'Audit QB Jan26', bookCode: 'AQB-001', quantity: 1 },
  { bookName: 'Audit Supp QB', bookCode: 'ASQB-001', quantity: 18 },
  { bookName: 'Audit QB Nov26', bookCode: 'AQB-002', quantity: 293 },

  // CA Final - IDT
  { bookName: 'IDT Handwritten 9.0', bookCode: 'FIDTHW-009', quantity: 373 },
  { bookName: 'IDT Question Bank 9.0', bookCode: 'FIDTQB-09', quantity: 47 },

  // CA Final - AFM
  { bookName: 'AFM Outnotes Nov 26 Combined', bookCode: 'AFON-002', quantity: 12 },
  { bookName: 'AFM Outnotes Nov26 Part 1', bookCode: 'AFON1-002', quantity: 0 },
  { bookName: 'AFM OutScanner Nov26 Part 1', bookCode: 'AFOS1-002', quantity: 26 },
  { bookName: 'AFM OutScanner Nov26 Part 2', bookCode: 'AFOS2-002', quantity: 27 },
  { bookName: 'AFM Outnotes Nov 26 Part 2', bookCode: 'AFON-002-V2', quantity: 4 },
  { bookName: 'AFM Outnotes Concept Book', bookCode: 'AFON-001', quantity: 1 },
  { bookName: 'AFM Outscanner QB Book', bookCode: 'AFOS-QB-001', quantity: 3 },
  { bookName: 'AFM Outscanner Vol 1', bookCode: 'AFOS1-001', quantity: 1 },
  { bookName: 'AFM Outscanner Vol 2', bookCode: 'AFOS2-001', quantity: 1 },

  // CA Final - DT
  { bookName: 'DT Study Mate May27 Part - 01', bookCode: 'DTSM-002', quantity: 1 },
  { bookName: 'DT Study Mate', bookCode: 'DTSM-001', quantity: 3 },
  { bookName: 'DT Question Bank / ITT', bookCode: 'DTQB-001', quantity: 2 },

  // CA Inter - Adv Accounting
  { bookName: 'Brahmastra Adv Accounts VOL I', bookCode: 'IACBR-001', quantity: 2 },
  { bookName: 'Striker Adv Accounts vol I', bookCode: 'IASBR-001', quantity: 1 },
  { bookName: 'Brahmastra AS vol II', bookCode: 'IACST-001', quantity: 3 },
  { bookName: 'Striker AS', bookCode: 'IASST-001', quantity: 2 },

  // CA Inter - Audit
  { bookName: 'Inter Audit Brahmastra', bookCode: 'IAEBR-001', quantity: 3 },
  { bookName: 'Inter Audit QB', bookCode: 'IAEQB-001', quantity: 3 },
  { bookName: 'Inter audit DC', bookCode: 'IAEDC-001', quantity: 6 },

  // CA Inter - IDT
  { bookName: 'Inter IDT Handwritten Book 8.0', bookCode: 'IGSHW-008', quantity: 15 },
  { bookName: 'Inter IDT QB Book 8.0', bookCode: 'IGSQB-008', quantity: 15 },

  // CA Inter - SM
  { bookName: 'CA Inter SM Concept Notes', bookCode: 'ISMHW-005', quantity: 15 },
  { bookName: 'CA Inter SM QB', bookCode: 'ISMQB-005', quantity: 17 },

  // CA Inter - FM
  { bookName: 'CA Inter FM QB + Th & MCQ V4', bookCode: 'IFMQB-004', quantity: 5 },
  { bookName: 'CA Inter FM Handwritten V5', bookCode: 'IFMHW-005', quantity: 16 },
  { bookName: 'CA Inter FM QB + MCQ V5', bookCode: 'IFMQB-005', quantity: 10 },

  // CA Inter - Costing
  { bookName: 'CA Inter Cost Handwritten V5', bookCode: 'ICHW-005', quantity: 13 },
  { bookName: 'CA Inter Cost Question Bank V5 combined', bookCode: 'ICQB-005', quantity: 0 },
  { bookName: 'CA Inter Cost Question Bank V6', bookCode: 'ICQB-006', quantity: 12 },
  { bookName: 'CA Inter Cost Handwritten Book V4', bookCode: 'ICHW-004', quantity: 1 },
  { bookName: 'CA Inter Cost Question Bank V4', bookCode: 'ICQB-004', quantity: 3 },
  { bookName: 'CA Inter Cost Theory + MCQ', bookCode: 'ICMCQ-005', quantity: 13 },

  // CA Inter - DT
  { bookName: 'CA Inter DT Study Mate', bookCode: 'IDTXSM-001', quantity: 4 },
  { bookName: 'CA Inter DT QB', bookCode: 'IDTXQB-001', quantity: 2 },
];

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/book_tracking_db');
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;

  // 1. Clear all old orders, import batches, dispatch logs, verification attempts
  console.log('Clearing old orders, import batches, and dispatch history...');
  const orderRes = await db.collection('orders').deleteMany({});
  const batchRes = await db.collection('importbatches').deleteMany({});
  const dispatchRes = await db.collection('dispatchlogs').deleteMany({});
  const attemptRes = await db.collection('verificationattempts').deleteMany({});
  const stockRes = await db.collection('bookstocks').deleteMany({});
  const inwardRes = await db.collection('stockinwards').deleteMany({});

  console.log(`Deleted Orders: ${orderRes.deletedCount}`);
  console.log(`Deleted Import Batches: ${batchRes.deletedCount}`);
  console.log(`Deleted Dispatch Logs: ${dispatchRes.deletedCount}`);
  console.log(`Deleted Verification Attempts: ${attemptRes.deletedCount}`);
  console.log(`Deleted BookStocks: ${stockRes.deletedCount}`);
  console.log(`Deleted StockInwards: ${inwardRes.deletedCount}`);

  // Get Admin user
  const adminUser = await db.collection('users').findOne({ role: 'ADMIN' });
  const adminId = adminUser ? adminUser._id : new mongoose.Types.ObjectId();

  // 2. Insert opening stock into BookStock and StockInward
  console.log('Inserting opening balance stock records...');
  let totalCopies = 0;
  const now = new Date();
  const openingDate = new Date('2026-08-01T10:00:00Z');

  for (const item of openingStockRaw) {
    const cleanCode = item.bookCode.trim().toUpperCase();
    const cleanName = item.bookName.trim();
    const qty = Math.max(0, item.quantity);
    totalCopies += qty;

    // Create BookStock record
    await db.collection('bookstocks').insertOne({
      bookCode: cleanCode,
      bookName: cleanName,
      productCode: '',
      totalInward: qty,
      totalDispatched: 0,
      availableQuantity: qty,
      lowStockThreshold: 10,
      lastRestockedAt: openingDate,
      createdAt: now,
      updatedAt: now,
    });

    // Create StockInward entry
    if (qty > 0) {
      await db.collection('stockinwards').insertOne({
        entryDate: openingDate,
        entryTime: '10:00:00',
        bookCode: cleanCode,
        bookName: cleanName,
        quantity: qty,
        supplier: 'Opening Stock (Prarambhik Stock)',
        remarks: 'Opening Balance as on 2026-08-01',
        source: 'MANUAL',
        enteredByUserId: adminId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  console.log(`\nSuccessfully inserted ${openingStockRaw.length} unique book titles!`);
  console.log(`Total live available copies in warehouse: ${totalCopies}`);

  await mongoose.disconnect();
  console.log('MongoDB disconnected. Done.');
}

main().catch(console.error);
