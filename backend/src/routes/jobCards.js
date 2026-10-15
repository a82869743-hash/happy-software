const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');
const auth = require('../middleware/auth');
const { createExcelResponse } = require('../utils/excel');
const { sendWhatsAppMessage } = require('../utils/whatsapp');

const router = express.Router();
router.use(auth);

// Helper to normalize empty strings, 'null', 'undefined' to null for MySQL compatibility
const nullIfEmpty = (val) => (val === '' || val === undefined || val === 'null' || val === null) ? null : val;

// Helper to map and sanitize incoming fuel types to database-supported enum values
const normalizeFuelType = (fuel) => {
  if (fuel === '' || fuel === undefined || fuel === 'null' || fuel === null) return 'petrol';
  const f = String(fuel).toLowerCase().trim();
  if (f === 'ev' || f === 'electric') return 'electric';
  if (['petrol', 'diesel', 'cng', 'electric', 'hybrid'].includes(f)) {
    return f;
  }
  return 'petrol';
};

// ===============================================================
// VALID_TRANSITIONS — Enforced pipeline status flow
// Pipeline: rfe -> estimation -> spares_pending -> wip -> ready -> delivered -> invoiced
// 'cancelled' is reachable from any non-terminal state.
// ===============================================================
const VALID_TRANSITIONS = {
  rfe:             ['estimation', 'wip', 'ready', 'delivered', 'invoiced', 'cancelled'],
  estimation:      ['wip', 'ready', 'delivered', 'invoiced', 'cancelled'],
  spares_pending:  ['wip', 'ready', 'delivered', 'invoiced', 'cancelled'],
  wip:             ['ready', 'delivered', 'invoiced', 'cancelled', 'estimation'],
  ready:           ['wip', 'delivered', 'invoiced', 'cancelled'],
  delivered:       ['invoiced', 'ready'],
  invoiced:        ['delivered'],
  cancelled:       ['estimation', 'wip', 'ready'],
  active:          ['estimation', 'wip', 'ready', 'delivered', 'invoiced', 'cancelled'],
  done:            ['invoiced', 'delivered', 'ready', 'wip'],
};


// ----- Number Generators -----
async function generateJobNo(conn = db) {
  const [rows] = await conn.query(
    "SELECT job_no FROM job_cards ORDER BY id DESC LIMIT 1 FOR UPDATE"
  );
  if (rows.length === 0) return 'HCW001';
  const match = rows[0].job_no ? rows[0].job_no.match(/HCW(\d+)/i) || rows[0].job_no.match(/(\d+)$/) : null;
  const lastNum = match ? parseInt(match[1]) : rows.length;
  return `HCW${String(lastNum + 1).padStart(3, '0')}`;
}

async function generateRfeNo(conn = db) {
  const [rows] = await conn.query(
    "SELECT rfe_no FROM job_cards WHERE rfe_no IS NOT NULL ORDER BY id DESC LIMIT 1 FOR UPDATE"
  );
  if (rows.length === 0) return 'HCW001';
  const match = rows[0].rfe_no ? rows[0].rfe_no.match(/HCW(\d+)/i) || rows[0].rfe_no.match(/(\d+)$/) : null;
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

async function generateEstimateNo(conn = db) {
  const [rows] = await conn.query(
    "SELECT estimate_no FROM estimates ORDER BY id DESC LIMIT 1 FOR UPDATE"
  );
  if (rows.length === 0) return 'HCW001';
  const match = rows[0].estimate_no ? rows[0].estimate_no.match(/HCW(\d+)/i) || rows[0].estimate_no.match(/(\d+)$/) : null;
  const lastNum = match ? parseInt(match[1]) : rows.length;
  return `HCW${String(lastNum + 1).padStart(3, '0')}`;
}

async function recalculateJobCardTotals(jobCardId, conn = db) {
  // 1. Fetch job card
  const [jobRows] = await conn.query('SELECT * FROM job_cards WHERE id = ?', [jobCardId]);
  if (jobRows.length === 0) return;
  const jobCard = jobRows[0];

  // 2. Fetch active services
  const [services] = await conn.query(
    'SELECT * FROM job_card_services WHERE job_card_id = ? AND (is_selected = 1 OR is_selected IS NULL)', [jobCardId]
  );

  const services_subtotal = services.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
  const non_gst_services_subtotal = services.reduce((sum, s) => sum + parseFloat(s.amount || 0) + parseFloat(s.tax_amount || 0), 0);
  const cat_amount = parseFloat(jobCard.job_category_amount || 0);
  const subtotal = services_subtotal + cat_amount;
  const non_gst_subtotal = non_gst_services_subtotal + cat_amount;

  // 3. Check for GST invoice
  const [invRows] = await conn.query('SELECT * FROM invoices WHERE job_card_id = ?', [jobCardId]);
  if (invRows.length > 0) {
    const inv = invRows[0];
    const gst_pct = parseFloat(inv.gst_percent || 18);
    const services_gst = services.reduce((sum, s) => sum + parseFloat(s.tax_amount || 0), 0);
    const cat_gst_pct = jobCard.job_category_gst_pct !== null && jobCard.job_category_gst_pct !== undefined ? parseFloat(jobCard.job_category_gst_pct) : 18.00;
    const cat_gst = parseFloat((cat_amount * cat_gst_pct / 100).toFixed(2));
    const gst_amount = parseFloat((services_gst + cat_gst).toFixed(2));
    const total_amount = parseFloat((subtotal + gst_amount).toFixed(2));

    await conn.execute(
      'UPDATE invoices SET subtotal = ?, gst_amount = ?, total_amount = ? WHERE id = ?',
      [subtotal, gst_amount, total_amount, inv.id]
    );
    await conn.execute(
      'UPDATE job_cards SET final_amount = ? WHERE id = ?',
      [total_amount, jobCardId]
    );
    await conn.execute(
      "UPDATE customer_payments SET amount = ? WHERE job_card_id = ? AND remarks LIKE 'Automatically recorded on GST Invoice%'",
      [total_amount, jobCardId]
    );
    await conn.execute(
      "UPDATE cash_ledger SET amount = ? WHERE description LIKE ? AND description LIKE '%GST Invoice%'",
      [total_amount, `%Job Card ${jobCard.job_no}%`]
    );
  }

  // 4. Check for Non-GST invoice
  const [ngstRows] = await conn.query('SELECT * FROM invoices_non_gst WHERE job_card_id = ? AND deleted_at IS NULL', [jobCardId]);
  if (ngstRows.length > 0) {
    const ngst = ngstRows[0];
    const total_amount = parseFloat(non_gst_subtotal.toFixed(2));

    await conn.execute(
      'UPDATE invoices_non_gst SET subtotal = ?, total_amount = ? WHERE id = ?',
      [total_amount, total_amount, ngst.id]
    );
    await conn.execute(
      'UPDATE job_cards SET final_amount = ? WHERE id = ?',
      [total_amount, jobCardId]
    );
    await conn.execute(
      "UPDATE customer_payments SET amount = ? WHERE job_card_id = ? AND remarks LIKE 'Automatically recorded on Non-GST Invoice%'",
      [total_amount, jobCardId]
    );
    await conn.execute(
      "UPDATE cash_ledger SET amount = ? WHERE description LIKE ? AND description LIKE '%Non-GST Invoice%'",
      [total_amount, `%Job Card ${jobCard.job_no}%`]
    );
  }

  // 5. Check for Estimate
  const [estRows] = await conn.query('SELECT * FROM estimates WHERE job_card_id = ?', [jobCardId]);
  if (estRows.length > 0) {
    const est = estRows[0];
    const gst_pct = parseFloat(est.gst_percentage || 0);
    const isNonGstEst = gst_pct === 0 || est.estimate_type === 'non_gst_estimate';
    const effectiveSubtotal = isNonGstEst ? non_gst_subtotal : subtotal;
    const services_gst = gst_pct > 0 ? services.reduce((sum, s) => sum + parseFloat(s.tax_amount || 0), 0) : 0;
    const cat_gst_pct = gst_pct > 0 ? (jobCard.job_category_gst_pct !== null && jobCard.job_category_gst_pct !== undefined ? parseFloat(jobCard.job_category_gst_pct) : 18.00) : 0;
    const cat_gst = parseFloat((cat_amount * cat_gst_pct / 100).toFixed(2));
    const gst_amount = parseFloat((services_gst + cat_gst).toFixed(2));
    const total_amount = parseFloat((effectiveSubtotal + gst_amount).toFixed(2));

    await conn.execute(
      'UPDATE estimates SET subtotal = ?, gst_amount = ?, total_amount = ? WHERE id = ?',
      [effectiveSubtotal, gst_amount, total_amount, est.id]
    );
    await conn.execute(
      'UPDATE job_cards SET final_amount = ? WHERE id = ?',
      [total_amount, jobCardId]
    );
    await conn.execute(
      "UPDATE customer_payments SET amount = ? WHERE job_card_id = ? AND remarks LIKE 'Automatically recorded on Estimate%'",
      [total_amount, jobCardId]
    );
    await conn.execute(
      "UPDATE cash_ledger SET amount = ? WHERE description LIKE ? AND description LIKE '%Estimate%'",
      [total_amount, `%Job Card ${jobCard.job_no}%`]
    );

    // Sync estimate_services table
    await conn.execute('DELETE FROM estimate_services WHERE estimate_id = ?', [est.id]);
    for (const svc of services) {
      await conn.execute(
        `INSERT INTO estimate_services (estimate_id, service_name, item_type, part_code, qty, rate, amount, hsn_sac)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [est.id, svc.service_name, svc.item_type, svc.part_code, svc.qty, svc.rate, svc.amount, svc.hsn_sac]
      );
    }
  }
}

// ===============================================================
// GET /api/job-cards — List with full search + pipeline filters (GST ONLY)
// ===============================================================
router.get('/', async (req, res) => {
  try {
    const { status, completion_type, company, date, from_date, to_date, month, year, search, page = 1, limit = 50 } = req.query;
    let where = 'WHERE jc.is_deleted = 0';
    const params = [];

    if (company && company !== 'all') {
      if (company === 'Detailing Studio') {
        where += " AND (jc.company = 'Detailing Studio' OR ((jc.company IS NULL OR jc.company = '') AND (jc.is_quick_job = 0 OR jc.is_quick_job IS NULL)))";
      } else {
        where += ' AND jc.company = ?';
        params.push(company);
      }
    } else {
      // By default on /job-cards, only show Detailing Studio records
      where += " AND (jc.company = 'Detailing Studio' OR (jc.company != 'Car Wash' AND jc.company != 'Accessories' AND (jc.is_quick_job = 0 OR jc.is_quick_job IS NULL)))";
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        where += " AND jc.status IN ('estimation','wip','ready')";
      } else {
        where += ' AND jc.status = ?';
        params.push(status);
      }
    }
    if (completion_type && completion_type !== 'all') {
      where += ' AND jc.completion_type = ?';
      params.push(completion_type);
    }
    if (date) {
      where += ' AND DATE(jc.job_date) = ?';
      params.push(date);
    } else if (from_date && to_date) {
      where += ' AND DATE(jc.job_date) BETWEEN ? AND ?';
      params.push(from_date, to_date);
    } else if (month && year) {
      where += ' AND MONTH(jc.job_date) = ? AND YEAR(jc.job_date) = ?';
      params.push(parseInt(month), parseInt(year));
    }
    if (search) {
      where += ' AND (jc.reg_no LIKE ? OR jc.car_name LIKE ? OR jc.owner_name LIKE ? OR jc.mobile_no LIKE ? OR jc.job_no LIKE ? OR jc.rfe_no LIKE ? OR c.customer_name LIKE ? OR c.mobile_no LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q, q, q, q, q, q);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM job_cards jc LEFT JOIN customers c ON jc.customer_id = c.id ${where}`,
      params
    );

    const [rows] = await db.query(
      `SELECT jc.*, s.full_name as assigned_staff_name, 
              c.customer_name as cust_name, c.mobile_no as cust_mobile, c.customer_type,
              v.make as vehicle_make, v.model as vehicle_model, v.fuel_type as vehicle_fuel,
              COALESCE(inv.invoice_no, ngst.invoice_no) as invoice_no, 
              COALESCE(inv.total_amount, ngst.total_amount) as invoice_total,
              ngst.invoice_no as non_gst_invoice_no, ngst.total_amount as non_gst_total
       FROM job_cards jc
       LEFT JOIN staff s ON jc.assigned_staff_id = s.id
       LEFT JOIN customers c ON jc.customer_id = c.id
       LEFT JOIN vehicles v ON jc.vehicle_id = v.id
       LEFT JOIN invoices inv ON inv.job_card_id = jc.id
       LEFT JOIN invoices_non_gst ngst ON ngst.job_card_id = jc.id AND ngst.deleted_at IS NULL
       ${where}
       ORDER BY jc.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Attach services for each job card
    for (const job of rows) {
      const [services] = await db.query(
        'SELECT id, service_name, item_type, part_code, qty, rate, amount, discount_pct, hsn_sac, tax_pct, tax_amount, unit FROM job_card_services WHERE job_card_id = ? ORDER BY id',
        [job.id]
      );
      job.services = services;
      job.subtotal = services.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0) + parseFloat(job.job_category_amount || 0);

      if (job.completion_type === 'invoice') {
        const [inv] = await db.query('SELECT * FROM invoices WHERE job_card_id = ?', [job.id]);
        if (inv.length > 0) {
          job.invoice = inv[0];
        } else {
          const [ngst] = await db.query('SELECT * FROM invoices_non_gst WHERE job_card_id = ? AND deleted_at IS NULL', [job.id]);
          job.invoice = ngst[0] || null;
        }
      } else if (job.completion_type === 'estimate') {
        const [est] = await db.query('SELECT * FROM estimates WHERE job_card_id = ?', [job.id]);
        job.estimate = est[0] || null;
      }
    }

    res.json({ data: rows, total: countRows[0].total, page: parseInt(page) });
  } catch (err) {
    console.error('GET /job-cards error:', err);
    res.status(500).json({ error: 'Failed to fetch job cards' });
  }
});

// ----- GET /api/job-cards/recycle-bin/list -----
router.get('/recycle-bin/list', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT jc.*, s.full_name as assigned_staff_name, 
              c.customer_name as cust_name, c.mobile_no as cust_mobile,
              v.make as vehicle_make, v.model as vehicle_model
       FROM job_cards jc
       LEFT JOIN staff s ON jc.assigned_staff_id = s.id
       LEFT JOIN customers c ON jc.customer_id = c.id
       LEFT JOIN vehicles v ON jc.vehicle_id = v.id
       WHERE jc.is_deleted = 1
       ORDER BY jc.updated_at DESC`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /job-cards/recycle-bin/list error:', err);
    res.status(500).json({ error: 'Failed to fetch recycle bin' });
  }
});

// ===============================================================
// Fix 5: PATCH /api/job-cards/bulk-status — Bulk status update
// IMPORTANT: Must be BEFORE any /:id routes to avoid Express matching
// ===============================================================
router.patch('/bulk-status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    const validStatuses = ['estimation', 'wip', 'ready', 'delivered', 'invoiced', 'cancelled'];

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of job card IDs required' });
    }
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid target status' });
    }

    const results = { updated: [], skipped: [] };

    for (const id of ids) {
      const [rows] = await db.query('SELECT status FROM job_cards WHERE id = ?', [id]);
      if (rows.length === 0) {
        results.skipped.push({ id, reason: 'Not found' });
        continue;
      }

      const currentStatus = rows[0].status;
      const allowed = VALID_TRANSITIONS[currentStatus] || [];

      if (!allowed.includes(status)) {
        results.skipped.push({ id, reason: `Cannot transition from "${currentStatus}" to "${status}"` });
        continue;
      }

      const closedAt = ['delivered', 'invoiced'].includes(status) ? 'NOW()' : 'NULL';
      await db.execute(`UPDATE job_cards SET status = ?, closed_at = ${closedAt} WHERE id = ?`, [status, id]);
      results.updated.push(id);
    }

    res.json({
      message: `${results.updated.length} updated, ${results.skipped.length} skipped`,
      ...results
    });
  } catch (err) {
    console.error('PATCH /job-cards/bulk-status error:', err);
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// ===============================================================
// GET /api/job-cards/export/estimates
// ===============================================================
router.get('/export/estimates', async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const [rows] = await db.query(
      `SELECT 
        e.estimate_no as 'Estimate No',
        jc.job_no as 'Job Card No',
        jc.rfe_no as 'RFE No',
        jc.reg_no as 'Reg No',
        jc.car_name as 'Car Name',
        v.make as 'Make',
        v.model as 'Model',
        v.variant as 'Variant',
        v.year as 'Year',
        v.fuel_type as 'Fuel Type',
        jc.charging_pct as 'Charging Percentage (%)',
        jc.odometer as 'Odometer (KM)',
        e.customer_name as 'Owner Name',
        e.mobile_no as 'Mobile No',
        c.email as 'Email',
        c.company_name as 'Company Name',
        c.gstin as 'GSTIN',
        c.address_line as 'Address',
        c.pincode as 'Pin Code',
        s.full_name as 'Assigned Staff',
        e.subtotal as 'Subtotal ₹',
        e.gst_percentage as 'GST %',
        e.gst_amount as 'GST Amount ₹',
        e.total_amount as 'Total Amount ₹',
        e.payment_mode as 'Payment Mode',
        'Invoice' as 'Invoice Type',
        DATE_FORMAT(e.created_at, '%d-%m-%Y %H:%i') as 'Estimate Date',
        jc.notes as 'Remarks / Notes',
        jc.pointers as 'Pointers / Scratches',
        IF(jc.spare_wheel = 1, 'Yes', 'No') as 'Spare Wheel Present',
        jc.insurance_company as 'Insurance Company',
        jc.insurance_claim_no as 'Insurance Claim No',
        DATE_FORMAT(v.insurance_expiry, '%d-%m-%Y') as 'Insurance Expiry',
        DATE_FORMAT(jc.accident_date, '%d-%m-%Y') as 'Accident Date',
        DATE_FORMAT(jc.delivery_date, '%d-%m-%Y') as 'Accident Delivery Date',
        jc.approval_status as 'Insurance Approval Status',
        DATE_FORMAT(jc.approval_date, '%d-%m-%Y') as 'Insurance Approval Date',
        GROUP_CONCAT(CONCAT(jcs.service_name, ' (x', jcs.qty, '): ₹', jcs.amount) SEPARATOR ' | ') as 'Services & Parts'
       FROM estimates e
       JOIN job_cards jc ON e.job_card_id = jc.id
       LEFT JOIN vehicles v ON jc.vehicle_id = v.id
       LEFT JOIN customers c ON jc.customer_id = c.id
       LEFT JOIN staff s ON jc.assigned_staff_id = s.id
       LEFT JOIN job_card_services jcs ON jcs.job_card_id = jc.id AND (jcs.is_selected = 1 OR jcs.is_selected IS NULL)
       WHERE MONTH(e.created_at) = ? AND YEAR(e.created_at) = ?
       GROUP BY e.id 
       ORDER BY e.created_at DESC`,
      [m, y]
    );

    createExcelResponse(res, `estimates_${y}_${String(m).padStart(2, '0')}.xlsx`, [
      { sheetName: 'Estimates Detail', data: rows.length ? rows : [{ 'No Data': 'No estimates found for this period' }] }
    ]);
  } catch (err) {
    console.error('Export estimates error:', err);
    res.status(500).json({ error: 'Failed to export' });
  }
});

