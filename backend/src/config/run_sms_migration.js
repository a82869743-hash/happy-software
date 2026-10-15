// Run: node backend/src/config/run_sms_migration.js
const path = require('path');
const fs = require('fs');
const db = require('./db');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'migration_sms_module.sql'), 'utf8');
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('USE'));
    for (const stmt of statements) {
      try {
        await db.execute(stmt);
        console.log('✅ Executed:', stmt.substring(0, 60) + '...');
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || err.code === 'ER_DUP_KEYNAME') {
          console.log('⏩ Skipped (already exists):', stmt.substring(0, 60));
        } else {
          console.warn('⚠️  Warning:', err.message.substring(0, 100));
        }
      }
    }
    console.log('\n✅ SMS module migration complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}
run();
