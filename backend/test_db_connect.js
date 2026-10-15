const mysql = require('mysql2/promise');

const creds = [
  { host: 'localhost', user: 'root', password: '1234', database: 'happy_gms' }
];

async function test() {
  for (const c of creds) {
    try {
      console.log(`Testing: user=${c.user} password=${c.password} database=${c.database}`);
      const conn = await mysql.createConnection({
        host: c.host,
        user: c.user,
        password: c.password,
        database: c.database
      });
      console.log(`--> SUCCESS! Connected successfully!`);
      const [rows] = await conn.query('SHOW TABLES;');
      console.log(`--> Tables count: ${rows.length}`);
      await conn.end();
      return;
    } catch (err) {
      console.log(`--> FAILED: ${err.message}`);
    }
  }
}

test();

