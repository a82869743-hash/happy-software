const pool = require('../src/config/db');

async function verify() {
  console.log('--- DATABASE VERIFICATION ---');

  const [jcCount] = await pool.query('SELECT COUNT(*) as count FROM job_cards');
  const [invCount] = await pool.query('SELECT COUNT(*) as count FROM invoices');
  const [jcsCount] = await pool.query('SELECT COUNT(*) as count FROM job_card_services');
  const [cpCount] = await pool.query('SELECT COUNT(*) as count FROM customer_payments');
  const [psCount] = await pool.query('SELECT COUNT(*) as count FROM product_sales');
  const [custCount] = await pool.query('SELECT COUNT(*) as count FROM customers');
  const [vehCount] = await pool.query('SELECT COUNT(*) as count FROM vehicles');
  const [clCount] = await pool.query('SELECT COUNT(*) as count FROM cash_ledger WHERE category IN ("Customer Payment", "Product Sale")');

  console.log({
    job_cards: jcCount[0].count,
    invoices: invCount[0].count,
    job_card_services: jcsCount[0].count,
    customer_payments: cpCount[0].count,
    product_sales: psCount[0].count,
    customers: custCount[0].count,
    vehicles: vehCount[0].count,
    cash_ledger_entries: clCount[0].count
  });

  // Verify company breakdown
  const [companyBreakdown] = await pool.query(`
    SELECT company, COUNT(*) as jobs, SUM(final_amount) as total_revenue
    FROM job_cards
    GROUP BY company
  `);
  console.log('\n--- COMPANY BREAKDOWN ---');
  console.table(companyBreakdown);

  // Verify payment status breakdown
  const [paymentBreakdown] = await pool.query(`
    SELECT payment_mode, invoice_status, COUNT(*) as count, SUM(final_amount) as amount
    FROM job_cards
    GROUP BY payment_mode, invoice_status
  `);
  console.log('\n--- PAYMENT BREAKDOWN ---');
  console.table(paymentBreakdown);

  // Check sample first 3 jobs
  const [first3] = await pool.query(`
    SELECT jc.id, jc.job_no, inv.invoice_no, jc.job_date, jc.owner_name, jc.mobile_no, jc.reg_no, jc.car_name, jc.company, jc.service_type, jc.final_amount, jc.payment_mode, jc.public_token
    FROM job_cards jc
    JOIN invoices inv ON inv.job_card_id = jc.id
    ORDER BY jc.id ASC LIMIT 3
  `);
  console.log('\n--- FIRST 3 JOB CARDS & INVOICES ---');
  console.table(first3);

  // Check sample last 3 jobs
  const [last3] = await pool.query(`
    SELECT jc.id, jc.job_no, inv.invoice_no, jc.job_date, jc.owner_name, jc.mobile_no, jc.reg_no, jc.car_name, jc.company, jc.service_type, jc.final_amount, jc.payment_mode, jc.public_token
    FROM job_cards jc
    JOIN invoices inv ON inv.job_card_id = jc.id
    ORDER BY jc.id DESC LIMIT 3
  `);
  console.log('\n--- LAST 3 JOB CARDS & INVOICES ---');
  console.table(last3);

  // Check accessories
  const [accs] = await pool.query('SELECT * FROM product_sales');
  console.log('\n--- ACCESSORIES SALES & INVOICES ---');
  console.table(accs);

  // Check Outstanding payments calculation
  const [outstanding] = await pool.query(`
    SELECT COUNT(*) as count, SUM(inv.total_amount) as total_outstanding
    FROM job_cards jc
    JOIN invoices inv ON inv.job_card_id = jc.id
    LEFT JOIN (SELECT job_card_id, SUM(amount) as paid FROM customer_payments GROUP BY job_card_id) cp ON cp.job_card_id = jc.id
    WHERE (inv.total_amount - COALESCE(cp.paid, 0)) > 0
  `);
  console.log('\n--- OUTSTANDING (PENDING) STATS ---');
  console.table(outstanding);

  process.exit(0);
}

verify().catch(console.error);