// ===============================================================
// GET /api/job-cards/non-gst-list — Paginated list of Non-GST job cards
// ===============================================================
router.get('/non-gst-list', async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    let where = 'WHERE ngst.deleted_at IS NULL AND jc.is_deleted = 0';
    const params = [];

    if (search) {
      where += ' AND (jc.reg_no LIKE ? OR jc.car_name LIKE ? OR jc.owner_name LIKE ? OR ngst.invoice_no LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countRows] = await db.query(`SELECT COUNT(*) as total FROM invoices_non_gst ngst JOIN job_cards jc ON ngst.job_card_id = jc.id ${where}`, params);
    const [rows] = await db.query(
      `SELECT ngst.*, jc.job_no, jc.reg_no, jc.car_name, jc.owner_name, jc.mobile_no, jc.job_date, jc.service_type, jc.status
       FROM invoices_non_gst ngst
       JOIN job_cards jc ON ngst.job_card_id = jc.id
       ${where}
       ORDER BY ngst.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ data: rows, total: countRows[0].total, page: parseInt(page) });
  } catch (err) {
    console.error('GET /non-gst-list error:', err);
    res.status(500).json({ error: 'Failed to fetch non-GST job cards' });
  }
});

// DELETE /api/job-cards/non-gst/:id — Soft-delete an individual Non-GST estimate entry
router.delete('/non-gst/:id', async (req, res) => {
  try {
    const [result] = await db.execute(
      'UPDATE invoices_non_gst SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Estimate record not found or already deleted' });
    }
    res.json({ message: 'Estimate entry deleted successfully' });
  } catch (err) {
    console.error('DELETE /non-gst/:id error:', err);
    res.status(500).json({ error: 'Failed to delete estimate record' });
  }
});

// ===============================================================
// DELETE /api/job-cards/non-gst/kill-switch — Purge all non-GST invoice records
// ===============================================================
router.delete('/non-gst/kill-switch', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Get all job cards that have active non-GST invoices (before soft-deleting them!)
    const [ngstJobs] = await conn.query(
      'SELECT jc.id, jc.job_no FROM invoices_non_gst ngst JOIN job_cards jc ON ngst.job_card_id = jc.id WHERE ngst.deleted_at IS NULL'
    );

    // 2. Get all estimates that have customer payments
    const [estPayments] = await conn.query(
      'SELECT DISTINCT estimate_id FROM customer_payments WHERE estimate_id IS NOT NULL'
    );

    // Perform payments & cash ledger purges for job cards
    if (ngstJobs.length > 0) {
      const jobIds = ngstJobs.map(r => r.id);
      const jobNos = ngstJobs.map(r => r.job_no);

      await conn.query('DELETE FROM customer_payments WHERE job_card_id IN (?)', [jobIds]);

      for (const jobNo of jobNos) {
        await conn.execute(
          "DELETE FROM cash_ledger WHERE category = 'Customer Payment' AND description LIKE ?",
          [`%Job Card ${jobNo}%`]
        );
      }
    }

    // Perform payments & cash ledger purges for standalone estimates
    if (estPayments.length > 0) {
      const estIds = estPayments.map(r => r.estimate_id);
      const [ests] = await conn.query('SELECT id, estimate_no FROM estimates WHERE id IN (?)', [estIds]);
      const estNos = ests.map(r => r.estimate_no);

      await conn.query('DELETE FROM customer_payments WHERE estimate_id IN (?)', [estIds]);

      for (const estNo of estNos) {
        await conn.execute(
          "DELETE FROM cash_ledger WHERE category = 'Customer Payment' AND description LIKE ?",
          [`%Estimate ${estNo}%`]
        );
      }
    }

    // Soft delete all non-GST records (set deleted_at = NOW())
    const [result] = await conn.execute(
      'UPDATE invoices_non_gst SET deleted_at = NOW() WHERE deleted_at IS NULL'
    );

    const deletedCount = result.affectedRows;

    // Log the kill switch action
    await conn.execute(
      'INSERT INTO non_gst_kill_switch_log (deleted_by, deleted_by_name, records_deleted, ip_address) VALUES (?, ?, ?, ?)',
      [req.user?.id || null, req.user?.full_name || req.user?.username || 'Admin', deletedCount, req.ip || null]
    );

    await conn.commit(); conn.release();
    res.json({ message: `Delete completed. ${deletedCount} estimate record(s) and associated payments removed.`, deleted_count: deletedCount });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ===============================================================
// GET /api/job-cards/non-gst/export-excel — Excel download for Non-GST
router.get('/non-gst/export-excel', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ngst.invoice_no as 'Invoice No',
              jc.job_no as 'Job Card No',
              jc.reg_no as 'Reg No',
              jc.car_name as 'Car Name',
              jc.owner_name as 'Owner Name',
              jc.mobile_no as 'Mobile',
              ngst.subtotal as 'Subtotal ₹',
              ngst.total_amount as 'Total Amount ₹',
              ngst.payment_mode as 'Payment Mode',
              DATE_FORMAT(ngst.created_at, '%d-%m-%Y') as 'Invoice Date'
       FROM invoices_non_gst ngst
       JOIN job_cards jc ON ngst.job_card_id = jc.id
       WHERE ngst.deleted_at IS NULL
       ORDER BY ngst.created_at DESC`
    );

    createExcelResponse(res, `non_gst_invoices_${new Date().toISOString().slice(0,10)}.xlsx`, [
      { sheetName: 'Non-GST Invoices', data: rows.length ? rows : [{ 'No Data': 'No invoices' }] }
    ]);
  } catch (err) {
    console.error('Non-GST export error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ===============================================================
// GET /api/job-cards/:id/services — List services for a job card
// ===============================================================
router.get('/:id/services', async (req, res) => {
  try {
    const [services] = await db.query(
      `SELECT id, service_name, item_type, part_code, part_no, labour_code, qty, rate, amount, 
              discount_pct, hsn_sac, tax_pct, tax_amount, price_type, is_selected, sort_order, unit, old_part
       FROM job_card_services WHERE job_card_id = ? ORDER BY sort_order, id`,
      [req.params.id]
    );

    // Compute totals for selected services
    const selected = services.filter(s => s.is_selected === 1 || s.is_selected === undefined);
    const totals = {
      parts_excl_tax:  selected.filter(s => s.item_type === 'part').reduce((sum, s) => sum + parseFloat(s.amount || 0), 0),
      labour_excl_tax: selected.filter(s => s.item_type === 'labour').reduce((sum, s) => sum + parseFloat(s.amount || 0), 0),
      tax_total:       selected.reduce((sum, s) => sum + parseFloat(s.tax_amount || 0), 0),
      grand_total:     selected.reduce((sum, s) => sum + parseFloat(s.amount || 0) + parseFloat(s.tax_amount || 0), 0),
      selected_count:  selected.length,
      total_count:     services.length,
    };

    // Normalize is_selected to 0|1 integers
    const normalized = services.map(s => ({ ...s, is_selected: s.is_selected ?? 1 }));

    res.json({ data: normalized, services: normalized, totals });
  } catch (err) {
    console.error('GET /job-cards/:id/services error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// ===============================================================
// GET /api/job-cards/:id — Single job card with full details
// ===============================================================
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT jc.*, jc.public_token, s.full_name as assigned_staff_name,
              c.customer_name as cust_name, c.mobile_no as cust_mobile, c.customer_type,
              c.company_name, c.gstin, c.email as cust_email, c.alt_mobile,
              c.address_line, c.colony_street, c.city, c.state, c.pincode, c.contact_person, c.driver_name,
              v.make, v.model as vehicle_model, v.year as vehicle_year, v.variant, v.vin, v.engine_no, v.fuel_type, v.vehicle_color, v.insurance_expiry
       FROM job_cards jc
       LEFT JOIN staff s ON jc.assigned_staff_id = s.id
       LEFT JOIN customers c ON jc.customer_id = c.id
       LEFT JOIN vehicles v ON jc.vehicle_id = v.id
       WHERE jc.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Job card not found' });

    const job = rows[0];

    // Services
    const [services] = await db.query(
      'SELECT * FROM job_card_services WHERE job_card_id = ? ORDER BY id', [job.id]
    );
    job.services = services;
    job.subtotal = services.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0) + parseFloat(job.job_category_amount || 0);

    // Concerns
    const [concerns] = await db.query(
      'SELECT * FROM customer_concerns WHERE job_card_id = ? ORDER BY id', [job.id]
    );
    job.concerns = concerns;

    // Advance payments
    const [advances] = await db.query(
      'SELECT * FROM advance_payments WHERE job_card_id = ? ORDER BY id', [job.id]
    );
    job.advance_payments = advances;

    // Invoice or Estimate (resilient lookup)
    const [inv] = await db.query('SELECT * FROM invoices WHERE job_card_id = ?', [job.id]);
    if (inv.length > 0) {
      job.invoice = inv[0];
    } else {
      const [ngst] = await db.query('SELECT * FROM invoices_non_gst WHERE job_card_id = ? AND deleted_at IS NULL', [job.id]);
      job.invoice = ngst[0] || null;
    }
    const [est] = await db.query('SELECT * FROM estimates WHERE job_card_id = ?', [job.id]);
    job.estimate = est[0] || null;

    // Normalize customer field aliases for template rendering
    job.customer_name = job.cust_name || job.customer_name || job.owner_name || '';
    job.email = job.cust_email || job.email || '';
    job.mobile_no = job.cust_mobile || job.mobile_no || '';
    job.address = [job.address_line, job.colony_street, job.city, job.state, job.pincode].filter(Boolean).join(', ');

    res.json(job);
  } catch (err) {
    console.error('GET /job-cards/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch job card' });
  }
});

// ===============================================================
// GET /api/job-cards/suggestions — Auto-complete suggestions
// ===============================================================
router.get('/suggestions', async (req, res) => {
  try {
    const { q = '', type = '' } = req.query;
    if (!q || q.length < 1) {
      return res.json({ data: [] });
    }
    const params = [`${q}%`];
    let typeFilter = '';
    if (type && ['service_name', 'part_name', 'category'].includes(type)) {
      typeFilter = ' AND suggestion_type = ?';
      params.push(type);
    }
    params.push(20); // limit
    const [rows] = await db.query(
      `SELECT hsn_sac, tax_pct, suggestion_text, suggestion_type, usage_count
       FROM service_suggestions
       WHERE suggestion_text LIKE ?${typeFilter}
       ORDER BY usage_count DESC, suggestion_text ASC
       LIMIT ?`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /job-cards/suggestions error:', err);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// POST /api/job-cards — Create (multi-step CRM flow)
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      // Vehicle
      reg_no, car_name, odometer, avg_km_day, service_type, service_advisor,
      estimated_delivery, is_inhouse, vehicle_id,
      // Vehicle details for new vehicle
      make, model, year, variant, vin, engine_no, fuel_type, vehicle_color,
      // Customer
      customer_id, owner_name, mobile_no,
      // Customer details for new customer
      customer_type, customer_name, company_name, gstin, ref_no, alt_mobile, email,
      contact_person, driver_name, address_line, colony_street, city, state, state_code, pincode, birth_date, is_sez,
      // Job
      assigned_staff_id, notes, services, concerns,
      job_category, job_category_desc, job_category_amount, job_category_gst_pct,
      // Insurance
      insurance_company, insurance_claim_no, claim_no, accident_date, delivery_date, approval_status, approval_date,
      // Fuel
      fuel_level,
      // Advance payment
      advance_payment,
      // Custom new fields
      insurance_expiry, spare_wheel, pointers, charging_pct, company, job_date, payment_mode
    } = req.body;

    const finalRegNo = (reg_no || '').toUpperCase().trim();
    const finalCarName = (car_name || '').trim();
    const finalOwnerName = (customer_name || owner_name || '').trim() || 'Customer';
    const finalMobile = (mobile_no || '').trim();

    // 1. Create or link customer
    let finalCustomerId = customer_id || null;
    if (!finalCustomerId && finalOwnerName && finalMobile) {
      const [existing] = await conn.query(
        'SELECT id FROM customers WHERE mobile_no = ? LIMIT 1', [finalMobile]
      );
      if (existing.length > 0) {
        finalCustomerId = existing[0].id;
      } else {
        const [custResult] = await conn.execute(
          `INSERT INTO customers (customer_type, customer_name, company_name, gstin, ref_no,
            mobile_no, alt_mobile, email, contact_person, driver_name,
            address_line, colony_street, city, state, state_code, pincode, birth_date, is_sez)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            customer_type || 'individual', finalOwnerName, nullIfEmpty(company_name),
            nullIfEmpty(gstin), nullIfEmpty(ref_no), finalMobile, nullIfEmpty(alt_mobile), nullIfEmpty(email),
            nullIfEmpty(contact_person), nullIfEmpty(driver_name), nullIfEmpty(address_line),
            nullIfEmpty(colony_street), nullIfEmpty(city), nullIfEmpty(state), nullIfEmpty(state_code),
            nullIfEmpty(pincode), nullIfEmpty(birth_date), is_sez ? 1 : 0
          ]
        );
        finalCustomerId = custResult.insertId;
      }
    }

    // 2. Create or link vehicle
    let finalVehicleId = vehicle_id || null;
    if (!finalVehicleId && finalRegNo) {
      const [existingV] = await conn.query('SELECT id FROM vehicles WHERE reg_no = ?', [finalRegNo]);
      if (existingV.length > 0) {
        finalVehicleId = existingV[0].id;
        // Update vehicle details if provided
        if (make || model || insurance_expiry) {
          await conn.execute(
            'UPDATE vehicles SET make = COALESCE(?, make), model = COALESCE(?, model), year = COALESCE(?, year), variant = COALESCE(?, variant), vin = COALESCE(?, vin), engine_no = COALESCE(?, engine_no), fuel_type = COALESCE(?, fuel_type), vehicle_color = COALESCE(?, vehicle_color), customer_id = COALESCE(?, customer_id), insurance_expiry = COALESCE(?, insurance_expiry) WHERE id = ?',
            [nullIfEmpty(make), nullIfEmpty(model), nullIfEmpty(year), nullIfEmpty(variant), nullIfEmpty(vin), nullIfEmpty(engine_no), normalizeFuelType(fuel_type), nullIfEmpty(vehicle_color), finalCustomerId, nullIfEmpty(insurance_expiry), finalVehicleId]
          );
        }
      } else {
        const [vResult] = await conn.execute(
          `INSERT INTO vehicles (customer_id, reg_no, make, model, year, variant, vin, engine_no, fuel_type, vehicle_color, insurance_expiry)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [finalCustomerId, reg_no.toUpperCase().trim(), nullIfEmpty(make), nullIfEmpty(model), nullIfEmpty(year),
           nullIfEmpty(variant), nullIfEmpty(vin), nullIfEmpty(engine_no), normalizeFuelType(fuel_type), nullIfEmpty(vehicle_color), nullIfEmpty(insurance_expiry)]
        );
        finalVehicleId = vResult.insertId;
      }
    }

    // 3. Create job card (with retry for duplicate key safety)
    let job_no, rfe_no, jobId;
    const public_token = crypto.randomBytes(32).toString('hex');
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        job_no = await generateJobNo(conn);
        rfe_no = await generateRfeNo(conn);

        const targetJobDate = job_date ? new Date(job_date) : new Date();

        const [result] = await conn.execute(
          `INSERT INTO job_cards (job_no, rfe_no, reg_no, car_name, owner_name, mobile_no,
            customer_id, vehicle_id, odometer, avg_km_day, service_type, service_advisor,
            estimated_delivery, is_inhouse, assigned_staff_id, notes,
            job_category, job_category_desc, job_category_amount, job_category_gst_pct,
            status,
            insurance_company, insurance_claim_no, claim_no, accident_date, delivery_date,
            approval_status, approval_date, fuel_level, public_token, spare_wheel, pointers, charging_pct, company, job_date, payment_mode)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            job_no, rfe_no, finalRegNo, finalCarName,
            finalOwnerName, finalMobile,
            finalCustomerId, finalVehicleId,
            nullIfEmpty(odometer), nullIfEmpty(avg_km_day) || 25, nullIfEmpty(service_type), nullIfEmpty(service_advisor),
            nullIfEmpty(estimated_delivery), is_inhouse ? 1 : 0,
            nullIfEmpty(assigned_staff_id), nullIfEmpty(notes),
            nullIfEmpty(job_category), nullIfEmpty(job_category_desc), job_category_amount ? parseFloat(job_category_amount) : 0,
            job_category_gst_pct !== undefined && job_category_gst_pct !== null && job_category_gst_pct !== '' ? parseFloat(job_category_gst_pct) : 18.00,
            nullIfEmpty(insurance_company), nullIfEmpty(insurance_claim_no),
            nullIfEmpty(claim_no), nullIfEmpty(accident_date), nullIfEmpty(delivery_date),
            nullIfEmpty(approval_status), nullIfEmpty(approval_date), nullIfEmpty(fuel_level),
            public_token,
            spare_wheel !== undefined ? (spare_wheel ? 1 : 0) : 0,
            nullIfEmpty(pointers),
            nullIfEmpty(charging_pct),
            nullIfEmpty(company) || 'Detailing Studio',
            targetJobDate,
            nullIfEmpty(payment_mode) || 'cash'
          ]
        );
        jobId = result.insertId;
        break; // Success — exit retry loop
      } catch (dupErr) {
        if (dupErr.errno === 1062 && attempt < MAX_RETRIES) {
          console.warn(`[JobCard] Duplicate key on attempt ${attempt}, retrying...`);
          continue; // Retry with new job_no/rfe_no
        }
        throw dupErr; // Not a dup error or exhausted retries
      }
    }

    // 4. Insert services
    if (services && Array.isArray(services)) {
      for (const svc of services) {
        if (svc.service_name && svc.amount !== undefined && svc.amount !== '') {
          const finalItemType = (svc.item_type === 'part' || svc.item_type === 'spare' || svc.item_type === 'consumable') ? 'part' : 'labour';
          const qty = (svc.qty !== undefined && svc.qty !== '') ? parseFloat(svc.qty) : 1;
          const rate = (svc.rate !== undefined && svc.rate !== '') ? parseFloat(svc.rate) : (parseFloat(svc.amount) || 0);
          const amount = parseFloat(svc.amount) || 0;
          const discount_pct = (svc.discount_pct !== undefined && svc.discount_pct !== '') ? parseFloat(svc.discount_pct) : 0;
          const tax_pct = (svc.tax_pct !== undefined && svc.tax_pct !== '') ? parseFloat(svc.tax_pct) : 18;
          const tax_amount = (svc.tax_amount !== undefined && svc.tax_amount !== '' && parseFloat(svc.tax_amount) !== 0) ? parseFloat(svc.tax_amount) : parseFloat((amount * tax_pct / 100).toFixed(2));
          const finalHsnSac = (svc.hsn_sac && svc.hsn_sac.trim()) ? svc.hsn_sac.trim() : (finalItemType === 'part' ? '8708' : '998714');

          await conn.execute(
            `INSERT INTO job_card_services (job_card_id, service_name, item_type, part_code, qty, rate, amount, discount_pct, hsn_sac, tax_pct, tax_amount, unit, job_category, price_type, old_part)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              jobId, svc.service_name, finalItemType, svc.part_code || null,
              qty, rate, amount, discount_pct, finalHsnSac,
              tax_pct, tax_amount, svc.unit || 'pc', svc.job_category || null,
              svc.price_type || 'price', svc.old_part ? 1 : 0
            ]
          );
        }
      }
    }

    // 4a. Upsert service suggestions for auto-complete (non-blocking)
    if (services && Array.isArray(services)) {
      try {
        const seen = new Set();
        for (const svc of services) {
          // Upsert service name
          if (svc.service_name && svc.service_name.trim()) {
            const sType = (svc.item_type === 'part') ? 'part_name' : 'service_name';
            const key = `${svc.service_name.trim()}|${sType}`;
            if (!seen.has(key)) {
              seen.add(key);
              const finalItemType = (svc.item_type === 'part' || svc.item_type === 'spare' || svc.item_type === 'consumable') ? 'part' : 'labour';
              const finalHsnSac = (svc.hsn_sac && svc.hsn_sac.trim()) ? svc.hsn_sac.trim() : (finalItemType === 'part' ? '8708' : '998714');
              await conn.execute(
                `INSERT INTO service_suggestions (suggestion_text, suggestion_type, hsn_sac, tax_pct, usage_count)
                 VALUES (?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE 
                   usage_count = usage_count + 1,
                   hsn_sac = VALUES(hsn_sac),
                   tax_pct = VALUES(tax_pct)`,
                [
                  svc.service_name.trim(),
                  sType,
                  finalHsnSac,
                  svc.tax_pct !== undefined && svc.tax_pct !== '' ? parseFloat(svc.tax_pct) : 18.00
                ]
              );
            }
          }
          // Upsert category
          if (svc.job_category && svc.job_category.trim()) {
            const catKey = `${svc.job_category.trim()}|category`;
            if (!seen.has(catKey)) {
              seen.add(catKey);
              await conn.execute(
                `INSERT INTO service_suggestions (suggestion_text, suggestion_type, usage_count)
                 VALUES (?, 'category', 1)
                 ON DUPLICATE KEY UPDATE usage_count = usage_count + 1`,
                [svc.job_category.trim()]
              );
            }
          }
        }
      } catch (suggErr) {
        console.warn('[Suggestions] Failed to upsert (non-fatal):', suggErr.message);
      }
    }

    // 4b. Upsert car_name suggestion for auto-complete
    if (car_name && car_name.trim()) {
      try {
        await conn.execute(
          `INSERT INTO global_suggestions (suggestion_type, suggestion_text, usage_count)
           VALUES ('car_name', ?, 1)
           ON DUPLICATE KEY UPDATE usage_count = usage_count + 1`,
          [car_name.trim()]
        );
      } catch (err) {
        // non-fatal
      }
    }

    // 5. Insert concerns
    if (concerns && Array.isArray(concerns)) {
      for (const c of concerns) {
        if (c.trim()) {
          await conn.execute('INSERT INTO customer_concerns (job_card_id, concern_text) VALUES (?, ?)', [jobId, c.trim()]);
        }
      }
    }

    // 6. Insert advance payment
    if (advance_payment && advance_payment.amount > 0) {
      await conn.execute(
        'INSERT INTO advance_payments (job_card_id, payment_type, bank_name, cheque_no, amount, payment_date) VALUES (?, ?, ?, ?, ?, ?)',
        [
          jobId, advance_payment.payment_type || 'cash', advance_payment.bank_name || null,
          advance_payment.cheque_no || null, advance_payment.amount,
          advance_payment.payment_date || new Date().toISOString().slice(0, 10)
        ]
      );

      // Record in cash ledger
      await conn.execute(
        `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date)
         VALUES (?, ?, ?, ?, ?)`,
        [
          'in',
          parseFloat(advance_payment.amount),
          'Customer Payment',
          `Advance payment received for Job Card ${job_no} (Mode: ${advance_payment.payment_type || 'cash'})`,
          (advance_payment.payment_date || new Date().toISOString().slice(0, 10)) + ' 00:00:00'
        ]
      );
    }

    await conn.commit();
    conn.release();

    // Non-blocking SMS — Job Card Opened
    // Fire after response is sent; never block or throw
    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    const trackingUrl = `${baseUrl}/track/${public_token}`;
    setImmediate(async () => {
      try {
        const { sendJobOpenedSMS } = require('../utils/msg91');
        if (mobile_no) {
          await sendJobOpenedSMS({
            ownerName: customer_name || owner_name || 'Customer',
            regNo: reg_no.toUpperCase().trim(),
            carName: car_name,
            trackingUrl,
            mobile: mobile_no,
            jobCardId: jobId,
            userId: req.user?.id || null
          });
        }
      } catch (smsErr) {
        console.warn('[SMS] Job opened SMS failed (non-fatal):', smsErr.message);
      }
    });

    res.status(201).json({ id: jobId, job_no, rfe_no, public_token, message: 'Job card created' });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('POST /job-cards error:', err);
    res.status(500).json({ error: 'Failed to create job card' });
  }
});

