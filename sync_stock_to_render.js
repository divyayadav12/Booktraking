process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

async function syncToRender() {
  const BASE_URL = 'https://booktraking.onrender.com/api';

  console.log('1. Logging in to Render backend (https://booktraking.onrender.com)...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin@123' }),
  });

  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.data?.token) {
    console.error('Login failed:', loginData);
    return;
  }

  const token = loginData.data.token;
  console.log('Admin authenticated on Render.');

  console.log('2. Clearing old orders and batches on Render...');
  try {
    const clearOrdersRes = await fetch(`${BASE_URL}/orders/clear-all`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const clearOrdersData = await clearOrdersRes.json();
    console.log('Orders cleared on Render:', clearOrdersData.message || clearOrdersData);
  } catch (e) {
    console.warn('Orders clear warning:', e.message);
  }

  console.log('3. Clearing existing stock on Render...');
  try {
    const clearStockRes = await fetch(`${BASE_URL}/stock/clear-all`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const clearStockData = await clearStockRes.json();
    console.log('Stock cleared on Render:', clearStockData.message || clearStockData);
  } catch (e) {
    console.warn('Stock clear warning:', e.message);
  }

  console.log('4. Uploading all 54 opening stock items to Render...');
  let totalCopies = 0;
  let successCount = 0;

  for (const item of openingStockRaw) {
    const cleanCode = item.bookCode.trim().toUpperCase();
    const cleanName = item.bookName.trim();
    const qty = Math.max(0, item.quantity);
    totalCopies += qty;

    if (qty > 0) {
      const inwardRes = await fetch(`${BASE_URL}/stock/inward`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookCode: cleanCode,
          bookName: cleanName,
          quantity: qty,
          supplier: 'Opening Stock (Prarambhik Stock)',
          remarks: 'Opening Balance as on 2026-08-01',
          entryDate: '2026-08-01',
          entryTime: '10:00:00',
          source: 'MANUAL',
        }),
      });

      const resData = await inwardRes.json();
      if (resData.success) {
        successCount++;
        process.stdout.write('.');
      } else {
        console.error(`\nFailed for ${cleanCode}:`, resData.message);
      }
    } else {
      // For 0 quantity books (like AFON1-002, ICQB-005), add with 1 then delete, or add 1 and adjust to 0
      // Inward requires quantity >= 1
      const inwardRes = await fetch(`${BASE_URL}/stock/inward`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookCode: cleanCode,
          bookName: cleanName,
          quantity: 1,
          supplier: 'Opening Stock (0 Balance)',
          remarks: 'Opening Balance - 0 quantity',
          entryDate: '2026-08-01',
          entryTime: '10:00:00',
          source: 'MANUAL',
        }),
      });
      const resData = await inwardRes.json();
      if (resData.success && resData.data?.inwardRecord?._id) {
        // delete the inward entry to make available stock exactly 0!
        await fetch(`${BASE_URL}/stock/inward/${resData.data.inwardRecord._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        successCount++;
        process.stdout.write('.');
      }
    }
  }

  console.log(`\n\n5. Verifying live stock on Render...`);
  const verifyRes = await fetch(`${BASE_URL}/stock/available?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const verifyData = await verifyRes.json();

  console.log('Available Stock Summary on Render:', verifyData.data?.summary);
  console.log(`Total Book Titles loaded: ${verifyData.data?.books?.length}`);
  console.log('Sync to Render production backend completed successfully!');
}

syncToRender().catch(console.error);
