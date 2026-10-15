/**
 * Customer Payments Routes
 * Feature 4: Payment management module
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const db = require('../config/db');
const auth = require('../middleware/auth');
const { createExcelResponse } = require('../utils/excel');

const router = express.Router();
router.use(auth);

// ───── GET /api/customer-payments ─────
router.get('/', async (req, res) => {
  try {
    const { job_card_id, estimate_id, from, to, estimate_only, invoice_only } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (job_card_id) {
      where += ' AND cp.job_card_id = ?';
      params.push(job_card_id);
    }
    if (estimate_id) {
      where += ' AND cp.estimate_id = ?';
      params.push(estimate_id);
    }
    if (estimate_only === 'true') {
      where += ' AND (cp.estimate_id IS NOT NULL OR (cp.job_card_id IS NOT NULL AND (EXISTS (SELECT 1 FROM invoices_non_gst WHERE job_card_id = cp.job_card_id AND deleted_at IS NULL) OR EXISTS (SELECT 1 FROM estimates WHERE job_card_id = cp.job_card_id))))';
    }
    if (invoice_only === 'true') {
      where += ' AND cp.job_card_id IS NOT NULL AND EXISTS (SELECT 1 FROM invoices WHERE job_card_id = cp.job_card_id)';
    }
    if (from) {
      where += ' AND cp.payment_date >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND cp.payment_date <= ?';
      params.push(to);
    }

    const [rows] = await db.query(
      `SELECT cp.*, jc.job_no, est.estimate_no,
              COALESCE(inv.invoice_no, ngst.invoice_no, est.estimate_no, '—') as invoice_no,
              COALESCE(NULLIF(TRIM(cp.reg_no), ''), jc.reg_no, est.reg_no, '') as reg_no,
              COALESCE(NULLIF(TRIM(cp.car_name), ''), jc.car_name, est.car_name, '') as car_name,
              COALESCE(NULLIF(TRIM(cp.owner_name), ''), jc.owner_name, est.customer_name, '') as owner_name,
              CASE
                WHEN jc.service_type REGEXP 'delux|dlx|teflon|taflon'
                  OR cp.remarks REGEXP 'delux|dlx|teflon|taflon'
                  OR cp.services_json REGEXP 'delux|dlx|teflon|taflon'
                  OR jc.id IN (
                    SELECT DISTINCT job_card_id FROM job_card_services
                    WHERE service_name REGEXP 'delux|dlx|teflon|taflon'
                  )
                  THEN 'Car Wash'
                WHEN jc.company = 'Accessories'
                  OR (cp.job_card_id IS NULL AND cp.estimate_id IS NULL AND (cp.remarks LIKE '%Accessory%' OR cp.services_json LIKE '%product%'))
                  THEN 'Accessories'
                WHEN jc.company = 'Car Wash' OR jc.is_quick_job = 1
                  THEN 'Car Wash'
                WHEN jc.company = 'Detailing Studio'
                  OR jc.service_type REGEXP 'coat|coting|ceram|ciram|ppf|polish|detail|rubb|buff|studio|interior|dry[[:space:]]*clean|deep[[:space:]]*clean|graphene|glass|headlight|spa'
                  OR cp.remarks REGEXP 'coat|coting|ceram|ciram|ppf|polish|detail|rubb|buff|studio|interior|dry[[:space:]]*clean|deep[[:space:]]*clean|graphene|glass|headlight|spa'
                  OR cp.services_json REGEXP 'coat|coting|ceram|ciram|ppf|polish|detail|rubb|buff|studio|interior|dry[[:space:]]*clean|deep[[:space:]]*clean|graphene|glass|headlight|spa'
                  THEN 'Detailing Studio'
                ELSE COALESCE(jc.company, 'Detailing Studio')
              END as company,
              CASE
                WHEN jc.service_type REGEXP 'delux|dlx|teflon|taflon'
                  OR cp.remarks REGEXP 'delux|dlx|teflon|taflon'
                  OR cp.services_json REGEXP 'delux|dlx|teflon|taflon'
                  OR jc.id IN (
                    SELECT DISTINCT job_card_id FROM job_card_services
                    WHERE service_name REGEXP 'delux|dlx|teflon|taflon'
                  )
                  THEN 1
                WHEN jc.service_type REGEXP 'coat|coting|ceram|ciram|ppf|polish|detail|rubb|buff|studio|interior|dry[[:space:]]*clean|deep[[:space:]]*clean|graphene|glass|headlight|spa'
                  OR cp.remarks REGEXP 'coat|coting|ceram|ciram|ppf|polish|detail|rubb|buff|studio|interior|dry[[:space:]]*clean|deep[[:space:]]*clean|graphene|glass|headlight|spa'
                  OR cp.services_json REGEXP 'coat|coting|ceram|ciram|ppf|polish|detail|rubb|buff|studio|interior|dry[[:space:]]*clean|deep[[:space:]]*clean|graphene|glass|headlight|spa'
                  THEN 0
                ELSE COALESCE(jc.is_quick_job, 0)
              END as is_quick_job,
              COALESCE(jc.service_type, '') as service_type,
              st.full_name as staff_name,
              au.full_name as created_by_name,
              'customer_payment' as record_source
       FROM customer_payments cp
       LEFT JOIN job_cards jc ON cp.job_card_id = jc.id
       LEFT JOIN estimates est ON cp.estimate_id = est.id
       LEFT JOIN invoices inv ON inv.job_card_id = jc.id
       LEFT JOIN invoices_non_gst ngst ON ngst.job_card_id = jc.id AND ngst.deleted_at IS NULL
       LEFT JOIN staff st ON cp.staff_id = st.id
       LEFT JOIN admin_users au ON cp.created_by = au.id
       ${where}
       ORDER BY cp.payment_date DESC, cp.id DESC`,
      params
    );

    let productSalesRows = [];
    if (estimate_only !== 'true' && invoice_only !== 'true') {
      try {
        let psWhere = ' WHERE 1=1';
        const psParams = [];
        if (from) {
          psWhere += ' AND DATE(ps.sale_date) >= ?';
          psParams.push(from);
        }
        if (to) {
          psWhere += ' AND DATE(ps.sale_date) <= ?';
          psParams.push(to);
        }
        const [ps] = await db.query(
          `SELECT -(ps.id) as id,
                  NULL as job_card_id,
                  NULL as estimate_id,
                  NULL as staff_id,
                  ps.price as amount,
                  ps.payment_mode,
                  NULL as transaction_id,
                  DATE(ps.sale_date) as payment_date,
                  CONCAT('Accessory Sale: ', ps.product_name) as remarks,
                  'Admin' as created_by_name,
                  'Accessory Desk' as staff_name,
                  ps.invoice_no as job_no,
                  NULL as estimate_no,
                  ps.invoice_no,
                  COALESCE(ps.vehicle_no, '') as reg_no,
                  COALESCE(ps.car_name, '') as car_name,
                  COALESCE(ps.customer_name, 'Walk-in Customer') as owner_name,
                  ps.customer_mobile as mobile_no,
                  'Accessories' as company,
                  ps.product_name as service_type,
                  'product_sale' as record_source,
                  ps.id as accessory_sale_id
           FROM product_sales ps
           ${psWhere}
           ORDER BY ps.sale_date DESC, ps.id DESC`,
          psParams
        );
        productSalesRows = ps;
      } catch (psErr) {
        console.warn('Product sales query warning in customer payments:', psErr.message);
      }
    }

    const allPayments = [...rows, ...productSalesRows].sort((a, b) => {
      const da = new Date(a.payment_date || a.created_at || 0).getTime();
      const db = new Date(b.payment_date || b.created_at || 0).getTime();
      return db - da;
    }).map(r => {
      const isWash = /delux|dlx|teflon|taflon/i.test(`${r.service_type || ''} ${r.remarks || ''} ${r.services_json || ''}`) || r.is_quick_job === 1;
      if (isWash && r.company !== 'Accessories') {
        return {
          ...r,
          company: 'Car Wash',
          is_quick_job: 1
        };
      }
      return r;
    });

    res.json({ data: allPayments });
  } catch (err) {
    console.error('GET /customer-payments error:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// ───── GET /api/customer-payments/summary/estimate/:estimateId ─────
router.get('/summary/estimate/:estimateId', async (req, res) => {
  try {
    const estId = req.params.estimateId;
    const [estRows] = await db.query(
      'SELECT total_amount FROM estimates WHERE id = ?',
      [estId]
    );
    if (estRows.length === 0) return res.status(404).json({ error: 'Estimate not found' });
    const totalBill = parseFloat(estRows[0].total_amount || 0);

    // Get payments
    const [payments] = await db.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments WHERE estimate_id = ?',
      [estId]
    );

    const totalPaid = parseFloat(payments[0].total);
    const outstanding = totalBill - totalPaid;

    // Get payment history
    const [history] = await db.query(
      `SELECT cp.*, au.full_name as created_by_name
       FROM customer_payments cp
       LEFT JOIN admin_users au ON cp.created_by = au.id
       WHERE cp.estimate_id = ?
       ORDER BY cp.payment_date DESC`,
      [estId]
    );

    res.json({
      total_bill: totalBill,
      advance_paid: 0,
      payments_made: totalPaid,
      total_paid: totalPaid,
      outstanding: outstanding > 0 ? outstanding : 0,
      is_settled: outstanding <= 0,
      history
    });
  } catch (err) {
    console.error('GET /customer-payments/summary/estimate error:', err);
    res.status(500).json({ error: 'Failed to fetch estimate payment summary' });
  }
});

// ───── GET /api/customer-payments/summary/:jobCardId ─────
router.get('/summary/:jobCardId', async (req, res) => {
  try {
    const jobId = req.params.jobCardId;

    // Get total bill amount
    const [jobRows] = await db.query(
      `SELECT jc.final_amount, inv.total_amount as invoice_total, COALESCE(est.total_amount, est.subtotal) as estimate_total,
              ngst.total_amount as non_gst_total
       FROM job_cards jc
       LEFT JOIN invoices inv ON inv.job_card_id = jc.id
       LEFT JOIN estimates est ON est.job_card_id = jc.id
       LEFT JOIN invoices_non_gst ngst ON ngst.job_card_id = jc.id AND ngst.deleted_at IS NULL
       WHERE jc.id = ?`,
      [jobId]
    );
    if (jobRows.length === 0) return res.status(404).json({ error: 'Job card not found' });

    const job = jobRows[0];
    const totalBill = parseFloat(job.invoice_total || job.non_gst_total || job.estimate_total || job.final_amount || 0);

    // Get advance payments
    const [advances] = await db.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM advance_payments WHERE job_card_id = ?',
      [jobId]
    );

    // Get customer payments
    const [payments] = await db.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments WHERE job_card_id = ?',
      [jobId]
    );

    const totalPaid = parseFloat(advances[0].total) + parseFloat(payments[0].total);
    const outstanding = totalBill - totalPaid;

    // Get payment history
    const [history] = await db.query(
      `SELECT cp.*, au.full_name as created_by_name
       FROM customer_payments cp
       LEFT JOIN admin_users au ON cp.created_by = au.id
       WHERE cp.job_card_id = ?
       ORDER BY cp.payment_date DESC`,
      [jobId]
    );

    res.json({
      total_bill: totalBill,
      advance_paid: parseFloat(advances[0].total),
      payments_made: parseFloat(payments[0].total),
      total_paid: totalPaid,
      outstanding: outstanding > 0 ? outstanding : 0,
      is_settled: outstanding <= 0,
      history
    });
  } catch (err) {
    console.error('GET /customer-payments/summary error:', err);
    res.status(500).json({ error: 'Failed to fetch payment summary' });
  }
});

// Ensure extra bill snapshot columns exist in customer_payments table
(async () => {
  try {
    await db.query("ALTER TABLE customer_payments ADD COLUMN staff_id INT UNSIGNED NULL AFTER estimate_id");
  } catch { /* already exists */ }
  const cols = [
    "ALTER TABLE customer_payments ADD COLUMN owner_name VARCHAR(255) NULL",
    "ALTER TABLE customer_payments ADD COLUMN mobile_no VARCHAR(50) NULL",
    "ALTER TABLE customer_payments ADD COLUMN reg_no VARCHAR(50) NULL",
    "ALTER TABLE customer_payments ADD COLUMN car_name VARCHAR(255) NULL",
    "ALTER TABLE customer_payments ADD COLUMN address TEXT NULL",
    "ALTER TABLE customer_payments ADD COLUMN customer_gstin VARCHAR(50) NULL",
    "ALTER TABLE customer_payments ADD COLUMN services_json LONGTEXT NULL"
  ];
  for (const c of cols) {
    try { await db.query(c); } catch { /* ignore if exists */ }
  }
})();