// ----- PUT /api/job-cards/:id — Update -----
router.put('/:id', async (req, res) => {
  try {
    const [existing] = await db.query('SELECT status, vehicle_id, job_date FROM job_cards WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Job card not found' });

    const { reg_no, car_name, owner_name, mobile_no, assigned_staff_id, notes, services,
            odometer, avg_km_day, service_type, service_advisor, estimated_delivery, concerns,
            make, model, year, variant, fuel_type, vehicle_color, vin, engine_no,
            fuel_level, insurance_company, insurance_claim_no, claim_no, accident_date,
            delivery_date, approval_status, approval_date,
            job_category, job_category_desc, job_category_amount, job_category_gst_pct,
            spare_wheel, pointers, insurance_expiry, charging_pct,
            customer_id, vehicle_id, alt_mobile, email, address_line, colony_street,
            city, state, pincode, company_name, gstin, customer_type, customer_name, company, job_date, payment_mode } = req.body;

    const updates = [];
    const values = [];

    if (payment_mode !== undefined) { updates.push('payment_mode = ?'); values.push(payment_mode || 'cash'); }

    const custNameInput = customer_name || owner_name;

    if (job_date !== undefined) { updates.push('job_date = ?'); values.push(job_date ? new Date(job_date) : existing[0].job_date); }

    if (customer_id !== undefined) { updates.push('customer_id = ?'); values.push(nullIfEmpty(customer_id)); }
    if (vehicle_id !== undefined) { updates.push('vehicle_id = ?'); values.push(nullIfEmpty(vehicle_id)); }
    if (reg_no !== undefined) { updates.push('reg_no = ?'); values.push(reg_no.toUpperCase().trim()); }

    let targetCarName = car_name;
    if (!targetCarName && (make || model)) {
      targetCarName = [make, model, variant].filter(Boolean).join(' ');
    }
    if (targetCarName !== undefined) { updates.push('car_name = ?'); values.push(nullIfEmpty(targetCarName)); }
    if (custNameInput !== undefined) { updates.push('owner_name = ?'); values.push(nullIfEmpty(custNameInput)); }
    if (mobile_no !== undefined) { updates.push('mobile_no = ?'); values.push(nullIfEmpty(mobile_no)); }
    if (assigned_staff_id !== undefined) { updates.push('assigned_staff_id = ?'); values.push(nullIfEmpty(assigned_staff_id)); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(nullIfEmpty(notes)); }
    if (odometer !== undefined) { updates.push('odometer = ?'); values.push(nullIfEmpty(odometer)); }
    if (avg_km_day !== undefined) { updates.push('avg_km_day = ?'); values.push(nullIfEmpty(avg_km_day)); }
    if (service_type !== undefined) { updates.push('service_type = ?'); values.push(nullIfEmpty(service_type)); }
    if (service_advisor !== undefined) { updates.push('service_advisor = ?'); values.push(nullIfEmpty(service_advisor)); }
    if (estimated_delivery !== undefined) { updates.push('estimated_delivery = ?'); values.push(nullIfEmpty(estimated_delivery)); }
    if (fuel_level !== undefined) { updates.push('fuel_level = ?'); values.push(nullIfEmpty(fuel_level)); }
    if (insurance_company !== undefined) { updates.push('insurance_company = ?'); values.push(nullIfEmpty(insurance_company)); }
    if (insurance_claim_no !== undefined) { updates.push('insurance_claim_no = ?'); values.push(nullIfEmpty(insurance_claim_no)); }
    if (claim_no !== undefined) { updates.push('claim_no = ?'); values.push(nullIfEmpty(claim_no)); }
    if (accident_date !== undefined) { updates.push('accident_date = ?'); values.push(nullIfEmpty(accident_date)); }
    if (delivery_date !== undefined) { updates.push('delivery_date = ?'); values.push(nullIfEmpty(delivery_date)); }
    if (approval_status !== undefined) { updates.push('approval_status = ?'); values.push(nullIfEmpty(approval_status)); }
    if (approval_date !== undefined) { updates.push('approval_date = ?'); values.push(nullIfEmpty(approval_date)); }
    if (job_category !== undefined) { updates.push('job_category = ?'); values.push(nullIfEmpty(job_category)); }
    if (job_category_desc !== undefined) { updates.push('job_category_desc = ?'); values.push(nullIfEmpty(job_category_desc)); }
    if (job_category_amount !== undefined) { updates.push('job_category_amount = ?'); values.push(job_category_amount !== '' && job_category_amount !== null ? parseFloat(job_category_amount) : 0); }
    if (job_category_gst_pct !== undefined) { updates.push('job_category_gst_pct = ?'); values.push(job_category_gst_pct !== '' && job_category_gst_pct !== null ? parseFloat(job_category_gst_pct) : 18.00); }
    if (spare_wheel !== undefined) { updates.push('spare_wheel = ?'); values.push(spare_wheel ? 1 : 0); }
    if (pointers !== undefined) { updates.push('pointers = ?'); values.push(nullIfEmpty(pointers)); }
    if (charging_pct !== undefined) { updates.push('charging_pct = ?'); values.push(nullIfEmpty(charging_pct)); }
    if (company !== undefined) { updates.push('company = ?'); values.push(nullIfEmpty(company)); }

    // Check customer link / creation
    let targetCustId = customer_id || existing[0].customer_id;
    const hasCustFields = custNameInput !== undefined || mobile_no !== undefined || alt_mobile !== undefined || email !== undefined || address_line !== undefined || colony_street !== undefined || city !== undefined || state !== undefined || pincode !== undefined || company_name !== undefined || gstin !== undefined || customer_type !== undefined;

    if (!targetCustId && (mobile_no || custNameInput)) {
      const mobToFind = mobile_no || existing[0].mobile_no;
      if (mobToFind) {
        const [foundCust] = await db.query('SELECT id FROM customers WHERE mobile_no = ? AND mobile_no IS NOT NULL AND mobile_no != "" LIMIT 1', [mobToFind]);
        if (foundCust.length > 0) {
          targetCustId = foundCust[0].id;
        } else if (custNameInput) {
          const [cIns] = await db.execute(
            `INSERT INTO customers (customer_type, customer_name, company_name, gstin, mobile_no, alt_mobile, email, address_line, colony_street, city, state, pincode)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              customer_type || 'individual', custNameInput, company_name || null, gstin || null,
              mobToFind || null, alt_mobile || null, email || null, address_line || null,
              colony_street || null, city || null, state || null, pincode || null
            ]
          );
          targetCustId = cIns.insertId;
        }
      }
      if (targetCustId && customer_id === undefined) {
        updates.push('customer_id = ?');
        values.push(targetCustId);
      }
    }

    if (targetCustId && hasCustFields) {
      const cUpdates = [];
      const cValues = [];
      if (custNameInput !== undefined) { cUpdates.push('customer_name = ?'); cValues.push(custNameInput); }
      if (mobile_no !== undefined) { cUpdates.push('mobile_no = ?'); cValues.push(mobile_no); }
      if (alt_mobile !== undefined) { cUpdates.push('alt_mobile = ?'); cValues.push(nullIfEmpty(alt_mobile)); }
      if (email !== undefined) { cUpdates.push('email = ?'); cValues.push(nullIfEmpty(email)); }
      if (address_line !== undefined) { cUpdates.push('address_line = ?'); cValues.push(nullIfEmpty(address_line)); }
      if (colony_street !== undefined) { cUpdates.push('colony_street = ?'); cValues.push(nullIfEmpty(colony_street)); }
      if (city !== undefined) { cUpdates.push('city = ?'); cValues.push(nullIfEmpty(city)); }
      if (state !== undefined) { cUpdates.push('state = ?'); cValues.push(nullIfEmpty(state)); }
      if (pincode !== undefined) { cUpdates.push('pincode = ?'); cValues.push(nullIfEmpty(pincode)); }
      if (company_name !== undefined) { cUpdates.push('company_name = ?'); cValues.push(nullIfEmpty(company_name)); }
      if (gstin !== undefined) { cUpdates.push('gstin = ?'); cValues.push(nullIfEmpty(gstin)); }
      if (customer_type !== undefined) { cUpdates.push('customer_type = ?'); cValues.push(customer_type); }

      if (cUpdates.length > 0) {
        cValues.push(targetCustId);
        await db.execute(`UPDATE customers SET ${cUpdates.join(', ')} WHERE id = ?`, cValues);
      }
    }

    // Check vehicle link / creation
    let targetVehId = vehicle_id || existing[0].vehicle_id;
    const regNoToUse = (reg_no !== undefined ? reg_no : (existing[0].reg_no || '')).toUpperCase().trim();
    const hasVehFields = make !== undefined || model !== undefined || year !== undefined || variant !== undefined || fuel_type !== undefined || vehicle_color !== undefined || vin !== undefined || engine_no !== undefined || insurance_expiry !== undefined;

    if (!targetVehId && regNoToUse) {
      const [foundVeh] = await db.query('SELECT id FROM vehicles WHERE reg_no = ? LIMIT 1', [regNoToUse]);
      if (foundVeh.length > 0) {
        targetVehId = foundVeh[0].id;
      } else {
        const [vIns] = await db.execute(
          `INSERT INTO vehicles (reg_no, customer_id, make, model, year, variant, fuel_type, vehicle_color, vin, engine_no, insurance_expiry)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            regNoToUse, targetCustId || null, make || null, model || null, year || null,
            variant || null, normalizeFuelType(fuel_type), vehicle_color || null, vin || null,
            engine_no || null, insurance_expiry || null
          ]
        );
        targetVehId = vIns.insertId;
      }
      if (targetVehId && vehicle_id === undefined) {
        updates.push('vehicle_id = ?');
        values.push(targetVehId);
      }
    }

    if (targetVehId && (hasVehFields || regNoToUse)) {
      const vUpdates = [];
      const vValues = [];
      if (regNoToUse) { vUpdates.push('reg_no = ?'); vValues.push(regNoToUse); }
      if (targetCustId) { vUpdates.push('customer_id = ?'); vValues.push(targetCustId); }
      if (make !== undefined) { vUpdates.push('make = ?'); vValues.push(nullIfEmpty(make)); }
      if (model !== undefined) { vUpdates.push('model = ?'); vValues.push(nullIfEmpty(model)); }
      if (year !== undefined) { vUpdates.push('year = ?'); vValues.push(nullIfEmpty(year)); }
      if (variant !== undefined) { vUpdates.push('variant = ?'); vValues.push(nullIfEmpty(variant)); }
      if (fuel_type !== undefined) { vUpdates.push('fuel_type = ?'); vValues.push(normalizeFuelType(fuel_type)); }
      if (vehicle_color !== undefined) { vUpdates.push('vehicle_color = ?'); vValues.push(nullIfEmpty(vehicle_color)); }
      if (vin !== undefined) { vUpdates.push('vin = ?'); vValues.push(nullIfEmpty(vin)); }
      if (engine_no !== undefined) { vUpdates.push('engine_no = ?'); vValues.push(nullIfEmpty(engine_no)); }
      if (insurance_expiry !== undefined) { vUpdates.push('insurance_expiry = ?'); vValues.push(nullIfEmpty(insurance_expiry)); }

      if (vUpdates.length > 0) {
        vValues.push(targetVehId);
        await db.execute(`UPDATE vehicles SET ${vUpdates.join(', ')} WHERE id = ?`, vValues);
      }
    }

    if (updates.length > 0) {
      values.push(req.params.id);
      await db.execute(`UPDATE job_cards SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    // Sync cached customer & vehicle columns in invoices_non_gst
    const ngstUpdates = [];
    const ngstValues = [];
    if (custNameInput !== undefined) { ngstUpdates.push('customer_name = ?'); ngstValues.push(custNameInput); }
    if (mobile_no !== undefined) { ngstUpdates.push('mobile_no = ?'); ngstValues.push(mobile_no); }
    if (reg_no !== undefined) { ngstUpdates.push('reg_no = ?'); ngstValues.push(reg_no.toUpperCase().trim()); }
    if (targetCarName !== undefined) { ngstUpdates.push('car_name = ?'); ngstValues.push(nullIfEmpty(targetCarName)); }

    if (ngstUpdates.length > 0) {
      ngstValues.push(req.params.id);
      await db.execute(`UPDATE invoices_non_gst SET ${ngstUpdates.join(', ')} WHERE job_card_id = ? AND deleted_at IS NULL`, ngstValues);
    }

    let newConcernIds = [];
    if (concerns !== undefined) {
      await db.execute('DELETE FROM customer_concerns WHERE job_card_id = ?', [req.params.id]);
      if (concerns && Array.isArray(concerns)) {
        for (const c of concerns) {
          let text = '';
          let isComp = 0;
          if (typeof c === 'string') {
            text = c.trim();
          } else if (c && typeof c === 'object' && c.concern_text) {
            text = c.concern_text.trim();
            isComp = c.is_completed ? 1 : 0;
          }

          if (text) {
            const [res] = await db.execute(
              'INSERT INTO customer_concerns (job_card_id, concern_text, is_completed) VALUES (?, ?, ?)',
              [req.params.id, text, isComp]
            );
            newConcernIds.push(res.insertId);
          } else {
            newConcernIds.push(null);
          }
        }
      }
    } else {
      const [existingConcerns] = await db.query(
        'SELECT id FROM customer_concerns WHERE job_card_id = ? ORDER BY id', [req.params.id]
      );
      newConcernIds = existingConcerns.map(c => c.id);
    }

    // Replace services
    if (services !== undefined) {
      await db.execute('DELETE FROM job_card_services WHERE job_card_id = ?', [req.params.id]);
      if (services && Array.isArray(services)) {
        for (const svc of services) {
          if (svc.service_name && svc.amount !== undefined && svc.amount !== '') {
            const finalItemType = (svc.item_type === 'part' || svc.item_type === 'spare' || svc.item_type === 'consumable') ? 'part' : 'labour';
            const qty = (svc.qty !== undefined && svc.qty !== '') ? parseFloat(svc.qty) : 1;
            const rate = (svc.rate !== undefined && svc.rate !== '') ? parseFloat(svc.rate) : (parseFloat(svc.amount) || 0);
            const amount = parseFloat(svc.amount) || 0;
            const discount_pct = (svc.discount_pct !== undefined && svc.discount_pct !== '') ? parseFloat(svc.discount_pct) : 0;
            const tax_pct = (svc.tax_pct !== undefined && svc.tax_pct !== '') ? parseFloat(svc.tax_pct) : 18;
            const tax_amount = (svc.tax_amount !== undefined && svc.tax_amount !== '' && parseFloat(svc.tax_amount) !== 0) ? parseFloat(svc.tax_amount) : parseFloat((amount * tax_pct / 100).toFixed(2));
            const finalHsnSac = (svc.hsn_sac && svc.hsn_sac.trim()) ? svc.hsn_sac.trim() : (finalItemType === 'part' ? '8708' : '998714');

            let concernId = null;
            if (svc.concern_index !== undefined && svc.concern_index !== null) {
              const idx = parseInt(svc.concern_index);
              if (idx >= 0 && idx < newConcernIds.length) {
                concernId = newConcernIds[idx];
              }
            } else if (svc.concern_id !== undefined && svc.concern_id !== null) {
              concernId = parseInt(svc.concern_id);
            }

            await db.execute(
              `INSERT INTO job_card_services (job_card_id, concern_id, service_name, item_type, part_code, qty, rate, amount, discount_pct, hsn_sac, tax_pct, tax_amount, unit, job_category, price_type, package_name, old_part)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                req.params.id, concernId, svc.service_name, finalItemType, svc.part_code || null,
                qty, rate, amount, discount_pct, finalHsnSac,
                tax_pct, tax_amount, svc.unit || 'pc', svc.job_category || null,
                svc.price_type || 'price', svc.package_name || null, svc.old_part ? 1 : 0
              ]
            );
          }
        }
      }
    }

    // 4a. Upsert service suggestions for auto-complete (non-blocking)
    if (services !== undefined && Array.isArray(services)) {
      try {
        const seen = new Set();
        for (const svc of services) {
          if (svc.service_name && svc.service_name.trim()) {
            const sType = (svc.item_type === 'part' || svc.item_type === 'spare' || svc.item_type === 'consumable') ? 'part_name' : 'service_name';
            const key = `${svc.service_name.trim()}|${sType}`;
            if (!seen.has(key)) {
              seen.add(key);
              const finalItemType = (svc.item_type === 'part' || svc.item_type === 'spare' || svc.item_type === 'consumable') ? 'part' : 'labour';
              const finalHsnSac = (svc.hsn_sac && svc.hsn_sac.trim()) ? svc.hsn_sac.trim() : (finalItemType === 'part' ? '8708' : '998714');
              await db.execute(
                `INSERT INTO service_suggestions (suggestion_text, suggestion_type, hsn_sac, tax_pct, usage_count)
                 VALUES (?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE 
                   usage_count = usage_count + 1,
                   hsn_sac = VALUES(hsn_sac),
                   tax_pct = VALUES(tax_pct)`,
                [
                  svc.service_name.trim(),
                  sType,
                  finalHsnSac,
                  svc.tax_pct !== undefined && svc.tax_pct !== '' ? parseFloat(svc.tax_pct) : 18.00
                ]
              );
            }
          }
          if (svc.job_category && svc.job_category.trim()) {
            const catKey = `${svc.job_category.trim()}|category`;
            if (!seen.has(catKey)) {
              seen.add(catKey);
              await db.execute(
                `INSERT INTO service_suggestions (suggestion_text, suggestion_type, usage_count)
                 VALUES (?, 'category', 1)
                 ON DUPLICATE KEY UPDATE usage_count = usage_count + 1`,
                [svc.job_category.trim()]
              );
            }
          }
        }
      } catch (suggErr) {
        console.warn('[Suggestions] Failed to upsert in PUT (non-fatal):', suggErr.message);
      }
    }

    // Recalculate invoice / estimate totals if already invoiced or saved as estimate
    await recalculateJobCardTotals(req.params.id);

    const [newServices] = await db.query(
      'SELECT * FROM job_card_services WHERE job_card_id = ? ORDER BY id', [req.params.id]
    );
    const [newConcerns] = await db.query(
      'SELECT * FROM customer_concerns WHERE job_card_id = ? ORDER BY id', [req.params.id]
    );

    // Fetch updated invoice / estimate
    let invoice = null;
    let estimate = null;
    const [jobRows] = await db.query('SELECT completion_type FROM job_cards WHERE id = ?', [req.params.id]);
    if (jobRows.length > 0) {
      const completion_type = jobRows[0].completion_type;
      if (completion_type === 'invoice') {
        const [inv] = await db.query('SELECT * FROM invoices WHERE job_card_id = ?', [req.params.id]);
        if (inv.length > 0) {
          invoice = inv[0];
        } else {
          const [ngst] = await db.query('SELECT * FROM invoices_non_gst WHERE job_card_id = ? AND deleted_at IS NULL', [req.params.id]);
          invoice = ngst[0] || null;
        }
      } else if (completion_type === 'estimate') {
        const [est] = await db.query('SELECT * FROM estimates WHERE job_card_id = ?', [req.params.id]);
        estimate = est[0] || null;
      }
    }

    res.json({ 
      message: 'Job card updated', 
      services: newServices, 
      concerns: newConcerns,
      invoice,
      estimate
    });
  } catch (err) {
    console.error('PUT /job-cards/:id error:', err);
    res.status(500).json({ error: 'Failed to update job card' });
  }
});

