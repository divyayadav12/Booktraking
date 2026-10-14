const ExcelJS = require('./backend/node_modules/exceljs');
const path = require('path');
const fs = require('fs');

async function generateSampleExcel() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Student Orders', {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { header: 'Student Name', key: 'studentName', width: 22 },
    { header: 'Mobile Number', key: 'mobileNumber', width: 16 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Tracking ID', key: 'trackingId', width: 18 },
    { header: 'Product Code', key: 'productCode', width: 16 },
    { header: 'Product Name', key: 'productName', width: 28 },
    { header: 'Book Code', key: 'bookCode', width: 16 },
    { header: 'Book Name', key: 'bookName', width: 36 },
    { header: 'Quantity', key: 'quantity', width: 12 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' }, // Navy blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 26;

  const rows = [
    // Order 1: Divya Sharma (4 books)
    {
      studentName: 'Divya Sharma',
      mobileNumber: '+919876543210',
      email: 'divya.sharma@example.com',
      trackingId: 'TRK-IND-9021',
      productCode: 'PRD-FND-01',
      productName: 'CA Foundation Complete Kit',
      bookCode: 'BK-ACC-101',
      bookName: 'Accounting Principles Volume 1',
      quantity: 1,
    },
    {
      studentName: 'Divya Sharma',
      mobileNumber: '+919876543210',
      email: 'divya.sharma@example.com',
      trackingId: 'TRK-IND-9021',
      productCode: 'PRD-FND-01',
      productName: 'CA Foundation Complete Kit',
      bookCode: 'BK-LAW-102',
      bookName: 'Business Laws & Corporate Ethics',
      quantity: 1,
    },
    {
      studentName: 'Divya Sharma',
      mobileNumber: '+919876543210',
      email: 'divya.sharma@example.com',
      trackingId: 'TRK-IND-9021',
      productCode: 'PRD-FND-01',
      productName: 'CA Foundation Complete Kit',
      bookCode: 'BK-MTH-103',
      bookName: 'Quantitative Aptitude & Logical Reasoning',
      quantity: 1,
    },
    {
      studentName: 'Divya Sharma',
      mobileNumber: '+919876543210',
      email: 'divya.sharma@example.com',
      trackingId: 'TRK-IND-9021',
      productCode: 'PRD-FND-01',
      productName: 'CA Foundation Complete Kit',
      bookCode: 'BK-ECO-104',
      bookName: 'Business Economics & Financial Markets',
      quantity: 1,
    },

    // Order 2: Rahul Gupta (3 books)
    {
      studentName: 'Rahul Gupta',
      mobileNumber: '+919811223344',
      email: 'rahul.gupta@example.com',
      trackingId: 'TRK-IND-9022',
      productCode: 'PRD-INT-02',
      productName: 'CA Intermediate Group 1 Combo',
      bookCode: 'BK-TAX-201',
      bookName: 'Direct Taxation & GST Practitioner Guide',
      quantity: 1,
    },
    {
      studentName: 'Rahul Gupta',
      mobileNumber: '+919811223344',
      email: 'rahul.gupta@example.com',
      trackingId: 'TRK-IND-9022',
      productCode: 'PRD-INT-02',
      productName: 'CA Intermediate Group 1 Combo',
      bookCode: 'BK-AUD-202',
      bookName: 'Advanced Auditing & Professional Ethics',
      quantity: 1,
    },
    {
      studentName: 'Rahul Gupta',
      mobileNumber: '+919811223344',
      email: 'rahul.gupta@example.com',
      trackingId: 'TRK-IND-9022',
      productCode: 'PRD-INT-02',
      productName: 'CA Intermediate Group 1 Combo',
      bookCode: 'BK-CST-203',
      bookName: 'Cost & Management Accounting Workbook',
      quantity: 1,
    },

    // Order 3: Priya Patel (2 books)
    {
      studentName: 'Priya Patel',
      mobileNumber: '+919988776655',
      email: 'priya.patel@example.com',
      trackingId: 'TRK-IND-9023',
      productCode: 'PRD-FIN-03',
      productName: 'CA Final Financial Reporting Kit',
      bookCode: 'BK-FRM-301',
      bookName: 'Financial Reporting Masterclass Vol 1',
      quantity: 1,
    },
    {
      studentName: 'Priya Patel',
      mobileNumber: '+919988776655',
      email: 'priya.patel@example.com',
      trackingId: 'TRK-IND-9023',
      productCode: 'PRD-FIN-03',
      productName: 'CA Final Financial Reporting Kit',
      bookCode: 'BK-SFM-302',
      bookName: 'Strategic Financial Management Practice',
      quantity: 1,
    },

    // Order 4: Aman Verma (2 books)
    {
      studentName: 'Aman Verma',
      mobileNumber: '+919765432109',
      email: 'aman.verma@example.com',
      trackingId: 'TRK-IND-9024',
      productCode: 'PRD-FND-01',
      productName: 'CA Foundation Complete Kit',
      bookCode: 'BK-ACC-101',
      bookName: 'Accounting Principles Volume 1',
      quantity: 1,
    },
    {
      studentName: 'Aman Verma',
      mobileNumber: '+919765432109',
      email: 'aman.verma@example.com',
      trackingId: 'TRK-IND-9024',
      productCode: 'PRD-FND-01',
      productName: 'CA Foundation Complete Kit',
      bookCode: 'BK-LAW-102',
      bookName: 'Business Laws & Corporate Ethics',
      quantity: 1,
    },
  ];

  rows.forEach((r, idx) => {
    const row = sheet.addRow(r);
    row.height = 20;
    row.alignment = { vertical: 'middle' };
    row.getCell('quantity').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('productCode').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('bookCode').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('trackingId').alignment = { vertical: 'middle', horizontal: 'center' };

    // Zebra striping
    if (idx % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
      };
    }
  });

  const localPath = path.resolve(__dirname, 'sample_student_orders.xlsx');
  await workbook.xlsx.writeFile(localPath);
  console.log(`Saved to ${localPath}`);

  // Copy to Desktop if exists
  const desktopPath = path.join('C:', 'Users', 'HP', 'Desktop', 'sample_student_orders.xlsx');
  try {
    fs.copyFileSync(localPath, desktopPath);
    console.log(`Also copied to Desktop: ${desktopPath}`);
  } catch (err) {
    console.log('Could not copy to Desktop:', err.message);
  }
}

generateSampleExcel().catch(console.error);
