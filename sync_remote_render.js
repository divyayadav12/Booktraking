process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');

async function syncRemote() {
  const FormData = require('./backend/node_modules/form-data');

  const BASE_URL = 'https://booktraking.onrender.com/api';

  console.log('1. Logging in to Render backend...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'Admin@123',
    }),
  });

  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.data?.token) {
    console.error('Login failed:', loginData);
    return;
  }

  const token = loginData.data.token;
  console.log('Admin authenticated successfully.');

  console.log('2. Wiping old data on remote Render database...');
  const clearRes = await fetch(`${BASE_URL}/orders/clear-all`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const clearData = await clearRes.json();
  console.log('Clear response:', clearData);

  console.log('3. Uploading real_student_orders.xlsx to preview...');
  const filePath = path.resolve(__dirname, 'real_student_orders.xlsx');
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const form = new globalThis.FormData();
  form.append('file', blob, 'real_student_orders.xlsx');

  const previewRes = await fetch(`${BASE_URL}/imports/preview`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const previewData = await previewRes.json();
  if (!previewData.success) {
    console.error('Preview failed:', previewData);
    return;
  }

  console.log(`Preview succeeded: ${previewData.data.validRowsCount} valid rows.`);

  console.log('4. Confirming import on Render...');
  const confirmRes = await fetch(`${BASE_URL}/imports/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileHash: previewData.data.fileHash,
      originalFileName: previewData.data.originalFileName,
      validRows: previewData.data.validRows,
      invalidRows: previewData.data.invalidRows,
    }),
  });

  const confirmData = await confirmRes.json();
  console.log('Confirm response:', confirmData);
  console.log('Render live sync completed successfully!');
}

syncRemote().catch(console.error);
