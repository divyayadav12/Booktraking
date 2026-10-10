import ExcelJS from 'exceljs';
import path from 'path';

async function generateSampleFiles() {
  const sampleDir = path.resolve(__dirname);

  // 1. Valid Orders Excel
  const validWb = new ExcelJS.Workbook();
  const validWs = validWb.addWorksheet('Student Orders');
  validWs.columns = [
    { header: 'Student Name', key: 'studentName', width: 20 },
    { header: 'Mobile Number', key: 'mobileNumber', width: 16 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Tracking ID', key: 'trackingId', width: 14 },
    { header: 'Book Code', key: 'bookCode', width: 14 },
    { header: 'Book Name', key: 'bookName', width: 25 },
    { header: 'Quantity', key: 'quantity', width: 12 },
  ];

  validWs.addRow({
    studentName: 'Aarav Sharma',
    mobileNumber: '9811122233',
    email: 'aarav@example.com',
    trackingId: 'TR501',
    bookCode: 'QB101',
    bookName: 'Quantitative Bank',
    quantity: 2,
  });
  validWs.addRow({
    studentName: 'Aarav Sharma',
    mobileNumber: '9811122233',
    email: 'aarav@example.com',
    trackingId: 'TR501',
    bookCode: 'MCQ201',
    bookName: 'MCQ Book',
    quantity: 1,
  });
  validWs.addRow({
    studentName: 'Diya Patel',
    mobileNumber: '9822233344',
    email: 'diya@example.com',
    trackingId: 'TR502',
    bookCode: 'QB101',
    bookName: 'Quantitative Bank',
    quantity: 3,
  });
  validWs.addRow({
    studentName: 'Karan Mehra',
    mobileNumber: '9833344455',
    email: 'karan@example.com',
    trackingId: 'TR503',
    bookCode: 'ENG201',
    bookName: 'English Comprehensive',
    quantity: 1,
  });
  validWs.addRow({
    studentName: 'Simran Kaur',
    mobileNumber: '9844455566',
    email: 'simran@example.com',
    trackingId: 'TR504',
    bookCode: 'MATH101',
    bookName: 'Higher Mathematics',
    quantity: 2,
  });

  await validWb.xlsx.writeFile(path.join(sampleDir, 'sample_valid_orders.xlsx'));
  console.log('✅ Created sample_valid_orders.xlsx');

  // 2. Mixed Orders with Errors
  const mixedWb = new ExcelJS.Workbook();
  const mixedWs = mixedWb.addWorksheet('Student Orders');
  mixedWs.columns = validWs.columns;

  // Valid
  mixedWs.addRow({
    studentName: 'Manish Gupta',
    mobileNumber: '9855566677',
    email: 'manish@example.com',
    trackingId: 'TR601',
    bookCode: 'QB101',
    bookName: 'Quantitative Bank',
    quantity: 2,
  });
  // Invalid mobile
  mixedWs.addRow({
    studentName: 'Ananya Sen',
    mobileNumber: 'invalid_phone',
    email: 'ananya@example.com',
    trackingId: 'TR602',
    bookCode: 'MCQ201',
    bookName: 'MCQ Book',
    quantity: 1,
  });
  // Invalid email
  mixedWs.addRow({
    studentName: 'Vikram Seth',
    mobileNumber: '9877788899',
    email: 'not-an-email',
    trackingId: 'TR603',
    bookCode: 'QB101',
    bookName: 'Quantitative Bank',
    quantity: 1,
  });
  // Invalid quantity (0)
  mixedWs.addRow({
    studentName: 'Ritika Roy',
    mobileNumber: '9888899900',
    email: 'ritika@example.com',
    trackingId: 'TR604',
    bookCode: 'CS301',
    bookName: 'Computer Science Handbook',
    quantity: 0,
  });
  // Missing Book Code
  mixedWs.addRow({
    studentName: 'Mohit Rao',
    mobileNumber: '9899900011',
    email: 'mohit@example.com',
    trackingId: 'TR605',
    bookCode: '',
    bookName: 'General Awareness',
    quantity: 2,
  });

  await mixedWb.xlsx.writeFile(path.join(sampleDir, 'sample_with_validation_errors.xlsx'));
  console.log('✅ Created sample_with_validation_errors.xlsx');
}

generateSampleFiles().catch(console.error);
