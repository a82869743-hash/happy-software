require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  console.log('Connected to database:', process.env.DB_NAME);

  // 1. Alter table invoices to add gst_type column
  try {
    await conn.execute("ALTER TABLE invoices ADD COLUMN gst_type ENUM('with_gst', 'without_gst') NOT NULL DEFAULT 'with_gst'");
    console.log('✓ Added gst_type column to invoices');
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME' || err.message.includes('Duplicate column') || err.message.includes('already exists')) {
      console.log('  ⊘ Column gst_type already exists, skipping');
    } else {
      throw err;
    }
  }

  // 2. Create invoices_non_gst
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS invoices_non_gst (
      id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
      job_card_id     INT NOT NULL UNIQUE,
      invoice_no      VARCHAR(50) NOT NULL UNIQUE,
      subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_mode    ENUM('cash','upi','card','bank') NOT NULL DEFAULT 'cash',
      customer_name   VARCHAR(200) NULL,
      mobile_no       VARCHAR(15) NULL,
      reg_no          VARCHAR(20) NULL,
      car_name        VARCHAR(200) NULL,
      created_by      INT NULL,
      created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at      TIMESTAMP NULL DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_nongst_job (job_card_id),
      KEY idx_nongst_date (created_at),
      KEY idx_nongst_deleted (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✓ Table invoices_non_gst verified/created');

  // 3. Create non_gst_kill_switch_log
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS non_gst_kill_switch_log (
      id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
      deleted_by      INT NULL,
      deleted_by_name VARCHAR(200) NULL,
      records_deleted INT NOT NULL DEFAULT 0,
      deleted_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ip_address      VARCHAR(45) NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✓ Table non_gst_kill_switch_log verified/created');

  console.log('✅ GST Module migration complete');
  await conn.end();
}

run().catch(e => { console.error('Migration failed:', e); process.exit(1); });
