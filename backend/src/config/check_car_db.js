const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function checkCars() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'root',
    database: process.env.DB_NAME || 'happy_car_wash'
  });

  const [tables] = await connection.query('SHOW TABLES');
  console.log('--- ALL TABLES & ROW COUNTS ---');
  for (const t of tables) {
    const table = Object.values(t)[0];
    const [[count]] = await connection.query(`SELECT COUNT(*) as c FROM \`${table}\``);
    console.log(`${table}: ${count.c} rows`);
  }
  await connection.end();
}

checkCars().catch(console.error);
