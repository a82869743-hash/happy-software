/**
 * Run Service Reminders Migration
 * Usage: node run_migration_reminders.js
 */
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function run() {
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, 'migration_service_reminders.sql'),
      'utf8'
    );
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await db.execute(stmt);
        console.log('✓', stmt.substring(0, 60).replace(/\n/g, ' ') + '...');
      } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log('⏭ Already exists:', stmt.substring(0, 50).replace(/\n/g, ' '));
        } else {
          throw err;
        }
      }
    }

    console.log('\n✅ Service Reminders migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

run();
