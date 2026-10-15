const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    console.log('Creating parts and parts_sales tables...');

    // 1. Create parts table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS parts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        part_code VARCHAR(30) UNIQUE NOT NULL,
        part_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        unit VARCHAR(20) DEFAULT 'pc',
        buying_price DECIMAL(10,2) DEFAULT 0.00,
        selling_price DECIMAL(10,2) NOT NULL,
        stock_qty INT DEFAULT 0,
        low_stock_alert INT DEFAULT 5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ parts table ready');

    // 2. Create parts_sales table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS parts_sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        part_id INT NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        customer_name VARCHAR(255) DEFAULT NULL,
        payment_mode VARCHAR(50) NOT NULL,
        job_card_id INT DEFAULT NULL,
        sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ parts_sales table ready');

    // 3. Seed some parts
    const partsData = [
      ['SAC-PRT-001', 'Microfiber Cloth 40x40 400GSM', 'Consumables', 'pc', 40.00, 120.00, 150, 20],
      ['SAC-PRT-002', 'Ceramic Polish (Sonax Profiline)', 'Chemicals', 'bottle', 1200.00, 2200.00, 12, 3],
      ['SAC-PRT-003', 'Windshield Wiper Blade 18 inch', 'Spares', 'pair', 250.00, 650.00, 15, 5],
      ['SAC-PRT-004', 'Front Bumper Cover (Maruti Swift)', 'Body Panels', 'pc', 1500.00, 2800.00, 5, 2],
      ['SAC-PRT-005', 'Car Shampoo (Meguiars Hyper Wash 1L)', 'Chemicals', 'bottle', 800.00, 1600.00, 20, 5],
      ['SAC-PRT-006', 'Clay Bar (Medium Grade)', 'Consumables', 'pc', 300.00, 750.00, 8, 3]
    ];

    for (const p of partsData) {
      await connection.execute(
        `INSERT INTO parts (part_code, part_name, category, unit, buying_price, selling_price, stock_qty, low_stock_alert)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           part_name = VALUES(part_name),
           buying_price = VALUES(buying_price),
           selling_price = VALUES(selling_price),
           stock_qty = VALUES(stock_qty)`,
        p
      );
    }
    console.log('✓ Sample parts seeded');

    console.log('\n🎉 Seed complete');
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seed();
