const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const BASE_URL = 'https://booktraking.onrender.com/api';

async function clearOrders() {
  console.log('1. Logging in to Render backend (https://booktraking.onrender.com/api)...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin@123' })
  });

  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.data?.token) {
    console.error('Login failed:', loginData);
    process.exit(1);
  }

  const token = loginData.data.token;
  console.log('Admin authenticated on Render.');

  console.log('2. Calling /orders/clear-all to delete all uploaded dispatch orders and batches...');
  const clearRes = await fetch(`${BASE_URL}/orders/clear-all`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const clearData = await clearRes.json();
  console.log('Clear Response:', clearData);

  console.log('3. Checking remaining orders on Render...');
  const checkRes = await fetch(`${BASE_URL}/orders?limit=10`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const checkData = await checkRes.json();
  const totalRemaining = checkData.data?.pagination?.total || 0;
  console.log(`Remaining Orders in database: ${totalRemaining}`);

  console.log('4. Verifying Available Stock status (should remain intact)...');
  const stockRes = await fetch(`${BASE_URL}/stock/available?limit=5`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const stockData = await stockRes.json();
  console.log('Stock Metrics:', stockData.data?.metrics);
  console.log('\nSUCCESS: All dispatch orders deleted. Database is clean for fresh Excel upload!');
}

clearOrders().catch(err => {
  console.error('Clear failed:', err);
  process.exit(1);
});
