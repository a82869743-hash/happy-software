const pool = require('./db');

async function run() {
  try {
    const [tables] = await pool.query('SHOW TABLES');
    console.log('Tables:', tables.map(t => Object.values(t)[0]));

    for (const table of ['product_sales', 'parts_sales', 'cash_ledger', 'parts']) {
      try {
        const [rows] = await pool.query(`SELECT * FROM ${table} LIMIT 5`);
        console.log(`=== ${table} (first 5 rows) ===`);
        console.log(rows);
      } catch (e) {
        console.error(`Error querying ${table}:`, e.message);
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
