const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Books from User's Google Sheet ("2025-2026 Books stock") - Column B (Op. Bal)
const targetStockList = [
  // CA Final - FR
  { bookName: 'FR Brahmastra Vol 1', bookCode: 'FRBR1-001', quantity: 263 },
  { bookName: 'FR Brahmastra Vol 2', bookCode: 'FRBR2-001', quantity: 816 },
  { bookName: 'Striker Vol 1', bookCode: 'FRST1-001', quantity: 69 },
  { bookName: 'Striker Vol 2', bookCode: 'FRST2-001', quantity: 68 },
  { bookName: 'FR MCQ', bookCode: 'FRMCQ-001', quantity: 289 },

  // CA Final - Audit
  { bookName: 'Audit Brahmastra Vol 1', bookCode: 'ABR1-001', quantity: 207 },
  { bookName: 'Audit Brahmastra Vol 2', bookCode: 'ABR2-001', quantity: 153 },
  { bookName: 'Audit Question Bank', bookCode: 'AQB-002', quantity: 178 },
  { bookName: 'Audit MCQ', bookCode: 'AMCQ-001', quantity: 495 },
  { bookName: 'Audit Drone Charts Full (270 Pg)', bookCode: 'ADC-001', quantity: 131 },

  // CA Final - IDT
  { bookName: 'IDT Handwritten 9.0', bookCode: 'FIDTHW-009', quantity: 30 },
  { bookName: 'IDT Question Bank 9.0', bookCode: 'FIDTQB-09', quantity: 34 },
  { bookName: 'IDT Question Bank 9.0', bookCode: 'FIDTQB-009', quantity: 34 },
  { bookName: 'SCPM', bookCode: 'SCPM-001', quantity: 5 },

  // CA Final - AFM
  { bookName: 'Outnotes Concept Book(old)', bookCode: 'AFON-001', quantity: 1 },
  { bookName: 'Outscanner QB Book(Old)', bookCode: 'AFOS-QB-001', quantity: 10 },
  { bookName: 'AFM Outnotes Nov 26 Combined', bookCode: 'AFON-002', quantity: 7 },
  { bookName: 'AFM OutScanner Nov26 Part 1', bookCode: 'AFOS1-002', quantity: 8 },
  { bookName: 'AFM OutScanner Nov26 Part 2', bookCode: 'AFOS2-002', quantity: 8 },

  // CA Final - DT
  { bookName: 'DT Study Mate', bookCode: 'DTSM-001', quantity: 4 },
  { bookName: 'DT Question Bank / ITT', bookCode: 'DTQB-001', quantity: 6 },

  // CA Inter - Adv Accounting
  { bookName: 'Brahmastra Adv Accounts VOL I', bookCode: 'IACBR-001', quantity: 3 },
  { bookName: 'Striker Adv Accounts vol I', bookCode: 'IASBR-001', quantity: 1 },
  { bookName: 'Brahmastra AS vol II', bookCode: 'IACST-001', quantity: 3 },
  { bookName: 'Striker AS', bookCode: 'IASST-001', quantity: 4 },

  // CA Inter - Audit
  { bookName: 'Inter Audit Brahmastra', bookCode: 'IAEBR-001', quantity: 8 },
  { bookName: 'Inter Audit QB', bookCode: 'IAEQB-001', quantity: 13 },
  { bookName: 'Inter audit DC', bookCode: 'IAEDC-001', quantity: 10 },

  // CA Inter - IDT
  { bookName: 'Inter IDT Handwritten Book 5.0', bookCode: 'IGSHW-008', quantity: 7 },
  { bookName: 'Inter IDT QB 5.0', bookCode: 'IGSQB-008', quantity: 7 },

  // CA Inter - SM
  { bookName: 'CA Inter SM Concept Notes', bookCode: 'ISMHW-005', quantity: 6 },
  { bookName: 'CA Inter SM QB', bookCode: 'ISMQB-005', quantity: 6 },

  // CA Inter - FM
  { bookName: 'CA Inter FM Handwritten V5', bookCode: 'IFMHW-005', quantity: 14 },
  { bookName: 'CA Inter FM QB + MCQ V5', bookCode: 'IFMQB-005', quantity: 5 },
  { bookName: 'CA Inter FM QB + Th & MCQ V4', bookCode: 'IFMQB-004', quantity: 8 },

  // CA Inter - Costing
  { bookName: 'CA Inter Cost Handwritten V5', bookCode: 'ICHW-005', quantity: 6 },
  { bookName: 'CA Inter Cost Question Bank V5 combined', bookCode: 'ICQB-005', quantity: 8 },
  { bookName: 'CA Inter Cost Question Bank V6', bookCode: 'ICQB-006', quantity: 8 },
  { bookName: 'CA Inter Cost Theory + MCQ', bookCode: 'ICMCQ-005', quantity: 7 },

  // CA Inter - DT
  { bookName: 'CA Inter DT Study Mate', bookCode: 'IDTXSM-001', quantity: 1 },
  { bookName: 'CA Inter DT QB', bookCode: 'IDTXQB-001', quantity: 1 },
];

async function updateDirectMongo() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/book_tracking_db';
  console.log(`\n=== 1. Direct MongoDB Update (${uri}) ===`);
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    await db.collection('bookstocks').deleteMany({});
    const now = new Date();

    const docs = targetStockList.map((item) => ({
      bookCode: item.bookCode.toUpperCase(),
      bookName: item.bookName,
      availableQuantity: item.quantity,
      totalInward: item.quantity,
      totalDispatched: 0,
      lowStockThreshold: 10,
      lastRestockedAt: now,
      createdAt: now,
      updatedAt: now,
    }));

    await db.collection('bookstocks').insertMany(docs);
    console.log(`Local DB updated with ${docs.length} books.`);
  } catch (err) {
    console.error('Local Mongo Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

async function updateRenderServer() {
  const BASE_URL = 'https://booktraking.onrender.com/api';
  console.log(`\n=== 2. Live Render Server Update (${BASE_URL}) ===`);

  try {
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'Admin@123' }),
    });

    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.data?.token) {
      console.error('Render Login Failed:', loginData);
      return;
    }

    const token = loginData.data.token;
    console.log('Admin logged in to Render.');

    // Clear old stock
    console.log('Resetting old stock on Render...');
    await fetch(`${BASE_URL}/stock/clear-all`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`Uploading ${targetStockList.length} books to Render...`);
    let added = 0;
    for (const item of targetStockList) {
      const inwardRes = await fetch(`${BASE_URL}/stock/inward`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookCode: item.bookCode,
          bookName: item.bookName,
          quantity: item.quantity,
          supplier: 'Opening Balance (Op. Bal) 2025-2026',
          remarks: 'Sheet Op. Bal initial upload',
        }),
      });

      const data = await inwardRes.json();
      if (data.success) {
        added++;
      } else {
        console.warn(`Failed for ${item.bookCode}:`, data.message);
      }
    }

    console.log(`Successfully synced ${added} / ${targetStockList.length} books to Render!`);
  } catch (err) {
    console.error('Render Server Error:', err.message);
  }
}

async function run() {
  await updateDirectMongo();
  await updateRenderServer();
  console.log('\nExact Op. Bal stock sync completed!');
}

run();
