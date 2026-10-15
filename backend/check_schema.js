const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'happy_gms'
  });
  
  console.log("Altering job_card_services.price_type to ENUM('price', 'mrp', 'fixed', 'variable')...");
  await conn.query(`ALTER TABLE job_card_services MODIFY COLUMN price_type ENUM('price', 'mrp', 'fixed', 'variable') DEFAULT 'price';`);
  
  const [rows] = await conn.query('DESCRIBE job_card_services;');
  console.log(JSON.stringify(rows, null, 2));
  
  await conn.end();
}

main().catch(console.error);

