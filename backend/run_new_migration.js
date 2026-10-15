/**
 * Improving fields migration runner
 * node run_new_migration.js
 */
const fs = require('fs');
const path = require('path');
const db = require('./src/config/db');

function splitSQL(sql) {
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

async function run() {
  console.log('Applying new columns (spare_wheel, pointers, hsn_sac)...');
  const sqlPath = path.join(__dirname, 'migration_new_fields.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ migration_new_fields.sql not found!');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');
  const statements = splitSQL(sql);

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (let idx = 0; idx < statements.length; idx++) {
    const stmt = statements[idx];
    try {
      await db.query(stmt);
      console.log(`✅ ${stmt.slice(0, 60)}...`);
      success++;
    } catch (err) {
      const safe = [
        'ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_TABLE_EXISTS_ERROR',
        'ER_DUP_ENTRY', 'ER_CANT_DROP_FIELD_OR_KEY', 'ER_DUP_COLUMN_NAME'
      ];
      if (safe.includes(err.code) || err.message.includes('Multiple primary key') || err.message.includes('already exists')) {
        console.log(`⏭️  ${stmt.slice(0, 60)}... (already applied/safe)`);
        skipped++;
      } else {
        console.error(`❌ Error executing: ${stmt}`);
        console.error(err);
        errors++;
      }
    }
  }

  console.log(`\nMigration completed: ${success} applied, ${skipped} skipped, ${errors} errors.`);
  process.exit(errors > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
