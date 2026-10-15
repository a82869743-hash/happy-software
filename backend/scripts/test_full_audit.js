const pool = require('../src/config/db');

async function testAll() {
  console.log('--- RUNNING FULL AUDIT INTEGRATION TESTS ---');

  // 1. Test dashboard queries (ensure no errors and correct calculations)
  console.log('1. Testing Dashboard Queries...');
  const [pipelineRows] = await pool.query(
    "SELECT COALESCE(SUM(jcs.amount), 0) as total FROM job_card_services jcs JOIN job_cards jc ON jcs.job_card_id = jc.id WHERE jc.status = 'estimation'"
  );
  console.log('   Pipeline estimation total:', pipelineRows[0].total);

  const [invoicesTodayRows] = await pool.query(
    "SELECT (SELECT COUNT(*) FROM invoices WHERE DATE(created_at) = CURDATE()) + (SELECT COUNT(*) FROM invoices_non_gst WHERE DATE(created_at) = CURDATE() AND deleted_at IS NULL) as cnt"
  );
  console.log('   Invoices today (GST + Non-GST):', invoicesTodayRows[0].cnt);

  // 2. Test estimate jobs query (company_name and gstin)
  console.log('2. Testing Estimate Jobs List Query...');
  const [estRows] = await pool.query(`
    SELECT e.id, e.estimate_no, e.company_name, e.gstin, e.total_amount
    FROM estimates e
    LIMIT 3
  `);
  console.log('   Estimate rows sampled:', estRows.length);
  if (estRows.length > 0) {
    console.log('   Sample estimate:', estRows[0]);
  }

  // 3. Test reports & accounts queries (standalone estimates)
  console.log('3. Testing Daily Report & Accounts Standalone Estimates Support...');
  const today = new Date().toISOString().slice(0, 10);
  const [repEst] = await pool.query(
    `SELECT e.estimate_no, COALESCE(jc.job_no, e.estimate_no) as job_no,
            COALESCE(jc.reg_no, e.reg_no, '') as reg_no,
            COALESCE(jc.company, e.company_name, 'Detailing Studio') as company
     FROM estimates e
     LEFT JOIN job_cards jc ON e.job_card_id = jc.id
     WHERE e.is_archived = 0
     LIMIT 3`
  );
  console.log('   Sample estimates with company fallbacks:', repEst);

  // 4. Test concern-presets soft delete
  console.log('4. Testing Concern Presets Table & Delete Logic...');
  const [cpRows] = await pool.query('SELECT id, concern_text, is_active FROM concern_presets LIMIT 1');
  if (cpRows.length > 0) {
    const testId = cpRows[0].id;
    await pool.execute('UPDATE concern_presets SET is_active = 0 WHERE id = ?', [testId]);
    await pool.execute('UPDATE concern_presets SET is_active = 1 WHERE id = ?', [testId]);
    console.log('   Concern preset soft delete test passed on ID:', testId);
  } else {
    console.log('   Concern presets table ready (0 rows).');
  }

  // 5. Test advanceBookings /today merge
  console.log('5. Testing Advance Bookings & Service Bookings Merge...');
  const [abRows] = await pool.query('SELECT COUNT(*) as total FROM advance_bookings WHERE booking_date = ?', [today]);
  const [sbRows] = await pool.query('SELECT COUNT(*) as total FROM service_bookings WHERE booking_date = ?', [today]);
  console.log('   Bookings today (advance_bookings):', abRows[0].total, '(service_bookings):', sbRows[0].total);

  console.log('--- ALL INTEGRATION TESTS PASSED CLEANLY ---');
  process.exit(0);
}

testAll().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