// ===============================================================
// PATCH /api/job-cards/services/:serviceId — Auto-save single field
// ===============================================================
router.patch('/services/:serviceId', async (req, res) => {
  try {
    // Verify service exists and job is not completed
    const [svc] = await db.query(
      `SELECT jcs.id, jcs.job_card_id, jc.status 
       FROM job_card_services jcs
       JOIN job_cards jc ON jcs.job_card_id = jc.id
       WHERE jcs.id = ?`,
      [req.params.serviceId]
    );
    if (svc.length === 0) return res.status(404).json({ error: 'Service not found' });
    if (['done'].includes(svc[0].status)) {
      return res.status(400).json({ error: 'Cannot edit services on a completed job' });
    }

    const allowedFields = ['service_name', 'item_type', 'part_code', 'part_no', 'labour_code',
      'qty', 'rate', 'amount', 'discount_pct', 'hsn_sac', 'tax_pct', 'tax_amount',
      'price_type', 'is_selected', 'sort_order', 'unit', 'old_part'];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    // Auto-compute amount if rate or qty changes
    if ((req.body.rate !== undefined || req.body.qty !== undefined) && req.body.amount === undefined) {
      const rate = req.body.rate !== undefined ? parseFloat(req.body.rate) : null;
      const qty = req.body.qty !== undefined ? parseFloat(req.body.qty) : null;

      if (rate !== null || qty !== null) {
        const [current] = await db.query('SELECT rate, qty FROM job_card_services WHERE id = ?', [req.params.serviceId]);
        const finalRate = rate !== null ? rate : parseFloat(current[0].rate);
        const finalQty = qty !== null ? qty : parseFloat(current[0].qty);
        updates.push('amount = ?');
        values.push(finalRate * finalQty);
      }
    }

    values.push(req.params.serviceId);
    await db.execute(`UPDATE job_card_services SET ${updates.join(', ')} WHERE id = ?`, values);

    // Return updated service
    const [updated] = await db.query('SELECT * FROM job_card_services WHERE id = ?', [req.params.serviceId]);
    await recalculateJobCardTotals(svc[0].job_card_id);

    res.json({ data: updated[0], message: 'Service updated' });
  } catch (err) {
    console.error('PATCH /job-cards/services/:serviceId error:', err);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// ===============================================================
// DELETE /api/job-cards/services/:serviceId — Remove a service
// ===============================================================
router.delete('/services/:serviceId', async (req, res) => {
  try {
    const [svc] = await db.query(
      `SELECT jcs.id, jc.status 
       FROM job_card_services jcs
       JOIN job_cards jc ON jcs.job_card_id = jc.id
       WHERE jcs.id = ?`,
      [req.params.serviceId]
    );
    if (svc.length === 0) return res.status(404).json({ error: 'Service not found' });
    if (['done'].includes(svc[0].status)) {
      return res.status(400).json({ error: 'Cannot delete services on a completed job' });
    }

    await db.execute('DELETE FROM job_card_services WHERE id = ?', [req.params.serviceId]);
    await recalculateJobCardTotals(svc[0].job_card_id);
    res.json({ message: 'Service deleted' });
  } catch (err) {
    console.error('DELETE /job-cards/services/:serviceId error:', err);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// ===============================================================
// PATCH /api/job-cards/:id/status — Pipeline status transition
// ===============================================================
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['estimation', 'wip', 'ready', 'delivered', 'invoiced', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // -- Enforce VALID_TRANSITIONS guard (safe: fallback if is_quick_job column missing) --
    let currentRows;
    try {
      [currentRows] = await db.query('SELECT status, is_quick_job FROM job_cards WHERE id = ?', [req.params.id]);
    } catch (colErr) {
      // is_quick_job column might not exist on live DB — fallback to just status
      [currentRows] = await db.query('SELECT status FROM job_cards WHERE id = ?', [req.params.id]);
    }
    if (!currentRows || currentRows.length === 0) return res.status(404).json({ error: 'Job card not found' });

    const currentStatus = (currentRows[0].status || 'estimation').toLowerCase().trim();
    const targetStatus = status.toLowerCase().trim();
    const isQuickJob = currentRows[0].is_quick_job === 1;
    const allowedNextStatuses = VALID_TRANSITIONS[currentStatus] || ['estimation', 'wip', 'ready', 'delivered', 'invoiced', 'cancelled'];

    const isAllowedTransition = allowedNextStatuses.includes(targetStatus) || 
      (isQuickJob && targetStatus === 'delivered' && !['invoiced', 'done'].includes(currentStatus)) ||
      !VALID_TRANSITIONS[currentStatus];

    if (!isAllowedTransition) {
      return res.status(400).json({
        error: `Invalid transition: "${currentStatus}" -> "${targetStatus}". Allowed: [${allowedNextStatuses.join(', ')}]`
      });
    }

    // Feature 15: Check inspection before delivery (safe: skip if table missing)
    if (status === 'delivered') {
      try {
        const [insp] = await db.query('SELECT * FROM post_service_inspection WHERE job_card_id = ?', [req.params.id]);
        if (insp.length > 0) {
          const i = insp[0];
          if (!(i.concern_resolved && i.vehicle_cleaned && i.photos_uploaded && i.quality_check)) {
            return res.status(400).json({ error: 'Post-service inspection not complete. All checklist items must be verified before delivery.' });
          }
        }
      } catch (inspErr) {
        // post_service_inspection table might not exist on live DB — skip check
        console.warn('Post-service inspection check skipped (table may not exist):', inspErr.message);
      }
    }

    const closedStatuses = ['delivered', 'invoiced'];
    const closedAt = closedStatuses.includes(status) ? new Date() : null;

    // Try updating with closed_at; fallback to just status if closed_at column missing
    try {
      await db.execute(
        `UPDATE job_cards SET status = ?, closed_at = ? WHERE id = ?`,
        [status, closedAt, req.params.id]
      );
    } catch (updateErr) {
      // closed_at column might not exist — fallback to simple status update
      await db.execute(
        `UPDATE job_cards SET status = ? WHERE id = ?`,
        [status, req.params.id]
      );
    }

    // Feature 3: Send WhatsApp status notification (entirely non-blocking)
    try {
      const [jobRows] = await db.query('SELECT owner_name, mobile_no, reg_no, car_name FROM job_cards WHERE id = ?', [req.params.id]);
      if (jobRows.length > 0 && jobRows[0].mobile_no) {
        const job = jobRows[0];
        const statusMessages = {
          estimation: `Dear ${job.owner_name}, the estimation for your vehicle ${job.reg_no} is being prepared.`,
          wip: `Dear ${job.owner_name}, your vehicle ${job.reg_no} (${job.car_name}) is under service at Happy Car Wash.`,
          ready: `Dear ${job.owner_name}, your vehicle ${job.reg_no} (${job.car_name}) is ready for delivery at Happy Car Wash!`,
          delivered: `Dear ${job.owner_name}, your vehicle ${job.reg_no} has been delivered. Thank you for choosing Happy Car Wash!`,
          invoiced: `Dear ${job.owner_name}, the invoice for your vehicle ${job.reg_no} has been generated. Thank you!`,
          cancelled: `Dear ${job.owner_name}, the service for vehicle ${job.reg_no} has been cancelled.`
        };

        const message = statusMessages[status] || `Status update for ${job.reg_no}: ${status}`;

        // Log notification (skip if table missing)
        try {
          await db.execute(
            `INSERT INTO status_notifications (job_card_id, status, message, recipient_no, dispatch_type, created_by) VALUES (?, ?, ?, ?, 'whatsapp', ?)`,
            [req.params.id, status, message, job.mobile_no, req.user?.id || null]
          );
        } catch (logErr) {
          console.warn('status_notifications table missing or insert failed (non-fatal):', logErr.message);
        }

        // Send WhatsApp (non-blocking)
        try {
          const { sendWhatsApp } = require('../utils/msg91');
          sendWhatsApp({
            to: job.mobile_no,
            templateName: process.env.MSG91_STATUS_TEMPLATE || 'status_update',
            params: [{ type: 'text', text: message }],
            jobCardId: parseInt(req.params.id),
            userId: req.user?.id || null
          }).catch(err => console.warn('Status WhatsApp failed:', err.message));
        } catch (waErr) {
          console.warn('WhatsApp send skipped:', waErr.message);
        }

        // Send SMS (non-blocking)
        try {
          const { sendStatusSMS } = require('../utils/msg91');
          sendStatusSMS({
            status,
            ownerName: job.owner_name || 'Customer',
            regNo: job.reg_no,
            carName: job.car_name,
            mobile: job.mobile_no,
            jobCardId: parseInt(req.params.id),
            userId: req.user?.id || null
          }).catch(err => console.warn('Status SMS failed (non-fatal):', err.message));
        } catch (smsErr) {
          console.warn('[SMS] Status SMS block error (non-fatal):', smsErr.message);
        }
      }
    } catch (notifErr) {
      console.warn('Status notification error (non-blocking):', notifErr.message);
    }

    res.json({ message: `Status updated to ${status}` });
  } catch (err) {
    console.error('PATCH /job-cards/:id/status error:', err);
    res.status(500).json({ error: err.message || 'Failed to update status' });
  }
});

// Helper to record payment in customer_payments and cash_ledger if payment is done
async function recordInvoicePaymentIfDone({ conn, jobCardId, totalAmount, paymentMode, paymentStatus, transactionId, staffId, paymentDate, invoiceNo, jobNo, company, userId }) {
  const isPaid = paymentStatus === 'done' || paymentStatus === 'approved' || (paymentStatus !== 'pending' && paymentMode && paymentMode !== 'pending');
  const finalStatus = isPaid ? 'approved' : 'outstanding';
  const finalMode = isPaid ? (paymentMode || 'cash') : 'pending';

  if (isPaid) {
    const pDate = paymentDate || new Date().toISOString().slice(0, 10);
    const [existingCP] = await conn.query('SELECT id FROM customer_payments WHERE job_card_id = ?', [jobCardId]);
    if (existingCP.length === 0) {
      await conn.execute(
        `INSERT INTO customer_payments (job_card_id, amount, payment_mode, transaction_id, payment_date, remarks, staff_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          jobCardId,
          totalAmount,
          finalMode,
          transactionId || null,
          pDate,
          `Payment received for Invoice ${invoiceNo}`,
          staffId ? parseInt(staffId) : null,
          userId || null
        ]
      );

      const comp = company || 'Detailing Studio';
      const desc = `Payment received for Job Card ${jobNo} (Invoice ${invoiceNo}) via ${finalMode}`;
      await conn.execute(
        `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
         VALUES ('in', ?, 'Customer Payment', ?, ?, ?)`,
        [
          totalAmount,
          desc,
          `${pDate} 00:00:00`,
          comp
        ]
      );
    }
  }

  return { finalStatus, finalMode };
}

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// POST /api/job-cards/:id/generate-invoice
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.post('/:id/generate-invoice', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { payment_mode = 'pending', payment_status, transaction_id, staff_id, payment_date, gst_percent, invoice_no: manual_invoice_no } = req.body;
    if (payment_mode && !['cash', 'upi', 'card', 'bank', 'bank_transfer', 'cheque', 'pending', 'manual_settlement'].includes(payment_mode)) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Valid payment mode required' });
    }

    const gst = gst_percent !== undefined ? parseFloat(gst_percent) : 18;
    const [existing] = await conn.query('SELECT * FROM job_cards WHERE id = ? FOR UPDATE', [req.params.id]);
    if (existing.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Job card not found' });
    }
    if (['done'].includes(existing[0].status)) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Job already completed' });
    }

    // Retrieve active services
    const [services] = await conn.query(
      'SELECT * FROM job_card_services WHERE job_card_id = ? AND (is_selected = 1 OR is_selected IS NULL)', [req.params.id]
    );

    // Deduct stock for parts
    for (const service of services) {
      if (service.item_type === 'part' && service.part_code) {
        const [partRows] = await conn.query('SELECT id, part_name, stock_qty FROM parts WHERE part_code = ? FOR UPDATE', [service.part_code]);
        if (partRows.length > 0) {
          const partInfo = partRows[0];
          if (partInfo.stock_qty < service.qty) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ error: `Insufficient stock for part: ${partInfo.part_name} (Available: ${partInfo.stock_qty})` });
          }
          await conn.execute('UPDATE parts SET stock_qty = stock_qty - ? WHERE part_code = ?', [service.qty, service.part_code]);
        }
      }
    }

    const services_subtotal = services.reduce((sum, s) => sum + parseFloat(s.amount), 0);
    const services_gst = services.reduce((sum, s) => sum + parseFloat(s.tax_amount || 0), 0);
    
    const cat_amount = parseFloat(existing[0].job_category_amount || 0);
    const cat_gst_pct = existing[0].job_category_gst_pct !== null && existing[0].job_category_gst_pct !== undefined ? parseFloat(existing[0].job_category_gst_pct) : 18.00;
    const cat_gst = parseFloat((cat_amount * cat_gst_pct / 100).toFixed(2));

    const subtotal = services_subtotal + cat_amount;
    if (subtotal <= 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'No services/job categories or subtotal is 0' });
    }

    const gst_amount = parseFloat((services_gst + cat_gst).toFixed(2));
    const total_amount = parseFloat((subtotal + gst_amount).toFixed(2));

    const [existingInvoice] = await conn.query('SELECT * FROM invoices WHERE job_card_id = ?', [req.params.id]);
    let invoice_no = manual_invoice_no ? manual_invoice_no.trim() : null;

    let finalStatus, finalMode;
    if (existingInvoice.length > 0) {
      const invId = existingInvoice[0].id;
      if (!invoice_no) {
        invoice_no = existingInvoice[0].invoice_no;
      } else if (invoice_no !== existingInvoice[0].invoice_no) {
        const [dupInv] = await conn.query('SELECT id FROM invoices WHERE invoice_no = ? AND id != ?', [invoice_no, invId]);
        if (dupInv.length > 0) {
          await conn.rollback(); conn.release();
          return res.status(400).json({ error: `Invoice number ${invoice_no} already exists.` });
        }
      }

      const paymentRes = await recordInvoicePaymentIfDone({
        conn, jobCardId: req.params.id, totalAmount: total_amount, paymentMode: payment_mode,
        paymentStatus: payment_status, transactionId: transaction_id, staffId: staff_id, paymentDate: payment_date,
        invoiceNo: invoice_no, jobNo: existing[0].job_no, company: existing[0].company, userId: req.user?.id
      });
      finalStatus = paymentRes.finalStatus;
      finalMode = paymentRes.finalMode;

      await conn.execute(
        `UPDATE invoices SET invoice_no = ?, subtotal = ?, gst_percent = ?, gst_amount = ?, total_amount = ?, payment_mode = ?, payment_status = ? WHERE id = ?`,
        [invoice_no, subtotal, gst, gst_amount, total_amount, finalMode, finalStatus, invId]
      );

      await conn.execute(
        `UPDATE job_cards SET status = 'invoiced', completion_type = 'invoice', final_amount = ?, payment_mode = ? WHERE id = ?`,
        [total_amount, finalMode, req.params.id]
      );

    } else {
      if (invoice_no) {
        const [dupInv] = await conn.query('SELECT id FROM invoices WHERE invoice_no = ?', [invoice_no]);
        if (dupInv.length > 0) {
          await conn.rollback(); conn.release();
          return res.status(400).json({ error: `Invoice number ${invoice_no} already exists.` });
        }
      } else {
        invoice_no = await generateInvoiceNo(conn);
      }

      const paymentRes = await recordInvoicePaymentIfDone({
        conn, jobCardId: req.params.id, totalAmount: total_amount, paymentMode: payment_mode,
        paymentStatus: payment_status, transactionId: transaction_id, staffId: staff_id, paymentDate: payment_date,
        invoiceNo: invoice_no, jobNo: existing[0].job_no, company: existing[0].company, userId: req.user?.id
      });
      finalStatus = paymentRes.finalStatus;
      finalMode = paymentRes.finalMode;

      await conn.execute(
        `UPDATE job_cards SET status = 'invoiced', completion_type = 'invoice', final_amount = ?, payment_mode = ?, closed_at = NOW() WHERE id = ?`,
        [total_amount, finalMode, req.params.id]
      );

      await conn.execute(
        `INSERT INTO invoices (job_card_id, invoice_no, subtotal, gst_percent, gst_amount, total_amount, payment_mode, gst_type, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.params.id, invoice_no, subtotal, gst, gst_amount, total_amount, finalMode, 'with_gst', finalStatus]
      );
    }

    await conn.commit();
    conn.release();

    res.json({ message: 'Invoice generated', invoice_no, subtotal, gst_percent: gst, gst_amount, total_amount, payment_mode: finalMode, payment_status: finalStatus });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Generate invoice error:', err);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});


// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// POST /api/job-cards/:id/generate-invoice-with-gst — Complete with GST
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.post('/:id/generate-invoice-with-gst', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { payment_mode = 'pending', payment_status, transaction_id, staff_id, payment_date, gst_percent, invoice_no: manual_invoice_no } = req.body;
    if (payment_mode && !['cash', 'upi', 'card', 'bank', 'bank_transfer', 'cheque', 'pending', 'manual_settlement'].includes(payment_mode)) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Valid payment mode required' });
    }

    const gst = gst_percent !== undefined ? parseFloat(gst_percent) : 18;
    const [existing] = await conn.query('SELECT * FROM job_cards WHERE id = ? FOR UPDATE', [req.params.id]);
    if (existing.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Job card not found' });
    }
    if (['done'].includes(existing[0].status)) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Job already completed' });
    }

    // Retrieve active services
    const [services] = await conn.query(
      'SELECT * FROM job_card_services WHERE job_card_id = ? AND (is_selected = 1 OR is_selected IS NULL)', [req.params.id]
    );

    // Check & deduct stock for parts
    for (const service of services) {
      if (service.item_type === 'part' && service.part_code) {
        const [partRows] = await conn.query('SELECT id, part_name, stock_qty FROM parts WHERE part_code = ? FOR UPDATE', [service.part_code]);
        if (partRows.length > 0) {
          const partInfo = partRows[0];
          if (partInfo.stock_qty < service.qty) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ error: `Insufficient stock for part: ${partInfo.part_name} (Available: ${partInfo.stock_qty})` });
          }
          await conn.execute('UPDATE parts SET stock_qty = stock_qty - ? WHERE part_code = ?', [service.qty, service.part_code]);
        }
      }
    }

    const services_subtotal = services.reduce((sum, s) => sum + parseFloat(s.amount), 0);
    const services_gst = services.reduce((sum, s) => sum + parseFloat(s.tax_amount || 0), 0);
    
    const cat_amount = parseFloat(existing[0].job_category_amount || 0);
    const cat_gst_pct = existing[0].job_category_gst_pct !== null && existing[0].job_category_gst_pct !== undefined ? parseFloat(existing[0].job_category_gst_pct) : 18.00;
    const cat_gst = parseFloat((cat_amount * cat_gst_pct / 100).toFixed(2));

    const subtotal = services_subtotal + cat_amount;
    if (subtotal <= 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'No services/job categories or subtotal is 0' });
    }

    const gst_amount = parseFloat((services_gst + cat_gst).toFixed(2));
    const total_amount = parseFloat((subtotal + gst_amount).toFixed(2));

    let invoice_no = manual_invoice_no ? manual_invoice_no.trim() : null;
    if (invoice_no) {
      const [existingInv] = await conn.query('SELECT id FROM invoices WHERE invoice_no = ?', [invoice_no]);
      if (existingInv.length > 0) {
        await conn.rollback(); conn.release();
        return res.status(400).json({ error: `Invoice number ${invoice_no} already exists.` });
      }
    } else {
      invoice_no = await generateInvoiceNo(conn);
    }

    const { finalStatus, finalMode } = await recordInvoicePaymentIfDone({
      conn, jobCardId: req.params.id, totalAmount: total_amount, paymentMode: payment_mode,
      paymentStatus: payment_status, transactionId: transaction_id, staffId: staff_id, paymentDate: payment_date,
      invoiceNo: invoice_no, jobNo: existing[0].job_no, company: existing[0].company, userId: req.user?.id
    });

    await conn.execute(
      `UPDATE job_cards SET status = 'invoiced', completion_type = 'invoice', final_amount = ?, payment_mode = ?, closed_at = NOW() WHERE id = ?`,
      [total_amount, finalMode, req.params.id]
    );

    await conn.execute(
      `INSERT INTO invoices (job_card_id, invoice_no, subtotal, gst_percent, gst_amount, total_amount, payment_mode, gst_type, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, invoice_no, subtotal, gst, gst_amount, total_amount, finalMode, 'with_gst', finalStatus]
    );


    // NOTE: No automatic customer_payment / cash_ledger entry.
    // Invoice goes to 'outstanding' status. Admin approves payment from Payments page.

    await conn.commit();
    conn.release();

    res.json({ message: 'Invoice generated', invoice_no, subtotal, gst_percent: gst, gst_amount, total_amount, payment_mode: finalMode, payment_status: finalStatus });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Generate invoice error:', err);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// POST /api/job-cards/:id/generate-invoice-without-gst — Complete without GST
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.post('/:id/generate-invoice-without-gst', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { payment_mode = 'pending', payment_status, transaction_id, staff_id, payment_date, invoice_no: manual_invoice_no } = req.body;
    if (payment_mode && !['cash', 'upi', 'card', 'bank', 'bank_transfer', 'cheque', 'pending', 'manual_settlement'].includes(payment_mode)) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Valid payment mode required' });
    }

    const [existing] = await conn.query('SELECT * FROM job_cards WHERE id = ? FOR UPDATE', [req.params.id]);
    if (existing.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Job card not found' }); }
    if (['done'].includes(existing[0].status)) { await conn.rollback(); conn.release(); return res.status(400).json({ error: 'Job already completed' }); }

    // Non-GST standard: 0% tax on all services and parts
    await conn.execute("UPDATE job_card_services SET tax_pct = 0, tax_amount = 0 WHERE job_card_id = ?", [req.params.id]);

    const [services] = await conn.query('SELECT * FROM job_card_services WHERE job_card_id = ? AND (is_selected = 1 OR is_selected IS NULL)', [req.params.id]);

    // Stock deduction for parts (only if not already invoiced to avoid double deduction)
    if (existing[0].status !== 'invoiced') {
      for (const service of services) {
        if (service.item_type === 'part' && service.part_code) {
          const [partRows] = await conn.query('SELECT id, part_name, stock_qty FROM parts WHERE part_code = ? FOR UPDATE', [service.part_code]);
          if (partRows.length > 0) {
            if (partRows[0].stock_qty < service.qty) {
              await conn.rollback(); conn.release();
              return res.status(400).json({ error: `Insufficient stock for part: ${partRows[0].part_name}` });
            }
            await conn.execute('UPDATE parts SET stock_qty = stock_qty - ? WHERE part_code = ?', [service.qty, service.part_code]);
          }
        }
      }
    }

    const servicesTotal = services.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    const catAmt = parseFloat(existing[0].job_category_amount || 0);

    const subtotal = parseFloat((servicesTotal + catAmt).toFixed(2));
    if (subtotal <= 0) { await conn.rollback(); conn.release(); return res.status(400).json({ error: 'No services/job categories or subtotal is 0' }); }

    const total_amount = subtotal;
    
    const [existingInvoice] = await conn.query('SELECT * FROM invoices_non_gst WHERE job_card_id = ? AND deleted_at IS NULL', [req.params.id]);
    let invoice_no = manual_invoice_no ? manual_invoice_no.trim() : null;

    let finalStatus, finalMode;
    if (existingInvoice.length > 0) {
      const invId = existingInvoice[0].id;
      if (!invoice_no) {
        invoice_no = existingInvoice[0].invoice_no;
      } else if (invoice_no !== existingInvoice[0].invoice_no) {
        const [dupInv] = await conn.query('SELECT id FROM invoices_non_gst WHERE invoice_no = ? AND id != ? AND deleted_at IS NULL', [invoice_no, invId]);
        if (dupInv.length > 0) {
          await conn.rollback(); conn.release();
          return res.status(400).json({ error: `Invoice number ${invoice_no} already exists.` });
        }
      }

      const paymentRes = await recordInvoicePaymentIfDone({
        conn, jobCardId: req.params.id, totalAmount: total_amount, paymentMode: payment_mode,
        paymentStatus: payment_status, transactionId: transaction_id, staffId: staff_id, paymentDate: payment_date,
        invoiceNo: invoice_no, jobNo: existing[0].job_no, company: existing[0].company, userId: req.user?.id
      });
      finalStatus = paymentRes.finalStatus;
      finalMode = paymentRes.finalMode;

      await conn.execute(
        `UPDATE invoices_non_gst SET invoice_no = ?, subtotal = ?, total_amount = ?, payment_mode = ?, payment_status = ? WHERE id = ?`,
        [invoice_no, subtotal, total_amount, finalMode, finalStatus, invId]
      );

      await conn.execute(
        `UPDATE job_cards SET status = 'invoiced', completion_type = 'invoice', final_amount = ?, payment_mode = ? WHERE id = ?`,
        [total_amount, finalMode, req.params.id]
      );

      // NOTE: No automatic customer_payment / cash_ledger entry on re-invoice.
      // Payment is managed from Payments page by admin.
    } else {
      if (invoice_no) {
        const [dupInv] = await conn.query('SELECT id FROM invoices_non_gst WHERE invoice_no = ? AND deleted_at IS NULL', [invoice_no]);
        if (dupInv.length > 0) {
          await conn.rollback(); conn.release();
          return res.status(400).json({ error: `Invoice number ${invoice_no} already exists.` });
        }
      } else {
        invoice_no = await generateNonGstInvoiceNo(conn);
      }

      const paymentRes = await recordInvoicePaymentIfDone({
        conn, jobCardId: req.params.id, totalAmount: total_amount, paymentMode: payment_mode,
        paymentStatus: payment_status, transactionId: transaction_id, staffId: staff_id, paymentDate: payment_date,
        invoiceNo: invoice_no, jobNo: existing[0].job_no, company: existing[0].company, userId: req.user?.id
      });
      finalStatus = paymentRes.finalStatus;
      finalMode = paymentRes.finalMode;

      await conn.execute(
        `UPDATE job_cards SET status = 'invoiced', completion_type = 'invoice', final_amount = ?, payment_mode = ?, closed_at = NOW() WHERE id = ?`,
        [total_amount, finalMode, req.params.id]
      );

      await conn.execute(
        `INSERT INTO invoices_non_gst (job_card_id, invoice_no, subtotal, total_amount, payment_mode, customer_name, mobile_no, reg_no, car_name, created_by, payment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.params.id, invoice_no, subtotal, total_amount, finalMode,
         existing[0].owner_name, existing[0].mobile_no, existing[0].reg_no, existing[0].car_name,
         req.user?.id || null, finalStatus]
      );
    }

    await conn.commit(); conn.release();
    res.json({ message: 'Invoice generated', invoice_no, subtotal, total_amount, payment_mode: finalMode, payment_status: finalStatus });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('Generate non-GST invoice error:', err);
    res.status(500).json({ error: 'Failed to generate non-GST invoice' });
  }
});

