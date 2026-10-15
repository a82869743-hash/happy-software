const db = require('./src/config/db');

async function migrate() {
  console.log('Starting crm v4 migrations...');
  
  const queries = [
    // 1. Add fuel_level to job_cards
    `ALTER TABLE job_cards ADD COLUMN fuel_level VARCHAR(20) DEFAULT NULL`,
    // 2. Add is_completed to customer_concerns
    `ALTER TABLE customer_concerns ADD COLUMN is_completed TINYINT(1) DEFAULT 0`,
    // 3. Add fields to bill_dispatch_log if they are missing
    `ALTER TABLE bill_dispatch_log ADD COLUMN provider_ref VARCHAR(100) DEFAULT NULL`,
    `ALTER TABLE bill_dispatch_log ADD COLUMN error_message TEXT DEFAULT NULL`,
    `ALTER TABLE bill_dispatch_log ADD COLUMN dispatched_by INT DEFAULT NULL`
  ];

  for (const q of queries) {
    try {
      await db.query(q);
      console.log(`Executed: ${q}`);
    } catch (err) {
      if (err.code === 'ER_DUP_COLUMN_NAME') {
        console.log(`Skipped: Column already exists for query -> ${q}`);
      } else {
        console.error(`Error executing query: ${q}. Error: ${err.message}`);
      }
    }
  }

  console.log('Migration finished!');
  process.exit(0);
}

migrate();
