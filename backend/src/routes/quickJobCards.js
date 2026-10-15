const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
router.use(auth);

// --- Number Generator (same pattern as jobCards.js) ---
async function generateJobNo(conn = db) {
  const [rows] = await conn.query(
    "SELECT job_no FROM job_cards ORDER BY id DESC LIMIT 1 FOR UPDATE"
  );
  if (rows.length === 0) return 'HCW001';
  const match = rows[0].job_no ? rows[0].job_no.match(/HCW(\d+)/i) || rows[0].job_no.match(/(\d+)$/) : null;
  const lastNum = match ? parseInt(match[1]) : rows.length;
  return `HCW${String(lastNum + 1).padStart(3, '0')}`;
}

async function generateInvoiceNo(conn = db) {
  const [rows] = await conn.query(
    "SELECT invoice_no FROM invoices ORDER BY id DESC LIMIT 1 FOR UPDATE"
  );
  if (rows.length === 0) return 'HCW001';
  const match = rows[0].invoice_no ? rows[0].invoice_no.match(/HCW(\d+)/i) || rows[0].invoice_no.match(/(\d+)$/) : null;
  const lastNum = match ? parseInt(match[1]) : rows.length;
  return `HCW${String(lastNum + 1).padStart(3, '0')}`;
}

async function generateNonGstInvoiceNo(conn = db) {
  const [rows] = await conn.query(
    "SELECT invoice_no FROM invoices_non_gst ORDER BY id DESC LIMIT 1 FOR UPDATE"
  );
  if (rows.length === 0) return 'HCW001';
  const match = rows[0].invoice_no ? rows[0].invoice_no.match(/HCW(\d+)/i) || rows[0].invoice_no.match(/(\d+)$/) : null;
  const lastNum = match ? parseInt(match[1]) : rows.length;
  return `HCW${String(lastNum + 1).padStart(3, '0')}`;
}

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// GET /api/quick-job-cards/quick-services — List active quick services
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.get('/quick-services', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, service_name, default_rate, sort_order FROM quick_services WHERE is_active = 1 ORDER BY sort_order ASC'
    );
    res.json({ data: rows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn('quick_services table not found — run migration_quick_jobcard.sql');
      return res.json({ data: [] });
    }
    console.error('GET /quick-services error:', err);
    res.status(500).json({ error: 'Failed to fetch quick services' });
  }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// POST /api/quick-job-cards/quick-services — Add a new quick service preset
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.post('/quick-services', async (req, res) => {
  try {
    const { service_name, default_rate } = req.body;
    if (!service_name || !service_name.trim()) {
      return res.status(400).json({ error: 'Service name is required' });
    }
    const name = service_name.trim();
    const rate = parseFloat(default_rate) || 0;

    const [existing] = await db.query('SELECT id FROM quick_services WHERE service_name = ?', [name]);
    if (existing.length > 0) {
      await db.execute('UPDATE quick_services SET is_active = 1 WHERE service_name = ?', [name]);
      return res.json({ message: 'Quick service preset saved' });
    }

    await db.execute(
      'INSERT INTO quick_services (service_name, default_rate, is_active) VALUES (?, ?, 1)',
      [name, rate]
    );
    res.status(201).json({ message: 'Quick service preset saved' });
  } catch (err) {
    console.error('POST /quick-services error:', err);
    res.status(500).json({ error: 'Failed to save quick service preset' });
  }
});

