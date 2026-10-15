const path = require('path');
const fs = require('fs');
const pool = require('../src/config/db');

async function cleanDemoData() {
  console.log('======================================================');
  console.log('  HAPPY CAR WASH - CLEAN DEMO & RESET TO FRESH STATE');
  console.log('======================================================\n');

  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    const tablesToClear = [
      'job_card_services',
      'job_card_media',
      'job_card_concern_checklist',
      'customer_concerns',
      'after_service_concerns',
      'recommended_services',
      'post_service_inspection',
      'bill_dispatch_log',
      'invoice_download_log',
      'invoices',
      'invoices_non_gst',
      'status_notifications',
      'customer_payments',
      'product_sales',
      'estimate_job_mapping',
      'estimate_services',
      'estimates',
      'estimate_audit_log',
      'estimate_history_vault',
      'advance_bookings',
      'advance_payments',
      'advance_payments_log',
      'service_bookings',
      'service_reminders',
      'job_cards',
      'vehicles',
      'customers',
      'quick_services'
    ];

    for (const tbl of tablesToClear) {
      try {
        const [exists] = await conn.query('SHOW TABLES LIKE ?', [tbl]);
        if (exists.length > 0) {
          await conn.query(`DELETE FROM \`${tbl}\``);
          await conn.query(`ALTER TABLE \`${tbl}\` AUTO_INCREMENT = 1`);
          console.log(`[CLEARED] Table '${tbl}' reset to empty (AUTO_INCREMENT = 1)`);
        }
      } catch (err) {
        console.warn(`[WARN] Could not reset table '${tbl}': ${err.message}`);
      }
    }

    // Clean cash_ledger: only remove Customer Payment & Product Sale demo entries
    try {
      await conn.query("DELETE FROM cash_ledger WHERE category IN ('Customer Payment', 'Product Sale')");
      console.log(`[CLEARED] Demo entries from 'cash_ledger' removed (staff entries preserved).`);
    } catch (err) {
      console.warn(`[WARN] Could not clean cash_ledger: ${err.message}`);
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Clean uploads/imports and uploads/media subfolders
    const uploadsDir = path.join(__dirname, '../uploads');
    const importsDir = path.join(uploadsDir, 'imports');
    if (fs.existsSync(importsDir)) {
      const files = fs.readdirSync(importsDir);
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(importsDir, f));
        } catch (_) {}
      }
      console.log(`[CLEARED] Uploaded import temp files cleaned.`);
    }

    const mediaDir = path.join(uploadsDir, 'media');
    if (fs.existsSync(mediaDir)) {
      const entries = fs.readdirSync(mediaDir);
      for (const e of entries) {
        if (e === '.gitkeep') continue;
        const p = path.join(mediaDir, e);
        try {
          if (fs.statSync(p).isDirectory()) {
            fs.rmSync(p, { recursive: true, force: true });
          } else {
            fs.unlinkSync(p);
          }
        } catch (_) {}
      }
      console.log(`[CLEARED] Uploaded job media folders cleaned.`);
    }

    console.log('\n======================================================');
    console.log('  SUCCESS: System is 100% clean and ready for fresh data!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('Fatal error during clean:', error);
    throw error;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  cleanDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = cleanDemoData;