// ===============================================================
// POST /api/job-cards/:id/save-estimate — Save estimate (GST or Non-GST)
// ===============================================================
router.post('/:id/save-estimate', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { payment_mode = 'pending', estimate_type, gst_percentage } = req.body;
    const type = estimate_type || 'non_gst_estimate';
    if (!['gst_estimate', 'non_gst_estimate'].includes(type)) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'estimate_type must be gst_estimate or non_gst_estimate' });
    }
    const validModes = ['cash', 'upi', 'card', 'bank', 'bank_transfer', 'cheque', 'pending', 'manual_settlement'];
    if (payment_mode && !validModes.includes(payment_mode)) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Valid payment mode required' });
    }
    const finalPaymentMode = payment_mode || 'pending';

    const [existing] = await conn.query('SELECT * FROM job_cards WHERE id = ? FOR UPDATE', [req.params.id]);
    if (existing.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Job card not found' }); }
    if (['done'].includes(existing[0].status)) { await conn.rollback(); conn.release(); return res.status(400).json({ error: 'Job already completed' }); }

    const [services] = await conn.query(
      'SELECT * FROM job_card_services WHERE job_card_id = ? AND (is_selected = 1 OR is_selected IS NULL)', [req.params.id]
    );

    // Check & deduct stock for parts
    for (const service of services) {
      if (service.item_type === 'part' && service.part_code) {
        const [partRows] = await conn.query('SELECT id, part_name, stock_qty FROM parts WHERE part_code = ? FOR UPDATE', [service.part_code]);
        if (partRows.length > 0) {
          if (partRows[0].stock_qty < service.qty) {
            await conn.rollback(); conn.release();
            return res.status(400).json({ error: `Insufficient stock for: ${partRows[0].part_name}` });
          }
          await conn.execute('UPDATE parts SET stock_qty = stock_qty - ? WHERE part_code = ?', [service.qty, service.part_code]);
        }
      }
    }

    const services_subtotal = services.reduce((sum, s) => sum + parseFloat(s.amount), 0);
    const gst_pct = type === 'gst_estimate' ? (parseFloat(gst_percentage) || 18) : 0;
    const services_gst = gst_pct > 0 ? services.reduce((sum, s) => sum + parseFloat(s.tax_amount || 0), 0) : 0;
    
    const cat_amount = parseFloat(existing[0].job_category_amount || 0);
    const cat_gst_pct = type === 'gst_estimate' ? (existing[0].job_category_gst_pct !== null && existing[0].job_category_gst_pct !== undefined ? parseFloat(existing[0].job_category_gst_pct) : 18.00) : 0;
    const cat_gst = parseFloat((cat_amount * cat_gst_pct / 100).toFixed(2));

    const subtotal = services_subtotal + cat_amount;
    if (subtotal <= 0) { await conn.rollback(); conn.release(); return res.status(400).json({ error: 'No services/job categories or subtotal is 0' }); }

    const gst_amt = parseFloat((services_gst + cat_gst).toFixed(2));
    const total = parseFloat((subtotal + gst_amt).toFixed(2));
    const estimate_no = await generateEstimateNo(conn);

    await conn.execute(
      `UPDATE job_cards SET status = 'delivered', completion_type = 'estimate', final_amount = ?, payment_mode = ?, closed_at = NOW() WHERE id = ?`,
      [total, finalPaymentMode, req.params.id]
    );

    const [estResult] = await conn.execute(
      `INSERT INTO estimates (job_card_id, estimate_no, subtotal, payment_mode, estimate_type, gst_percentage, gst_amount, total_amount,
        customer_name, mobile_no, reg_no, car_name, vehicle_make, vehicle_model, company_name, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, estimate_no, subtotal, finalPaymentMode, type, gst_pct, gst_amt, total,
       existing[0].owner_name, existing[0].mobile_no, existing[0].reg_no, existing[0].car_name,
       existing[0].vehicle_make, existing[0].vehicle_model, existing[0].company || 'Detailing Studio', req.user?.id || null]
    );

    const estimateId = estResult.insertId;

    // Copy services to estimate_services
    for (const svc of services) {
      await conn.execute(
        `INSERT INTO estimate_services (estimate_id, service_name, item_type, part_code, qty, rate, amount, hsn_sac)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [estimateId, svc.service_name, svc.item_type, svc.part_code, svc.qty, svc.rate, svc.amount, svc.hsn_sac]
      );
    }

    // Audit log
    try {
      await conn.execute(
        'INSERT INTO estimate_audit_log (estimate_id, action, user_id, user_name, details) VALUES (?, ?, ?, ?, ?)',
        [estimateId, 'created', req.user?.id || null, req.user?.full_name || 'System', `From Job Card — ${type} — ₹${total}`]
      );
    } catch (e) { /* audit table may not exist yet */ }

    // Record customer payment only if no payment recorded for this job card yet and mode is not pending
    if (payment_mode && payment_mode !== 'pending') {
      const [existingPay] = await conn.query('SELECT id FROM customer_payments WHERE job_card_id = ?', [req.params.id]);
      if (existingPay.length === 0 && parseFloat(total) > 0) {
        await conn.execute(
          `INSERT INTO customer_payments (job_card_id, amount, payment_mode, payment_date, remarks, created_by)
           VALUES (?, ?, ?, CURRENT_DATE(), ?, ?)`,
          [req.params.id, total, payment_mode, `Automatically recorded on Estimate generation: ${estimate_no}`, req.user?.id || null]
        );

        await conn.execute(
          `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date)
           VALUES (?, ?, ?, ?, NOW())`,
          ['in', total, 'Customer Payment', `Payment received for Job Card ${existing[0].job_no} (Estimate: ${estimate_no}) via ${payment_mode}`]
        );
      }
    }

    await conn.commit(); conn.release();
    res.json({ message: 'Estimate saved', estimate_no, estimate_type: type, subtotal, gst_percentage: gst_pct, gst_amount: gst_amt, total_amount: total, payment_mode });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('Save estimate error:', err);
    res.status(500).json({ error: 'Failed to save estimate' });
  }
});