// DELETE /api/quick-job-cards/quick-services/:id — Delete a preset service
router.delete('/quick-services/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM quick_services WHERE id = ?', [req.params.id]);
    res.json({ message: 'Quick service preset deleted' });
  } catch (err) {
    console.error('DELETE /quick-services/:id error:', err);
    res.status(500).json({ error: 'Failed to delete quick service preset' });
  }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// GET /api/quick-job-cards — List all Car Wash job cards with services & totals
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.get('/', async (req, res) => {
  try {
    const { q, date, from, to } = req.query;
    let sql = `
      SELECT jc.*,
             COALESCE(c.address_line, '') as address,
             COALESCE(c.gstin, '') as customer_gstin,
             COALESCE(inv.invoice_no, ngst.invoice_no, jc.job_no) as invoice_no,
             inv.id as gst_invoice_id,
             ngst.id as non_gst_invoice_id,
             CASE 
               WHEN inv.id IS NOT NULL THEN 'gst'
               ELSE 'non_gst'
             END as billing_type,
             COALESCE(inv.total_amount, ngst.total_amount, jc.final_amount, 0) as calculated_total,
             (SELECT COUNT(*) FROM job_card_services WHERE job_card_id = jc.id) as service_count
      FROM job_cards jc
      LEFT JOIN customers c ON jc.customer_id = c.id
      LEFT JOIN invoices inv ON inv.job_card_id = jc.id
      LEFT JOIN invoices_non_gst ngst ON ngst.job_card_id = jc.id AND ngst.deleted_at IS NULL
      WHERE (jc.company = 'Car Wash' OR ((jc.company IS NULL OR jc.company = '') AND jc.is_quick_job = 1) OR LOWER(jc.service_type) REGEXP 'delux|dlx|teflon|taflon')
    `;
    const params = [];

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      sql += ` AND (jc.job_no LIKE ? OR jc.reg_no LIKE ? OR jc.owner_name LIKE ? OR jc.mobile_no LIKE ? OR jc.car_name LIKE ?)`;
      params.push(term, term, term, term, term);
    }

    if (date && date !== 'all') {
      sql += ` AND DATE(COALESCE(jc.job_date, jc.created_at)) = ?`;
      params.push(date);
    } else if (from && to) {
      sql += ` AND DATE(COALESCE(jc.job_date, jc.created_at)) BETWEEN ? AND ?`;
      params.push(from, to);
    }

    sql += ` ORDER BY COALESCE(jc.job_date, jc.created_at) DESC, jc.id DESC`;

    const [rows] = await db.query(sql, params);

    // Fetch services for these job cards
    const jobIds = rows.map(r => r.id);
    let servicesByJob = {};
    if (jobIds.length > 0) {
      const [svcRows] = await db.query(
        `SELECT job_card_id, id, service_name, qty, rate, amount, tax_pct, tax_amount 
         FROM job_card_services 
         WHERE job_card_id IN (${jobIds.map(() => '?').join(',')})`,
        jobIds
      );
      for (const s of svcRows) {
        if (!servicesByJob[s.job_card_id]) servicesByJob[s.job_card_id] = [];
        servicesByJob[s.job_card_id].push(s);
      }
    }

    const data = rows.map(r => ({
      ...r,
      services: servicesByJob[r.id] || []
    }));

    res.json({ data });
  } catch (err) {
    console.error('GET /quick-job-cards error:', err);
    res.status(500).json({ error: 'Failed to fetch car wash job cards' });
  }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// GET /api/quick-job-cards/:id — Get specific Car Wash job card details
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT jc.*,
              COALESCE(c.address_line, '') as address,
              COALESCE(c.gstin, '') as customer_gstin,
              COALESCE(inv.invoice_no, ngst.invoice_no, jc.job_no) as invoice_no,
              CASE 
                WHEN inv.id IS NOT NULL THEN 'gst'
                ELSE 'non_gst'
              END as billing_type,
              COALESCE(inv.total_amount, ngst.total_amount, jc.final_amount, 0) as calculated_total
       FROM job_cards jc
       LEFT JOIN customers c ON jc.customer_id = c.id
       LEFT JOIN invoices inv ON inv.job_card_id = jc.id
       LEFT JOIN invoices_non_gst ngst ON ngst.job_card_id = jc.id AND ngst.deleted_at IS NULL
       WHERE jc.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Car wash job card not found' });
    }

    const [services] = await db.query(
      'SELECT id, service_name, qty, rate, amount, tax_pct, tax_amount FROM job_card_services WHERE job_card_id = ? ORDER BY id',
      [req.params.id]
    );

    res.json({ data: rows[0], services });
  } catch (err) {
    console.error('GET /quick-job-cards/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch job card details' });
  }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// POST /api/quick-job-cards — Create a quick car wash job card & sync ledger/accounts
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      reg_no, owner_name, mobile, address, car_name,
      odometer, km_reading,
      services, custom_service, custom_service_rate, save_custom_service,
      job_date, billing_type = 'gst', payment_mode = 'cash'
    } = req.body;

    const odoVal = odometer || km_reading || null;
    const targetJobDate = job_date ? new Date(job_date) : new Date();
    const finalOwnerName = (owner_name || '').trim() || 'Customer';

    if (!reg_no || !mobile || !car_name) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'reg_no, mobile, and car_name are required' });
    }

    // Upsert customer info
    let customer_id = null;
    if (mobile) {
      try {
        const [existingCust] = await conn.query('SELECT id, address_line FROM customers WHERE mobile_no = ?', [mobile.trim()]);
        if (existingCust.length > 0) {
          customer_id = existingCust[0].id;
          if (address && address.trim()) {
            await conn.execute('UPDATE customers SET address_line = ? WHERE id = ?', [address.trim(), customer_id]);
          }
          if (owner_name && owner_name.trim()) {
            await conn.execute('UPDATE customers SET customer_name = ? WHERE id = ?', [owner_name.trim(), customer_id]);
          }
        } else {
          const [cRes] = await conn.execute(
            'INSERT INTO customers (customer_name, mobile_no, address_line) VALUES (?, ?, ?)',
            [finalOwnerName, mobile.trim(), address ? address.trim() : null]
          );
          customer_id = cRes.insertId;
        }
      } catch (custErr) {
        console.warn('Customer upsert error (non-fatal):', custErr.message);
      }
    }

    const job_no = await generateJobNo(conn);
    const public_token = uuidv4();

    // Insert job card with company = 'Car Wash'
    const [result] = await conn.execute(
      `INSERT INTO job_cards (job_no, reg_no, car_name, owner_name, mobile_no, customer_id, status, is_quick_job, public_token, odometer, company, job_date, payment_mode)
       VALUES (?, ?, ?, ?, ?, ?, 'ready', 1, ?, ?, 'Car Wash', ?, ?)`,
      [job_no, reg_no.toUpperCase().trim(), car_name.trim(), finalOwnerName, mobile.trim(), customer_id, public_token, odoVal, targetJobDate, payment_mode]
    );
    const jobId = result.insertId;

    // Helper to insert service
    async function insertService(jobCardId, serviceName, qty, rate, amount) {
      const isGst = billing_type === 'gst';
      const tax_pct = isGst ? 18 : 0;
      const tax_amount = parseFloat((amount * tax_pct / 100).toFixed(2));
      try {
        await conn.execute(
          `INSERT INTO job_card_services (job_card_id, service_name, item_type, qty, rate, amount, hsn_sac, tax_pct, tax_amount, is_selected)
           VALUES (?, ?, 'labour', ?, ?, ?, '998714', ?, ?, 1)`,
          [jobCardId, serviceName, qty, rate, amount, tax_pct, tax_amount]
        );
      } catch {
        await conn.execute(
          `INSERT INTO job_card_services (job_card_id, service_name, amount) VALUES (?, ?, ?)`,
          [jobCardId, serviceName, amount]
        );
      }
    }

    let subtotal = 0;

    if (services && Array.isArray(services)) {
      for (const svc of services) {
        if (svc.service_name && svc.amount !== undefined) {
          const q = parseFloat(svc.qty || 1) || 1;
          const r = parseFloat(svc.rate !== undefined ? svc.rate : svc.amount) || 0;
          const amt = q * r;
          subtotal += amt;
          await insertService(jobId, svc.service_name.trim(), q, r, amt);
        }
      }
    }

    if (custom_service && custom_service.trim()) {
      const customRate = parseFloat(custom_service_rate) || 0;
      subtotal += customRate;
      await insertService(jobId, custom_service.trim(), 1, customRate, customRate);

      if (save_custom_service) {
        try {
          const name = custom_service.trim();
          const [existing] = await conn.query('SELECT id FROM quick_services WHERE service_name = ?', [name]);
          if (existing.length === 0) {
            await conn.execute('INSERT INTO quick_services (service_name, default_rate, is_active) VALUES (?, 0, 1)', [name]);
          } else {
            await conn.execute('UPDATE quick_services SET is_active = 1 WHERE service_name = ?', [name]);
          }
        } catch (presetErr) {
          console.error('Failed to auto-save custom quick service preset:', presetErr.message);
        }
      }
    }

    const isGst = billing_type === 'gst';
    const gst_amount = isGst ? parseFloat((subtotal * 0.18).toFixed(2)) : 0;
    const total_amount = parseFloat((subtotal + gst_amount).toFixed(2));

    // Update final_amount on job_cards
    await conn.execute('UPDATE job_cards SET final_amount = ? WHERE id = ?', [total_amount, jobId]);

    const isCredit = payment_mode === 'credit';
    const initPayStatus = isCredit ? 'pending' : 'approved';

    let generatedInvNo = job_no;
    if (isGst) {
      generatedInvNo = await generateInvoiceNo(conn);
      await conn.execute(
        `INSERT INTO invoices (job_card_id, invoice_no, subtotal, gst_percent, gst_amount, total_amount, payment_mode, payment_status, created_at)
         VALUES (?, ?, ?, 18.00, ?, ?, ?, ?, ?)`,
        [jobId, generatedInvNo, subtotal, gst_amount, total_amount, payment_mode, initPayStatus, targetJobDate]
      );
    } else {
      generatedInvNo = await generateNonGstInvoiceNo(conn);
      await conn.execute(
        `INSERT INTO invoices_non_gst (job_card_id, invoice_no, subtotal, total_amount, payment_mode, payment_status, customer_name, mobile_no, reg_no, car_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [jobId, generatedInvNo, subtotal, total_amount, payment_mode, initPayStatus, owner_name.trim(), mobile.trim(), reg_no.toUpperCase().trim(), car_name.trim(), targetJobDate]
      );
    }

    if (!isCredit) {
      // Record initial customer payment (Cash / UPI / Card paid)
      await conn.execute(
        `INSERT INTO customer_payments (job_card_id, amount, payment_mode, payment_date, remarks, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [jobId, total_amount, payment_mode, targetJobDate, `Payment received for Car Wash Job ${job_no}`, req.user?.id || null]
      );

      // Sync Cash Ledger for Daily Report and Accounts
      if (payment_mode !== 'discount') {
        const ledgerDesc = `Payment received for Job Card ${job_no} (${generatedInvNo}) via ${payment_mode} - Express Car Wash`;
        await conn.execute(
          `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
           VALUES ('in', ?, 'Customer Payment', ?, ?, 'Car Wash')`,
          [total_amount, ledgerDesc, targetJobDate]
        );
      }
    }

    await conn.commit();
    conn.release();

    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    const tracking_url = `${baseUrl}/track/${public_token}`;

    if (mobile) {
      (async () => {
        try {
          const message = `Dear ${owner_name || 'Customer'}, track your Happy Car Wash job card ${job_no} at: ${tracking_url}`;
          const msg91 = require('../utils/msg91');
          await msg91.sendSMS({
            to: mobile,
            message,
            jobCardId: jobId,
            userId: req.user?.id || null
          });
        } catch (smsErr) {
          console.error('[SMS Auto Send Error - Quick Job Card]:', smsErr.message);
        }
      })();
    }

    res.status(201).json({
      id: jobId,
      job_no,
      invoice_no: generatedInvNo,
      public_token,
      tracking_url,
      total_amount,
      message: 'Quick car wash job card created successfully'
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('POST /quick-job-cards error:', err);
    res.status(500).json({ error: 'Failed to create quick job card: ' + err.message });
  }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// PUT /api/quick-job-cards/:id — Edit Car Wash Job Card, services & sync accounts/ledger
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.put('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const [existing] = await conn.query('SELECT * FROM job_cards WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'Car wash job card not found' });
    }
    const old = existing[0];

    await conn.beginTransaction();

    const {
      reg_no, owner_name, mobile, address, car_name,
      odometer, km_reading,
      services, custom_service, custom_service_rate,
      job_date, billing_type = 'gst', payment_mode = 'cash'
    } = req.body;

    const odoVal = odometer || km_reading || old.odometer;
    const targetJobDate = job_date ? new Date(job_date) : (old.job_date || new Date());
    const finalRegNo = (reg_no || old.reg_no || '').toUpperCase().trim();
    const finalOwnerName = (owner_name || old.owner_name || '').trim();
    const finalMobile = (mobile || old.mobile_no || '').trim();
    const finalCarName = (car_name || old.car_name || '').trim();
    const finalPaymentMode = (payment_mode || old.payment_mode || 'cash').toLowerCase();

    // 1. Update job card
    await conn.execute(
      `UPDATE job_cards 
       SET reg_no = ?, owner_name = ?, mobile_no = ?, car_name = ?, odometer = ?, job_date = ?, payment_mode = ?
       WHERE id = ?`,
      [finalRegNo, finalOwnerName, finalMobile, finalCarName, odoVal, targetJobDate, finalPaymentMode, req.params.id]
    );

    // 2. Update customer if linked
    if (old.customer_id) {
      await conn.execute(
        `UPDATE customers SET customer_name = ?, mobile_no = ?, address_line = COALESCE(?, address_line) WHERE id = ?`,
        [finalOwnerName, finalMobile, address ? address.trim() : null, old.customer_id]
      );
    }

    // 3. Re-insert services
    if (Array.isArray(services)) {
      await conn.execute('DELETE FROM job_card_services WHERE job_card_id = ?', [req.params.id]);

      const isGst = billing_type === 'gst';
      for (const s of services) {
        if (s && s.service_name) {
          const q = parseFloat(s.qty || 1) || 1;
          const r = parseFloat(s.rate !== undefined ? s.rate : s.amount) || 0;
          const amt = q * r;
          const tax_pct = isGst ? 18 : 0;
          const tax_amount = parseFloat((amt * tax_pct / 100).toFixed(2));
          try {
            await conn.execute(
              `INSERT INTO job_card_services (job_card_id, service_name, item_type, qty, rate, amount, hsn_sac, tax_pct, tax_amount, is_selected)
               VALUES (?, ?, 'labour', ?, ?, ?, '998714', ?, ?, 1)`,
              [req.params.id, s.service_name.trim(), q, r, amt, tax_pct, tax_amount]
            );
          } catch {
            await conn.execute(
              `INSERT INTO job_card_services (job_card_id, service_name, amount) VALUES (?, ?, ?)`,
              [req.params.id, s.service_name.trim(), amt]
            );
          }
        }
      }
    }

    if (custom_service && custom_service.trim()) {
      const customRate = parseFloat(custom_service_rate) || 0;
      const isGst = billing_type === 'gst';
      const tax_pct = isGst ? 18 : 0;
      const tax_amount = parseFloat((customRate * tax_pct / 100).toFixed(2));
      try {
        await conn.execute(
          `INSERT INTO job_card_services (job_card_id, service_name, item_type, qty, rate, amount, hsn_sac, tax_pct, tax_amount, is_selected)
           VALUES (?, ?, 'labour', 1, ?, ?, '998714', ?, ?, 1)`,
          [req.params.id, custom_service.trim(), customRate, customRate, tax_pct, tax_amount]
        );
      } catch {
        await conn.execute(
          `INSERT INTO job_card_services (job_card_id, service_name, amount) VALUES (?, ?, ?)`,
          [req.params.id, custom_service.trim(), customRate]
        );
      }
    }

    // 4. Calculate new totals
    const [freshServices] = await conn.query('SELECT * FROM job_card_services WHERE job_card_id = ?', [req.params.id]);
    const subtotal = freshServices.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    const isGst = billing_type === 'gst';
    const gst_amount = isGst ? parseFloat((subtotal * 0.18).toFixed(2)) : 0;
    const total_amount = parseFloat((subtotal + gst_amount).toFixed(2));

    await conn.execute('UPDATE job_cards SET final_amount = ? WHERE id = ?', [total_amount, req.params.id]);

    // 5. Sync Invoices
    const [invRows] = await conn.query('SELECT id, invoice_no FROM invoices WHERE job_card_id = ?', [req.params.id]);
    const [ngstRows] = await conn.query('SELECT id, invoice_no FROM invoices_non_gst WHERE job_card_id = ? AND deleted_at IS NULL', [req.params.id]);

    let activeInvoiceNo = old.job_no;
    if (isGst) {
      if (ngstRows.length > 0) {
        await conn.execute('DELETE FROM invoices_non_gst WHERE id = ?', [ngstRows[0].id]);
      }
      if (invRows.length > 0) {
        activeInvoiceNo = invRows[0].invoice_no;
        await conn.execute(
          'UPDATE invoices SET subtotal = ?, gst_amount = ?, total_amount = ?, payment_mode = ?, created_at = ? WHERE id = ?',
          [subtotal, gst_amount, total_amount, finalPaymentMode, targetJobDate, invRows[0].id]
        );
      } else {
        activeInvoiceNo = await generateInvoiceNo(conn);
        await conn.execute(
          `INSERT INTO invoices (job_card_id, invoice_no, subtotal, gst_percent, gst_amount, total_amount, payment_mode, created_at)
           VALUES (?, ?, ?, 18.00, ?, ?, ?, ?)`,
          [req.params.id, activeInvoiceNo, subtotal, gst_amount, total_amount, finalPaymentMode, targetJobDate]
        );
      }
    } else {
      if (invRows.length > 0) {
        await conn.execute('DELETE FROM invoices WHERE id = ?', [invRows[0].id]);
      }
      if (ngstRows.length > 0) {
        activeInvoiceNo = ngstRows[0].invoice_no;
        await conn.execute(
          `UPDATE invoices_non_gst 
           SET subtotal = ?, total_amount = ?, payment_mode = ?, customer_name = ?, mobile_no = ?, reg_no = ?, car_name = ?, created_at = ?
           WHERE id = ?`,
          [subtotal, total_amount, finalPaymentMode, finalOwnerName, finalMobile, finalRegNo, finalCarName, targetJobDate, ngstRows[0].id]
        );
      } else {
        activeInvoiceNo = await generateNonGstInvoiceNo(conn);
        await conn.execute(
          `INSERT INTO invoices_non_gst (job_card_id, invoice_no, subtotal, total_amount, payment_mode, customer_name, mobile_no, reg_no, car_name, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [req.params.id, activeInvoiceNo, subtotal, total_amount, finalPaymentMode, finalOwnerName, finalMobile, finalRegNo, finalCarName, targetJobDate]
        );
      }
    }

    const isCreditUpdate = finalPaymentMode === 'credit';
    const updatedPayStatus = isCreditUpdate ? 'pending' : 'approved';
    await conn.execute("UPDATE invoices_non_gst SET payment_status = ? WHERE job_card_id = ?", [updatedPayStatus, req.params.id]);
    await conn.execute("UPDATE job_cards SET payment_mode = ? WHERE id = ?", [finalPaymentMode, req.params.id]);

    if (isCreditUpdate) {
      // Remove any initial payments and ledger so it appears as outstanding / pending
      await conn.execute("DELETE FROM customer_payments WHERE job_card_id = ?", [req.params.id]);
      await conn.execute("DELETE FROM cash_ledger WHERE category = 'Customer Payment' AND description LIKE ?", [`%${old.job_no}%`]);
    } else {
      // 6. Sync Customer Payments
      const [pRows] = await conn.query('SELECT id FROM customer_payments WHERE job_card_id = ? ORDER BY id ASC LIMIT 1', [req.params.id]);
      if (pRows.length > 0) {
        await conn.execute(
          `UPDATE customer_payments SET amount = ?, payment_mode = ?, payment_date = ?, remarks = ? WHERE id = ?`,
          [total_amount, finalPaymentMode, targetJobDate, `Payment for Car Wash ${old.job_no}`, pRows[0].id]
        );
      } else {
        await conn.execute(
          `INSERT INTO customer_payments (job_card_id, amount, payment_mode, payment_date, remarks, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [req.params.id, total_amount, finalPaymentMode, targetJobDate, `Payment for Car Wash ${old.job_no}`, req.user?.id || null]
        );
      }

      // 7. Sync Cash Ledger for Daily Report and Accounts
      if (finalPaymentMode === 'discount') {
        await conn.execute("DELETE FROM cash_ledger WHERE category = 'Customer Payment' AND description LIKE ?", [`%${old.job_no}%`]);
      } else {
        const ledgerDesc = `Payment received for Job Card ${old.job_no} (${activeInvoiceNo}) via ${finalPaymentMode} - Express Car Wash`;
        const [lRows] = await conn.query("SELECT id FROM cash_ledger WHERE category = 'Customer Payment' AND description LIKE ?", [`%${old.job_no}%`]);
        if (lRows.length > 0) {
          await conn.execute(
            "UPDATE cash_ledger SET amount = ?, description = ?, entry_date = ?, company = 'Car Wash' WHERE id = ?",
            [total_amount, ledgerDesc, targetJobDate, lRows[0].id]
          );
        } else {
          await conn.execute(
            `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
             VALUES ('in', ?, 'Customer Payment', ?, ?, 'Car Wash')`,
            [total_amount, ledgerDesc, targetJobDate]
          );
        }
      }
    }

    await conn.commit();
    conn.release();

    res.json({
      success: true,
      message: 'Car Wash job card updated successfully',
      data: {
        id: req.params.id,
        job_no: old.job_no,
        invoice_no: activeInvoiceNo,
        total_amount,
        billing_type
      },
      services: freshServices
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('PUT /quick-job-cards/:id error:', err);
    res.status(500).json({ error: 'Failed to update job card: ' + err.message });
  }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// DELETE /api/quick-job-cards/:id — Delete Car Wash Job Card
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.delete('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const [existing] = await conn.query('SELECT * FROM job_cards WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'Car wash job card not found' });
    }
    const job = existing[0];

    await conn.beginTransaction();

    await conn.execute('DELETE FROM job_card_services WHERE job_card_id = ?', [req.params.id]);
    await conn.execute('DELETE FROM invoices WHERE job_card_id = ?', [req.params.id]);
    await conn.execute('DELETE FROM invoices_non_gst WHERE job_card_id = ?', [req.params.id]);
    await conn.execute('DELETE FROM customer_payments WHERE job_card_id = ?', [req.params.id]);
    await conn.execute("DELETE FROM cash_ledger WHERE description LIKE ?", [`%${job.job_no}%`]);
    await conn.execute('DELETE FROM job_cards WHERE id = ?', [req.params.id]);

    await conn.commit();
    conn.release();

    res.json({ success: true, message: `Car Wash Job Card #${job.job_no} deleted successfully` });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('DELETE /quick-job-cards/:id error:', err);
    res.status(500).json({ error: 'Failed to delete car wash job card: ' + err.message });
  }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// POST /api/quick-job-cards/send-tracking-sms — Send tracking link SMS
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.post('/send-tracking-sms', async (req, res) => {
  try {
    const { job_card_id } = req.body;
    if (!job_card_id) {
      return res.status(400).json({ error: 'job_card_id is required' });
    }

    const [rows] = await db.query(
      'SELECT id, job_no, owner_name, mobile_no, public_token FROM job_cards WHERE id = ?',
      [job_card_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Job card not found' });
    }

    const job = rows[0];
    if (!job.public_token) {
      return res.status(400).json({ error: 'No tracking token found for this job card' });
    }

    const mobile = job.mobile_no;
    if (!mobile) {
      return res.status(400).json({ error: 'No mobile number found on job card' });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    const tracking_url = `${baseUrl}/track/${job.public_token}`;
    const message = `Dear ${job.owner_name}, track your Happy Car Wash job card ${job.job_no} at: ${tracking_url}`;

    const msg91 = require('../utils/msg91');
    await msg91.sendSMS({
      to: mobile,
      message,
      jobCardId: job_card_id,
      userId: req.user?.id || null
    });

    try {
      await db.execute(
        `INSERT INTO bill_dispatch_log (job_card_id, dispatch_type, recipient_no, template_name, status)
         VALUES (?, 'sms', ?, 'tracking_link', 'sent')`,
        [job_card_id, mobile]
      );
    } catch (logErr) {
      console.error('Failed to log SMS dispatch (non-fatal):', logErr.message);
    }

    res.json({ message: 'SMS sent' });
  } catch (err) {
    console.error('POST /send-tracking-sms error:', err);
    res.status(500).json({ error: 'Failed to send tracking SMS' });
  }
});

module.exports = router;
