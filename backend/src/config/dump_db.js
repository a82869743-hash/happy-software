const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function dump() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '1234',
    database: process.env.DB_NAME || 'happy_gms'
  });

  try {
    console.log('Dumping database:', process.env.DB_NAME);
    let sqlOutput = `-- HAPPY CAR WASH GMS Database Dump\n`;
    sqlOutput += `-- Generated on: ${new Date().toISOString()}\n\n`;

    // Get all tables
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);

    // Order tables to prevent foreign key constraint issues on insert/drop
    // Let's turn off foreign key checks during import instead
    sqlOutput += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    for (const table of tableNames) {
      console.log(`Dumping table: ${table}`);
      sqlOutput += `-- ------------------------------------------------------\n`;
      sqlOutput += `-- Table structure for table \`${table}\`\n`;
      sqlOutput += `-- ------------------------------------------------------\n`;
      sqlOutput += `DROP TABLE IF EXISTS \`${table}\`;\n`;

      const [createTable] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
      let createSQL = createTable[0]['Create Table'];
      
      // Compatibility replacement for older MySQL/MariaDB collations
      createSQL = createSQL.replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_general_ci');
      
      // Normalize create SQL to remove absolute auto increment values starting high if desired,
      // but standard dump preserves it. Let's just output it.
      sqlOutput += `${createSQL};\n\n`;

      // Get rows
      const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
      if (rows.length > 0) {
        sqlOutput += `-- Dumping data for table \`${table}\`\n`;
        sqlOutput += `LOCK TABLES \`${table}\` WRITE;\n`;
        
        const columns = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
        
        for (const row of rows) {
          const values = Object.values(row).map(val => {
            if (val === null) return 'NULL';
            if (typeof val === 'number') return val;
            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            
            let strVal = '';
            if (typeof val === 'object') {
              strVal = JSON.stringify(val);
            } else {
              strVal = val.toString();
            }

            // Escape string values safely
            const escaped = strVal
              .replace(/\\/g, '\\\\')
              .replace(/'/g, "\\'")
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r');
            return `'${escaped}'`;
          }).join(', ');
          
          sqlOutput += `INSERT INTO \`${table}\` (${columns}) VALUES (${values});\n`;
        }
        
        sqlOutput += `UNLOCK TABLES;\n\n`;
      }
    }

    sqlOutput += `SET FOREIGN_KEY_CHECKS = 1;\n`;

    // Save to root folder
    const rootPath = path.join(__dirname, '../../../happy_car_wash_database.sql');
    fs.writeFileSync(rootPath, sqlOutput, 'utf8');

    console.log('✓ Database dumped successfully to:');
    console.log('  -', rootPath);
  } catch (err) {
    console.error('Error dumping database:', err);
  } finally {
    await connection.end();
  }
}

dump();