// ===============================================================
// POST /api/job-cards/:id/services — Add a service line item
// ===============================================================
router.post('/:id/services', async (req, res) => {
  try {
    const [job] = await db.query('SELECT id, status FROM job_cards WHERE id = ?', [req.params.id]);
    if (job.length === 0) return res.status(404).json({ error: 'Job card not found' });
    if (['done'].includes(job[0].status)) {
      return res.status(400).json({ error: 'Cannot add services to a completed job' });
    }

    const { service_name, item_type, part_code, part_no, labour_code, qty, rate, amount,
            discount_pct, hsn_sac, tax_pct, tax_amount, price_type, is_selected, sort_order, unit } = req.body;

    if (!service_name) return res.status(400).json({ error: 'Service name is required' });

    const finalRate = parseFloat(rate) || parseFloat(amount) || 0;
    const finalQty = parseFloat(qty) || 1;
    const finalAmount = parseFloat(amount) || (finalRate * finalQty);
    const finalItemType = (item_type === 'part' || item_type === 'spare' || item_type === 'consumable') ? 'part' : 'labour';
    const finalHsnSac = (hsn_sac && hsn_sac.trim()) ? hsn_sac.trim() : (finalItemType === 'part' ? '8708' : '998714');

    const [result] = await db.execute(
      `INSERT INTO job_card_services 
        (job_card_id, service_name, item_type, part_code, part_no, labour_code, qty, rate, amount, 
         discount_pct, hsn_sac, tax_pct, tax_amount, price_type, is_selected, sort_order, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id, service_name, finalItemType, part_code || null,
        part_no || null, labour_code || null, finalQty, finalRate, finalAmount,
        discount_pct || 0, finalHsnSac, tax_pct !== undefined ? tax_pct : 18,
        tax_amount || 0, price_type || 'fixed', is_selected !== undefined ? is_selected : 1,
        sort_order || 0, unit || 'pc'
      ]
    );

    // Fetch the created service
    const [created] = await db.query('SELECT * FROM job_card_services WHERE id = ?', [result.insertId]);
    await recalculateJobCardTotals(req.params.id);

    res.status(201).json({ data: created[0], message: 'Service added' });
  } catch (err) {
    console.error('POST /job-cards/:id/services error:', err);
    res.status(500).json({ error: 'Failed to add service' });
  }
});


// ===============================================================
// PATCH /api/job-cards/concerns/:concernId/toggle — Toggle concern status
// ===============================================================
router.patch('/concerns/:concernId/toggle', async (req, res) => {
  try {
    const { is_completed } = req.body;
    const [existing] = await db.query('SELECT is_completed FROM customer_concerns WHERE id = ?', [req.params.concernId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Concern not found' });

    const nextVal = is_completed !== undefined ? (is_completed ? 1 : 0) : (existing[0].is_completed ? 0 : 1);
    await db.execute('UPDATE customer_concerns SET is_completed = ? WHERE id = ?', [nextVal, req.params.concernId]);
    res.json({ message: 'Concern completion updated', is_completed: nextVal });
  } catch (err) {
    console.error('PATCH /job-cards/concerns/:concernId/toggle error:', err);
    res.status(500).json({ error: 'Failed to update concern status' });
  }
});

// ===============================================================
// POST /api/job-cards/:id/dispatch — Send invoice via WhatsApp/SMS
// ===============================================================
router.post('/:id/dispatch', async (req, res) => {
  try {
    const { channel } = req.body; // 'whatsapp' | 'sms' | 'both'
    if (!channel || !['whatsapp', 'sms', 'both'].includes(channel)) {
      return res.status(400).json({ error: 'Valid channel required: whatsapp, sms, or both' });
    }

    const [job] = await db.query(
      `SELECT jc.*, c.customer_name, c.mobile_no as cust_mobile, c.email as cust_email,
              inv.invoice_no, inv.total_amount, inv.subtotal, inv.gst_amount,
              est.estimate_no, est.subtotal as est_subtotal
       FROM job_cards jc
       LEFT JOIN customers c ON jc.customer_id = c.id  
       LEFT JOIN invoices inv ON inv.job_card_id = jc.id
       LEFT JOIN estimates est ON est.job_card_id = jc.id
       WHERE jc.id = ?`,
      [req.params.id]
    );
    if (job.length === 0) return res.status(404).json({ error: 'Job card not found' });

    const j = job[0];
    const mobile = j.cust_mobile || j.mobile_no;
    if (!mobile) return res.status(400).json({ error: 'No mobile number found for customer' });

    const msg91 = require('../utils/msg91');
    const results = {};

    const docType = j.invoice_no ? 'Invoice' : 'Estimate';
    const docNo = j.invoice_no || j.estimate_no || j.job_no;
    const totalAmt = j.total_amount || j.est_subtotal || j.final_amount || 0;

    if (channel === 'whatsapp' || channel === 'both') {
      results.whatsapp = await msg91.sendWhatsApp({
        to: mobile,
        templateName: process.env.MSG91_WA_TEMPLATE_NAME || 'invoice_notification',
        params: [
          { type: 'text', text: j.customer_name || j.owner_name || 'Customer' },
          { type: 'text', text: docNo },
          { type: 'text', text: `₹${totalAmt.toLocaleString('en-IN')}` },
          { type: 'text', text: j.car_name || '' },
          { type: 'text', text: j.reg_no || '' }
        ],
        jobCardId: req.params.id,
        userId: req.user?.id || null
      });
    }

    if (channel === 'sms' || channel === 'both') {
      const smsMsg = `Dear ${j.customer_name || j.owner_name || 'Customer'}, your ${docType} ${docNo} for ${j.car_name} (${j.reg_no}) totalling Rs.${totalAmt} has been generated. Thank you - Happy Car Wash`;
      results.sms = await msg91.sendSMS({
        to: mobile,
        message: smsMsg,
        jobCardId: req.params.id,
        userId: req.user?.id || null
      });
    }

    res.json({ message: `${docType} dispatched via ${channel}`, results });
  } catch (err) {
    console.error('POST /job-cards/:id/dispatch error:', err);
    res.status(500).json({ error: 'Failed to dispatch' });
  }
});

// ===============================================================
// POST /api/job-cards/:id/send-invoice-sms — Manual invoice SMS
// Called by admin after invoice is generated
// ===============================================================
router.post('/:id/send-invoice-sms', async (req, res) => {
  try {
    const { channel = 'sms' } = req.body; // 'sms' | 'whatsapp' | 'both'

    const [jobRows] = await db.query(
      `SELECT jc.id, jc.owner_name, jc.reg_no, jc.car_name, jc.mobile_no, jc.status,
              c.customer_name, c.mobile_no as cust_mobile,
              inv.invoice_no, inv.total_amount,
              ngst.invoice_no as ngst_invoice_no, ngst.total_amount as ngst_total
       FROM job_cards jc
       LEFT JOIN customers c ON jc.customer_id = c.id
       LEFT JOIN invoices inv ON inv.job_card_id = jc.id
       LEFT JOIN invoices_non_gst ngst ON ngst.job_card_id = jc.id AND ngst.deleted_at IS NULL
       WHERE jc.id = ?`,
      [req.params.id]
    );

    if (jobRows.length === 0) return res.status(404).json({ error: 'Job card not found' });
    const j = jobRows[0];

    const mobile = j.cust_mobile || j.mobile_no;
    if (!mobile) return res.status(400).json({ error: 'No mobile number on record for this customer' });

    const invoiceNo = j.invoice_no || j.ngst_invoice_no;
    const totalAmount = j.total_amount || j.ngst_total || 0;
    if (!invoiceNo) return res.status(400).json({ error: 'No invoice found for this job card. Generate an invoice first.' });

    const ownerName = j.customer_name || j.owner_name || 'Customer';
    const msg91 = require('../utils/msg91');
    const results = {};

    if (channel === 'sms' || channel === 'both') {
      results.sms = await msg91.sendInvoiceSMS({
        ownerName,
        regNo: j.reg_no,
        carName: j.car_name,
        invoiceNo,
        totalAmount: parseFloat(totalAmount).toLocaleString('en-IN'),
        mobile,
        jobCardId: parseInt(req.params.id),
        userId: req.user?.id || null
      });
    }

    if (channel === 'whatsapp' || channel === 'both') {
      results.whatsapp = await msg91.sendWhatsApp({
        to: mobile,
        templateName: process.env.MSG91_WA_TEMPLATE_NAME || 'invoice_notification',
        params: [
          { type: 'text', text: ownerName },
          { type: 'text', text: invoiceNo },
          { type: 'text', text: `₹${parseFloat(totalAmount).toLocaleString('en-IN')}` },
          { type: 'text', text: j.car_name || '' },
          { type: 'text', text: j.reg_no || '' }
        ],
        jobCardId: parseInt(req.params.id),
        userId: req.user?.id || null
      });
    }

    // Log dispatch to bill_dispatch_log
    await db.execute(
      `INSERT INTO bill_dispatch_log (job_card_id, dispatch_type, recipient_no, template_name, trigger_event, status)
       VALUES (?, ?, ?, ?, 'invoice_manual', 'sent')`,
      [req.params.id, channel, mobile, `invoice_${invoiceNo}`]
    );

    res.json({
      message: `Invoice SMS dispatched successfully`,
      invoice_no: invoiceNo,
      recipient: mobile,
      results
    });
  } catch (err) {
    console.error('POST /job-cards/:id/send-invoice-sms error:', err);
    res.status(500).json({ error: 'Failed to send invoice SMS: ' + err.message });
  }
});

// ===============================================================
// GET /api/job-cards/:id/dispatch-history — Get dispatch log
// ===============================================================
router.get('/:id/dispatch-history', async (req, res) => {
  try {
    const msg91 = require('../utils/msg91');
    const history = await msg91.getDispatchHistory(req.params.id);
    res.json({ data: history });
  } catch (err) {
    console.error('GET /job-cards/:id/dispatch-history error:', err);
    res.status(500).json({ error: 'Failed to fetch dispatch history' });
  }
});

// ===============================================================
// -- MEDIA UPLOADS (Before/After Photos) --
// ===============================================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const mediaStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(__dirname, '../../uploads/media', String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const stamp = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${stamp}${ext}`);
  },
});
const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  },
});