// ───── POST /api/customer-payments ─────
router.post('/', async (req, res) => {
  try {
    const { job_card_id, estimate_id, staff_id, amount, payment_mode, transaction_id, payment_date, remarks } = req.body;

    if (!job_card_id && !estimate_id) {
      return res.status(400).json({ error: 'Job card ID or Estimate ID is required' });
    }
    if (!amount || !payment_mode) {
      return res.status(400).json({ error: 'Amount and payment mode are required' });
    }

    const validModes = ['cash', 'upi', 'card', 'bank_transfer', 'discount'];
    if (!validModes.includes(payment_mode)) {
      return res.status(400).json({ error: 'Invalid payment mode' });
    }

    const pDate = payment_date || new Date().toISOString().slice(0, 10);

    // Duplicate check (prevent rapid double submission within 10 seconds)
    const [recentDup] = await db.query(
      `SELECT id FROM customer_payments 
       WHERE (job_card_id <=> ? AND estimate_id <=> ?) 
         AND amount = ? AND payment_mode = ? AND payment_date = ?
         AND created_at >= NOW() - INTERVAL 10 SECOND`,
      [job_card_id || null, estimate_id || null, amount, payment_mode, pDate]
    );
    if (recentDup.length > 0) {
      return res.status(200).json({ id: recentDup[0].id, message: 'Payment already recorded recently' });
    }

    const [result] = await db.execute(
      `INSERT INTO customer_payments (job_card_id, estimate_id, staff_id, amount, payment_mode, transaction_id, payment_date, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job_card_id || null,
        estimate_id || null,
        staff_id ? parseInt(staff_id) : null,
        amount, payment_mode,
        transaction_id || null,
        pDate,
        remarks || null,
        req.user.id
      ]
    );

    // Record in cash ledger (skip for discount type write-offs)
    let docNo = '';
    let regNo = '';
    if (payment_mode !== 'discount') {
      try {
        let desc = '';
        let compName = 'Detailing Studio';
        if (job_card_id && parseInt(job_card_id) < 0) {
          const psId = Math.abs(parseInt(job_card_id));
          const [psRows] = await db.query('SELECT invoice_no, product_name, price, tax_amount FROM product_sales WHERE id = ?', [psId]);
          if (psRows.length > 0) {
            docNo = psRows[0].invoice_no || `ACC-${psId}`;
            compName = 'Accessories';
            desc = `Payment received for Accessory Invoice ${docNo} (${psRows[0].product_name}) (Mode: ${payment_mode})`;
            await db.execute('UPDATE product_sales SET payment_mode = ? WHERE id = ?', [payment_mode, psId]);
          }
        } else if (job_card_id) {
          const [jobRows] = await db.query('SELECT job_no, reg_no, company FROM job_cards WHERE id = ?', [job_card_id]);
          if (jobRows.length > 0) {
            docNo = jobRows[0].job_no;
            regNo = jobRows[0].reg_no;
            compName = jobRows[0].company || 'Detailing Studio';
          } else {
            docNo = `#${job_card_id}`;
          }
          desc = `Payment received for Job Card ${docNo} (Mode: ${payment_mode})`;
        } else {
          const [estRows] = await db.query('SELECT estimate_no, reg_no FROM estimates WHERE id = ?', [estimate_id]);
          if (estRows.length > 0) {
            docNo = estRows[0].estimate_no;
            regNo = estRows[0].reg_no;
          } else {
            docNo = `#${estimate_id}`;
          }
          desc = `Payment received for Estimate ${docNo} (Mode: ${payment_mode})`;
        }

        await db.execute(
          `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            'in',
            parseFloat(amount),
            'Customer Payment',
            desc,
            (payment_date || new Date().toISOString().slice(0, 10)) + ' 00:00:00',
            compName
          ]
        );

        // Check if total paid now covers total billed, if so update invoice status to 'approved'
        if (job_card_id) {
          try {
            const [invRows] = await db.query('SELECT total_amount FROM invoices WHERE job_card_id = ?', [job_card_id]);
            const [ngstRows] = await db.query('SELECT total_amount FROM invoices_non_gst WHERE job_card_id = ? AND deleted_at IS NULL', [job_card_id]);
            const [payRows] = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments WHERE job_card_id = ?', [job_card_id]);
            const [advRows] = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM advance_payments WHERE job_card_id = ?', [job_card_id]);
            
            const billed = invRows.length > 0 ? parseFloat(invRows[0].total_amount) : (ngstRows.length > 0 ? parseFloat(ngstRows[0].total_amount) : 0);
            const totalPaidSoFar = parseFloat(payRows[0].total) + parseFloat(advRows[0].total);

            if (billed > 0 && totalPaidSoFar >= billed - 0.01) {
              await db.execute("UPDATE invoices SET payment_status = 'approved', payment_mode = ? WHERE job_card_id = ?", [payment_mode, job_card_id]);
              await db.execute("UPDATE invoices_non_gst SET payment_status = 'approved', payment_mode = ? WHERE job_card_id = ?", [payment_mode, job_card_id]);
              await db.execute("UPDATE job_cards SET payment_mode = ? WHERE id = ?", [payment_mode, job_card_id]);
            }
          } catch (statusErr) {
            console.warn('Failed to auto-approve invoice payment_status:', statusErr.message);
          }
        }
      } catch (e) {
        console.error('Failed to log customer payment to cash ledger:', e.message);
      }
    }

    // Auto-sync entry to Staff Ledger if staff_id is specified
    if (staff_id && payment_mode !== 'discount') {
      try {
        const [staffRows] = await db.query('SELECT full_name FROM staff WHERE id = ?', [staff_id]);
        if (staffRows.length > 0) {
          const staffName = staffRows[0].full_name;
          const pDate = payment_date || new Date().toISOString().slice(0, 10);
          const ledgerDesc = `Payment collected for ${docNo ? docNo : 'Job Card / Estimate'} (Mode: ${payment_mode})`;

          await db.execute(
            `INSERT INTO staff_ledger (staff_id, staff_name, entry_date, veh_no, description, credit_amount, debit_amount, is_cash_ledger_synced)
             VALUES (?, ?, ?, ?, ?, ?, 0, 1)`,
            [
              parseInt(staff_id),
              staffName,
              pDate,
              regNo || null,
              ledgerDesc,
              parseFloat(amount)
            ]
          );
        }
      } catch (e) {
        console.error('Failed to sync payment to staff ledger:', e.message);
      }
    }

    res.status(201).json({ id: result.insertId, message: 'Payment recorded' });
  } catch (err) {
    console.error('POST /customer-payments error:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// ───── GET /api/customer-payments/outstanding ─────
router.get('/outstanding', async (req, res) => {
  try {
    const { estimate_only, invoice_only } = req.query;

    let subquery1 = `
      SELECT jc.id as job_card_id, NULL as estimate_id, jc.job_no as doc_no, jc.job_no, jc.reg_no, jc.car_name, jc.owner_name,
             jc.mobile_no,
             COALESCE(jc.company, 'Detailing Studio') as company,
             COALESCE(inv.invoice_no, ngst.invoice_no, est.estimate_no, jc.job_no) as invoice_no,
             DATE(COALESCE(inv.created_at, ngst.created_at, jc.closed_at, jc.created_at)) as doc_date,
             COALESCE(inv.total_amount, ngst.total_amount, est.total_amount, est.subtotal, jc.final_amount) as total_billed,
             COALESCE((SELECT SUM(amount) FROM advance_payments WHERE job_card_id = jc.id), 0) +
             COALESCE((SELECT SUM(amount) FROM customer_payments WHERE job_card_id = jc.id), 0) as total_paid,
             'Invoice' as type,
             COALESCE((SELECT GROUP_CONCAT(service_name SEPARATOR ', ') FROM job_card_services WHERE job_card_id = jc.id), jc.service_type, jc.job_category, 'Car Wash & Service') as service_type
      FROM job_cards jc
      LEFT JOIN invoices inv ON inv.job_card_id = jc.id
      LEFT JOIN estimates est ON est.job_card_id = jc.id
      LEFT JOIN invoices_non_gst ngst ON ngst.job_card_id = jc.id AND ngst.deleted_at IS NULL
      WHERE (inv.id IS NOT NULL OR est.id IS NOT NULL OR ngst.id IS NOT NULL OR jc.final_amount > 0)
    `;

    let subquery2 = `
      SELECT NULL as job_card_id, e.id as estimate_id, e.estimate_no as doc_no, e.estimate_no as job_no, e.reg_no, e.car_name, e.customer_name as owner_name,
             e.mobile_no,
             'Detailing Studio' as company,
             e.estimate_no as invoice_no,
             DATE(e.created_at) as doc_date,
             e.total_amount as total_billed,
             COALESCE((SELECT SUM(amount) FROM customer_payments WHERE estimate_id = e.id), 0) as total_paid,
             'Invoice' as type,
             COALESCE((SELECT GROUP_CONCAT(service_name SEPARATOR ', ') FROM estimate_services WHERE estimate_id = e.id), 'General Service') as service_type
      FROM estimates e
      WHERE e.job_card_id IS NULL
    `;

    if (invoice_only === 'true') {
      // ONLY GST Tax Invoices
      subquery1 = `
        SELECT jc.id as job_card_id, NULL as estimate_id, jc.job_no as doc_no, jc.job_no, jc.reg_no, jc.car_name, jc.owner_name,
               jc.mobile_no,
               COALESCE(jc.company, 'Detailing Studio') as company,
               inv.invoice_no,
               DATE(COALESCE(inv.created_at, jc.closed_at, jc.created_at)) as doc_date,
               inv.total_amount as total_billed,
               COALESCE((SELECT SUM(amount) FROM advance_payments WHERE job_card_id = jc.id), 0) +
               COALESCE((SELECT SUM(amount) FROM customer_payments WHERE job_card_id = jc.id), 0) as total_paid,
               'Invoice' as type,
               COALESCE((SELECT GROUP_CONCAT(service_name SEPARATOR ', ') FROM job_card_services WHERE job_card_id = jc.id), jc.service_type, jc.job_category, 'Car Wash & Service') as service_type
        FROM job_cards jc
        JOIN invoices inv ON inv.job_card_id = jc.id
      `;
      subquery2 = null;
    } else if (estimate_only === 'true') {
      // Estimate Invoices (Non-GST) AND Estimates
      subquery1 = `
        SELECT jc.id as job_card_id, NULL as estimate_id, jc.job_no as doc_no, jc.job_no, jc.reg_no, jc.car_name, jc.owner_name,
               jc.mobile_no,
               COALESCE(jc.company, 'Detailing Studio') as company,
               COALESCE(ngst.invoice_no, est.estimate_no, jc.job_no) as invoice_no,
               DATE(COALESCE(ngst.created_at, est.created_at, jc.closed_at, jc.created_at)) as doc_date,
               COALESCE(ngst.total_amount, est.total_amount, est.subtotal, jc.final_amount) as total_billed,
               COALESCE((SELECT SUM(amount) FROM advance_payments WHERE job_card_id = jc.id), 0) +
               COALESCE((SELECT SUM(amount) FROM customer_payments WHERE job_card_id = jc.id), 0) as total_paid,
               'Invoice' as type,
               COALESCE((SELECT GROUP_CONCAT(service_name SEPARATOR ', ') FROM job_card_services WHERE job_card_id = jc.id), jc.service_type, jc.job_category, 'Car Wash & Service') as service_type
        FROM job_cards jc
        LEFT JOIN invoices_non_gst ngst ON ngst.job_card_id = jc.id AND ngst.deleted_at IS NULL
        LEFT JOIN estimates est ON est.job_card_id = jc.id
        WHERE (ngst.id IS NOT NULL OR est.id IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM invoices WHERE job_card_id = jc.id)
      `;
      subquery2 = `
        SELECT NULL as job_card_id, e.id as estimate_id, e.estimate_no as doc_no, e.estimate_no as job_no, e.reg_no, e.car_name, e.customer_name as owner_name,
               e.mobile_no,
               'Detailing Studio' as company,
               e.estimate_no as invoice_no,
               DATE(e.created_at) as doc_date,
               e.total_amount as total_billed,
               COALESCE((SELECT SUM(amount) FROM customer_payments WHERE estimate_id = e.id), 0) as total_paid,
               'Invoice' as type,
               COALESCE((SELECT GROUP_CONCAT(service_name SEPARATOR ', ') FROM estimate_services WHERE estimate_id = e.id), 'General Service') as service_type
        FROM estimates e
        WHERE e.job_card_id IS NULL
      `;
    }

    let subquery3 = null;
    if (invoice_only !== 'true') {
      subquery3 = `
        SELECT -(ps.id) as job_card_id, NULL as estimate_id, ps.invoice_no as doc_no, ps.invoice_no as job_no, COALESCE(ps.vehicle_no, '') as reg_no,
               COALESCE(ps.car_name, '') as car_name, COALESCE(NULLIF(TRIM(ps.customer_name), ''), 'Walk-in Customer') as owner_name,
               COALESCE(ps.customer_mobile, '') as mobile_no,
               'Accessories' as company,
               ps.invoice_no,
               DATE(ps.sale_date) as doc_date,
               (ps.price + COALESCE(ps.tax_amount, 0)) as total_billed,
               COALESCE((SELECT SUM(amount) FROM customer_payments WHERE remarks LIKE CONCAT('%', ps.invoice_no, '%') OR remarks LIKE CONCAT('%Accessory Sale: ', ps.product_name, '%')), 0) as total_paid,
               'Invoice' as type,
               ps.product_name as service_type
        FROM product_sales ps
        WHERE LOWER(ps.payment_mode) = 'credit'
      `;
    }

    const subqueries = [subquery1, subquery2, subquery3].filter(Boolean);
    const query = `
      SELECT * FROM (
        ${subqueries.join('\n UNION ALL \n')}
      ) as outstanding_payments
      WHERE (total_billed - total_paid) > 0
      ORDER BY total_billed - total_paid DESC
    `;

    const [rows] = await db.query(query);

    let summary = {
      total_count: rows.length,
      gst_count: 0,
      estimate_count: 0,
      total_outstanding: 0,
      gst_outstanding: 0,
      estimate_outstanding: 0
    };

    try {
      const [countsResult] = await db.query(`
        SELECT 
          COUNT(*) as total_count,
          COUNT(*) as gst_count,
           0 as estimate_count,
           COALESCE(SUM(total_billed - total_paid), 0) as total_outstanding,
           COALESCE(SUM(total_billed - total_paid), 0) as gst_outstanding,
           0 as estimate_outstanding
        FROM (
          SELECT jc.id,
                 COALESCE(inv.total_amount, ngst.total_amount, est.total_amount, est.subtotal, jc.final_amount) as total_billed,
                 COALESCE((SELECT SUM(amount) FROM advance_payments WHERE job_card_id = jc.id), 0) +
                 COALESCE((SELECT SUM(amount) FROM customer_payments WHERE job_card_id = jc.id), 0) as total_paid,
                 'Invoice' as type
          FROM job_cards jc
          LEFT JOIN invoices inv ON inv.job_card_id = jc.id
          LEFT JOIN estimates est ON est.job_card_id = jc.id
          LEFT JOIN invoices_non_gst ngst ON ngst.job_card_id = jc.id AND ngst.deleted_at IS NULL
          WHERE (inv.id IS NOT NULL OR est.id IS NOT NULL OR ngst.id IS NOT NULL OR jc.final_amount > 0)

          UNION ALL

          SELECT NULL as id,
                 e.total_amount as total_billed,
                 COALESCE((SELECT SUM(amount) FROM customer_payments WHERE estimate_id = e.id), 0) as total_paid,
                 'Invoice' as type
          FROM estimates e
          WHERE e.job_card_id IS NULL

          UNION ALL

          SELECT NULL as id,
                 (ps.price + COALESCE(ps.tax_amount, 0)) as total_billed,
                 COALESCE((SELECT SUM(amount) FROM customer_payments WHERE remarks LIKE CONCAT('%', ps.invoice_no, '%') OR remarks LIKE CONCAT('%Accessory Sale: ', ps.product_name, '%')), 0) as total_paid,
                 'Invoice' as type
          FROM product_sales ps
          WHERE LOWER(ps.payment_mode) = 'credit'
        ) as all_dues
        WHERE (total_billed - total_paid) > 0
      `);
      if (countsResult && countsResult.length > 0) {
        summary = {
          total_count: parseInt(countsResult[0].total_count) || 0,
          gst_count: parseInt(countsResult[0].gst_count) || 0,
          estimate_count: parseInt(countsResult[0].estimate_count) || 0,
          total_outstanding: parseFloat(countsResult[0].total_outstanding) || 0,
          gst_outstanding: parseFloat(countsResult[0].gst_outstanding) || 0,
          estimate_outstanding: parseFloat(countsResult[0].estimate_outstanding) || 0
        };
      }
    } catch (countErr) {
      console.warn('Could not compute dues summary:', countErr.message);
    }

    res.json({ data: rows, summary });
  } catch (err) {
    console.error('GET /customer-payments/outstanding error:', err);
    res.status(500).json({ error: 'Failed to fetch outstanding payments' });
  }
});

// ───── PATCH /api/customer-payments/approve-invoice ─────
router.patch('/approve-invoice', async (req, res) => {
  try {
    const { job_card_id, invoice_type = 'gst' } = req.body;
    if (!job_card_id) return res.status(400).json({ error: 'job_card_id is required' });

    let invoice = null;
    if (invoice_type === 'non_gst') {
      const [rows] = await db.query(
        'SELECT i.*, jc.job_no, jc.company FROM invoices_non_gst i LEFT JOIN job_cards jc ON i.job_card_id = jc.id WHERE i.job_card_id = ? AND i.deleted_at IS NULL',
        [job_card_id]
      );
      if (rows.length > 0) invoice = rows[0];
      await db.execute("UPDATE invoices_non_gst SET payment_status = 'approved' WHERE job_card_id = ?", [job_card_id]);
    } else {
      const [rows] = await db.query(
        'SELECT i.*, jc.job_no, jc.company FROM invoices i LEFT JOIN job_cards jc ON i.job_card_id = jc.id WHERE i.job_card_id = ?',
        [job_card_id]
      );
      if (rows.length > 0) invoice = rows[0];
      await db.execute("UPDATE invoices SET payment_status = 'approved' WHERE job_card_id = ?", [job_card_id]);
    }

    if (invoice) {
      const amount = parseFloat(invoice.total_amount || 0);
      const payMode = invoice.payment_mode || 'cash';
      const invNo = invoice.invoice_no || '';
      const jobNo = invoice.job_no || '';
      const compName = invoice.company || 'Detailing Studio';

      // Record customer payment entry if not already logged
      const [existingPay] = await db.query('SELECT id FROM customer_payments WHERE job_card_id = ?', [job_card_id]);
      if (existingPay.length === 0 && amount > 0) {
        await db.execute(
          `INSERT INTO customer_payments (job_card_id, amount, payment_mode, payment_date, remarks, created_by)
           VALUES (?, ?, ?, CURRENT_DATE(), ?, ?)`,
          [job_card_id, amount, payMode, `Admin approved payment for Invoice: ${invNo}`, req.user?.id || null]
        );

        if (payMode !== 'pending' && payMode !== 'manual_settlement') {
          await db.execute(
            `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
             VALUES ('in', ?, 'Customer Payment', ?, NOW(), ?)`,
            [amount, `Payment received for Job Card ${jobNo} (Invoice: ${invNo}) via ${payMode}`, compName]
          );
        }
      }
    }

    res.json({ message: 'Payment status approved successfully' });
  } catch (err) {
    console.error('PATCH /customer-payments/approve-invoice error:', err);
    res.status(500).json({ error: 'Failed to approve payment status' });
  }
});

// ───── GET /api/customer-payments/export-pending-excel ─────
router.get('/export-pending-excel', async (req, res) => {
  try {
    const { month } = req.query;
    let whereClause = `WHERE (COALESCE(inv.total_amount, ngst.total_amount, jc.final_amount, 0) - COALESCE((SELECT SUM(amount) FROM customer_payments WHERE job_card_id = jc.id), 0)) > 0.01`;
    const params = [];
    if (month && month !== 'all') {
      whereClause += ` AND DATE_FORMAT(jc.job_date, '%Y-%m') = ?`;
      params.push(month);
    }

    const [rows] = await db.query(`
      SELECT 
        jc.job_no as 'Job / Document No',
        COALESCE(inv.invoice_no, ngst.invoice_no, '—') as 'Invoice No',
        DATE_FORMAT(jc.job_date, '%Y-%m-%d') as 'Job Date',
        COALESCE(jc.company, 'Detailing Studio') as 'Company',
        COALESCE(jc.owner_name, c.customer_name, '—') as 'Customer Name',
        COALESCE(jc.mobile_no, c.mobile_no, '—') as 'Mobile No',
        COALESCE(jc.reg_no, '—') as 'Vehicle Reg No',
        COALESCE(jc.car_name, '—') as 'Car Model',
        COALESCE(inv.total_amount, ngst.total_amount, jc.final_amount, 0) as 'Total Billed ₹',
        COALESCE((SELECT SUM(amount) FROM customer_payments WHERE job_card_id = jc.id), 0) as 'Total Paid ₹',
        (COALESCE(inv.total_amount, ngst.total_amount, jc.final_amount, 0) - COALESCE((SELECT SUM(amount) FROM customer_payments WHERE job_card_id = jc.id), 0)) as 'Pending Outstanding ₹',
        'Pending' as 'Status'
      FROM job_cards jc
      LEFT JOIN invoices inv ON inv.job_card_id = jc.id
      LEFT JOIN invoices_non_gst ngst ON ngst.job_card_id = jc.id AND ngst.deleted_at IS NULL
      LEFT JOIN customers c ON jc.customer_id = c.id
      ${whereClause}
      ORDER BY jc.job_date DESC, jc.id DESC
    `, params);

    const suffix = month && month !== 'all' ? `_${month}` : '';
    createExcelResponse(res, `HAPPYGMS_Pending_Balances${suffix}_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { sheetName: 'Pending Outstanding Bills', data: rows.length ? rows : [{ 'Status': 'All balances settled' }] }
    ]);
  } catch (err) {
    console.error('GET /export-pending-excel error:', err);
    res.status(500).json({ error: 'Failed to export pending excel: ' + err.message });
  }
});

