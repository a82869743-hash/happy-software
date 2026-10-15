const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

// Test connection on startup and run migration if needed
pool.getConnection()
  .then(async conn => {
    console.log('MySQL connected to', process.env.DB_NAME);
    try {
      const [columns] = await conn.query("SHOW COLUMNS FROM staff LIKE 'admin_user_id'");
      if (columns.length === 0) {
        console.log('Migrating database: Adding admin_user_id to staff table...');
        await conn.query("ALTER TABLE staff ADD COLUMN admin_user_id INT NULL");
        await conn.query("ALTER TABLE staff ADD CONSTRAINT fk_staff_admin_user FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL");
        console.log('Database migration complete.');
      }

      await conn.query(`
        CREATE TABLE IF NOT EXISTS staff_ledger (
          id INT AUTO_INCREMENT PRIMARY KEY,
          staff_id INT NULL,
          staff_name VARCHAR(150) NOT NULL,
          entry_date DATE NOT NULL,
          veh_no VARCHAR(50) NULL,
          description VARCHAR(255) NOT NULL,
          credit_amount DECIMAL(10,2) DEFAULT 0.00,
          debit_amount DECIMAL(10,2) DEFAULT 0.00,
          is_cash_ledger_synced TINYINT(1) DEFAULT 0,
          cash_ledger_id INT NULL,
          job_card_id INT NULL,
          estimate_id INT NULL,
          payment_id INT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_staff_id (staff_id),
          KEY idx_staff_name (staff_name),
          KEY idx_entry_date (entry_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Fix existing 00:00:00 timestamps in cash_ledger
      try {
        await conn.query("UPDATE cash_ledger SET entry_date = CONCAT(DATE(entry_date), ' ', TIME(created_at)) WHERE TIME(entry_date) = '00:00:00' AND created_at IS NOT NULL");
        await conn.query("UPDATE cash_ledger SET entry_date = NOW() WHERE TIME(entry_date) = '00:00:00'");
      } catch { /* ignore if column missing */ }

      // Ensure necessary division and bill snapshot columns exist
      try { await conn.query("ALTER TABLE job_cards ADD COLUMN company VARCHAR(100) DEFAULT 'Detailing Studio'"); } catch {}
      try { await conn.query("ALTER TABLE job_cards ADD COLUMN service_type VARCHAR(255) NULL"); } catch {}
      try { await conn.query("ALTER TABLE cash_ledger ADD COLUMN company VARCHAR(100) DEFAULT 'Detailing Studio'"); } catch {}
      try { await conn.query("ALTER TABLE job_card_services ADD COLUMN is_selected TINYINT(1) DEFAULT 1"); } catch {}
      try { await conn.query("ALTER TABLE product_sales ADD COLUMN company VARCHAR(100) DEFAULT 'Accessories'"); } catch {}
      try { await conn.query("ALTER TABLE product_sales ADD COLUMN items LONGTEXT NULL"); } catch {}
      try { await conn.query("ALTER TABLE product_sales ADD COLUMN car_name VARCHAR(150) NULL"); } catch {}
      try { await conn.query("ALTER TABLE product_sales ADD COLUMN vehicle_no VARCHAR(50) NULL"); } catch {}

      // Seed Teflon Coating & Deluxe Wash under Car Wash quick_services and service_catalog
      try {
        const [qExisting] = await conn.query("SELECT service_name FROM quick_services WHERE LOWER(service_name) IN ('deluxe wash', 'teflon coating')");
        const existingNames = (qExisting || []).map(r => (r.service_name || '').toLowerCase());
        if (!existingNames.includes('deluxe wash')) {
          await conn.query("INSERT INTO quick_services (service_name, default_rate, sort_order, is_active) VALUES ('Deluxe Wash', 0, 1, 1)");
        }
        if (!existingNames.includes('teflon coating')) {
          await conn.query("INSERT INTO quick_services (service_name, default_rate, sort_order, is_active) VALUES ('Teflon Coating', 0, 2, 1)");
        }
      } catch {}

      try {
        await conn.query("UPDATE service_catalog SET category = 'wash' WHERE name LIKE '%teflon%' OR name LIKE '%delux%' OR name LIKE '%dlx%'");
      } catch {}

      // Auto-heal all Deluxe Wash (Delux/Deluxe/Dlx) & Teflon Coating records in job_cards and cash_ledger to Car Wash
      try {
        await conn.query(`
          UPDATE job_cards
          SET company = 'Car Wash', is_quick_job = 1, job_category = 'wash'
          WHERE (
            LOWER(service_type) REGEXP 'delux|dlx|teflon|taflon'
            OR id IN (
              SELECT DISTINCT job_card_id FROM job_card_services
              WHERE LOWER(service_name) REGEXP 'delux|dlx|teflon|taflon'
            )
          )
          AND (company != 'Car Wash' OR is_quick_job != 1 OR job_category != 'wash')
        `);

        await conn.query(`
          UPDATE cash_ledger cl
          JOIN job_cards jc ON (cl.description LIKE CONCAT('%', jc.job_no, '%'))
          SET cl.company = 'Car Wash'
          WHERE (
            LOWER(jc.service_type) REGEXP 'delux|dlx|teflon|taflon'
            OR jc.id IN (
              SELECT DISTINCT job_card_id FROM job_card_services
              WHERE LOWER(service_name) REGEXP 'delux|dlx|teflon|taflon'
            )
          )
          AND (cl.company != 'Car Wash' OR cl.company IS NULL)
        `);
        await conn.query("UPDATE cash_ledger SET company = 'Car Wash' WHERE LOWER(description) REGEXP 'delux|dlx|teflon|taflon'");
      } catch (e) {
        console.warn('Startup auto-heal Teflon/Deluxe note:', e.message);
      }

      // Auto-correct staff_ledger salary/UPAD entries from debit to credit
      try {
        await conn.query(
          "UPDATE staff_ledger SET credit_amount = debit_amount, debit_amount = 0.00 WHERE (payment_id IS NOT NULL OR description LIKE 'Payment - %' OR veh_no IN ('UPAD', 'SALARY')) AND debit_amount > 0 AND credit_amount = 0"
        );
      } catch { /* ignore */ }

      // Seed vehicle_master from cars_ds_final.csv dataset if needed
      try {
        const seedVehicleMaster = require('./seedVehicleMaster');
        await seedVehicleMaster();
      } catch (err) {
        console.error('Vehicle master seed error:', err.message);
      }
    } catch (err) {
      console.error('Database migration error:', err.message);
    }
    conn.release();
  })
  .catch(err => {
    console.error('MySQL connection error:', err.message);
  });

module.exports = pool;