// GET /api/job-cards/:id/media — List media for a job card
router.get('/:id/media', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM job_card_media WHERE job_card_id = ? ORDER BY stage, created_at DESC',
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ data: [] });
    console.error('GET /job-cards/:id/media error:', err);
    res.status(500).json({ error: 'Failed to fetch media: ' + err.message });
  }
});

// POST /api/job-cards/:id/media — Upload media file
router.post('/:id/media', (req, res, next) => {
  uploadMedia.single('media')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(500).json({ error: 'File upload failed: ' + err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    const stage = ['before', 'after', 'other'].includes(req.body.stage) ? req.body.stage : 'before';
    const filePath = `uploads/media/${req.params.id}/${req.file.filename}`;

    const [result] = await db.execute(
      `INSERT INTO job_card_media (job_card_id, media_type, stage, file_name, file_path, mime_type, file_size, caption, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id, mediaType, stage,
        req.file.originalname, filePath,
        req.file.mimetype, req.file.size,
        req.body.caption || null,
        req.user?.id || null,
      ]
    );

    res.status(201).json({ id: result.insertId, file_path: filePath, message: 'Media uploaded' });
  } catch (err) {
    console.error('POST /job-cards/:id/media error:', err);
    res.status(500).json({ error: 'Failed to upload media: ' + err.message });
  }
});

// DELETE /api/job-cards/:id/media/:mediaId — Delete a media file
router.delete('/:id/media/:mediaId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT file_path FROM job_card_media WHERE id = ? AND job_card_id = ?',
      [req.params.mediaId, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Media not found' });

    // Delete from disk
    const fullPath = path.join(__dirname, '../..', rows[0].file_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await db.execute('DELETE FROM job_card_media WHERE id = ?', [req.params.mediaId]);
    res.json({ message: 'Media deleted' });
  } catch (err) {
    console.error('DELETE /job-cards/:id/media error:', err);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// ===============================================================
// GET /api/job-cards/:id/invoice-html — Render printable invoice
// ===============================================================
router.get('/:id/invoice-html', async (req, res) => {
  try {
    const { renderRetailInvoiceHtml } = require('../utils/invoiceRenderer');

    // Fetch job card
    const [jobs] = await db.query(
      `SELECT jc.*, s.full_name as advisor_name
       FROM job_cards jc
       LEFT JOIN staff s ON jc.assigned_staff_id = s.id
       WHERE jc.id = ?`, [req.params.id]
    );
    if (jobs.length === 0) return res.status(404).send('Job card not found');
    const job = jobs[0];

    // Fetch invoice or estimate
    let invoice = null;
    try {
      const [inv] = await db.query('SELECT * FROM invoices WHERE job_card_id = ? ORDER BY id DESC LIMIT 1', [req.params.id]);
      if (inv.length > 0) {
        invoice = inv[0];
      } else {
        const [ngst] = await db.query('SELECT * FROM invoices_non_gst WHERE job_card_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1', [req.params.id]);
        if (ngst.length > 0) invoice = ngst[0];
      }
    } catch { /* ignore */ }

    // Fetch services
    const [services] = await db.query(
      'SELECT * FROM job_card_services WHERE job_card_id = ? ORDER BY sort_order ASC, id ASC',
      [req.params.id]
    );

    // Fetch customer
    let customer = {};
    try {
      const [cust] = await db.query('SELECT * FROM customers WHERE id = ?', [job.customer_id]);
      if (cust.length > 0) customer = cust[0];
    } catch { /* noop */ }

    const custName = customer.customer_name || job.owner_name || 'Counter Customer';
    const custMobile = customer.mobile_no || job.mobile_no || '';
    const custGstin = customer.gstin || job.gstin || '';
    const addressParts = [
      customer.address_line || job.address_line,
      customer.colony_street || job.colony_street,
      customer.city || job.city,
      customer.state || job.state,
      customer.pincode || job.pincode
    ].filter(Boolean);
    const custAddress = addressParts.length > 0 ? addressParts.join(', ') : (job.address || '');

    const invNo = invoice ? invoice.invoice_no : (job.invoice_no || job.non_gst_invoice_no || job.job_no || '—');
    const invDateRaw = invoice ? new Date(invoice.created_at) : (job.job_date ? new Date(job.job_date) : new Date(job.created_at));
    const invDate = invDateRaw.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

    // Advance payments
    let totalAdvance = 0;
    try {
      const [advRows] = await db.query('SELECT * FROM advance_payments WHERE job_card_id = ? ORDER BY id', [req.params.id]);
      totalAdvance = advRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    } catch { /* ignore */ }

    const isPaid = job.status === 'delivered' || job.status === 'invoiced' || job.payment_status === 'paid';
    const carName = job.car_name || [job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ') || '—';
    const regNo = job.reg_no || '—';

    const html = await renderRetailInvoiceHtml({
      company: job.company,
      isQuickJob: job.is_quick_job,
      jobNo: job.job_no,
      serviceType: job.service_type,
      invNo,
      invDate,
      customerName: custName,
      customerAddress: custAddress,
      customerMobile: custMobile,
      customerGstin: custGstin,
      carName,
      regNo,
      items: services,
      finalAmount: job.final_amount,
      advancePaid: totalAdvance,
      isPaid
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('GET /job-cards/:id/invoice-html error:', err);
    res.status(500).send('Failed to generate invoice');
  }
});

// ===============================================================
// Feature 1: PATCH /api/job-cards/:id/fuel — Update fuel level
// ===============================================================
router.patch('/:id/fuel', async (req, res) => {
  try {
    const { fuel_level_percent, fuel_photo } = req.body;
    const updates = [];
    const values = [];

    if (fuel_level_percent !== undefined) {
      updates.push('fuel_level_percent = ?');
      values.push(Math.max(0, Math.min(100, parseInt(fuel_level_percent) || 0)));
    }
    if (fuel_photo !== undefined) {
      updates.push('fuel_photo = ?');
      values.push(fuel_photo);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fuel data provided' });
    values.push(req.params.id);

    await db.execute(`UPDATE job_cards SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Fuel level updated' });
  } catch (err) {
    console.error('PATCH /job-cards/:id/fuel error:', err);
    res.status(500).json({ error: 'Failed to update fuel level' });
  }
});

// ===============================================================
// Feature 5: POST /api/job-cards/:id/log-download — Log invoice download
// ===============================================================
router.post('/:id/log-download', async (req, res) => {
  try {
    const [invRows] = await db.query('SELECT id FROM invoices WHERE job_card_id = ?', [req.params.id]);
    if (invRows.length === 0) return res.status(404).json({ error: 'No invoice found for this job card' });

    await db.execute(
      'INSERT INTO invoice_download_log (invoice_id, downloaded_by) VALUES (?, ?)',
      [invRows[0].id, req.user.id]
    );
    res.json({ message: 'Download logged' });
  } catch (err) {
    console.error('POST /job-cards/:id/log-download error:', err);
    res.status(500).json({ error: 'Failed to log download' });
  }
});

// ===============================================================
// Feature 3: GET /api/job-cards/:id/notifications — Status notification history
// ===============================================================
router.get('/:id/notifications', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT sn.*, au.full_name as sent_by_name
       FROM status_notifications sn
       LEFT JOIN admin_users au ON sn.created_by = au.id
       WHERE sn.job_card_id = ?
       ORDER BY sn.created_at DESC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /job-cards/:id/notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ===============================================================
// DELETE /api/job-cards/:id — Soft delete job card
// ===============================================================
router.delete('/:id', async (req, res) => {
  try {
    const [existing] = await db.query('SELECT status FROM job_cards WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Job card not found' });
    
    // Try soft-delete with is_deleted column; fallback to hard delete if column missing
    try {
      await db.execute('UPDATE job_cards SET is_deleted = 1 WHERE id = ?', [req.params.id]);
    } catch (colErr) {
      // is_deleted column doesn't exist — use real DELETE as fallback
      await db.execute('DELETE FROM job_cards WHERE id = ?', [req.params.id]);
    }
    res.json({ message: 'Job card deleted' });
  } catch (err) {
    console.error('DELETE /job-cards/:id error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete job card' });
  }
});

// ===============================================================
// POST /api/job-cards/:id/restore — Restore soft-deleted job card
// ===============================================================
router.post('/:id/restore', async (req, res) => {
  try {
    const [existing] = await db.query('SELECT id FROM job_cards WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Job card not found' });
    
    await db.execute('UPDATE job_cards SET is_deleted = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Job card restored successfully' });
  } catch (err) {
    console.error('POST /job-cards/:id/restore error:', err);
    res.status(500).json({ error: 'Failed to restore job card' });
  }
});


