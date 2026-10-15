const db = require('./db');

async function runMigrationV5() {
  console.log('Running HAPPY CAR WASH GMS V5.0 Migration...');
  try {
    // 1. Check if concern_id column exists
    const [colRows] = await db.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_NAME = 'job_card_services' 
        AND COLUMN_NAME = 'concern_id'
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (colRows.length === 0) {
      await db.query(`
        ALTER TABLE job_card_services 
        ADD COLUMN concern_id INT NULL AFTER job_card_id
      `);
      console.log('✅ Column concern_id created.');
    } else {
      await db.query(`
        ALTER TABLE job_card_services 
        MODIFY COLUMN concern_id INT NULL
      `);
      console.log('✅ Column concern_id modified to INT.');
    }

    // 2. Check if foreign key fk_jcs_concern exists
    const [fkRows] = await db.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE CONSTRAINT_NAME = 'fk_jcs_concern' 
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (fkRows.length === 0) {
      await db.query(`
        ALTER TABLE job_card_services 
        ADD CONSTRAINT fk_jcs_concern 
        FOREIGN KEY (concern_id) REFERENCES customer_concerns(id) 
        ON DELETE SET NULL
      `);
      console.log('✅ Foreign key fk_jcs_concern created.');
    } else {
      console.log('â„¹¸ Foreign key fk_jcs_concern already exists.');
    }

    console.log('Migration V5.0 completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('âŒ Migration V5.0 failed:', err.message);
    process.exit(1);
  }
}

runMigrationV5();

