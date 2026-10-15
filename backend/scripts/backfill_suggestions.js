/**
 * Backfill Suggestions Script
 * Seeds global_suggestions from existing job_cards, customers, vehicles,
 * estimates, services, and product sales.
 * Idempotent: safe to run multiple times.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../src/config/db');

function normalize(type, val) {
  if (!val) return null;
  let s = String(val).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (
    !s ||
    s === '-' ||
    s === '—' ||
    s.toLowerCase() === 'null' ||
    s.toLowerCase() === 'undefined' ||
    s.toLowerCase() === 'na' ||
    s.toLowerCase() === 'n/a'
  ) {
    return null;
  }

  if (type === 'reg_no') {
    s = s.toUpperCase().replace(/[\s\-_]/g, '');
    if (s.length < 4 || s.length > 15) return null;
    return s;
  }

  if (type === 'mobile_no' || type === 'alt_mobile') {
    const digits = s.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      s = digits.slice(2);
    } else if (digits.length === 10) {
      s = digits;
    } else {
      return null;
    }
    return s;
  }

  if (type === 'email') {
    s = s.toLowerCase();
    if (!s.includes('@') || !s.includes('.')) return null;
    return s;
  }

  if (type === 'pincode') {
    const digits = s.replace(/\D/g, '');
    if (digits.length === 6) return digits;
    return null;
  }

  if (type === 'gstin') {
    s = s.toUpperCase().replace(/[\s\-]/g, '');
    if (s.length !== 15) return null;
    return s;
  }

  if (s.length < 2) return null;
  return s;
}

async function runBackfill() {
  console.log('--- Starting Suggestions Backfill ---');
  const counts = new Map(); // key: `${type}:::${text}`, value: number

  function record(type, text) {
    const clean = normalize(type, text);
    if (!clean) return;
    const key = `${type}:::${clean}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  try {
    // 1. job_cards
    console.log('Extracting from job_cards...');
    const [jobs] = await db.query(
      `SELECT reg_no, car_name, owner_name, mobile_no, corporate_name, insurance_company, company FROM job_cards`
    );
    for (const j of jobs) {
      record('reg_no', j.reg_no);
      record('car_name', j.car_name);
      record('client_name', j.owner_name);
      record('mobile_no', j.mobile_no);
      record('company_name', j.corporate_name);
      record('company_name', j.company);
      record('insurance_company', j.insurance_company);
    }

    // 2. customers
    console.log('Extracting from customers...');
    const [custs] = await db.query(
      `SELECT customer_name, mobile_no, alt_mobile, email, company_name, gstin, address_line, colony_street, city, state, pincode FROM customers`
    );
    for (const c of custs) {
      record('client_name', c.customer_name);
      record('mobile_no', c.mobile_no);
      record('alt_mobile', c.alt_mobile);
      record('email', c.email);
      record('company_name', c.company_name);
      record('gstin', c.gstin);
      record('address_line', c.address_line);
      record('colony_street', c.colony_street);
      record('city', c.city);
      record('state', c.state);
      record('pincode', c.pincode);
    }

    // 3. vehicles
    console.log('Extracting from vehicles...');
    const [vehs] = await db.query(`SELECT reg_no, make, model FROM vehicles`);
    for (const v of vehs) {
      record('reg_no', v.reg_no);
      if (v.make && v.model) {
        record('car_name', `${v.make} ${v.model}`.trim());
      } else if (v.model) {
        record('car_name', v.model);
      }
    }

    // 4. estimates
    console.log('Extracting from estimates...');
    const [ests] = await db.query(
      `SELECT customer_name, mobile_no, reg_no, car_name, company_name, gstin FROM estimates`
    );
    for (const e of ests) {
      record('client_name', e.customer_name);
      record('mobile_no', e.mobile_no);
      record('reg_no', e.reg_no);
      record('car_name', e.car_name);
      record('company_name', e.company_name);
      record('gstin', e.gstin);
    }

    // 5. service_catalog & job_card_services & estimate_services
    console.log('Extracting services...');
    try {
      const [cats] = await db.query(`SELECT service_name FROM service_catalog WHERE is_active = 1`);
      for (const s of cats) record('service_name', s.service_name);
    } catch {}

    try {
      const [jServices] = await db.query(`SELECT service_name FROM job_card_services`);
      for (const s of jServices) record('service_name', s.service_name);
    } catch {}

    try {
      const [eServices] = await db.query(`SELECT service_name FROM estimate_services`);
      for (const s of eServices) record('service_name', s.service_name);
    } catch {}

    // 6. product_sales & parts
    console.log('Extracting product sales and parts...');
    try {
      const [sales] = await db.query(
        `SELECT product_name, customer_name, customer_mobile, customer_address, company, car_name, vehicle_no, items FROM product_sales`
      );
      for (const ps of sales) {
        record('product_name', ps.product_name);
        record('client_name', ps.customer_name);
        record('mobile_no', ps.customer_mobile);
        record('address_line', ps.customer_address);
        record('company_name', ps.company);
        record('car_name', ps.car_name);
        record('reg_no', ps.vehicle_no);
        if (ps.items) {
          try {
            const parsed = typeof ps.items === 'string' ? JSON.parse(ps.items) : ps.items;
            if (Array.isArray(parsed)) {
              for (const it of parsed) {
                if (it.name || it.product_name) record('product_name', it.name || it.product_name);
              }
            }
          } catch {}
        }
      }
    } catch {}

    try {
      const [parts] = await db.query(`SELECT part_name FROM parts`);
      for (const p of parts) record('product_name', p.part_name);
    } catch {}

    console.log(`Extracted ${counts.size} distinct suggestion entries. Inserting into global_suggestions...`);

    let inserted = 0;
    const batchSize = 100;
    const entries = Array.from(counts.entries());

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async ([key, count]) => {
          const [type, ...textParts] = key.split(':::');
          const text = textParts.join(':::');
          await db.query(
            `INSERT INTO global_suggestions (suggestion_type, suggestion_text, usage_count)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE usage_count = GREATEST(global_suggestions.usage_count, VALUES(usage_count))`,
            [type, text, count]
          );
          inserted++;
        })
      );
    }

    console.log(`✓ Backfill complete: successfully seeded/updated ${inserted} suggestions!`);
    const [summary] = await db.query(
      `SELECT suggestion_type, COUNT(*) as total, SUM(usage_count) as total_usage
       FROM global_suggestions
       GROUP BY suggestion_type
       ORDER BY total DESC`
    );
    console.table(summary);
  } catch (err) {
    console.error('Error during backfill:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runBackfill();