// ===============================================================
// PATCH /api/job-cards/:id/invoice-number — Update generated invoice number
// ===============================================================
router.patch('/:id/invoice-number', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { invoice_no } = req.body;
    if (!invoice_no || !invoice_no.trim()) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Invoice number is required' });
    }
    const newInvNo = invoice_no.trim();

    // 1. Fetch job card
    const [jobRows] = await conn.query('SELECT * FROM job_cards WHERE id = ? FOR UPDATE', [req.params.id]);
    if (jobRows.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: 'Job card not found' });
    }
    const job = jobRows[0];

    // Check if it's a GST or Non-GST invoice or an Estimate
    const [gstRows] = await conn.query('SELECT * FROM invoices WHERE job_card_id = ?', [req.params.id]);
    const [ngstRows] = await conn.query('SELECT * FROM invoices_non_gst WHERE job_card_id = ? AND deleted_at IS NULL', [req.params.id]);
    const [estRows] = await conn.query('SELECT * FROM estimates WHERE job_card_id = ?', [req.params.id]);

    if (gstRows.length === 0 && ngstRows.length === 0 && estRows.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'No generated invoice/estimate found for this job card' });
    }

    if (gstRows.length > 0) {
      const oldInvNo = gstRows[0].invoice_no;
      // Check duplicate
      const [dup] = await conn.query('SELECT id FROM invoices WHERE invoice_no = ? AND job_card_id != ?', [newInvNo, req.params.id]);
      if (dup.length > 0) {
        await conn.rollback(); conn.release();
        return res.status(400).json({ error: `Invoice number ${newInvNo} already exists` });
      }

      // Update invoices
      await conn.execute('UPDATE invoices SET invoice_no = ? WHERE job_card_id = ?', [newInvNo, req.params.id]);

      // Update customer_payments
      await conn.execute(
        `UPDATE customer_payments SET remarks = ? WHERE job_card_id = ? AND remarks LIKE 'Automatically recorded on GST Invoice%'`,
        [`Automatically recorded on GST Invoice generation: ${newInvNo}`, req.params.id]
      );

      // Update cash_ledger
      await conn.execute(
        `UPDATE cash_ledger SET description = ? WHERE description LIKE ? AND description LIKE '%GST Invoice%'`,
        [`Payment received for Job Card ${job.job_no} (GST Invoice: ${newInvNo}) via ${job.payment_mode || 'cash'}`, `%Job Card ${job.job_no}%`]
      );
    } else if (ngstRows.length > 0) {
      const oldInvNo = ngstRows[0].invoice_no;
      // Check duplicate
      const [dup] = await conn.query('SELECT id FROM invoices_non_gst WHERE invoice_no = ? AND job_card_id != ? AND deleted_at IS NULL', [newInvNo, req.params.id]);
      if (dup.length > 0) {
        await conn.rollback(); conn.release();
        return res.status(400).json({ error: `Invoice number ${newInvNo} already exists` });
      }

      // Update invoices_non_gst
      await conn.execute('UPDATE invoices_non_gst SET invoice_no = ? WHERE job_card_id = ? AND deleted_at IS NULL', [newInvNo, req.params.id]);

      // Update customer_payments
      await conn.execute(
        `UPDATE customer_payments SET remarks = ? WHERE job_card_id = ? AND remarks LIKE 'Automatically recorded on Non-GST Invoice%'`,
        [`Automatically recorded on Non-GST Invoice generation: ${newInvNo}`, req.params.id]
      );

      // Update cash_ledger
      await conn.execute(
        `UPDATE cash_ledger SET description = ? WHERE description LIKE ? AND description LIKE '%Non-GST Invoice%'`,
        [`Payment received for Job Card ${job.job_no} (Non-GST Invoice: ${newInvNo}) via ${job.payment_mode || 'cash'}`, `%Job Card ${job.job_no}%`]
      );
    } else if (estRows.length > 0) {
      const oldEstNo = estRows[0].estimate_no;
      // Check duplicate
      const [dup] = await conn.query('SELECT id FROM estimates WHERE estimate_no = ? AND job_card_id != ?', [newInvNo, req.params.id]);
      if (dup.length > 0) {
        await conn.rollback(); conn.release();
        return res.status(400).json({ error: `Estimate number ${newInvNo} already exists` });
      }

      // Update estimates
      await conn.execute('UPDATE estimates SET estimate_no = ? WHERE job_card_id = ?', [newInvNo, req.params.id]);

      // Update customer_payments
      await conn.execute(
        `UPDATE customer_payments SET remarks = ? WHERE job_card_id = ? AND remarks LIKE 'Automatically recorded on Estimate%'`,
        [`Automatically recorded on Estimate: ${newInvNo}`, req.params.id]
      );

      // Update cash_ledger
      await conn.execute(
        `UPDATE cash_ledger SET description = ? WHERE description LIKE ? AND description LIKE '%Estimate%'`,
        [`Payment received for Job Card ${job.job_no} (Estimate: ${newInvNo}) via ${job.payment_mode || 'cash'}`, `%Job Card ${job.job_no}%`]
      );
    }

    await conn.commit(); conn.release();
    res.json({ message: 'Invoice number updated successfully', invoice_no: newInvNo });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('Update invoice number error:', err);
    res.status(500).json({ error: 'Failed to update invoice number' });
  }
});

// ===============================================================
// POST /api/job-cards/:id/share — Share Job Card/Estimate/Invoice via WhatsApp API
// ===============================================================
router.post('/:id/share', auth, async (req, res) => {
  try {
    const { type } = req.body;
    if (!type || !['job_card', 'estimate', 'invoice'].includes(type)) {
      return res.status(400).json({ error: 'Valid sharing type (job_card, estimate, invoice) is required' });
    }

    const [rows] = await db.query(
      `SELECT jc.*, v.reg_no, v.make, v.vehicle_model AS model, c.cust_name, c.mobile_no AS cust_mobile,
              i.id as invoice_id_gst, ngst.id as invoice_id_nongst,
              COALESCE(i.invoice_no, ngst.invoice_no) as invoice_no,
              COALESCE(i.total_amount, ngst.total_amount) as total_amount,
              e.estimate_no, e.subtotal AS estimate_subtotal
       FROM job_cards jc
       LEFT JOIN vehicles v ON jc.vehicle_id = v.id
       LEFT JOIN customers c ON jc.customer_id = c.id
       LEFT JOIN invoices i ON jc.id = i.job_card_id
       LEFT JOIN invoices_non_gst ngst ON jc.id = ngst.job_card_id AND ngst.deleted_at IS NULL
       LEFT JOIN estimates e ON jc.id = e.job_card_id
       WHERE jc.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Job card not found' });
    }

    const job = rows[0];
    const phone = (job.mobile_no || job.cust_mobile || '').replace(/\D/g, '');
    if (!phone) {
      return res.status(400).json({ error: 'Customer mobile number is missing' });
    }

    const [svcRows] = await db.query('SELECT service_name, amount, total_amount FROM job_card_services WHERE job_card_id = ?', [req.params.id]);
    const [advRows] = await db.query('SELECT amount FROM advance_payments WHERE job_card_id = ?', [req.params.id]);

    const clientName = job.owner_name || job.cust_name || 'Valued Customer';
    const vehReg = job.reg_no || '';
    const vehCar = [job.make, job.model].filter(Boolean).join(' ');
    const carDisplay = vehCar ? `${vehReg} (${vehCar})` : vehReg;
    const jobNo = job.job_no || '';

    let text = '';
    if (type === 'job_card') {
      text = `Hello *${clientName}*,\n\n🚗 *Job Card Created - Happy Car Wash*\n────────────────────────\n📋 *Order No:* ${jobNo}\n🚙 *Vehicle:* ${carDisplay}\n🔧 *Service Type:* ${job.service_type || 'General Service'}\n\nThank you for choosing *Happy Car Wash*!`;
    } else if (type === 'estimate') {
      const serviceSummary = svcRows.length > 0
        ? svcRows.slice(0, 8).map(s => `• ${s.service_name}: ₹${parseFloat(s.total_amount || s.amount || 0).toLocaleString('en-IN')}`).join('\n')
        : '• General Inspection & Service';
      const estAmt = parseFloat(job.estimate_subtotal || job.grand_total || 0).toLocaleString('en-IN');

      text = `Hello *${clientName}*,\n\n📊 *Service Estimate - Happy Car Wash*\n────────────────────────\n📋 *Job Card No:* ${jobNo}\n🚙 *Vehicle:* ${carDisplay}\n\n🛠️ *Estimated Services:*\n${serviceSummary}\n\n💰 *Total Estimated Amount:* ₹${estAmt}\n\nPlease review and let us know to proceed.\nThank you,\n*Happy Car Wash*`;
    } else if (type === 'invoice') {
      const isNgst = !!job.invoice_id_nongst;
      const docName = 'Invoice';
      const invoiceNo = job.invoice_no || jobNo;
      const totalAmt = parseFloat(job.total_amount || job.grand_total || 0);
      const advPaid = advRows.reduce((sum, ap) => sum + (parseFloat(ap.amount) || 0), 0);
      const balDue = Math.max(0, totalAmt - advPaid);

      text = `Hello *${clientName}*,\n\n🧾 *${docName} - Happy Car Wash*\n────────────────────────\n📄 *Invoice No:* ${invoiceNo}\n📋 *Job Card No:* ${jobNo}\n🚙 *Vehicle:* ${carDisplay}\n\n💼 *Billing Summary:*\n• *Total Amount:* ₹${totalAmt.toLocaleString('en-IN')}`;

      if (advPaid > 0) {
        text += `\n• *Advance Paid:* ₹${advPaid.toLocaleString('en-IN')}`;
        text += `\n• *Balance Due:* ₹${balDue.toLocaleString('en-IN')}`;
      }

      text += `\n\nThank you for your business!\n*Happy Car Wash*`;
    }

    const waResult = await sendWhatsAppMessage(phone, text);
    if (waResult.success) {
      res.json({ success: true, messageId: waResult.messageId });
    } else {
      res.json({
        success: false,
        error: waResult.error,
        fallbackUrl: waResult.fallbackUrl || `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
      });
    }
  } catch (err) {
    console.error('Share via WhatsApp error:', err);
    res.status(500).json({ error: 'Failed to share job card' });
  }
});

// ===============================================================
// Autocomplete Suggestions CRUD
// ===============================================================
router.post('/suggestions/record', auth, async (req, res) => {
  try {
    const { type, text } = req.body;
    if (!type || !text || !text.trim()) {
      return res.status(400).json({ error: 'Suggestion type and text are required' });
    }
    const { canonicalType, normalizeSuggestion } = require('./suggestions');
    const cType = canonicalType(type);
    const cleanText = normalizeSuggestion(cType, text);
    if (!cleanText) {
      return res.json({ success: true, recorded: 0 });
    }
    await db.execute(
      `INSERT INTO global_suggestions (suggestion_type, suggestion_text, usage_count)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE usage_count = usage_count + 1`,
      [cType, cleanText]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Record suggestion error:', err);
    res.status(500).json({ error: 'Failed to record suggestion' });
  }
});

router.get('/suggestions/list', auth, async (req, res) => {
  try {
    const { type, q, limit } = req.query;
    if (!type) {
      return res.status(400).json({ error: 'Suggestion type is required' });
    }
    const { canonicalType } = require('./suggestions');
    const cType = canonicalType(type);
    const limitNum = Math.min(Math.max(parseInt(String(limit || 25), 10) || 25, 1), 25);
    const searchStr = q ? String(q).trim() : '';

    let rows = [];
    if (searchStr.length > 0) {
      let formattedSearch = searchStr;
      if (cType === 'reg_no') {
        formattedSearch = searchStr.toUpperCase().replace(/[\s\-_]/g, '');
      }
      const [queryResult] = await db.query(
        `SELECT suggestion_text
         FROM global_suggestions
         WHERE (suggestion_type = ? OR suggestion_type = ?)
           AND suggestion_text LIKE ?
         ORDER BY
           CASE WHEN suggestion_text LIKE ? THEN 0 ELSE 1 END,
           usage_count DESC,
           suggestion_text ASC
         LIMIT ?`,
        [cType, type, `%${formattedSearch}%`, `${formattedSearch}%`, limitNum]
      );
      rows = queryResult;
    } else {
      const [queryResult] = await db.query(
        `SELECT suggestion_text
         FROM global_suggestions
         WHERE suggestion_type = ? OR suggestion_type = ?
         ORDER BY usage_count DESC, suggestion_text ASC
         LIMIT ?`,
        [cType, type, limitNum]
      );
      rows = queryResult;
    }
    res.json({ data: rows.map(r => r.suggestion_text) });
  } catch (err) {
    console.error('Get suggestions error:', err);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// ===============================================================
// Advance Payment Management Module (Task 22)
// ===============================================================

// GET /api/job-cards/advances/history - Retrieve advance logs for customer or staff
router.get('/advances/history', auth, async (req, res) => {
  try {
    const { customer_id, staff_id, job_card_id } = req.query;
    let query = 'SELECT apl.*, jc.job_no, jc.reg_no, s.full_name as staff_name, c.customer_name FROM advance_payments_log apl LEFT JOIN job_cards jc ON apl.job_card_id = jc.id LEFT JOIN staff s ON apl.staff_id = s.id LEFT JOIN customers c ON apl.customer_id = c.id WHERE 1=1';
    const params = [];
    if (customer_id) { query += ' AND apl.customer_id = ?'; params.push(customer_id); }
    if (staff_id) { query += ' AND apl.staff_id = ?'; params.push(staff_id); }
    if (job_card_id) { query += ' AND apl.job_card_id = ?'; params.push(job_card_id); }
    query += ' ORDER BY apl.created_at DESC';
    const [rows] = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('GET advances history error:', err);
    res.status(500).json({ error: 'Failed to retrieve advance payments log' });
  }
});

// POST /api/job-cards/advances - Record a new advance payment (Job Card, Next Month, Salary, etc.)
router.post('/advances', auth, async (req, res) => {
  try {
    const { job_card_id, staff_id, customer_id, advance_type, amount, reason, payment_date } = req.body;
    if (!amount || parseFloat(amount) <= 0 || !advance_type) {
      return res.status(400).json({ error: 'Valid amount and advance type are required' });
    }

    const amt = parseFloat(amount);
    const dateStr = payment_date || new Date().toISOString().slice(0, 10);

    const [result] = await db.execute(
      `INSERT INTO advance_payments_log (job_card_id, staff_id, customer_id, advance_type, amount, remaining_amount, payment_date, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [job_card_id || null, staff_id || null, customer_id || null, advance_type, amt, amt, dateStr, reason || null]
    );

    // If linked to a job card, sync with the standard advance_payments table
    if (job_card_id) {
      await db.execute(
        'INSERT INTO advance_payments (job_card_id, payment_type, amount, payment_date) VALUES (?, ?, ?, ?)',
        [job_card_id, 'cash', amt, dateStr]
      );
    }

    // Insert cash ledger entry
    let ledgerDesc = `Advance payment received (Type: ${advance_type})`;
    if (job_card_id) {
      const [jc] = await db.query('SELECT job_no FROM job_cards WHERE id = ?', [job_card_id]);
      if (jc.length > 0) ledgerDesc += ` for Job Card ${jc[0].job_no}`;
    }
    if (staff_id) {
      const [s] = await db.query('SELECT full_name FROM staff WHERE id = ?', [staff_id]);
      if (s.length > 0) ledgerDesc = `Advance payment issued to staff member ${s[0].full_name} (${advance_type})`;
    }

    await db.execute(
      'INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date) VALUES (?, ?, ?, ?, ?)',
      [staff_id ? 'out' : 'in', amt, 'Advance Payment', ledgerDesc, dateStr + ' 00:00:00']
    );

    res.status(201).json({ id: result.insertId, message: 'Advance payment recorded successfully' });
  } catch (err) {
    console.error('POST advances error:', err);
    res.status(500).json({ error: 'Failed to record advance payment' });
  }
});

// PUT /api/job-cards/advances/:id - Adjust remaining balance / settle an advance log
router.put('/advances/:id', auth, async (req, res) => {
  try {
    const { remaining_amount, reason } = req.body;
    if (remaining_amount === undefined) {
      return res.status(400).json({ error: 'remaining_amount is required' });
    }
    await db.execute(
      'UPDATE advance_payments_log SET remaining_amount = ?, reason = COALESCE(?, reason) WHERE id = ?',
      [parseFloat(remaining_amount), reason || null, req.params.id]
    );
    res.json({ message: 'Advance payment log updated successfully' });
  } catch (err) {
    console.error('PUT /advances/:id error:', err);
    res.status(500).json({ error: 'Failed to update advance payment log' });
  }
});

module.exports = router;



