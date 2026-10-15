/**
 * Migration Runner for Estimate V2
 * Run: node run_migration_v2.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '1234',
    database: process.env.DB_NAME || 'happy_gms',
    multipleStatements: true
  });

  const steps = [
    // 1. Add columns to estimates (each separately to handle "already exists")
    { name: 'Add estimate_type', sql: "ALTER TABLE estimates ADD COLUMN estimate_type ENUM('gst_estimate','non_gst_estimate') NOT NULL DEFAULT 'non_gst_estimate' AFTER payment_mode" },
    { name: 'Add gst_percentage', sql: "ALTER TABLE estimates ADD COLUMN gst_percentage DECIMAL(5,2) DEFAULT 0 AFTER estimate_type" },
    { name: 'Add gst_amount', sql: "ALTER TABLE estimates ADD COLUMN gst_amount DECIMAL(10,2) DEFAULT 0 AFTER gst_percentage" },
    { name: 'Add total_amount', sql: "ALTER TABLE estimates ADD COLUMN total_amount DECIMAL(10,2) DEFAULT 0 AFTER gst_amount" },
    { name: 'Add is_archived', sql: "ALTER TABLE estimates ADD COLUMN is_archived TINYINT(1) DEFAULT 0 AFTER total_amount" },
    { name: 'Add archived_at', sql: "ALTER TABLE estimates ADD COLUMN archived_at DATETIME NULL AFTER is_archived" },
    { name: 'Add archived_by', sql: "ALTER TABLE estimates ADD COLUMN archived_by INT NULL AFTER archived_at" },
    { name: 'Add customer_name', sql: "ALTER TABLE estimates ADD COLUMN customer_name VARCHAR(100) NULL AFTER archived_by" },
    { name: 'Add mobile_no', sql: "ALTER TABLE estimates ADD COLUMN mobile_no VARCHAR(20) NULL AFTER customer_name" },
    { name: 'Add reg_no', sql: "ALTER TABLE estimates ADD COLUMN reg_no VARCHAR(20) NULL AFTER mobile_no" },
    { name: 'Add car_name', sql: "ALTER TABLE estimates ADD COLUMN car_name VARCHAR(100) NULL AFTER reg_no" },
    { name: 'Add vehicle_make', sql: "ALTER TABLE estimates ADD COLUMN vehicle_make VARCHAR(50) NULL AFTER car_name" },
    { name: 'Add vehicle_model', sql: "ALTER TABLE estimates ADD COLUMN vehicle_model VARCHAR(50) NULL AFTER vehicle_make" },
    { name: 'Add notes', sql: "ALTER TABLE estimates ADD COLUMN notes TEXT NULL AFTER vehicle_model" },
    { name: 'Add created_by', sql: "ALTER TABLE estimates ADD COLUMN created_by INT NULL AFTER notes" },
    // 2. Make job_card_id nullable
    { name: 'Make job_card_id nullable', sql: "ALTER TABLE estimates MODIFY job_card_id INT NULL" },
    // 3. Drop unique constraint on job_card_id (if exists)
    { name: 'Drop job_card_id unique', sql: "ALTER TABLE estimates DROP INDEX job_card_id" },
    // 4. Create estimate_services
    { name: 'Create estimate_services', sql: `CREATE TABLE IF NOT EXISTS estimate_services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      estimate_id INT NOT NULL,
      service_name VARCHAR(200) NOT NULL,
      item_type ENUM('labour','part','consumable','external') DEFAULT 'labour',
      part_code VARCHAR(30) NULL,
      qty INT DEFAULT 1,
      rate DECIMAL(10,2) DEFAULT 0,
      amount DECIMAL(10,2) DEFAULT 0,
      hsn_sac VARCHAR(20) NULL,
      FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE
    )` },
    // 5. Create estimate_job_mapping
    { name: 'Create estimate_job_mapping', sql: `CREATE TABLE IF NOT EXISTS estimate_job_mapping (
      id INT AUTO_INCREMENT PRIMARY KEY,
      estimate_id INT NOT NULL,
      job_card_id INT NOT NULL,
      converted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      converted_by INT NULL,
      FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
      FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
    )` },
    // 6. Create estimate_history_vault
    { name: 'Create estimate_history_vault', sql: `CREATE TABLE IF NOT EXISTS estimate_history_vault (
      id INT AUTO_INCREMENT PRIMARY KEY,
      estimate_id INT NOT NULL,
      estimate_no VARCHAR(30) NOT NULL,
      estimate_type ENUM('gst_estimate','non_gst_estimate') NOT NULL,
      customer_name VARCHAR(100) NULL,
      mobile_no VARCHAR(20) NULL,
      reg_no VARCHAR(20) NULL,
      car_name VARCHAR(100) NULL,
      vehicle_make VARCHAR(50) NULL,
      vehicle_model VARCHAR(50) NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      gst_percentage DECIMAL(5,2) DEFAULT 0,
      gst_amount DECIMAL(10,2) DEFAULT 0,
      total_amount DECIMAL(10,2) DEFAULT 0,
      payment_mode VARCHAR(20) NULL,
      services_json JSON NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL,
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      vault_action ENUM('archived','created','converted') DEFAULT 'archived'
    )` },
    // 7. Create estimate_audit_log
    { name: 'Create estimate_audit_log', sql: `CREATE TABLE IF NOT EXISTS estimate_audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      estimate_id INT NOT NULL,
      action ENUM('created','edited','converted','archived','restored','bulk_archived') NOT NULL,
      user_id INT NULL,
      user_name VARCHAR(100) NULL,
      details TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )` },
    // 8. Indexes
    { name: 'Index audit estimate', sql: "CREATE INDEX idx_estimate_audit_estimate ON estimate_audit_log(estimate_id)" },
    { name: 'Index audit action', sql: "CREATE INDEX idx_estimate_audit_action ON estimate_audit_log(action)" },
    { name: 'Index estimates archived', sql: "CREATE INDEX idx_estimates_archived ON estimates(is_archived)" },
    { name: 'Index estimates type', sql: "CREATE INDEX idx_estimates_type ON estimates(estimate_type)" },
  ];

  console.log('ðŸš€ Running Estimate V2 Migration...\n');

  for (const step of steps) {
    try {
      await conn.execute(step.sql);
      console.log(`  âœ… ${step.name}`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME' || err.message.includes('Duplicate') || err.message.includes('already exists') || err.message.includes("Can't DROP")) {
        console.log(`  â­ï¸  ${step.name} (already exists, skipped)`);
      } else {
        console.log(`  âŒ ${step.name}: ${err.message}`);
      }
    }
  }

  // Verify
  const [cols] = await conn.query("SHOW COLUMNS FROM estimates");
  console.log(`\nðŸ“Š estimates table now has ${cols.length} columns:`);
  cols.forEach(c => console.log(`   - ${c.Field} (${c.Type})`));

  const [tables] = await conn.query("SHOW TABLES LIKE 'estimate_%'");
  console.log(`\nðŸ“‹ Estimate tables: ${tables.map(t => Object.values(t)[0]).join(', ')}`);

  console.log('\nâœ… Migration complete!');
  await conn.end();
}

run().catch(err => { console.error('ðŸ’¥ Fatal:', err.message); process.exit(1); });