// ───── POST /api/customer-payments/bulk-clear-pending ─────
router.post('/bulk-clear-pending', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { payment_mode = 'cash', payment_date, job_card_ids, estimate_ids, customer_name, month, remarks = 'Cleared pending balance' } = req.body;
    const pDate = payment_date || new Date().toISOString().slice(0, 10);

    let sql = `
      SELECT jc.id as job_card_id, NULL as estimate_id, jc.job_no, jc.job_date, jc.reg_no, jc.car_name, jc.owner_name,
             COALESCE((SELECT GROUP_CONCAT(service_name SEPARATOR ', ') FROM job_card_services WHERE job_card_id = jc.id), jc.service_type, jc.job_category, 'Car Wash & Service') as service_type,
             jc.mobile_no,
             COALESCE(jc.company, 'Detailing Studio') as company,
             COALESCE(inv.invoice_no, ngst.invoice_no, jc.job_no) as invoice_no,
             COALESCE(inv.total_amount, ngst.total_amount, jc.final_amount) as total_billed,
             COALESCE((SELECT SUM(amount) FROM customer_payments WHERE job_card_id = jc.id), 0) as total_paid
      FROM job_cards jc
      LEFT JOIN invoices inv ON inv.job_card_id = jc.id
      LEFT JOIN invoices_non_gst ngst ON ngst.job_card_id = jc.id AND ngst.deleted_at IS NULL
      LEFT JOIN customers c ON jc.customer_id = c.id
      WHERE (inv.id IS NOT NULL OR ngst.id IS NOT NULL OR jc.final_amount > 0)
    `;
    const params = [];
    if (job_card_ids && Array.isArray(job_card_ids) && job_card_ids.length > 0) {
      sql += ` AND jc.id IN (${job_card_ids.map(() => '?').join(',')})`;
      params.push(...job_card_ids);
    } else if (customer_name && customer_name.trim()) {
      sql += ` AND (LOWER(TRIM(jc.owner_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(c.customer_name)) = LOWER(TRIM(?)))`;
      params.push(customer_name.trim(), customer_name.trim());
    } else if (month && month !== 'all') {
      sql += ` AND DATE_FORMAT(jc.job_date, '%Y-%m') = ?`;
      params.push(month);
    }
    const [rows] = await conn.query(sql, params);

    const pendingJobs = rows.filter(r => (parseFloat(r.total_billed || 0) - parseFloat(r.total_paid || 0)) > 0.01);

    let clearedCount = 0;
    let totalClearedAmount = 0;
    const clearedItems = [];

    for (const job of pendingJobs) {
      const bal = parseFloat((parseFloat(job.total_billed) - parseFloat(job.total_paid)).toFixed(2));
      if (bal <= 0) continue;

      // 1. Insert customer payment
      await conn.execute(
        `INSERT INTO customer_payments (job_card_id, amount, payment_mode, payment_date, remarks, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [job.job_card_id, bal, payment_mode, pDate, remarks, req.user?.id || null]
      );

      // 2. Update job_cards payment_mode
      await conn.execute(
        `UPDATE job_cards SET payment_mode = ? WHERE id = ?`,
        [payment_mode, job.job_card_id]
      );

      // 3. Update invoices
      await conn.execute(
        `UPDATE invoices SET payment_status = 'approved', payment_mode = ? WHERE job_card_id = ?`,
        [payment_mode, job.job_card_id]
      );
      await conn.execute(
        `UPDATE invoices_non_gst SET payment_status = 'approved' WHERE job_card_id = ?`,
        [job.job_card_id]
      );

      // 4. Update cash_ledger
      if (payment_mode !== 'discount') {
        const desc = `Payment received for Job Card ${job.job_no} (${job.invoice_no}) via ${payment_mode} - ${remarks}`;
        await conn.execute(
          `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
           VALUES ('in', ?, 'Customer Payment', ?, ?, ?)`,
          [bal, desc, pDate, job.company]
        );
      }

      clearedCount++;
      totalClearedAmount += bal;
      clearedItems.push({
        job_card_id: job.job_card_id,
        doc_no: job.job_no,
        invoice_no: job.invoice_no,
        job_date: job.job_date,
        reg_no: job.reg_no,
        car_name: job.car_name,
        service_type: job.service_type || 'Car Wash / Detailing',
        total_billed: parseFloat(job.total_billed || 0),
        cleared_amount: bal
      });
    }

    // Also process estimate_ids if provided
    if (estimate_ids && Array.isArray(estimate_ids) && estimate_ids.length > 0) {
      for (const estId of estimate_ids) {
        const [estRows] = await conn.query(`
          SELECT e.id, e.estimate_no, e.customer_name, e.mobile_no, e.car_name, e.reg_no, e.total_amount as total_billed, e.created_at,
                 COALESCE((SELECT GROUP_CONCAT(service_name SEPARATOR ', ') FROM estimate_services WHERE estimate_id = e.id), 'Estimate Service') as service_type,
                 COALESCE((SELECT SUM(amount) FROM customer_payments WHERE estimate_id = e.id), 0) as total_paid
          FROM estimates e WHERE e.id = ?
        `, [estId]);
        if (estRows.length > 0) {
          const est = estRows[0];
          const bal = parseFloat((parseFloat(est.total_billed || 0) - parseFloat(est.total_paid || 0)).toFixed(2));
          if (bal > 0.01) {
            await conn.execute(
              `INSERT INTO customer_payments (estimate_id, amount, payment_mode, payment_date, remarks, created_by)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [estId, bal, payment_mode, pDate, remarks, req.user?.id || null]
            );
            if (payment_mode !== 'discount') {
              const desc = `Payment received for Estimate ${est.estimate_no} via ${payment_mode} - ${remarks}`;
              await conn.execute(
                `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
                 VALUES ('in', ?, 'Customer Payment', ?, ?, 'Detailing Studio')`,
                [bal, desc, pDate]
              );
            }
            clearedCount++;
            totalClearedAmount += bal;
            clearedItems.push({
              estimate_id: est.id,
              doc_no: est.estimate_no,
              invoice_no: est.estimate_no,
              job_date: est.created_at,
              reg_no: est.reg_no,
              car_name: est.car_name,
              service_type: est.service_type || 'Estimate Service',
              total_billed: parseFloat(est.total_billed || 0),
              cleared_amount: bal
            });
          }
        }
      }
    }
    // Also process accessory credit sales (negative IDs in job_card_ids, or customer_name match)
    const accIds = (job_card_ids && Array.isArray(job_card_ids)) ? job_card_ids.filter(id => parseInt(id) < 0).map(id => Math.abs(parseInt(id))) : [];
    if (accIds.length > 0 || (customer_name && customer_name.trim())) {
      let accSql = `SELECT id, invoice_no, product_name, price, tax_amount, customer_name, sale_date FROM product_sales WHERE LOWER(payment_mode) = 'credit'`;
      const accParams = [];
      if (accIds.length > 0) {
        accSql += ` AND id IN (${accIds.map(() => '?').join(',')})`;
        accParams.push(...accIds);
      } else if (customer_name && customer_name.trim()) {
        accSql += ` AND LOWER(TRIM(customer_name)) = LOWER(TRIM(?))`;
        accParams.push(customer_name.trim());
      }
      const [accRows] = await conn.query(accSql, accParams);
      for (const ps of accRows) {
        const tot = parseFloat(ps.price || 0) + parseFloat(ps.tax_amount || 0);
        await conn.execute('UPDATE product_sales SET payment_mode = ? WHERE id = ?', [payment_mode, ps.id]);
        await conn.execute(
          `INSERT INTO customer_payments (amount, payment_mode, payment_date, remarks, created_by)
           VALUES (?, ?, ?, ?, ?)`,
          [tot, payment_mode, pDate, `Payment received for Accessory Invoice ${ps.invoice_no || `ACC-${ps.id}`} (${ps.product_name}) - ${remarks}`, req.user?.id || null]
        );
        if (payment_mode !== 'discount') {
          const desc = `Payment received for Accessory Invoice ${ps.invoice_no || `ACC-${ps.id}`} via ${payment_mode} - ${remarks}`;
          await conn.execute(
            `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
             VALUES ('in', ?, 'Customer Payment', ?, ?, 'Accessories')`,
            [tot, desc, pDate]
          );
        }
        clearedCount++;
        totalClearedAmount += tot;
        clearedItems.push({
          doc_no: ps.invoice_no || `ACC-${ps.id}`,
          invoice_no: ps.invoice_no || `ACC-${ps.id}`,
          job_date: ps.sale_date,
          reg_no: '—',
          car_name: ps.product_name,
          service_type: 'Accessory / Product',
          total_billed: tot,
          cleared_amount: tot
        });
      }
    }

    await conn.commit();
    conn.release();

    res.json({
      success: true,
      cleared_count: clearedCount,
      total_cleared_amount: parseFloat(totalClearedAmount.toFixed(2)),
      items: clearedItems,
      message: `Successfully cleared ${clearedCount} pending bills totaling ₹${totalClearedAmount.toLocaleString('en-IN')}`
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('POST /bulk-clear-pending error:', err);
    res.status(500).json({ error: 'Failed to bulk clear pending payments: ' + err.message });
  }
});

