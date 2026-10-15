const http = require('http');
const db = require('./src/config/db');

function httpReq(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body) {
      if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

async function main() {
  console.log('====================================================');
  console.log('      Quick Job Card GST & Non-GST Integration Tests');
  console.log('====================================================\n');

  // 1. Authenticate
  console.log('1. Logging in as admin...');
  const loginRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'HAPPY@2024' });

  if (loginRes.status !== 200) {
    console.error('âŒ Login failed status:', loginRes.status, loginRes.body);
    process.exit(1);
  }
  const authData = JSON.parse(loginRes.body);
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authData.token}`
  };
  console.log(`âœ… Authentication Success. Token obtained.\n`);

  // Helper to create a quick job card
  async function createQuickJobCard(regNo, carName) {
    const payload = {
      reg_no: regNo,
      owner_name: 'Quick Test Customer',
      mobile: '9876543210',
      car_name: carName,
      services: [
        { service_name: 'Quick Wash', rate: 1000, qty: 1, amount: 1000 }
      ]
    };
    const res = await httpReq({
      hostname: 'localhost', port: 5000, path: '/api/quick-job-cards',
      method: 'POST', headers
    }, payload);
    if (res.status !== 201) {
      throw new Error(`Failed to create quick job card: ${res.status} - ${res.body}`);
    }
    const data = JSON.parse(res.body);
    return data.id;
  }

  // 2. Test Quick Job Card creation & properties
  console.log('2. Testing Quick Job Card creation & database flags...');
  const qjId1 = await createQuickJobCard('GJ-06-QJ-1111', 'Quick Car A');
  console.log(`âœ… Created Quick Job Card 1 (ID: ${qjId1})`);

  const [jobDb] = await db.query('SELECT * FROM job_cards WHERE id = ?', [qjId1]);
  if (jobDb.length === 0) {
    console.error('âŒ Job Card not found in DB!');
    process.exit(1);
  }
  const job = jobDb[0];
  console.log('âœ… DB Job Card details:', { status: job.status, is_quick_job: job.is_quick_job });
  if (job.status !== 'estimation' || job.is_quick_job !== 1) {
    console.error('âŒ Quick Job Card status or is_quick_job flag is incorrect!');
    process.exit(1);
  }
  console.log('âœ… Quick Job Card properties verified successfully!\n');

  // 3. Test Direct Transition to Delivered (from Estimation)
  console.log('3. Testing direct transition from estimation to delivered for Quick Job Card...');
  const transitionRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/job-cards/${qjId1}/status`,
    method: 'PATCH', headers
  }, { status: 'delivered' });

  if (transitionRes.status !== 200) {
    console.error('âŒ Direct transition to delivered failed:', transitionRes.status, transitionRes.body);
    process.exit(1);
  }
  console.log('âœ… Status transition succeeded.');
  const [jobDbDelivered] = await db.query('SELECT status FROM job_cards WHERE id = ?', [qjId1]);
  if (jobDbDelivered[0].status !== 'delivered') {
    console.error('âŒ Job Card status is not delivered in DB!');
    process.exit(1);
  }
  console.log('âœ… Status updated to delivered in DB successfully!\n');

  // 4. Test GST Billing for Quick Job Card
  console.log('4. Testing GST Invoice generation for Quick Job Card...');
  const gstInvoiceRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/job-cards/${qjId1}/generate-invoice-with-gst`,
    method: 'POST', headers
  }, { payment_mode: 'upi', gst_percent: 18 });

  if (gstInvoiceRes.status !== 200) {
    console.error('âŒ GST Invoice generation failed:', gstInvoiceRes.status, gstInvoiceRes.body);
    process.exit(1);
  }
  const gstInvData = JSON.parse(gstInvoiceRes.body);
  console.log('âœ… GST Invoice Response:', gstInvData);

  const [invoicesDb] = await db.query('SELECT * FROM invoices WHERE job_card_id = ?', [qjId1]);
  if (invoicesDb.length === 0) {
    console.error('âŒ GST Invoice not found in invoices table!');
    process.exit(1);
  }
  console.log('âœ… GST Invoice saved successfully in the database.\n');

  // 5. Test Non-GST Billing for Quick Job Card
  console.log('5. Testing Non-GST Invoice generation for Quick Job Card...');
  const qjId2 = await createQuickJobCard('GJ-06-QJ-2222', 'Quick Car B');
  console.log(`âœ… Created Quick Job Card 2 (ID: ${qjId2})`);

  // Direct transition to delivered
  await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/job-cards/${qjId2}/status`,
    method: 'PATCH', headers
  }, { status: 'delivered' });

  // Generate invoice without GST
  const nonGstInvoiceRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/job-cards/${qjId2}/generate-invoice-without-gst`,
    method: 'POST', headers
  }, { payment_mode: 'cash' });

  if (nonGstInvoiceRes.status !== 200) {
    console.error('âŒ Non-GST Invoice generation failed:', nonGstInvoiceRes.status, nonGstInvoiceRes.body);
    process.exit(1);
  }
  const nonGstInvData = JSON.parse(nonGstInvoiceRes.body);
  console.log('âœ… Non-GST Invoice Response:', nonGstInvData);

  const [nonGstInvoicesDb] = await db.query('SELECT * FROM invoices_non_gst WHERE job_card_id = ? AND deleted_at IS NULL', [qjId2]);
  if (nonGstInvoicesDb.length === 0) {
    console.error('âŒ Non-GST Invoice not found in invoices_non_gst table!');
    process.exit(1);
  }
  console.log('âœ… Non-GST Invoice saved successfully in the database.\n');

  // 6. Test Kill Switch for Quick Job Card Non-GST Invoice
  console.log('6. Testing Non-GST Kill Switch on Quick Job Card invoice...');
  const killSwitchRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/job-cards/non-gst/kill-switch',
    method: 'DELETE', headers
  });
  if (killSwitchRes.status !== 200) {
    console.error('âŒ Kill Switch failed:', killSwitchRes.status, killSwitchRes.body);
    process.exit(1);
  }
  console.log('âœ… Kill Switch response:', JSON.parse(killSwitchRes.body));

  const [nonGstInvoicesDbAfter] = await db.query('SELECT * FROM invoices_non_gst WHERE job_card_id = ? AND deleted_at IS NULL', [qjId2]);
  if (nonGstInvoicesDbAfter.length > 0) {
    console.error('âŒ Non-GST Invoice still active in invoices_non_gst table after Kill Switch!');
    process.exit(1);
  }
  console.log('âœ… Quick Job Card Non-GST Invoice successfully soft-deleted via Kill Switch!\n');

  console.log('====================================================');
  console.log('   ðŸŽ‰ ALL QUICK JOB CARD INTEGRATION TESTS PASSED!');
  console.log('====================================================');
  process.exit(0);
}

main().catch(err => {
  console.error('âŒ Test execution failed:', err);
  process.exit(1);
});

