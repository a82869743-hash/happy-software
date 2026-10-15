const db = require('./src/config/db');

/**
 * Fix missing columns that are causing:
 * - "Failed to create job card" (missing job_category*, is_deleted columns)
 * - "Failed to load recycle bin data" (missing is_deleted column)
 * - Missing 'unit' column in job_card_services
 */
async function fixMissingColumns() {
  const conn = await db.getConnection();
  try {
    console.log('ðŸ”§ Adding missing columns to job_cards table...\n');

    const alterations = [
      {
        col: 'is_deleted',
        sql: "ALTER TABLE job_cards ADD COLUMN is_deleted TINYINT(1) DEFAULT 0",
      },
      {
        col: 'job_category',
        sql: "ALTER TABLE job_cards ADD COLUMN job_category VARCHAR(255) NULL AFTER notes",
      },
      {
        col: 'job_category_desc',
        sql: "ALTER TABLE job_cards ADD COLUMN job_category_desc TEXT NULL AFTER job_category",
      },
      {
        col: 'job_category_amount',
        sql: "ALTER TABLE job_cards ADD COLUMN job_category_amount DECIMAL(10,2) NULL DEFAULT 0.00 AFTER job_category_desc",
      },
      {
        col: 'job_category_gst_pct',
        sql: "ALTER TABLE job_cards ADD COLUMN job_category_gst_pct DECIMAL(5,2) NULL DEFAULT 18.00 AFTER job_category_amount",
      },
    ];

    for (const alt of alterations) {
      // Check if column exists first
      const [exists] = await conn.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='happy_gms' AND TABLE_NAME='job_cards' AND COLUMN_NAME=?",
        [alt.col]
      );
      if (exists.length > 0) {
        console.log(`  âœ… job_cards.${alt.col} already exists - skipping`);
      } else {
        await conn.execute(alt.sql);
        console.log(`  âœ… Added job_cards.${alt.col}`);
      }
    }

    // Fix job_card_services - add 'unit' column
    console.log('\nðŸ”§ Checking job_card_services.unit column...');
    const [unitExists] = await conn.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='happy_gms' AND TABLE_NAME='job_card_services' AND COLUMN_NAME='unit'"
    );
    if (unitExists.length > 0) {
      console.log('  âœ… job_card_services.unit already exists - skipping');
    } else {
      await conn.execute("ALTER TABLE job_card_services ADD COLUMN unit VARCHAR(20) DEFAULT 'pc'");
      console.log('  âœ… Added job_card_services.unit');
    }

    // Ensure non_gst_kill_switch_log table exists (used by kill-switch endpoint)
    console.log('\nðŸ”§ Checking non_gst_kill_switch_log table...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS non_gst_kill_switch_log (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        deleted_by INT NULL,
        deleted_by_name VARCHAR(150) NULL,
        records_deleted INT DEFAULT 0,
        ip_address VARCHAR(50) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('  âœ… non_gst_kill_switch_log table ensured');

    conn.release();

    // Verify
    console.log('\nðŸ“‹ Verification:');
    const [finalCols] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='happy_gms' AND TABLE_NAME='job_cards' ORDER BY ORDINAL_POSITION"
    );
    const colNames = finalCols.map(r => r.COLUMN_NAME);
    const required = ['is_deleted', 'job_category', 'job_category_desc', 'job_category_amount', 'job_category_gst_pct'];
    for (const c of required) {
      console.log(`  ${colNames.includes(c) ? 'âœ…' : 'âŒ'} ${c}`);
    }

    const [svcCols] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='happy_gms' AND TABLE_NAME='job_card_services' AND COLUMN_NAME='unit'"
    );
    console.log(`  ${svcCols.length > 0 ? 'âœ…' : 'âŒ'} job_card_services.unit`);

    console.log('\nðŸŽ‰ All fixes applied successfully! Restart the backend server.');
    process.exit(0);
  } catch (err) {
    conn.release();
    console.error('âŒ Migration failed:', err.message);
    process.exit(1);
  }
}

fixMissingColumns();

