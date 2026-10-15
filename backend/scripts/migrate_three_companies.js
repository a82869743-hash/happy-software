const db = require('../src/config/db');

async function runMigration() {
  console.log('Running 3-company migration and data repair...');
  let conn = null;
  try {
    conn = await db.getConnection();

    // 1. job_cards.company
    const [jcCols] = await conn.query("SHOW COLUMNS FROM job_cards LIKE 'company'");
    if (jcCols.length === 0) {
      await conn.query("ALTER TABLE job_cards ADD COLUMN company VARCHAR(50) DEFAULT 'Detailing Studio'");
      console.log('Added company column to job_cards');
    }

    // 2. product_sales.company
    const [psCols] = await conn.query("SHOW COLUMNS FROM product_sales LIKE 'company'");
    if (psCols.length === 0) {
      await conn.query("ALTER TABLE product_sales ADD COLUMN company VARCHAR(50) DEFAULT 'Accessories'");
      console.log('Added company column to product_sales');
    }

    // 3. cash_ledger.company
    const [clCols] = await conn.query("SHOW COLUMNS FROM cash_ledger LIKE 'company'");
    if (clCols.length === 0) {
      await conn.query("ALTER TABLE cash_ledger ADD COLUMN company VARCHAR(50) DEFAULT NULL");
      console.log('Added company column to cash_ledger');
    }

    // 4. CRITICAL REPAIR: Correct job cards that contain detailing services or were wrongly marked as Car Wash
    // Detailing keywords: coat, coting, ceram, ciram, ppf, polish, detail, rubb, buff, studio, interior, dry clean, deep clean, graphene, headlight, glass, spa
    // Note: Teflon Coating and Deluxe Wash (Delux / Deluxe / Dlx) are EXPLICITLY Car Wash, not Detailing Studio!
    const detailingRegex = 'coat|coting|ceram|ciram|ppf|polish|detail|rubb|buff|studio|interior|dry[[:space:]]*clean|deep[[:space:]]*clean|graphene|glass|headlight|spa';

    try {
      const [detRepRes] = await conn.query(`
        UPDATE job_cards
        SET company = 'Detailing Studio', is_quick_job = 0
        WHERE (
          service_type REGEXP '${detailingRegex}'
          OR id IN (
            SELECT DISTINCT job_card_id FROM job_card_services
            WHERE service_name REGEXP '${detailingRegex}'
          )
          OR (final_amount >= 1500 AND service_type NOT REGEXP '^(car[[:space:]]*wash|wash|foam[[:space:]]*wash|water[[:space:]]*wash|body[[:space:]]*wash|diesel[[:space:]]*wash|delux.*|dlx.*|teflon.*)$')
        )
        AND (company != 'Accessories' OR company IS NULL)
        AND (service_type IS NULL OR LOWER(service_type) NOT REGEXP 'delux|dlx|teflon|taflon')
        AND id NOT IN (
          SELECT DISTINCT job_card_id FROM job_card_services
          WHERE LOWER(service_name) REGEXP 'delux|dlx|teflon|taflon'
        )
      `);
      console.log(`Repaired ${detRepRes.affectedRows} detailing job cards to 'Detailing Studio' with is_quick_job=0.`);
    } catch (e) {
      console.warn('Note repairing detailing job cards:', e.message);
    }

    // 4b. CRITICAL REPAIR: Ensure all Deluxe Wash (Delux/Deluxe/Dlx) and Teflon Coating entries belong to Car Wash
    try {
      const [washRepRes] = await conn.query(`
        UPDATE job_cards
        SET company = 'Car Wash', is_quick_job = 1, job_category = 'wash'
        WHERE LOWER(service_type) REGEXP 'delux|dlx|teflon|taflon'
           OR id IN (
             SELECT DISTINCT job_card_id FROM job_card_services
             WHERE LOWER(service_name) REGEXP 'delux|dlx|teflon|taflon'
           )
      `);
      console.log(`Repaired ${washRepRes.affectedRows} Deluxe Wash & Teflon Coating job cards to 'Car Wash' with is_quick_job=1.`);
    } catch (e) {
      console.warn('Note repairing Deluxe Wash & Teflon Coating job cards:', e.message);
    }

    // 5. Backfill any remaining null company on job_cards
    await conn.query("UPDATE job_cards SET company = IF(is_quick_job = 1, 'Car Wash', 'Detailing Studio') WHERE company IS NULL OR company = ''");
    console.log('Updated job_cards company backfill');

    // 6. product_sales backfill
    await conn.query("UPDATE product_sales SET company = 'Accessories' WHERE company IS NULL OR company = ''");
    console.log('Updated product_sales company backfill');

    // 7. cash_ledger company alignment
    await conn.query("UPDATE cash_ledger SET company = 'Accessories' WHERE (category LIKE 'Product Sale%' OR category LIKE 'Spare Parts Sale%') AND (company IS NULL OR company = '')");
    await conn.query("UPDATE cash_ledger SET company = 'Car Wash' WHERE (description LIKE '%Quick Job%' OR description LIKE '%Car Wash%' OR LOWER(description) REGEXP 'delux|dlx|teflon|taflon')");
    await conn.query("UPDATE cash_ledger SET company = 'Detailing Studio' WHERE (category LIKE 'Customer Payment%' OR description LIKE '%Job Card HCW%') AND (company IS NULL OR company = '')");

    // Also sync cash_ledger entries to their job_card company if mismatched
    try {
      await conn.query(`
        UPDATE cash_ledger cl
        JOIN job_cards jc ON (cl.description LIKE CONCAT('%', jc.job_no, '%'))
        SET cl.company = jc.company
        WHERE cl.company != jc.company
      `);
    } catch (e) {
      console.warn('Note syncing ledger companies:', e.message);
    }

    console.log('Migration and DB repairs completed successfully!');
  } catch (err) {
    console.error('Migration note:', err.message || err);
  } finally {
    if (conn) {
      try { conn.release(); } catch (e) {}
    }
    process.exit(0);
  }
}

runMigration();
