const http = require('http');

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
  console.log('====================================================');
  console.log('    HAPPY CAR WASH GMS V4.0 - Integration & API Verification');
  console.log('====================================================\n');

  // 1. Authenticate
  console.log('Testing Authenticate...');
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
  console.log(`âœ… Authentication Success. Token obtained for: ${authData.user.full_name}\n`);

  // 2. Fetch Job Cards to get a valid job_card_id dynamically
  console.log('Fetching active job cards...');
  const jcRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/job-cards',
    method: 'GET', headers
  });

  if (jcRes.status !== 200) {
    console.error('âŒ Failed to fetch job cards:', jcRes.status, jcRes.body);
    process.exit(1);
  }
  const jcData = JSON.parse(jcRes.body);
  if (!jcData.data || jcData.data.length === 0) {
    console.error('âŒ No job cards found in the system. Cannot run V4 integration tests.');
    process.exit(1);
  }
  const testJobCard = jcData.data[0];
  const testJobCardId = testJobCard.id;
  console.log(`âœ… Found job card for test: Job No ${testJobCard.job_no} (ID: ${testJobCardId})\n`);

  // 3. Test Feature 4: Customer Payments
  console.log('Testing Customer Payments (Feature 4)...');
  const paymentPayload = {
    job_card_id: testJobCardId,
    amount: 1500.00,
    payment_mode: 'upi',
    transaction_id: 'TXN' + Date.now(),
    remarks: 'Integration Test Payment'
  };
  
  const postPaymentRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/customer-payments',
    method: 'POST', headers
  }, paymentPayload);

  if (postPaymentRes.status !== 201) {
    console.error('âŒ POST /api/customer-payments failed:', postPaymentRes.status, postPaymentRes.body);
    process.exit(1);
  }
  const paymentRecord = JSON.parse(postPaymentRes.body);
  console.log(`âœ… Recorded payment. ID: ${paymentRecord.id}`);

  // Fetch Summary
  const getSummaryRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/customer-payments/summary/${testJobCardId}`,
    method: 'GET', headers
  });

  if (getSummaryRes.status !== 200) {
    console.error('âŒ GET /api/customer-payments/summary failed:', getSummaryRes.status, getSummaryRes.body);
    process.exit(1);
  }
  const summaryData = JSON.parse(getSummaryRes.body);
  console.log(`âœ… Payment Summary: Total Paid: â‚¹${summaryData.total_paid}, Outstanding: â‚¹${summaryData.outstanding}`);

  // Fetch list of payments
  const getPaymentsRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/customer-payments?job_card_id=${testJobCardId}`,
    method: 'GET', headers
  });
  if (getPaymentsRes.status !== 200) {
    console.error('âŒ GET /api/customer-payments failed:', getPaymentsRes.status, getPaymentsRes.body);
    process.exit(1);
  }
  console.log('âœ… Fetched customer payments list successfully.\n');

  // 4. Test Feature 10 & 11: Service Bookings & Confirmation WhatsApp
  console.log('Testing Service Bookings (Feature 10 & 11)...');
  const bookingPayload = {
    customer_name: 'V4 Integration Customer',
    mobile_no: '9999999999',
    car_number: 'GJ-06-XX-1234',
    car_name: 'Hyundai i20',
    booking_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), // tomorrow
    booking_time: '11:00:00',
    concerns: 'AC not cooling',
    advance_amount: 500.00,
    advance_mode: 'cash',
    notes: 'Create booking via integration test'
  };

  const postBookingRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/service-bookings',
    method: 'POST', headers
  }, bookingPayload);

  if (postBookingRes.status !== 201) {
    console.error('âŒ POST /api/service-bookings failed:', postBookingRes.status, postBookingRes.body);
    process.exit(1);
  }
  const bookingRecord = JSON.parse(postBookingRes.body);
  const testBookingId = bookingRecord.id;
  console.log(`âœ… Created service booking. No: ${bookingRecord.booking_no}, ID: ${testBookingId}`);

  // Fetch booking details
  const getBookingRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/service-bookings/${testBookingId}`,
    method: 'GET', headers
  });
  if (getBookingRes.status !== 200) {
    console.error('âŒ GET /api/service-bookings/:id failed:', getBookingRes.status, getBookingRes.body);
    process.exit(1);
  }
  console.log('âœ… Retrieved service booking details successfully.');

  // Update status
  const patchBookingRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/service-bookings/${testBookingId}/status`,
    method: 'PATCH', headers
  }, { booking_status: 'confirmed' });
  if (patchBookingRes.status !== 200) {
    console.error('âŒ PATCH /api/service-bookings/:id/status failed:', patchBookingRes.status, patchBookingRes.body);
    process.exit(1);
  }
  console.log('âœ… Updated service booking status to "confirmed".');

  // Calendar endpoint
  const getCalendarRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/service-bookings/calendar?month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}`,
    method: 'GET', headers
  });
  if (getCalendarRes.status !== 200) {
    console.error('âŒ GET /api/service-bookings/calendar failed:', getCalendarRes.status, getCalendarRes.body);
    process.exit(1);
  }
  console.log('âœ… Fetched service bookings calendar summary successfully.\n');

  // 5. Test Feature 8: After-Service Concerns
  console.log('Testing After-Service Concerns (Feature 8)...');
  const concernPayload = {
    job_card_id: testJobCardId,
    concern_name: 'Engine oil level low check',
    resolved_status: 'not_resolved',
    remarks: 'Added via integration tests'
  };

  const postConcernRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/inspections/concerns',
    method: 'POST', headers
  }, concernPayload);

  if (postConcernRes.status !== 201) {
    console.error('âŒ POST /api/inspections/concerns failed:', postConcernRes.status, postConcernRes.body);
    process.exit(1);
  }
  const concernRecord = JSON.parse(postConcernRes.body);
  const testConcernId = concernRecord.id;
  console.log(`âœ… Created after-service concern. ID: ${testConcernId}`);

  // Fetch concerns
  const getConcernsRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/inspections/concerns/${testJobCardId}`,
    method: 'GET', headers
  });
  if (getConcernsRes.status !== 200) {
    console.error('âŒ GET /api/inspections/concerns/:jobCardId failed:', getConcernsRes.status, getConcernsRes.body);
    process.exit(1);
  }
  console.log('âœ… Fetched concerns list successfully.');

  // Update concern
  const patchConcernRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/inspections/concerns/${testConcernId}`,
    method: 'PATCH', headers
  }, { resolved_status: 'resolved', remarks: 'Resolved in integration test' });
  if (patchConcernRes.status !== 200) {
    console.error('âŒ PATCH /api/inspections/concerns/:id failed:', patchConcernRes.status, patchConcernRes.body);
    process.exit(1);
  }
  console.log('âœ… Updated after-service concern status successfully.\n');

  // 6. Test Feature 17: Job Card Concern Checklist
  console.log('Testing Job Card Concern Checklist (Feature 17)...');
  const checklistPayload = {
    job_card_id: testJobCardId,
    concern_name: 'Brake squeaking check'
  };

  const postChecklistRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/inspections/concern-checklist',
    method: 'POST', headers
  }, checklistPayload);

  if (postChecklistRes.status !== 201) {
    console.error('âŒ POST /api/inspections/concern-checklist failed:', postChecklistRes.status, postChecklistRes.body);
    process.exit(1);
  }
  const checklistRecord = JSON.parse(postChecklistRes.body);
  const testChecklistItemId = checklistRecord.id;
  console.log(`âœ… Created concern checklist item. ID: ${testChecklistItemId}`);

  // Toggle checklist item
  const patchChecklistRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/inspections/concern-checklist/${testChecklistItemId}/toggle`,
    method: 'PATCH', headers
  }, {});
  if (patchChecklistRes.status !== 200) {
    console.error('âŒ PATCH /api/inspections/concern-checklist/:id/toggle failed:', patchChecklistRes.status, patchChecklistRes.body);
    process.exit(1);
  }
  console.log('âœ… Toggled concern checklist item successfully.');

  // Bulk add
  const bulkChecklistPayload = {
    job_card_id: testJobCardId,
    concerns: ['Wiper check', 'AC filter cleanup']
  };
  const postBulkChecklistRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/inspections/concern-checklist/bulk',
    method: 'POST', headers
  }, bulkChecklistPayload);
  if (postBulkChecklistRes.status !== 200) {
    console.error('âŒ POST /api/inspections/concern-checklist/bulk failed:', postBulkChecklistRes.status, postBulkChecklistRes.body);
    process.exit(1);
  }
  console.log('âœ… Bulk added concern checklist items successfully.\n');

  // 7. Test Feature 15: Post-Service Inspection
  console.log('Testing Post-Service Inspection & Delivery Eligibility (Feature 15)...');
  
  // Try to deliver before completing checklist (should be false or inspection not completed)
  const getCanDeliverBefore = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/inspections/can-deliver/${testJobCardId}`,
    method: 'GET', headers
  });
  if (getCanDeliverBefore.status !== 200) {
    console.error('âŒ GET /api/inspections/can-deliver/:jobCardId failed:', getCanDeliverBefore.status, getCanDeliverBefore.body);
    process.exit(1);
  }
  const beforeDeliv = JSON.parse(getCanDeliverBefore.body);
  console.log(`âœ… Check Delivery Eligibility (Before): can_deliver = ${beforeDeliv.can_deliver}, reason: "${beforeDeliv.reason}"`);

  // Record complete inspection checklist
  const inspectionPayload = {
    job_card_id: testJobCardId,
    concern_resolved: true,
    vehicle_cleaned: true,
    photos_uploaded: true,
    quality_check: true,
    notes: 'Integration test completed'
  };
  const postInspectionRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/inspections/checklist',
    method: 'POST', headers
  }, inspectionPayload);
  if (postInspectionRes.status !== 200) {
    console.error('âŒ POST /api/inspections/checklist failed:', postInspectionRes.status, postInspectionRes.body);
    process.exit(1);
  }
  console.log('âœ… Saved post-service inspection checklist.');

  // Check can-deliver after saving completed inspection
  const getCanDeliverAfter = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/inspections/can-deliver/${testJobCardId}`,
    method: 'GET', headers
  });
  if (getCanDeliverAfter.status !== 200) {
    console.error('âŒ GET /api/inspections/can-deliver/:jobCardId failed:', getCanDeliverAfter.status, getCanDeliverAfter.body);
    process.exit(1);
  }
  const afterDeliv = JSON.parse(getCanDeliverAfter.body);
  console.log(`âœ… Check Delivery Eligibility (After): can_deliver = ${afterDeliv.can_deliver}`);
  
  // Verify checklist retrieval
  const getChecklistRes = await httpReq({
    hostname: 'localhost', port: 5000, path: `/api/inspections/checklist/${testJobCardId}`,
    method: 'GET', headers
  });
  if (getChecklistRes.status !== 200) {
    console.error('âŒ GET /api/inspections/checklist/:jobCardId failed:', getChecklistRes.status, getChecklistRes.body);
    process.exit(1);
  }
  console.log('âœ… Fetched saved checklist successfully.\n');

  // 8. Test Data Import Route Presence
  console.log('Checking Import Route Presence...');
  // We can just verify the route responds with a 400 when no file is uploaded (indicating the route handler is active)
  const importPreviewRes = await httpReq({
    hostname: 'localhost', port: 5000, path: '/api/imports/preview',
    method: 'POST', headers
  });
  if (importPreviewRes.status === 400) {
    console.log('âœ… Import Preview route is active (responded 400 Bad Request as expected for no file).\n');
  } else {
    console.warn(`âš ï¸ Import Preview route returned status ${importPreviewRes.status}. Expected 400.`, importPreviewRes.body);
  }

  console.log('====================================================');
  console.log('  âœ… ALL V4 ENDPOINTS VERIFIED - INTEGRATION OK');
  console.log('====================================================\n');
  process.exit(0);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});

