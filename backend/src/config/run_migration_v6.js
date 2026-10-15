const db = require('./db');

async function runMigrationV6() {
  console.log('Running HAPPY CAR WASH GMS V6.0 Migration (Adding package_name)...');
  try {
    const [colRows] = await db.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_NAME = 'job_card_services' 
        AND COLUMN_NAME = 'package_name'
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (colRows.length === 0) {
      await db.query(`
        ALTER TABLE job_card_services 
        ADD COLUMN package_name VARCHAR(255) NULL AFTER job_category
      `);
      console.log('✅ Column package_name created in job_card_services.');
    } else {
      console.log('â„¹¸ Column package_name already exists.');
    }

    console.log('Migration V6.0 completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('âŒ Migration V6.0 failed:', err.message);
    process.exit(1);
  }
}

runMigrationV6();