// ───── POST /api/customer-payments/clear-from-excel-sheet ─────
router.post('/clear-from-excel-sheet', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { sheet_name = 'SEP 2026', payment_mode = 'cash', payment_date } = req.body;
    const excelPath = path.join(__dirname, '../../../2024_HAAPY CAR WASH WROKING SHEET...xlsx');
    if (!fs.existsSync(excelPath)) {
      conn.release();
      return res.status(404).json({ error: 'Excel working sheet not found at root path' });
    }

    const wb = XLSX.readFile(excelPath);
    const ws = wb.Sheets[sheet_name];
    if (!ws) {
      conn.release();
      return res.status(404).json({ error: `Sheet '${sheet_name}' not found in workbook` });
    }

    await conn.beginTransaction();
    const pDate = payment_date || new Date().toISOString().slice(0, 10);

    let dateFilter = '';
    if (sheet_name && sheet_name.toUpperCase().includes('SEP 2026')) {
      dateFilter = ` AND DATE_FORMAT(jc.job_date, '%Y-%m') = '2026-09'`;
    }

    const [pendingJobs] = await conn.query(`
      SELECT jc.id, jc.job_no, jc.reg_no, jc.owner_name, jc.mobile_no, jc.final_amount,
             COALESCE(jc.company, 'Detailing Studio') as company,
             COALESCE(inv.invoice_no, jc.job_no) as invoice_no,
             (COALESCE(inv.total_amount, jc.final_amount, 0) - COALESCE((SELECT SUM(amount) FROM customer_payments WHERE job_card_id = jc.id), 0)) as bal
      FROM job_cards jc
      LEFT JOIN invoices inv ON inv.job_card_id = jc.id
      WHERE (COALESCE(inv.total_amount, jc.final_amount, 0) - COALESCE((SELECT SUM(amount) FROM customer_payments WHERE job_card_id = jc.id), 0)) > 0.01
      ${dateFilter}
    `);

    let clearedCount = 0;
    let totalCleared = 0;

    for (const job of pendingJobs) {
      const bal = parseFloat(job.bal);
      if (bal <= 0) continue;

      await conn.execute(
        `INSERT INTO customer_payments (job_card_id, amount, payment_mode, payment_date, remarks, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [job.id, bal, payment_mode, pDate, `Cleared pending balance from Excel working sheet (${sheet_name})`, req.user?.id || null]
      );

      await conn.execute(`UPDATE job_cards SET payment_mode = ? WHERE id = ?`, [payment_mode, job.id]);
      await conn.execute(`UPDATE invoices SET payment_status = 'approved', payment_mode = ? WHERE job_card_id = ?`, [payment_mode, job.id]);

      const desc = `Payment received for Job Card ${job.job_no} (${job.invoice_no}) via ${payment_mode} - Cleared from Excel (${sheet_name})`;
      await conn.execute(
        `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
         VALUES ('in', ?, 'Customer Payment', ?, ?, ?)`,
        [bal, desc, pDate, job.company]
      );

      clearedCount++;
      totalCleared += bal;
    }

    await conn.commit();
    conn.release();

    res.json({
      success: true,
      cleared_count: clearedCount,
      total_cleared_amount: parseFloat(totalCleared.toFixed(2)),
      message: `Cleared ${clearedCount} pending jobs from Excel sheet '${sheet_name}' (Total: ₹${totalCleared.toLocaleString('en-IN')})`
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('POST /clear-from-excel-sheet error:', err);
    res.status(500).json({ error: 'Failed to clear from Excel: ' + err.message });
  }
});

// ───── GET /api/customer-payments/:id ─────
router.get('/:id', async (req, res) => {
  try {
    const payId = parseInt(req.params.id);

    // Support product sales (represented with negative IDs in payment history)
    if (payId < 0) {
      const psId = Math.abs(payId);
      const [psRows] = await db.query('SELECT * FROM product_sales WHERE id = ?', [psId]);
      if (psRows.length === 0) return res.status(404).json({ error: 'Product sale not found' });
      const ps = psRows[0];

      let items = [];
      if (ps.items) {
        try {
          items = typeof ps.items === 'string' ? JSON.parse(ps.items) : ps.items;
        } catch {}
      }
      if (!items || items.length === 0) {
        items = [{
          id: `ps-${ps.id}`,
          service_name: ps.product_name || 'Car Accessory',
          hsn_sac: '8708',
          qty: parseInt(ps.qty) || 1,
          rate: parseFloat(ps.price) || 0,
          tax_pct: parseFloat(ps.tax_pct) || 0,
          tax_amount: parseFloat(ps.tax_amount) || 0,
          amount: parseFloat(ps.price) || 0
        }];
      } else {
        items = items.map((it, idx) => ({
          id: it.id || `ps-item-${idx}`,
          service_name: it.product_name || it.name || ps.product_name || 'Accessory Item',
          hsn_sac: it.hsn_sac || '8708',
          qty: parseInt(it.qty) || 1,
          rate: parseFloat(it.price || it.rate) || 0,
          tax_pct: parseFloat(it.tax_pct || ps.tax_pct) || 0,
          tax_amount: parseFloat(it.tax_amount) || 0,
          amount: parseFloat(it.total || it.price) || 0
        }));
      }
      const amt = parseFloat(ps.price) || 0;
      return res.json({
        data: {
          id: -ps.id,
          amount: amt,
          payment_mode: ps.payment_mode || 'cash',
          payment_date: ps.sale_date,
          owner_name: ps.customer_name || 'Walk-in Customer',
          mobile_no: ps.customer_mobile || '',
          address: ps.customer_address || '',
          customer_gstin: '',
          reg_no: ps.vehicle_no || '',
          car_name: ps.car_name || '',
          company: 'Accessories',
          is_quick_job: 0,
          service_type: ps.product_name || 'Car Accessories',
          invoice_no: ps.invoice_no || `ACC-${String(ps.id).padStart(4, '0')}`,
          total_billed: amt,
          total_paid: amt,
          balance_due: 0,
          staff_name: 'Accessory Desk',
          remarks: `Accessory Sale: ${ps.product_name}`
        },
        services: items,
        business: {
          name: 'Happy Car Wash & Accessories',
          address: '8/9 GIDC - Vadsar Main Road Mohangiri, opp. Uma Co Op Bank Ltd, near Bank Of Baroda, Makarpura, Vadodara, Gujarat 390010',
          phone: '99986 25511',
          email: 'contact@happycarwash.com',
          gstin: ''
        }
      });
    }

    const [rows] = await db.query(
      `SELECT cp.*, jc.job_no, jc.is_quick_job, est.estimate_no,
              COALESCE(inv.invoice_no, ngst.invoice_no, est.estimate_no, jc.job_no, '—') as invoice_no,
              COALESCE(NULLIF(TRIM(cp.reg_no), ''), jc.reg_no, est.reg_no, '') as reg_no,
              COALESCE(NULLIF(TRIM(cp.car_name), ''), jc.car_name, est.car_name, '') as car_name,
              COALESCE(NULLIF(TRIM(cp.owner_name), ''), jc.owner_name, est.customer_name, '') as owner_name,
              COALESCE(NULLIF(TRIM(cp.mobile_no), ''), jc.mobile_no, est.mobile_no, '') as mobile_no,
              COALESCE(NULLIF(TRIM(cp.address), ''), c.address_line, '') as address,
              COALESCE(c.city, '') as city,
              COALESCE(NULLIF(TRIM(cp.customer_gstin), ''), c.gstin, '') as customer_gstin,
              COALESCE(v.model, jc.car_name, '') as vehicle_model,
              CASE
                WHEN jc.service_type REGEXP 'delux|dlx|teflon|taflon'
                  OR cp.remarks REGEXP 'delux|dlx|teflon|taflon'
                  OR cp.services_json REGEXP 'delux|dlx|teflon|taflon'
                  OR jc.id IN (
                    SELECT DISTINCT job_card_id FROM job_card_services
                    WHERE service_name REGEXP 'delux|dlx|teflon|taflon'
                  )
                  THEN 'Car Wash'
                WHEN jc.company = 'Accessories'
                  OR (cp.job_card_id IS NULL AND cp.estimate_id IS NULL AND (cp.remarks LIKE '%Accessory%' OR cp.services_json LIKE '%product%'))
                  THEN 'Accessories'
                WHEN jc.company = 'Car Wash' OR jc.is_quick_job = 1
                  THEN 'Car Wash'
                WHEN jc.company = 'Detailing Studio'
                  OR jc.service_type REGEXP 'coat|coting|ceram|ciram|ppf|polish|detail|rubb|buff|studio|interior|dry[[:space:]]*clean|deep[[:space:]]*clean|graphene|glass|headlight|spa'
                  OR cp.remarks REGEXP 'coat|coting|ceram|ciram|ppf|polish|detail|rubb|buff|studio|interior|dry[[:space:]]*clean|deep[[:space:]]*clean|graphene|glass|headlight|spa'
                  OR cp.services_json REGEXP 'coat|coting|ceram|ciram|ppf|polish|detail|rubb|buff|studio|interior|dry[[:space:]]*clean|deep[[:space:]]*clean|graphene|glass|headlight|spa'
                  THEN 'Detailing Studio'
                ELSE COALESCE(jc.company, 'Detailing Studio')
              END as company,
              COALESCE(jc.service_type, '') as service_type,
              COALESCE(inv.total_amount, ngst.total_amount, est.total_amount, jc.final_amount, cp.amount) as total_billed,
              st.full_name as staff_name,
              au.full_name as created_by_name
       FROM customer_payments cp
       LEFT JOIN job_cards jc ON cp.job_card_id = jc.id
       LEFT JOIN customers c ON jc.customer_id = c.id
       LEFT JOIN vehicles v ON jc.vehicle_id = v.id
       LEFT JOIN estimates est ON cp.estimate_id = est.id
       LEFT JOIN invoices inv ON inv.job_card_id = jc.id
       LEFT JOIN invoices_non_gst ngst ON ngst.job_card_id = jc.id AND ngst.deleted_at IS NULL
       LEFT JOIN staff st ON cp.staff_id = st.id
       LEFT JOIN admin_users au ON cp.created_by = au.id
       WHERE cp.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    const payment = rows[0];

    // Fetch services
    let services = [];
    if (payment.job_card_id) {
      const [svcRows] = await db.query('SELECT * FROM job_card_services WHERE job_card_id = ? ORDER BY id', [payment.job_card_id]);
      services = svcRows;
    } else if (payment.estimate_id) {
      const [estSvcRows] = await db.query('SELECT * FROM estimate_services WHERE estimate_id = ? ORDER BY id', [payment.estimate_id]);
      services = estSvcRows;
    }

    // Fallback to services_json if empty
    if ((!services || services.length === 0) && payment.services_json) {
      try {
        const parsed = typeof payment.services_json === 'string' ? JSON.parse(payment.services_json) : payment.services_json;
        if (Array.isArray(parsed) && parsed.length > 0) {
          services = parsed;
        }
      } catch (e) {
        console.warn('Failed to parse payment services_json:', e.message);
      }
    }

    // If still empty, provide meaningful service item rather than leaving it empty
    const isTeflonDeluxe = /delux|dlx|teflon|taflon/i.test(`${payment.service_type || ''} ${payment.remarks || ''} ${payment.services_json || ''}`) || services.some(s => /delux|dlx|teflon|taflon/i.test(s.service_name || s.name || ''));
    if (isTeflonDeluxe && payment.company !== 'Accessories') {
      payment.company = 'Car Wash';
      payment.is_quick_job = 1;
    }
    if (!services || services.length === 0) {
      const billedVal = parseFloat(payment.total_billed || payment.amount || 0);
      const isDet = !isTeflonDeluxe && (payment.company === 'Detailing Studio' || /coat|coting|ceram|ciram|ppf|polish|detail|rubb|buff|studio|interior|dry\s*clean|deep\s*clean|graphene|glass|headlight|spa/i.test(`${payment.service_type || ''} ${payment.remarks || ''}`));
      const svcTitle = payment.service_type || (isTeflonDeluxe ? `Car Wash Service (${payment.job_no || 'Walk-in'})` : isDet ? `Detailing Studio Service (${payment.job_no || 'Walk-in'})` : payment.company === 'Car Wash' ? `Car Wash Service (${payment.job_no || 'Walk-in'})` : `Car Wash & Detailing Service (${payment.job_no || 'Walk-in'})`);
      services = [{
        id: 'default-svc',
        service_name: svcTitle,
        hsn_sac: '998714',
        qty: 1,
        rate: billedVal,
        tax_pct: 0,
        tax_amount: 0,
        amount: billedVal
      }];
    }

    // Calculate total paid and balance due
    let totalPaid = 0;
    if (payment.job_card_id) {
      const [adv] = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM advance_payments WHERE job_card_id = ?', [payment.job_card_id]);
      const [pays] = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments WHERE job_card_id = ?', [payment.job_card_id]);
      totalPaid = parseFloat(adv[0]?.total || 0) + parseFloat(pays[0]?.total || 0);
    } else if (payment.estimate_id) {
      const [pays] = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments WHERE estimate_id = ?', [payment.estimate_id]);
      totalPaid = parseFloat(pays[0]?.total || 0);
    } else {
      totalPaid = parseFloat(payment.amount || 0);
    }

    const totalBilled = parseFloat(payment.total_billed || 0);
    const balanceDue = Math.max(0, totalBilled - totalPaid);

    // Dynamic Business Heading based on Company
    const compUpper = (payment.company || '').toUpperCase();
    let defaultBizName = 'Happy Car Detailing Studio';
    if (compUpper === 'CAR WASH' || payment.is_quick_job === 1 || isTeflonDeluxe) {
      defaultBizName = 'Happy Car Wash';
    } else if (compUpper.includes('ACCESSORIES') || compUpper.includes('PRODUCT')) {
      defaultBizName = 'Happy Car Wash & Accessories';
    }

    let business = {
      name: defaultBizName,
      address: '8/9 GIDC - Vadsar Main Road Mohangiri, opp. Uma Co Op Bank Ltd, near Bank Of Baroda, Makarpura, Vadodara, Gujarat 390010',
      phone: '99986 25511',
      email: 'contact@happycarwash.com',
      gstin: ''
    };
    try {
      const [sRows] = await db.query('SELECT setting_key, setting_value FROM settings');
      for (const r of sRows) {
        if (r.setting_key === 'business_name' && !payment.company) business.name = r.setting_value || business.name;
        if (r.setting_key === 'business_address') business.address = r.setting_value || business.address;
        if (r.setting_key === 'business_phone') business.phone = r.setting_value || business.phone;
        if (r.setting_key === 'business_email') business.email = r.setting_value || business.email;
        if (r.setting_key === 'business_gstin') business.gstin = r.setting_value || business.gstin;
      }
    } catch { /* ignore */ }

    res.json({
      data: {
        ...payment,
        total_paid: totalPaid,
        balance_due: balanceDue
      },
      services,
      business
    });
  } catch (err) {
    console.error('GET /customer-payments/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch payment details' });
  }
});

