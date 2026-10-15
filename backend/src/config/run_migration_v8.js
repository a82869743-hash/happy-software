const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runMigrationV8() {
  console.log('Running HAPPY CAR WASH GMS V8.0 Migration (Suggestions + Unique Constraints)...');
  try {
    // 1. Run suggestions table migration
    const suggestionsSql = fs.readFileSync(
      path.join(__dirname, 'migration_v8_suggestions.sql'), 'utf8'
    );
    // Execute each statement (split by semicolons, filter empties)
    const statements = suggestionsSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    for (const stmt of statements) {
      await db.query(stmt);
    }
    console.log('✅ service_suggestions table created (or already exists).');

    // 2. Run unique job_no constraint migration
    const uniqueSql = fs.readFileSync(
      path.join(__dirname, 'migration_v8_unique_jobno.sql'), 'utf8'
    );
    // This migration uses MySQL prepared statements, execute as multistatement
    const uniqueStatements = uniqueSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    for (const stmt of uniqueStatements) {
      await db.query(stmt);
    }
    console.log('✅ Unique constraints on job_no and rfe_no applied.');

    console.log('Migration V8.0 completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('âŒ Migration V8.0 failed:', err.message);
    process.exit(1);
  }
}

runMigrationV8();

