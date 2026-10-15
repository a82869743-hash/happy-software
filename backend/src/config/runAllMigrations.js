const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runAllMigrations() {
  console.log('=======================================');
  console.log('  Running All HAPPY CAR WASH GMS Database Migrations');
  console.log('=======================================');

  const migrationFiles = [
    'migration_crm.sql',
    'migration_autorox.sql',
    'migration_billing.sql',
    'migration_quick_jobcard.sql',
    'migration_attendance_time.sql',
    'migration_v4_features.sql',
    'migration_job_category.sql',
    'migration_job_category_gst.sql',
    'migration_concern_presets.sql',
    'migration_v9_recommended_suggestions.sql',
    'migration_v10_crm_fixes.sql',
    'migration_v11_estimate_payments.sql',
    'migration_v12_payment_mode_length.sql',
    'migration_v13_enhancements.sql',
    'migration_v14_payment_status.sql',
    'migration_v16_non_mandatory_fields.sql'
  ];

  for (const file of migrationFiles) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      console.log(`\nSkipping ${file} (does not exist)`);
      continue;
    }

    console.log(`\nProcessing file: ${file}`);
    const sql = fs.readFileSync(filePath, 'utf8');

    // Split by semicolon and filter empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let success = 0;
    let skipped = 0;
    let errors = 0;

    for (const stmt of statements) {
      if (stmt.toLowerCase().startsWith('use ')) {
        continue;
      }
      // Skip if it is purely comments
      if (stmt.split('\n').every(line => line.trim().startsWith('--') || line.trim() === '')) {
        continue;
      }

      try {
        await db.query(stmt);
        success++;
      } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME' || 
            err.code === 'ER_TABLE_EXISTS_ERROR' ||
            err.code === 'ER_DUP_FIELDNAME' ||
            err.code === 'ER_DUP_KEYNAME' ||
            err.message.includes('Duplicate column') ||
            err.message.includes('already exists')) {
          skipped++;
        } else {
          errors++;
          console.error(`  âœ— Error in stmt [${stmt.slice(0, 50)}...]: ${err.message}`);
        }
      }
    }
    console.log(`  â””- Done: ${success} succeeded, ${skipped} skipped, ${errors} errors`);
  }

  console.log('\n=======================================');
  console.log('  All migrations processing completed!');
  console.log('=======================================');
  process.exit(0);
}

runAllMigrations().catch(err => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});