// ───── PUT /api/customer-payments/:id (Edit Whole Bill / Payment) ─────
router.put('/:id', async (req, res) => {
  try {
    const payId = parseInt(req.params.id);

    // Support editing product sales through negative IDs
    if (payId < 0) {
      const psId = Math.abs(payId);
      const [psRows] = await db.query('SELECT * FROM product_sales WHERE id = ?', [psId]);
      if (psRows.length === 0) return res.status(404).json({ error: 'Product sale not found' });
      const { amount, payment_mode, payment_date, owner_name, mobile_no, address, services, car_name, reg_no, vehicle_no } = req.body;
      const numAmount = amount !== undefined ? parseFloat(amount) : parseFloat(psRows[0].price);
      const cleanMode = payment_mode || psRows[0].payment_mode;
      const cleanDate = payment_date || psRows[0].sale_date;
      const cleanCust = owner_name !== undefined ? owner_name : psRows[0].customer_name;
      const cleanMob = mobile_no !== undefined ? mobile_no : psRows[0].customer_mobile;
      const cleanAddr = address !== undefined ? address : psRows[0].customer_address;
      const cleanCarName = car_name !== undefined ? car_name : psRows[0].car_name;
      const cleanVehNo = (reg_no !== undefined ? reg_no : vehicle_no) !== undefined ? (reg_no || vehicle_no) : psRows[0].vehicle_no;
      let itemsJson = psRows[0].items;
      let mainProdName = psRows[0].product_name;
      if (Array.isArray(services) && services.length > 0) {
        itemsJson = JSON.stringify(services);
        mainProdName = services[0].service_name || services[0].product_name || mainProdName;
      }
      await db.execute(
        `UPDATE product_sales 
         SET price = ?, payment_mode = ?, sale_date = ?, customer_name = ?, customer_mobile = ?, customer_address = ?, car_name = ?, vehicle_no = ?, items = ?, product_name = ?
         WHERE id = ?`,
        [numAmount, cleanMode, cleanDate, cleanCust, cleanMob, cleanAddr, cleanCarName, cleanVehNo, itemsJson, mainProdName, psId]
      );
      return res.json({
        success: true,
        message: 'Product sale updated successfully',
        data: {
          id: -psId,
          amount: numAmount,
          payment_mode: cleanMode,
          payment_date: cleanDate,
          owner_name: cleanCust,
          mobile_no: cleanMob,
          address: cleanAddr,
          service_type: mainProdName,
          total_billed: numAmount,
          total_paid: numAmount,
          balance_due: 0
        },
        services: Array.isArray(services) ? services : []
      });
    }

    const [existing] = await db.query('SELECT * FROM customer_payments WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Payment not found' });
    const old = existing[0];

    const {
      amount,
      payment_mode,
      payment_date,
      transaction_id,
      remarks,
      staff_id,
      owner_name,
      mobile_no,
      address,
      customer_gstin,
      reg_no,
      car_name,
      services
    } = req.body;

    const numAmount = amount !== undefined ? parseFloat(amount) : parseFloat(old.amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    const cleanMode = (payment_mode || old.payment_mode || 'cash').toString().toLowerCase().trim();
    const cleanDate = payment_date || (old.payment_date ? String(old.payment_date).slice(0, 10) : new Date().toISOString().slice(0, 10));
    const cleanStaffId = staff_id !== undefined ? (staff_id ? parseInt(staff_id) : null) : old.staff_id;
    const cleanTxn = transaction_id !== undefined ? (transaction_id ? String(transaction_id).trim() : null) : old.transaction_id;
    const cleanRemarks = remarks !== undefined ? (remarks ? String(remarks).trim() : null) : old.remarks;

    const cleanOwner = owner_name !== undefined ? (owner_name ? String(owner_name).trim() : '') : (old.owner_name || '');
    const cleanMobile = mobile_no !== undefined ? (mobile_no ? String(mobile_no).trim() : '') : (old.mobile_no || '');
    const cleanReg = reg_no !== undefined ? (reg_no ? String(reg_no).toUpperCase().trim() : '') : (old.reg_no || '');
    const cleanCar = car_name !== undefined ? (car_name ? String(car_name).trim() : '') : (old.car_name || '');
    const cleanAddr = address !== undefined ? (address ? String(address).trim() : '') : (old.address || '');
    const cleanGstin = customer_gstin !== undefined ? (customer_gstin ? String(customer_gstin).trim() : '') : (old.customer_gstin || '');

    // Calculate totals if services array provided
    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    const hasServiceEdits = Array.isArray(services) && services.length > 0;
    let servicesJson = null;

    if (hasServiceEdits) {
      for (const s of services) {
        const q = parseFloat(s.qty || 1) || 1;
        const r = parseFloat(s.rate !== undefined ? s.rate : (s.amount || 0)) || 0;
        const lineAmt = parseFloat((q * r).toFixed(2));
        const tp = parseFloat(s.tax_pct || 0) || 0;
        const ta = parseFloat(s.tax_amount !== undefined ? s.tax_amount : (lineAmt * tp / 100)) || 0;
        calculatedSubtotal += lineAmt;
        calculatedTax += ta;
      }
      servicesJson = JSON.stringify(services);
    }
    const newTotalBilled = hasServiceEdits ? parseFloat((calculatedSubtotal + calculatedTax).toFixed(2)) : null;

    // 1. Update customer_payments
    await db.execute(
      `UPDATE customer_payments 
       SET amount = ?, payment_mode = ?, payment_date = ?, transaction_id = ?, remarks = ?, staff_id = ?,
           owner_name = ?, mobile_no = ?, reg_no = ?, car_name = ?, address = ?, customer_gstin = ?,
           services_json = COALESCE(?, services_json)
       WHERE id = ?`,
      [
        numAmount, cleanMode, cleanDate, cleanTxn, cleanRemarks, cleanStaffId,
        cleanOwner || null, cleanMobile || null, cleanReg || null, cleanCar || null, cleanAddr || null, cleanGstin || null,
        servicesJson,
        req.params.id
      ]
    );

    let docNo = old.job_card_id ? `Job Card #${old.job_card_id}` : (old.estimate_id ? `Estimate #${old.estimate_id}` : `Bill #${old.id}`);
    let compName = 'Detailing Studio';

    // 2. If linked to Job Card
    if (old.job_card_id) {
      try {
        const [jcRows] = await db.query('SELECT * FROM job_cards WHERE id = ?', [old.job_card_id]);
        if (jcRows.length > 0) {
          const jc = jcRows[0];
          docNo = jc.job_no || `Job Card #${old.job_card_id}`;
          compName = jc.company || 'Detailing Studio';

          const finalAmt = newTotalBilled !== null ? newTotalBilled : (jc.final_amount || numAmount);
          const primaryService = (hasServiceEdits && services[0]?.service_name)
            ? services[0].service_name.trim()
            : (jc.service_type || 'Car Wash & Detailing');

          await db.execute(
            `UPDATE job_cards 
             SET owner_name = COALESCE(NULLIF(?, ''), owner_name),
                 mobile_no = COALESCE(NULLIF(?, ''), mobile_no),
                 reg_no = COALESCE(NULLIF(?, ''), reg_no),
                 car_name = COALESCE(NULLIF(?, ''), car_name),
                 vehicle_model = COALESCE(NULLIF(?, ''), vehicle_model),
                 service_type = ?,
                 final_amount = ?
             WHERE id = ?`,
            [
              cleanOwner,
              cleanMobile,
              cleanReg,
              cleanCar,
              cleanCar,
              primaryService,
              finalAmt,
              old.job_card_id
            ]
          );

          if (jc.customer_id) {
            await db.execute(
              `UPDATE customers 
               SET customer_name = COALESCE(NULLIF(?, ''), customer_name),
                   mobile_no = COALESCE(NULLIF(?, ''), mobile_no),
                   address_line = COALESCE(NULLIF(?, ''), address_line),
                   gstin = COALESCE(NULLIF(?, ''), gstin)
               WHERE id = ?`,
              [
                cleanOwner,
                cleanMobile,
                cleanAddr,
                cleanGstin,
                jc.customer_id
              ]
            );
          }

          if (jc.vehicle_id) {
            await db.execute(
              `UPDATE vehicles 
               SET reg_no = COALESCE(NULLIF(?, ''), reg_no),
                   model = COALESCE(NULLIF(?, ''), model)
               WHERE id = ?`,
              [
                cleanReg,
                cleanCar,
                jc.vehicle_id
              ]
            );
          }

          // If services array is provided, replace job_card_services (WITHOUT the non-existent 'description' column)
          if (hasServiceEdits) {
            await db.execute('DELETE FROM job_card_services WHERE job_card_id = ?', [old.job_card_id]);
            for (const s of services) {
              const q = parseFloat(s.qty || 1) || 1;
              const r = parseFloat(s.rate !== undefined ? s.rate : (s.amount || 0)) || 0;
              const lineAmt = parseFloat((q * r).toFixed(2));
              const tp = parseFloat(s.tax_pct || 0) || 0;
              const ta = parseFloat(s.tax_amount !== undefined ? s.tax_amount : (lineAmt * tp / 100)) || 0;
              await db.execute(
                `INSERT INTO job_card_services 
                 (job_card_id, service_name, item_type, qty, rate, amount, hsn_sac, tax_pct, tax_amount, is_selected)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                  old.job_card_id,
                  (s.service_name || s.name || 'Automotive Service').trim(),
                  s.item_type || 'labour',
                  q,
                  r,
                  lineAmt,
                  s.hsn_sac || '998714',
                  tp,
                  ta
                ]
              );
            }

            // Sync GST & Non-GST invoices
            const [hasInv] = await db.query('SELECT id FROM invoices WHERE job_card_id = ?', [old.job_card_id]);
            const [hasNgst] = await db.query('SELECT id FROM invoices_non_gst WHERE job_card_id = ? AND deleted_at IS NULL', [old.job_card_id]);

            if (hasInv.length > 0) {
              await db.execute(
                `UPDATE invoices 
                 SET subtotal = ?, gst_amount = ?, total_amount = ?, payment_mode = ?
                 WHERE job_card_id = ?`,
                [calculatedSubtotal, calculatedTax, newTotalBilled, cleanMode, old.job_card_id]
              );
            }
            if (hasNgst.length > 0) {
              await db.execute(
                `UPDATE invoices_non_gst 
                 SET subtotal = ?, total_amount = ?, payment_mode = ?,
                     customer_name = COALESCE(NULLIF(?, ''), customer_name),
                     mobile_no = COALESCE(NULLIF(?, ''), mobile_no),
                     reg_no = COALESCE(NULLIF(?, ''), reg_no),
                     car_name = COALESCE(NULLIF(?, ''), car_name)
                 WHERE job_card_id = ? AND deleted_at IS NULL`,
                [newTotalBilled, newTotalBilled, cleanMode, cleanOwner, cleanMobile, cleanReg, cleanCar, old.job_card_id]
              );
            } else if (hasInv.length === 0 && hasNgst.length === 0) {
              const invNo = jc.job_no || `HCW-${old.job_card_id}`;
              await db.execute(
                `INSERT INTO invoices_non_gst (job_card_id, invoice_no, subtotal, total_amount, payment_mode, customer_name, mobile_no, reg_no, car_name, payment_status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)`,
                [old.job_card_id, invNo, newTotalBilled, newTotalBilled, cleanMode, cleanOwner || jc.owner_name, cleanMobile || jc.mobile_no, cleanReg || jc.reg_no, cleanCar || jc.car_name, cleanDate]
              );
            }
          }
        }
      } catch (jcErr) {
        console.error('PUT /customer-payments/:id job card sync error:', jcErr);
      }
    } else if (old.estimate_id) {
      // 3. If linked to Estimate
      try {
        const finalAmt = newTotalBilled !== null ? newTotalBilled : numAmount;
        await db.execute(
          `UPDATE estimates 
           SET customer_name = COALESCE(NULLIF(?, ''), customer_name),
               mobile_no = COALESCE(NULLIF(?, ''), mobile_no),
               reg_no = COALESCE(NULLIF(?, ''), reg_no),
               car_name = COALESCE(NULLIF(?, ''), car_name),
               total_amount = ?
           WHERE id = ?`,
          [
            cleanOwner,
            cleanMobile,
            cleanReg,
            cleanCar,
            finalAmt,
            old.estimate_id
          ]
        );

        if (hasServiceEdits) {
          await db.execute('DELETE FROM estimate_services WHERE estimate_id = ?', [old.estimate_id]);
          for (const s of services) {
            const q = parseFloat(s.qty || 1) || 1;
            const r = parseFloat(s.rate !== undefined ? s.rate : (s.amount || 0)) || 0;
            const lineAmt = parseFloat((q * r).toFixed(2));
            await db.execute(
              `INSERT INTO estimate_services (estimate_id, service_name, qty, rate, amount, hsn_sac)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [old.estimate_id, (s.service_name || s.name || 'Service').trim(), q, r, lineAmt, s.hsn_sac || '998714']
            );
          }
        }
      } catch (estErr) {
        console.error('PUT /customer-payments/:id estimate sync error:', estErr);
      }
    }

    // 4. Sync cash ledger with accounts & daily report
    try {
      const [ledgerMatches] = await db.query(
        "SELECT id FROM cash_ledger WHERE category = 'Customer Payment' AND (description LIKE ? OR description LIKE ?)",
        [`%${old.job_card_id ? old.job_card_id : old.id}%`, `%${docNo}%`]
      );

      if (cleanMode === 'discount') {
        if (ledgerMatches.length > 0) {
          await db.execute("DELETE FROM cash_ledger WHERE id = ?", [ledgerMatches[0].id]);
        }
      } else {
        const desc = `Payment received for ${docNo} (Mode: ${cleanMode})${cleanRemarks ? ` - ${cleanRemarks}` : ''}`;
        const entryDateTime = cleanDate + ' 00:00:00';
        if (ledgerMatches.length > 0) {
          await db.execute(
            "UPDATE cash_ledger SET amount = ?, description = ?, entry_date = ?, company = ? WHERE id = ?",
            [numAmount, desc, entryDateTime, compName, ledgerMatches[0].id]
          );
        } else {
          await db.execute(
            `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
             VALUES ('in', ?, 'Customer Payment', ?, ?, ?)`,
            [numAmount, desc, entryDateTime, compName]
          );
        }
      }
    } catch (lErr) {
      console.warn('PUT /customer-payments/:id cash ledger warning:', lErr.message);
    }

    // 5. Fetch updated services
    let updatedServices = [];
    if (old.job_card_id) {
      const [svcRows] = await db.query('SELECT * FROM job_card_services WHERE job_card_id = ? ORDER BY id', [old.job_card_id]);
      updatedServices = svcRows;
    } else if (old.estimate_id) {
      const [estSvcRows] = await db.query('SELECT * FROM estimate_services WHERE estimate_id = ? ORDER BY id', [old.estimate_id]);
      updatedServices = estSvcRows;
    }

    if ((!updatedServices || updatedServices.length === 0) && hasServiceEdits) {
      updatedServices = services;
    }

    res.json({
      success: true,
      message: 'Payment bill updated successfully',
      data: {
        id: old.id,
        amount: numAmount,
        payment_mode: cleanMode,
        payment_date: cleanDate,
        transaction_id: cleanTxn,
        remarks: cleanRemarks,
        staff_id: cleanStaffId,
        owner_name: cleanOwner || old.owner_name,
        mobile_no: cleanMobile || old.mobile_no,
        address: cleanAddr || old.address,
        customer_gstin: cleanGstin || old.customer_gstin,
        reg_no: cleanReg || old.reg_no,
        car_name: cleanCar || old.car_name,
        total_billed: newTotalBilled !== null ? newTotalBilled : (old.total_billed || numAmount)
      },
      services: updatedServices
    });
  } catch (err) {
    console.error('PUT /customer-payments/:id error:', err);
    res.status(500).json({ error: 'Failed to update payment: ' + err.message });
  }
});

module.exports = router;
