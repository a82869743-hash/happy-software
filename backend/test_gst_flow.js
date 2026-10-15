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
  console.log('      GST & Non-GST Module Integration Tests');
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

  // Helper to create a job card
  async function createTestJobCard(regNo, carName) {
    const payload = {
      reg_no: regNo,
      car_name: carName,
      odometer: '12345',
      service_type: 'general',
      owner_name: 'GST Test Customer',
      mobile_no: '9876543210',
      notes: 'GST Module verification job card',
    };
    const res = await httpReq({
      hostname: 'localhost', port: 5000, path: '/api/job-cards',
      method: 'POST', headers
    }, payload);
    if (res.status !== 201) {
      throw new Error(`Failed to create job card: ${res.status} - ${res.body}`);
    }
    const data = JSON.parse(res.body);
    return data.id;
  }

  // Helper to add a service to a job card
  async function addService(jobCardId, serviceName, amount) {
    const tax_pct = 18;
    const tax_amount = parseFloat((amount * tax_pct / 100).toFixed(2));
    const payload = {
      service_name: serviceName,
      item_type: 'labour',
      qty: 1,
      rate: amount,
      amount: amount,
      tax_pct: tax_pct,
      tax_amount: tax_amount,
      is_selected: 1
    };
    const res = await httpReq({
      hostname: 'localhost', port: 5000, path: `/api/job-cards/${jobCardId}/services`,
      method: 'POST', headers
    }, payload);
    if (res.status !== 201) {
      throw new Error(`Failed to add service: ${res.status} - ${res.body}`);
    }
  }

  // 2. Test standard GST Invoice Flow
  console.log('2. Testing standard GST Invoice Flow...');
  const jcId1 = await createTestJobCard('GJ-06-GST-1111', 'GST Test Car A');
  console.log(`âœ… Created Job Card 1 (ID: ${jcId1})`);
  await addService(jcId1, 'Standard Wash', 1000.00);
  console.log('âœ… Added service with amount 1000.00');

  // Trigger invoice generation with GST (18%)
  const gstInvoiceRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/job-cards/${jcId1}/generate-invoice-with-gst`,
    method: 'POST', headers
  }, { payment_mode: 'upi', gst_percent: 18 });

  if (gstInvoiceRes.status !== 200) {
    console.error('âŒ GST Invoice generation failed:', gstInvoiceRes.status, gstInvoiceRes.body);
    process.exit(1);
  }
  const gstInvData = JSON.parse(gstInvoiceRes.body);
  console.log('âœ… GST Invoice Response:', gstInvData);

  // Verify DB entries for GST Invoice
  const [invoicesDb] = await db.query('SELECT * FROM invoices WHERE job_card_id = ?', [jcId1]);
  if (invoicesDb.length === 0) {
    console.error('âŒ GST Invoice not found in invoices table!');
    process.exit(1);
  }
  const invRecord = invoicesDb[0];
  console.log('âœ… DB Invoice Record:', invRecord);
  if (invRecord.gst_type !== 'with_gst' || parseFloat(invRecord.gst_percent) !== 18 || parseFloat(invRecord.total_amount) !== 1180.00) {
    console.error('âŒ GST calculation or type is incorrect in DB!');
    process.exit(1);
  }
  console.log('âœ… GST Invoice calculations and database columns are correct!\n');


  // 3. Test Non-GST Invoice Flow
  console.log('3. Testing Non-GST Invoice Flow...');
  const jcId2 = await createTestJobCard('GJ-06-NOGST-2222', 'GST Test Car B');
  console.log(`âœ… Created Job Card 2 (ID: ${jcId2})`);
  await addService(jcId2, 'Non-GST Repairs', 2000.00);
  console.log('âœ… Added service with amount 2000.00');

  // Trigger invoice generation without GST
  const nonGstInvoiceRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/job-cards/${jcId2}/generate-invoice-without-gst`,
    method: 'POST', headers
  }, { payment_mode: 'cash' });

  if (nonGstInvoiceRes.status !== 200) {
    console.error('âŒ Non-GST Invoice generation failed:', nonGstInvoiceRes.status, nonGstInvoiceRes.body);
    process.exit(1);
  }
  const nonGstInvData = JSON.parse(nonGstInvoiceRes.body);
  console.log('âœ… Non-GST Invoice Response:', nonGstInvData);

  // Verify DB entries for Non-GST Invoice
  const [nonGstInvoicesDb] = await db.query('SELECT * FROM invoices_non_gst WHERE job_card_id = ?', [jcId2]);
  if (nonGstInvoicesDb.length === 0) {
    console.error('âŒ Non-GST Invoice not found in invoices_non_gst table!');
    process.exit(1);
  }
  const nonGstRecord = nonGstInvoicesDb[0];
  console.log('âœ… DB Non-GST Invoice Record:', nonGstRecord);
  if (parseFloat(nonGstRecord.total_amount) !== 2000.00 || nonGstRecord.payment_mode !== 'cash') {
    console.error('âŒ Non-GST calculation or payment mode is incorrect in DB!');
    process.exit(1);
  }
  console.log('âœ… Non-GST Invoice database record is correct!\n');


  // 4. Test List Endpoint for Non-GST
  console.log('4. Testing Non-GST List endpoint...');
  const listRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/job-cards/non-gst-list',
    method: 'GET', headers
  });
  if (listRes.status !== 200) {
    console.error('âŒ Failed to fetch Non-GST list:', listRes.status, listRes.body);
    process.exit(1);
  }
  const listData = JSON.parse(listRes.body);
  console.log(`âœ… Non-GST List retrieved. Total records: ${listData.total}`);
  const foundRecord = listData.data.find(r => r.job_card_id === jcId2);
  if (!foundRecord) {
    console.error('âŒ Created Non-GST invoice was not found in the list!');
    process.exit(1);
  }
  console.log('âœ… Created Non-GST invoice found in the list successfully!\n');


  // 5. Test Export Endpoint for Non-GST
  console.log('5. Testing Non-GST Export Excel/CSV endpoint...');
  const exportRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/job-cards/non-gst/export-excel',
    method: 'GET', headers
  });
  if (exportRes.status !== 200) {
    console.error('âŒ Failed to download Non-GST export:', exportRes.status, exportRes.body);
    process.exit(1);
  }
  console.log('âœ… Export download succeeded! Headers received:', exportRes.status);
  console.log('âœ… Content-Disposition:', exportRes.body.slice(0, 100));
  if (!exportRes.body.includes('NGST-')) {
    console.error('âŒ Export body does not contain invoice numbers!');
    process.exit(1);
  }
  console.log('âœ… Export file format verified successfully!\n');


  // 6. Test Kill Switch Endpoint
  console.log('6. Testing Non-GST Kill Switch...');
  const killSwitchRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/job-cards/non-gst/kill-switch',
    method: 'DELETE', headers
  });
  if (killSwitchRes.status !== 200) {
    console.error('âŒ Kill Switch failed:', killSwitchRes.status, killSwitchRes.body);
    process.exit(1);
  }
  const killData = JSON.parse(killSwitchRes.body);
  console.log('âœ… Kill Switch Response:', killData);

  // Verify non-GST list is now empty (soft-deleted)
  const listAfterRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/job-cards/non-gst-list',
    method: 'GET', headers
  });
  const listAfterData = JSON.parse(listAfterRes.body);
  console.log(`âœ… Non-GST List after Kill Switch: ${listAfterData.total} record(s)`);
  if (listAfterData.total !== 0) {
    console.error('âŒ Non-GST list is not empty after Kill Switch!');
    process.exit(1);
  }

  // Verify kill switch log was written to database
  const [killLogs] = await db.query('SELECT * FROM non_gst_kill_switch_log ORDER BY id DESC LIMIT 1');
  if (killLogs.length === 0) {
    console.error('âŒ Kill Switch audit log was not written to DB!');
    process.exit(1);
  }
  console.log('âœ… DB Kill Switch Audit Log Record:', killLogs[0]);
  console.log('âœ… Kill Switch successfully executed and audited!\n');

  console.log('====================================================');
  console.log('       ðŸŽ‰ ALL GST MODULE TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
  process.exit(0);
}

main().catch(err => {
  console.error('âŒ Test execution failed:', err);
  process.exit(1);
});

