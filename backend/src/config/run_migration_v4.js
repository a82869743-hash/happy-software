/**
 * HAPPY CAR WASH GMS V4.0 — Migration Runner
 * Runs migration_v4_features.sql against the database
 * 
 * Usage: node backend/src/config/run_migration_v4.js
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runMigration() {
  console.log('=======================================');
  console.log('  HAPPY CAR WASH GMS V4.0 — Running Migration');
  console.log('=======================================');

  const sqlPath = path.join(__dirname, 'migration_v4_features.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

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
      // Extract a short description from the statement
      const firstLine = stmt.split('\n').find(l => l.trim() && !l.trim().startsWith('--'));
      const desc = firstLine ? firstLine.trim().slice(0, 60) : 'Unknown';
      console.log(`  ✓ ${desc}...`);
    } catch (err) {
      if (err.code === 'ER_DUP_COLUMN_NAME' || 
          err.code === 'ER_TABLE_EXISTS_ERROR' ||
          err.code === 'ER_DUP_FIELDNAME' ||
          err.message.includes('Duplicate column') ||
          err.message.includes('already exists')) {
        skipped++;
        console.log(`  âŠ˜ Skipped (already exists): ${err.message.slice(0, 60)}`);
      } else {
        errors++;
        console.error(`  âœ— Error: ${err.message}`);
      }
    }
  }

  console.log('');
  console.log('=======================================');
  console.log(`  Results: ${success} succeeded, ${skipped} skipped, ${errors} errors`);
  console.log('=======================================');

  process.exit(errors > 0 ? 1 : 0);
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

