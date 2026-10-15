const db = require('../src/config/db');

async function fix() {
  console.log('Fixing DB columns and schema...');
  try {
    // 1. Alter product_sales payment_mode to VARCHAR(50) so any payment mode is accepted without enum errors
    await db.query("ALTER TABLE product_sales MODIFY COLUMN payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash'");
    console.log('product_sales.payment_mode altered to VARCHAR(50).');

    // 2. Ensure customer_name, customer_mobile, customer_address, qty, tax_pct, tax_amount exist and are nullable
    await db.query("ALTER TABLE product_sales MODIFY COLUMN customer_name VARCHAR(255) NULL");
    await db.query("ALTER TABLE product_sales MODIFY COLUMN customer_mobile VARCHAR(50) NULL");
    await db.query("ALTER TABLE product_sales MODIFY COLUMN customer_address TEXT NULL");
    console.log('product_sales customer columns updated.');

    // 3. Ensure car_name and vehicle_no columns exist on product_sales
    try { await db.query("ALTER TABLE product_sales ADD COLUMN car_name VARCHAR(150) NULL"); } catch {}
    try { await db.query("ALTER TABLE product_sales ADD COLUMN vehicle_no VARCHAR(50) NULL"); } catch {}
    console.log('product_sales car_name and vehicle_no columns ensured.');

    // 4. Ensure quick_services has Deluxe Wash and Teflon Coating under Car Wash
    try {
      await db.query("INSERT INTO quick_services (service_name, default_rate, sort_order, is_active) SELECT 'Deluxe Wash', 0.00, 1, 1 WHERE NOT EXISTS (SELECT 1 FROM quick_services WHERE service_name = 'Deluxe Wash')");
      await db.query("INSERT INTO quick_services (service_name, default_rate, sort_order, is_active) SELECT 'Teflon Coating', 0.00, 2, 1 WHERE NOT EXISTS (SELECT 1 FROM quick_services WHERE service_name = 'Teflon Coating')");
      await db.query("UPDATE service_catalog SET category = 'wash' WHERE name LIKE '%teflon%' OR name LIKE '%delux%' OR name LIKE '%dlx%'");
      console.log('quick_services Deluxe Wash & Teflon Coating ensured.');
    } catch {}

    // 4b. Ensure all existing/imported job_cards and cash_ledger records for Deluxe Wash (Delux/Deluxe/Dlx) and Teflon Coating are Car Wash
    try {
      const [washFix] = await db.query(`
        UPDATE job_cards
        SET company = 'Car Wash', is_quick_job = 1, job_category = 'wash'
        WHERE LOWER(service_type) REGEXP 'delux|dlx|teflon|taflon'
           OR id IN (
             SELECT DISTINCT job_card_id FROM job_card_services
             WHERE LOWER(service_name) REGEXP 'delux|dlx|teflon|taflon'
           )
      `);
      console.log(`Updated ${washFix.affectedRows} Deluxe Wash & Teflon Coating job cards to Car Wash.`);

      await db.query(`
        UPDATE cash_ledger cl
        JOIN job_cards jc ON (cl.description LIKE CONCAT('%', jc.job_no, '%'))
        SET cl.company = 'Car Wash'
        WHERE LOWER(jc.service_type) REGEXP 'delux|dlx|teflon|taflon'
           OR jc.id IN (
             SELECT DISTINCT job_card_id FROM job_card_services
             WHERE LOWER(service_name) REGEXP 'delux|dlx|teflon|taflon'
           )
      `);
      await db.query("UPDATE cash_ledger SET company = 'Car Wash' WHERE LOWER(description) REGEXP 'delux|dlx|teflon|taflon'");
      console.log('Synced cash_ledger for Deluxe Wash & Teflon Coating to Car Wash.');
    } catch (e) {
      console.warn('Note updating Deluxe Wash/Teflon in fixDbIssues:', e.message);
    }

    // 5. Check if any product_sales rows have invalid or null invoice_no and fix them
    const [rows] = await db.query("SELECT id, invoice_no FROM product_sales WHERE invoice_no IS NULL OR invoice_no = ''");
    for (const r of rows) {
      const invNo = `ACC-${String(r.id).padStart(4, '0')}`;
      await db.query("UPDATE product_sales SET invoice_no = ? WHERE id = ?", [invNo, r.id]);
    // 6. Ensure job_cards and customers columns are non-mandatory
    try {
      await db.query("ALTER TABLE job_cards MODIFY COLUMN reg_no VARCHAR(20) NULL DEFAULT ''");
      await db.query("ALTER TABLE job_cards MODIFY COLUMN car_name VARCHAR(100) NULL DEFAULT ''");
      await db.query("ALTER TABLE job_cards MODIFY COLUMN owner_name VARCHAR(150) NULL DEFAULT 'Customer'");
      await db.query("ALTER TABLE job_cards MODIFY COLUMN mobile_no VARCHAR(20) NULL DEFAULT ''");
      await db.query("ALTER TABLE customers MODIFY COLUMN customer_name VARCHAR(200) NULL DEFAULT 'Customer'");
      await db.query("ALTER TABLE customers MODIFY COLUMN mobile_no VARCHAR(20) NULL DEFAULT NULL");
      console.log('job_cards & customers non-mandatory columns ensured.');
    } catch (e) {
      console.warn('Note setting non-mandatory columns in fixDbIssues:', e.message);
    }

    console.log('DB fixes completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Note during DB fixes:', err.message || err);
    process.exit(0);
  }
}

fix();
