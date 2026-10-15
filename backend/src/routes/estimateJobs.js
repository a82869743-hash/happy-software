/**
 * Estimate Jobs Routes — V2
 * Standalone estimation management with GST/Non-GST, archive, restore, convert
 */
const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── Estimate Number Generator ─────
async function generateEstimateNo(conn = db) {
  const [rows] = await conn.query(
    "SELECT estimate_no FROM estimates ORDER BY id DESC LIMIT 1 FOR UPDATE"
  );
  if (rows.length === 0) return 'HCW001';
  const match = rows[0].estimate_no ? rows[0].estimate_no.match(/HCW(\d+)/i) || rows[0].estimate_no.match(/(\d+)$/) : null;
  const lastNum = match ? parseInt(match[1]) : rows.length;
  return `HCW${String(lastNum + 1).padStart(3, '0')}`;
}

// ───── Audit Logger ─────
async function logAudit(conn, estimateId, action, user, details = null) {
  await conn.execute(
    'INSERT INTO estimate_audit_log (estimate_id, action, user_id, user_name, details) VALUES (?, ?, ?, ?, ?)',
    [estimateId, action, user?.id || null, user?.full_name || 'System', details]
  );
}

// ═══════════════════════════════════════════════════════════════
// GET /api/estimate-jobs — List estimates (not archived by default)
// ═══════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { filter, search, page = 1, limit = 50 } = req.query;
    const searchVal = search ? `%${search}%` : null;

    let baseQuery = `
      FROM (
        SELECT 
          e.id, 
          e.job_card_id, 
          e.estimate_no, 
          e.subtotal, 
          e.payment_mode, 
          e.estimate_type,
          e.gst_percentage, 
          e.gst_amount, 
          e.total_amount, 
          e.customer_name, 
          e.mobile_no, 
          e.reg_no, 
          e.car_name, 
          e.vehicle_make, 
          e.vehicle_model, 
          e.notes, 
          e.company_name as company_name, 
          e.gstin as gstin, 
          e.is_archived, 
          e.created_at
        FROM estimates e

        UNION ALL

        SELECT 
          jc.id as id, 
          jc.id as job_card_id, 
          ng.invoice_no as estimate_no, 
          ng.subtotal, 
          ng.payment_mode, 
          'non_gst_estimate' as estimate_type,
          0 as gst_percentage, 
          0 as gst_amount, 
          ng.total_amount, 
          jc.owner_name as customer_name, 
          jc.mobile_no, 
          jc.reg_no, 
          jc.car_name, 
          jc.vehicle_make, 
          jc.vehicle_model, 
          jc.notes as notes, 
          jc.corporate_name as company_name, 
          NULL as gstin, 
          0 as is_archived, 
          ng.created_at
        FROM job_cards jc
        JOIN invoices_non_gst ng ON ng.job_card_id = jc.id
        WHERE jc.is_deleted = 0 AND ng.deleted_at IS NULL

        UNION ALL

        SELECT 
          jc.id as id, 
          jc.id as job_card_id, 
          CONCAT('EST-JC-', jc.job_no) as estimate_no, 
          jc.final_amount as subtotal, 
          jc.payment_mode, 
          'non_gst_estimate' as estimate_type,
          0 as gst_percentage, 
          0 as gst_amount, 
          jc.final_amount as total_amount, 
          jc.owner_name as customer_name, 
          jc.mobile_no, 
          jc.reg_no, 
          jc.car_name, 
          jc.vehicle_make, 
          jc.vehicle_model, 
          jc.notes as notes, 
          jc.corporate_name as company_name, 
          NULL as gstin, 
          0 as is_archived, 
          jc.created_at
        FROM job_cards jc
        WHERE jc.status = 'estimation' AND jc.is_deleted = 0
          AND jc.id NOT IN (SELECT job_card_id FROM invoices_non_gst)
      ) as combined
      WHERE 1=1
    `;

    const queryParams = [];

    if (filter === 'gst') {
      baseQuery += " AND combined.estimate_type = 'gst_estimate' AND combined.is_archived = 0";
    } else if (filter === 'non_gst') {
      baseQuery += " AND combined.estimate_type = 'non_gst_estimate' AND combined.is_archived = 0";
    } else if (filter === 'converted') {
      baseQuery += ' AND combined.id IN (SELECT estimate_id FROM estimate_job_mapping) AND combined.is_archived = 0';
    } else if (filter === 'archived') {
      baseQuery += ' AND combined.is_archived = 1';
    } else {
      baseQuery += ' AND combined.is_archived = 0';
    }

    if (search) {
      baseQuery += ' AND (combined.estimate_no LIKE ? OR combined.customer_name LIKE ? OR combined.reg_no LIKE ? OR combined.mobile_no LIKE ?)';
      queryParams.push(searchVal, searchVal, searchVal, searchVal);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countRows] = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, queryParams);
    const [rows] = await db.query(
      `SELECT * ${baseQuery} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), offset]
    );

    // Attach services if any
    for (const est of rows) {
      if (est.job_card_id) {
        const [svcs] = await db.query('SELECT * FROM job_card_services WHERE job_card_id = ? ORDER BY id', [est.job_card_id]);
        est.services = svcs;
      } else {
        const [svcs] = await db.query('SELECT * FROM estimate_services WHERE estimate_id = ? ORDER BY id', [est.id]);
        est.services = svcs;
      }
    }

    res.json({ data: rows, total: countRows[0].total, page: parseInt(page) });
  } catch (err) {
    console.error('GET /estimate-jobs error:', err);
    res.status(500).json({ error: 'Failed to fetch estimates' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/estimate-jobs/stats — Dashboard cards
// ═══════════════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const [total] = await db.query('SELECT COUNT(*) as cnt FROM estimates');
    const [gst] = await db.query("SELECT COUNT(*) as cnt FROM estimates WHERE estimate_type = 'gst_estimate' AND is_archived = 0");
    const [nonGst] = await db.query("SELECT COUNT(*) as cnt FROM estimates WHERE estimate_type = 'non_gst_estimate' AND is_archived = 0");
    const [archived] = await db.query('SELECT COUNT(*) as cnt FROM estimates WHERE is_archived = 1');
    const [converted] = await db.query('SELECT COUNT(*) as cnt FROM estimate_job_mapping');
    const active = total[0].cnt - archived[0].cnt;
    const convRate = active > 0 ? ((converted[0].cnt / active) * 100).toFixed(1) : '0.0';

    res.json({
      total: total[0].cnt,
      gst: gst[0].cnt,
      non_gst: nonGst[0].cnt,
      archived: archived[0].cnt,
      converted: converted[0].cnt,
      conversion_rate: parseFloat(convRate)
    });
  } catch (err) {
    console.error('GET /estimate-jobs/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/estimate-jobs/:id — Single estimate detail
// ═══════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*, ejm.job_card_id as converted_job_card_id, ejm.converted_at
       FROM estimates e
       LEFT JOIN estimate_job_mapping ejm ON ejm.estimate_id = e.id
       WHERE e.id = ?`, [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Estimate not found' });

    const est = rows[0];
    const [svcs] = await db.query('SELECT * FROM estimate_services WHERE estimate_id = ? ORDER BY id', [est.id]);
    est.services = svcs;

    const [audit] = await db.query('SELECT * FROM estimate_audit_log WHERE estimate_id = ? ORDER BY created_at DESC', [est.id]);
    est.audit_log = audit;

    res.json(est);
  } catch (err) {
    console.error('GET /estimate-jobs/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch estimate' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/estimate-jobs — Create standalone estimate
// ═══════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      estimate_type, customer_name, mobile_no, reg_no, car_name,
      vehicle_make, vehicle_model, notes, services, payment_mode,
      gst_percentage, job_card_id, company_name, gstin
    } = req.body;

    if (!estimate_type || !['gst_estimate', 'non_gst_estimate'].includes(estimate_type)) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'estimate_type must be gst_estimate or non_gst_estimate' });
    }
    if (!services || !Array.isArray(services) || services.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'At least one service is required' });
    }

    const subtotal = services.reduce((s, svc) => s + (parseFloat(svc.amount) || 0) + (estimate_type === 'non_gst_estimate' ? (parseFloat(svc.tax_amount) || 0) : 0), 0);
    const gst_pct = estimate_type === 'gst_estimate' ? (parseFloat(gst_percentage) || 18) : 0;
    const gst_amt = parseFloat((subtotal * gst_pct / 100).toFixed(2));
    const total = parseFloat((subtotal + gst_amt).toFixed(2));
    const estimate_no = await generateEstimateNo(conn);

    const [result] = await conn.execute(
      `INSERT INTO estimates (job_card_id, estimate_no, subtotal, payment_mode, estimate_type,
        gst_percentage, gst_amount, total_amount, customer_name, mobile_no, reg_no, car_name,
        vehicle_make, vehicle_model, notes, company_name, gstin, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [job_card_id || null, estimate_no, subtotal, payment_mode || 'cash', estimate_type,
       gst_pct, gst_amt, total, customer_name || null, mobile_no || null,
       reg_no ? reg_no.toUpperCase().trim() : null, car_name || null,
       vehicle_make || null, vehicle_model || null, notes || null,
       company_name || null, gstin || null, req.user?.id || null]
    );

    const estimateId = result.insertId;

    // Insert services
    for (const svc of services) {
      if (svc.service_name && svc.amount !== undefined && svc.amount !== '') {
        const itemType = (svc.item_type === 'part' || svc.item_type === 'spare' || svc.item_type === 'consumable' || svc.item_type === 'external') ? svc.item_type : 'labour';
        const qty = (svc.qty !== undefined && svc.qty !== '') ? parseInt(svc.qty) : 1;
        const rate = (svc.rate !== undefined && svc.rate !== '') ? parseFloat(svc.rate) : (parseFloat(svc.amount) || 0);
        const amount = parseFloat(svc.amount) || 0;
        const finalHsnSac = (svc.hsn_sac && svc.hsn_sac.trim()) ? svc.hsn_sac.trim() : (['part', 'spare', 'consumable', 'external'].includes(itemType) ? '8708' : '998714');

        await conn.execute(
          `INSERT INTO estimate_services (estimate_id, service_name, item_type, part_code, qty, rate, amount, hsn_sac)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [estimateId, svc.service_name, itemType, svc.part_code || null,
           qty, rate, amount, finalHsnSac]
        );
      }
    }

    // Vault entry
    await conn.execute(
      `INSERT INTO estimate_history_vault (estimate_id, estimate_no, estimate_type, customer_name, mobile_no,
        reg_no, car_name, vehicle_make, vehicle_model, subtotal, gst_percentage, gst_amount, total_amount,
        payment_mode, services_json, notes, company_name, gstin, created_at, vault_action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'created')`,
      [estimateId, estimate_no, estimate_type, customer_name || null, mobile_no || null,
       reg_no || null, car_name || null, vehicle_make || null, vehicle_model || null,
       subtotal, gst_pct, gst_amt, total, payment_mode || 'cash', JSON.stringify(services), notes || null,
       company_name || null, gstin || null]
    );

    await logAudit(conn, estimateId, 'created', req.user, `${estimate_type} — ₹${total}`);
    await conn.commit(); conn.release();

    res.status(201).json({ id: estimateId, estimate_no, subtotal, gst_amount: gst_amt, total_amount: total });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('POST /estimate-jobs error:', err);
    res.status(500).json({ error: 'Failed to create estimate' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /api/estimate-jobs/:id — Edit estimate
// ═══════════════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { estimate_type, customer_name, mobile_no, reg_no, car_name,
      vehicle_make, vehicle_model, notes, services, payment_mode, gst_percentage,
      company_name, gstin } = req.body;

    const [existing] = await conn.query('SELECT * FROM estimates WHERE id = ?', [req.params.id]);
    if (existing.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Not found' }); }
    if (existing[0].is_archived) { await conn.rollback(); conn.release(); return res.status(400).json({ error: 'Cannot edit archived estimate' }); }

    const type = estimate_type || existing[0].estimate_type;
    const subtotal = services ? services.reduce((s, svc) => s + (parseFloat(svc.amount) || 0) + (type === 'non_gst_estimate' ? (parseFloat(svc.tax_amount) || 0) : 0), 0) : existing[0].subtotal;
    const gst_pct = type === 'gst_estimate' ? (parseFloat(gst_percentage) || 18) : 0;
    const gst_amt = parseFloat((subtotal * gst_pct / 100).toFixed(2));
    const total = parseFloat((subtotal + gst_amt).toFixed(2));

    await conn.execute(
      `UPDATE estimates SET estimate_type=?, subtotal=?, gst_percentage=?, gst_amount=?, total_amount=?,
        payment_mode=?, customer_name=?, mobile_no=?, reg_no=?, car_name=?, vehicle_make=?, vehicle_model=?, notes=?,
        company_name=?, gstin=?
       WHERE id = ?`,
      [type, subtotal, gst_pct, gst_amt, total, payment_mode || existing[0].payment_mode,
       customer_name ?? existing[0].customer_name, mobile_no ?? existing[0].mobile_no,
       reg_no ? reg_no.toUpperCase().trim() : existing[0].reg_no, car_name ?? existing[0].car_name,
       vehicle_make ?? existing[0].vehicle_make, vehicle_model ?? existing[0].vehicle_model,
       notes ?? existing[0].notes,
       company_name !== undefined ? company_name : existing[0].company_name,
       gstin !== undefined ? gstin : existing[0].gstin,
       req.params.id]
    );

    if (services && Array.isArray(services)) {
      await conn.execute('DELETE FROM estimate_services WHERE estimate_id = ?', [req.params.id]);
      for (const svc of services) {
        if (svc.service_name && svc.amount !== undefined && svc.amount !== '') {
          const itemType = (svc.item_type === 'part' || svc.item_type === 'spare' || svc.item_type === 'consumable' || svc.item_type === 'external') ? svc.item_type : 'labour';
          const qty = (svc.qty !== undefined && svc.qty !== '') ? parseInt(svc.qty) : 1;
          const rate = (svc.rate !== undefined && svc.rate !== '') ? parseFloat(svc.rate) : (parseFloat(svc.amount) || 0);
          const amount = parseFloat(svc.amount) || 0;
          const finalHsnSac = (svc.hsn_sac && svc.hsn_sac.trim()) ? svc.hsn_sac.trim() : (['part', 'spare', 'consumable', 'external'].includes(itemType) ? '8708' : '998714');

          await conn.execute(
            `INSERT INTO estimate_services (estimate_id, service_name, item_type, part_code, qty, rate, amount, hsn_sac)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, svc.service_name, itemType, svc.part_code || null,
             qty, rate, amount, finalHsnSac]
          );
        }
      }
    }

    await logAudit(conn, req.params.id, 'edited', req.user, `Updated to ${type} — ₹${total}`);
    await conn.commit(); conn.release();
    res.json({ message: 'Estimate updated', total_amount: total });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('PUT /estimate-jobs/:id error:', err);
    res.status(500).json({ error: 'Failed to update estimate' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/estimate-jobs/:id/convert — Convert to Job Card
// ═══════════════════════════════════════════════════════════════
router.post('/:id/convert', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [est] = await conn.query('SELECT * FROM estimates WHERE id = ?', [req.params.id]);
    if (est.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Not found' }); }

    const [alreadyConverted] = await conn.query('SELECT * FROM estimate_job_mapping WHERE estimate_id = ?', [req.params.id]);
    if (alreadyConverted.length > 0) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Already converted', job_card_id: alreadyConverted[0].job_card_id });
    }

    const estimate = est[0];

    // Generate job number
    const [rows] = await conn.query(
      "SELECT job_no FROM job_cards ORDER BY id DESC LIMIT 1 FOR UPDATE"
    );
    let job_no = 'HCW001';
    if (rows.length > 0) {
      const match = rows[0].job_no ? rows[0].job_no.match(/HCW(\d+)/i) || rows[0].job_no.match(/(\d+)$/) : null;
      const lastNum = match ? parseInt(match[1]) : rows.length;
      job_no = `HCW${String(lastNum + 1).padStart(3, '0')}`;
    }

    const crypto = require('crypto');
    const public_token = crypto.randomBytes(32).toString('hex');

    // Link or create customer with corporate details
    let finalCustomerId = null;
    if (estimate.customer_name && estimate.mobile_no) {
      const [existingCust] = await conn.query(
        'SELECT id FROM customers WHERE mobile_no = ? LIMIT 1', [estimate.mobile_no]
      );
      if (existingCust.length > 0) {
        finalCustomerId = existingCust[0].id;
        if (estimate.company_name || estimate.gstin) {
          await conn.execute(
            `UPDATE customers SET 
              company_name = COALESCE(NULLIF(company_name, ''), ?), 
              gstin = COALESCE(NULLIF(gstin, ''), ?),
              customer_type = COALESCE(NULLIF(customer_type, ''), ?)
             WHERE id = ?`,
            [estimate.company_name || null, estimate.gstin || null, (estimate.company_name || estimate.gstin) ? 'corporate' : 'individual', finalCustomerId]
          );
        }
      } else {
        const [custResult] = await conn.execute(
          `INSERT INTO customers (customer_type, customer_name, company_name, gstin, mobile_no)
           VALUES (?, ?, ?, ?, ?)`,
          [
            (estimate.company_name || estimate.gstin) ? 'corporate' : 'individual',
            estimate.customer_name,
            estimate.company_name || null,
            estimate.gstin || null,
            estimate.mobile_no
          ]
        );
        finalCustomerId = custResult.insertId;
      }
    }

    // Link vehicle if exists
    let finalVehicleId = null;
    if (estimate.reg_no && estimate.reg_no.trim()) {
      const cleanReg = estimate.reg_no.trim().toUpperCase();
      const [vRows] = await conn.query('SELECT id FROM vehicles WHERE reg_no = ? LIMIT 1', [cleanReg]);
      if (vRows.length > 0) {
        finalVehicleId = vRows[0].id;
      }
    }

    const [jcResult] = await conn.execute(
      `INSERT INTO job_cards (job_no, reg_no, car_name, owner_name, mobile_no, vehicle_make, vehicle_model,
        status, notes, public_token, customer_id, vehicle_id, company) VALUES (?, ?, ?, ?, ?, ?, ?, 'estimation', ?, ?, ?, ?, ?)`,
      [job_no, estimate.reg_no || '', estimate.car_name || '', estimate.customer_name || '',
       estimate.mobile_no || '', estimate.vehicle_make || '', estimate.vehicle_model || '',
       estimate.notes || null, public_token, finalCustomerId, finalVehicleId, estimate.company_name || 'Detailing Studio']
    );

    const jobCardId = jcResult.insertId;

    // Copy services
    const [svcs] = await conn.query('SELECT * FROM estimate_services WHERE estimate_id = ?', [req.params.id]);
    for (const svc of svcs) {
      const finalItemType = (svc.item_type === 'part' || svc.item_type === 'spare' || svc.item_type === 'consumable' || svc.item_type === 'external') ? 'part' : 'labour';
      await conn.execute(
        `INSERT INTO job_card_services (job_card_id, service_name, item_type, part_code, qty, rate, amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [jobCardId, svc.service_name, finalItemType, svc.part_code, svc.qty, svc.rate, svc.amount]
      );
    }

    // Create mapping
    await conn.execute(
      'INSERT INTO estimate_job_mapping (estimate_id, job_card_id, converted_by) VALUES (?, ?, ?)',
      [req.params.id, jobCardId, req.user?.id || null]
    );

    // Vault
    await conn.execute(
      `INSERT INTO estimate_history_vault (estimate_id, estimate_no, estimate_type, customer_name, mobile_no,
        reg_no, car_name, vehicle_make, vehicle_model, subtotal, gst_percentage, gst_amount, total_amount,
        payment_mode, services_json, notes, created_at, vault_action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'converted')`,
      [req.params.id, estimate.estimate_no, estimate.estimate_type, estimate.customer_name,
       estimate.mobile_no, estimate.reg_no, estimate.car_name, estimate.vehicle_make, estimate.vehicle_model,
       estimate.subtotal, estimate.gst_percentage, estimate.gst_amount, estimate.total_amount,
       estimate.payment_mode, JSON.stringify(svcs), estimate.notes, estimate.created_at]
    );

    await logAudit(conn, req.params.id, 'converted', req.user, `Converted to Job Card ${job_no}`);
    await conn.commit(); conn.release();

    res.json({ message: 'Converted to Job Card', job_card_id: jobCardId, job_no });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('POST /estimate-jobs/:id/convert error:', err);
    res.status(500).json({ error: 'Failed to convert' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/estimate-jobs/:id/archive — Archive single estimate
// ═══════════════════════════════════════════════════════════════
router.post('/:id/archive', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [est] = await conn.query('SELECT * FROM estimates WHERE id = ? AND is_archived = 0', [req.params.id]);
    if (est.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Not found or already archived' }); }

    const estimate = est[0];
    const [svcs] = await conn.query('SELECT * FROM estimate_services WHERE estimate_id = ?', [req.params.id]);

    await conn.execute('UPDATE estimates SET is_archived = 1, archived_at = NOW(), archived_by = ? WHERE id = ?',
      [req.user?.id || null, req.params.id]);

    await conn.execute(
      `INSERT INTO estimate_history_vault (estimate_id, estimate_no, estimate_type, customer_name, mobile_no,
        reg_no, car_name, vehicle_make, vehicle_model, subtotal, gst_percentage, gst_amount, total_amount,
        payment_mode, services_json, notes, created_at, vault_action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'archived')`,
      [req.params.id, estimate.estimate_no, estimate.estimate_type, estimate.customer_name,
       estimate.mobile_no, estimate.reg_no, estimate.car_name, estimate.vehicle_make, estimate.vehicle_model,
       estimate.subtotal, estimate.gst_percentage, estimate.gst_amount, estimate.total_amount,
       estimate.payment_mode, JSON.stringify(svcs), estimate.notes, estimate.created_at]
    );

    await logAudit(conn, req.params.id, 'archived', req.user);
    await conn.commit(); conn.release();
    res.json({ message: 'Estimate archived' });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('Archive error:', err);
    res.status(500).json({ error: 'Failed to archive' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/estimate-jobs/:id/restore — Restore from archive
// ═══════════════════════════════════════════════════════════════
router.post('/:id/restore', async (req, res) => {
  try {
    const [est] = await db.query('SELECT * FROM estimates WHERE id = ? AND is_archived = 1', [req.params.id]);
    if (est.length === 0) return res.status(404).json({ error: 'Not found or not archived' });

    await db.execute('UPDATE estimates SET is_archived = 0, archived_at = NULL, archived_by = NULL WHERE id = ?', [req.params.id]);
    await logAudit(db, req.params.id, 'restored', req.user);
    res.json({ message: 'Estimate restored' });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Failed to restore' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/estimate-jobs/bulk-archive — Admin: Clear Estimate Page
// ═══════════════════════════════════════════════════════════════
router.post('/bulk-archive', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [estimates] = await conn.query('SELECT * FROM estimates WHERE is_archived = 0');
    if (estimates.length === 0) { await conn.rollback(); conn.release(); return res.json({ message: 'No estimates to archive', count: 0 }); }

    for (const estimate of estimates) {
      const [svcs] = await conn.query('SELECT * FROM estimate_services WHERE estimate_id = ?', [estimate.id]);
      await conn.execute(
        `INSERT INTO estimate_history_vault (estimate_id, estimate_no, estimate_type, customer_name, mobile_no,
          reg_no, car_name, vehicle_make, vehicle_model, subtotal, gst_percentage, gst_amount, total_amount,
          payment_mode, services_json, notes, created_at, vault_action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'archived')`,
        [estimate.id, estimate.estimate_no, estimate.estimate_type, estimate.customer_name,
         estimate.mobile_no, estimate.reg_no, estimate.car_name, estimate.vehicle_make, estimate.vehicle_model,
         estimate.subtotal, estimate.gst_percentage, estimate.gst_amount, estimate.total_amount,
         estimate.payment_mode, JSON.stringify(svcs), estimate.notes, estimate.created_at]
      );
      await logAudit(conn, estimate.id, 'bulk_archived', req.user);
    }

    await conn.execute('UPDATE estimates SET is_archived = 1, archived_at = NOW(), archived_by = ? WHERE is_archived = 0',
      [req.user?.id || null]);
    await conn.execute('DELETE FROM estimate_services');
    await conn.execute('DELETE FROM estimates');

    await conn.commit(); conn.release();
    res.json({ message: `${estimates.length} estimates archived & cleared`, count: estimates.length });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('Bulk archive error:', err);
    res.status(500).json({ error: 'Failed to bulk archive' });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/estimate-jobs/:id — Hard Delete Estimate
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const id = parseInt(req.params.id);
    await conn.execute('DELETE FROM estimate_services WHERE estimate_id = ?', [id]);
    await conn.execute('DELETE FROM estimates WHERE id = ?', [id]);
    await conn.commit(); conn.release();
    res.json({ message: 'Estimate deleted successfully' });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('DELETE estimate error:', err);
    res.status(500).json({ error: 'Failed to delete estimate' });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/estimate-jobs/:estimateId/items/:itemId — Delete individual line item
// ═══════════════════════════════════════════════════════════════
router.delete('/:estimateId/items/:itemId', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const estimateId = parseInt(req.params.estimateId);
    const itemId = parseInt(req.params.itemId);

    const [estRows] = await conn.query('SELECT * FROM estimates WHERE id = ?', [estimateId]);
    if (estRows.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const estimate = estRows[0];

    await conn.execute('DELETE FROM estimate_services WHERE id = ? AND estimate_id = ?', [itemId, estimateId]);

    // Recalculate totals
    const [svcs] = await conn.query('SELECT amount FROM estimate_services WHERE estimate_id = ?', [estimateId]);
    const subtotal = svcs.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    const gstPct = parseFloat(estimate.gst_percentage || 0);
    const gstAmount = estimate.estimate_type === 'gst_estimate' ? (subtotal * gstPct / 100) : 0;
    const totalAmount = subtotal + gstAmount;

    await conn.execute(
      'UPDATE estimates SET subtotal = ?, gst_amount = ?, total_amount = ? WHERE id = ?',
      [subtotal, gstAmount, totalAmount, estimateId]
    );

    await logAudit(conn, estimateId, 'item_deleted', req.user, `Deleted service item #${itemId}`);
    await conn.commit(); conn.release();

    res.json({ message: 'Line item deleted successfully', estimateId, subtotal, totalAmount });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('DELETE item error:', err);
    res.status(500).json({ error: 'Failed to delete line item' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/estimate-jobs/vault/history — History Vault (read-only)
// ═══════════════════════════════════════════════════════════════
router.get('/vault/history', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM estimate_history_vault ORDER BY archived_at DESC LIMIT 200');
    res.json({ data: rows });
  } catch (err) {
    console.error('Vault error:', err);
    res.status(500).json({ error: 'Failed to fetch vault' });
  }
});

module.exports = router;
