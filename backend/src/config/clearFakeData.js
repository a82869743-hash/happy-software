const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        // Do not delete the default happy-logo.png if it's there
        if (file !== 'happy-logo.png') {
          fs.unlinkSync(curPath);
        }
      }
    });
    // Don't delete the root imports or media folders themselves, just their subfolders
    if (path.basename(folderPath) !== 'media' && path.basename(folderPath) !== 'imports' && path.basename(folderPath) !== 'uploads') {
      try {
        fs.rmdirSync(folderPath);
      } catch (err) {
        // Ignore folder delete error if it fails
      }
    }
  }
}

async function clearDb() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    console.log('Clearing database of all fake/sample/seed data...');
    
    // Disable foreign key checks temporarily
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    const tablesToClear = [
      'job_card_concern_checklist',
      'post_service_inspection',
      'service_bookings',
      'after_service_concerns',
      'invoice_download_log',
      'customer_payments',
      'status_notifications',
      'quick_services',
      'advance_payments',
      'customer_concerns',
      'vehicles',
      'customers',
      'invoices_non_gst',
      'non_gst_kill_switch_log',
      'estimates',
      'invoices',
      'job_card_services',
      'job_cards',
      'staff_payments',
      'attendance',
      'staff',
      'product_sales',
      'parts_sales',
      'parts',
      'cash_ledger',
      'bill_dispatch_log'
    ];

    for (const table of tablesToClear) {
      try {
        await connection.execute(`TRUNCATE TABLE ${table}`);
        console.log(`✓ Cleared table: ${table}`);
      } catch (err) {
        console.log(`- Table ${table} not found or could not be truncated (skipped)`);
      }
    }

    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\nCleaning up uploaded fake media and imports files...');
    const mediaDir = path.join(__dirname, '../../uploads/media');
    const importsDir = path.join(__dirname, '../../uploads/imports');
    
    deleteFolderRecursive(mediaDir);
    deleteFolderRecursive(importsDir);
    console.log('✓ Upload directories cleaned.');

    console.log('\nDatabase and uploads cleared successfully! Ready for production use.');
  } catch (err) {
    console.error('Error clearing database:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

clearDb();

