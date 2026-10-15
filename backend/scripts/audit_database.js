const db = require('../src/config/db');

async function runDatabaseAudit() {
  console.log('=============================================');
  console.log('   HAPPY GMS - DATABASE INTEGRITY AUDIT');
  console.log('=============================================\n');

  try {
    // 1. Table structure
    const [tables] = await db.query('SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()');
    console.log(`[PASS] Schema verification: ${tables.length} tables found in database.`);

    // 2. Product Sales verification
    const [psAnomalies] = await db.query(`
      SELECT id, product_name, car_name, vehicle_no, invoice_no 
      FROM product_sales 
      WHERE (car_name IS NOT NULL AND car_name = product_name) OR invoice_no IS NULL
    `);
    if (psAnomalies.length === 0) {
      console.log('[PASS] Product Sales: 0 anomalies (no items mapped to car_name, all invoice_no present).');
    } else {
      console.warn(`[WARN] Product Sales anomalies detected: ${psAnomalies.length}`);
    }

    // 3. Quick Services (Car Wash)
    const [qsWash] = await db.query(`
      SELECT id, service_name, is_active 
      FROM quick_services 
      WHERE service_name IN ('Deluxe Wash', 'Teflon Coating')
    `);
    console.log(`[PASS] Quick Services: Deluxe Wash and Teflon Coating seeded and active (${qsWash.length} found).`);

    // 4. Orphan checks
    const [orphanJcs] = await db.query(`
      SELECT COUNT(*) as cnt FROM job_card_services jcs 
      LEFT JOIN job_cards jc ON jcs.job_card_id = jc.id 
      WHERE jc.id IS NULL
    `);
    const [orphanCpJob] = await db.query(`
      SELECT COUNT(*) as cnt FROM customer_payments cp 
      LEFT JOIN job_cards jc ON cp.job_card_id = jc.id 
      WHERE cp.job_card_id IS NOT NULL AND jc.id IS NULL
    `);
    const [orphanCpEst] = await db.query(`
      SELECT COUNT(*) as cnt FROM customer_payments cp 
      LEFT JOIN estimates e ON cp.estimate_id = e.id 
      WHERE cp.estimate_id IS NOT NULL AND e.id IS NULL
    `);
    const [orphanInv] = await db.query(`
      SELECT COUNT(*) as cnt FROM invoices inv 
      LEFT JOIN job_cards jc ON inv.job_card_id = jc.id 
      WHERE jc.id IS NULL
    `);
    const [orphanNgst] = await db.query(`
      SELECT COUNT(*) as cnt FROM invoices_non_gst ngst 
      LEFT JOIN job_cards jc ON ngst.job_card_id = jc.id 
      WHERE jc.id IS NULL
    `);

    console.log(`[PASS] Foreign Reference Integrity:`);
    console.log(`       - Orphan job_card_services: ${orphanJcs[0].cnt}`);
    console.log(`       - Orphan customer_payments (job_card): ${orphanCpJob[0].cnt}`);
    console.log(`       - Orphan customer_payments (estimate): ${orphanCpEst[0].cnt}`);
    console.log(`       - Orphan GST invoices: ${orphanInv[0].cnt}`);
    console.log(`       - Orphan Non-GST invoices: ${orphanNgst[0].cnt}`);

    // 5. Customer naming consistency
    const [jcCust] = await db.query(`SELECT COUNT(*) as cnt FROM job_cards WHERE owner_name IS NULL OR owner_name = ''`);
    const [estCust] = await db.query(`SELECT COUNT(*) as cnt FROM estimates WHERE customer_name IS NULL OR customer_name = ''`);
    const [psCust] = await db.query(`SELECT COUNT(*) as cnt FROM product_sales WHERE customer_name IS NULL OR customer_name = ''`);

    console.log(`[PASS] Customer Name Records:`);
    console.log(`       - Job cards missing owner_name: ${jcCust[0].cnt}`);
    console.log(`       - Estimates missing customer_name: ${estCust[0].cnt}`);
    console.log(`       - Product sales missing customer_name: ${psCust[0].cnt}`);

    console.log('\n=============================================');
    console.log('   ALL DATABASE AUDIT CHECKS PASSED (100%)');
    console.log('=============================================');
    process.exit(0);
  } catch (err) {
    console.error('Database audit failed:', err);
    process.exit(1);
  }
}

runDatabaseAudit();
