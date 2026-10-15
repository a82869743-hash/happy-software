const db = require('./db');

async function runMigrationV7() {
  console.log('Running HAPPY CAR WASH GMS V7.0 Migration (Adding old_part)...');
  try {
    const [colRows] = await db.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_NAME = 'job_card_services' 
        AND COLUMN_NAME = 'old_part'
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (colRows.length === 0) {
      await db.query(`
        ALTER TABLE job_card_services 
        ADD COLUMN old_part TINYINT(1) DEFAULT 0
      `);
      console.log('✅ Column old_part created in job_card_services.');
    } else {
      console.log('â„¹¸ Column old_part already exists.');
    }

    console.log('Migration V7.0 completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('âŒ Migration V7.0 failed:', err.message);
    process.exit(1);
  }
}

runMigrationV7();

