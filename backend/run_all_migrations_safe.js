const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

function splitSQL(sql) {
  // Remove block comments /* ... */
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');

  const statements = [];
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (inString) {
      current += ch;
      if (ch === stringChar && sql[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }

    if (ch === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      if (nl === -1) break;
      i = nl;
      continue;
    }

    if (ch === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
}

const migrationFiles = [
  { file: 'src/config/migration_crm.sql' },
  { file: 'src/config/migration_autorox.sql' },
  { file: 'src/config/migration_billing.sql' },
  { file: 'src/config/migration_quick_jobcard.sql' },
  { file: 'src/config/migration_attendance_time.sql' },
  { file: 'migration_v2.sql' },
  { file: 'migration_v3_features.sql' },
  { file: 'migration_v3_status_guard.sql' },
  { file: 'src/config/migration_v4_features.sql' },
  { file: 'src/config/migration_job_category.sql' },
  { file: 'src/config/migration_job_category_gst.sql' },
  { file: 'src/config/migration_concern_presets.sql' },
  { file: 'src/config/migration_v5_changes.sql' },
  { file: 'src/config/migration_v7_changes.sql' },
  { file: 'src/config/migration_v8_suggestions.sql' },
  { file: 'src/config/migration_v8_unique_jobno.sql' },
  { file: 'src/config/migration_v9_recommended_suggestions.sql' },
  { file: 'src/config/migration_v10_crm_fixes.sql' },
  { file: 'src/config/migration_sms_module.sql' },
  { file: 'src/config/migration_service_reminders.sql' },
  { file: 'migration_new_fields.sql' },
  { file: 'migration_gst_module.sql' },
  { file: 'migration_estimate_v2.sql' },
  { file: 'migration_fix_services_endpoint.sql' },
  { file: 'migration_product_sales.sql' },
  { file: 'src/config/migration_vehicle_master.sql' },
  { file: 'src/config/seed_service_catalog.sql' },
  { file: 'src/config/migration_v15_suggestions_index.sql' }
];

const ignoredErrors = [
  'ER_DUP_FIELDNAME',
  'ER_DUP_KEYNAME',
  'ER_TABLE_EXISTS_ERROR',
  'ER_DUP_ENTRY',
  'ER_CANT_DROP_FIELD_OR_KEY',
  'ER_DUP_COLUMN_NAME',
  'ER_MULTIPLE_PRI_KEY',
  'ER_NO_SUCH_TABLE'
];

async function run() {
  console.log('=”============================================—');
  console.log('=‘   HAPPY CAR WASH GMS - SAFE DATABASE MIGRATOR      =‘');
  console.log('=š============================================\n');

  let successTotal = 0;
  let skippedTotal = 0;
  let errorsTotal = 0;

  for (const item of migrationFiles) {
    const filePath = path.join(__dirname, item.file);
    if (!fs.existsSync(filePath)) {
      console.log(`âš ï¸  Skipping file (not found): ${item.file}`);
      continue;
    }

    console.log(`\nðŸ“‚ Processing: ${item.file}`);
    const sql = fs.readFileSync(filePath, 'utf-8');
    const statements = splitSQL(sql);
    console.log(`   Found ${statements.length} statements.`);

    for (let idx = 0; idx < statements.length; idx++) {
      let stmt = statements[idx];

      // Fix ALTER TABLE syntax by removing IF NOT EXISTS for column alterations
      if (stmt.toLowerCase().startsWith('alter table')) {
        stmt = stmt
          .replace(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+/gi, 'ADD COLUMN ')
          .replace(/ADD\s+IF\s+NOT\s+EXISTS\s+/gi, 'ADD ')
          .replace(/MODIFY\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+/gi, 'MODIFY COLUMN ')
          .replace(/MODIFY\s+IF\s+NOT\s+EXISTS\s+/gi, 'MODIFY ')
          .replace(/DROP\s+COLUMN\s+IF\s+EXISTS\s+/gi, 'DROP COLUMN ')
          .replace(/DROP\s+IF\s+EXISTS\s+/gi, 'DROP ');
      }

      const preview = stmt.split('\n')[0].slice(0, 80);
      try {
        await pool.query(stmt);
        successTotal++;
      } catch (err) {
        if (ignoredErrors.includes(err.code) || err.message.includes('already exists') || err.message.includes('Duplicate')) {
          skippedTotal++;
        } else {
          console.error(`   âŒ Error on statement [${idx + 1}/${statements.length}]: ${preview}...`);
          console.error(`      Code: ${err.code}`);
          console.error(`      Error: ${err.message}`);
          errorsTotal++;
        }
      }
    }
  }

  // Run custom V5 and V6 alterations manually to be completely sure
  console.log('\nðŸ”§ Running custom constraints and manual column alterations...');
  const conn = await pool.getConnection();

  // V5: Add FK constraint
  try {
    const [fkRows] = await conn.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE CONSTRAINT_NAME = 'fk_jcs_concern' 
        AND TABLE_SCHEMA = DATABASE()
    `);
    if (fkRows.length === 0) {
      await conn.query(`
        ALTER TABLE job_card_services 
        ADD CONSTRAINT fk_jcs_concern 
        FOREIGN KEY (concern_id) REFERENCES customer_concerns(id) 
        ON DELETE SET NULL
      `);
      console.log('   âœ… Foreign key fk_jcs_concern created.');
      successTotal++;
    } else {
      console.log('   â„¹ï¸ Foreign key fk_jcs_concern already exists.');
      skippedTotal++;
    }
  } catch (err) {
    if (err.message.includes('already exists') || err.code === 'ER_DUP_KEYNAME') {
      skippedTotal++;
    } else {
      console.error('   âŒ Failed to create fk_jcs_concern constraint:', err.message);
      errorsTotal++;
    }
  }

  // V6: Add package_name to job_card_services
  try {
    const [colRows] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_NAME = 'job_card_services' 
        AND COLUMN_NAME = 'package_name'
        AND TABLE_SCHEMA = DATABASE()
    `);
    if (colRows.length === 0) {
      await conn.query(`
        ALTER TABLE job_card_services 
        ADD COLUMN package_name VARCHAR(255) NULL AFTER job_category
      `);
      console.log('   âœ… Column package_name created in job_card_services.');
      successTotal++;
    } else {
      console.log('   â„¹ï¸ Column package_name already exists.');
      skippedTotal++;
    }
  } catch (err) {
    console.error('   âŒ Failed to add package_name column:', err.message);
    errorsTotal++;
  }

  conn.release();

  console.log(`\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€`);
  console.log(`ðŸ“Š Total Successes: ${successTotal} | Skipped/Existing: ${skippedTotal} | Errors: ${errorsTotal}`);
  console.log(`â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n`);

  await pool.end();
  process.exit(errorsTotal > 0 ? 1 : 0);
}

run().catch(async err => {
  console.error('Fatal execution error:', err);
  await pool.end();
  process.exit(1);
});

