const express = require('express');
const db = require('../config/db');

const router = express.Router();
// -- NO AUTH MIDDLEWARE — This is a PUBLIC route --

// ===============================================================
// GET /api/public/job-card/:token — Public job card tracking
// ===============================================================
router.get('/job-card/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.length < 10) {
      return res.status(400).json({ error: 'Invalid tracking token' });
    }

    // Fetch job card by public_token — ONLY expose safe fields
    const [rows] = await db.query(
      `SELECT 
        jc.id,
        jc.job_no,
        jc.reg_no,
        jc.car_name,
        jc.owner_name,
        jc.status,
        jc.job_date,
        jc.service_type,
        jc.vehicle_make,
        jc.vehicle_model,
        jc.is_quick_job
       FROM job_cards jc
       WHERE jc.public_token = ?
       LIMIT 1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Job card not found' });
    }

    const job = rows[0];

    // Fetch services (only names & amounts — no internal fields)
    const [services] = await db.query(
      `SELECT service_name, item_type, qty, rate, amount
       FROM job_card_services
       WHERE job_card_id = ?
       ORDER BY id ASC`,
      [job.id]
    );

    // Compute total
    const total = services.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);

    // Fetch media (photos) — safe fallback if table doesn't exist
    let media = [];
    try {
      const [mediaRows] = await db.query(
        `SELECT file_path, stage, caption FROM job_card_media WHERE job_card_id = ? ORDER BY stage, id`,
        [job.id]
      );
      media = mediaRows.map(m => ({
        url: m.file_path,
        stage: m.stage,
        caption: m.caption || null,
      }));
    } catch (mediaErr) {
      if (mediaErr.code !== 'ER_NO_SUCH_TABLE') console.error('Media fetch error:', mediaErr);
    }

    // Build a user-friendly status label
    const STATUS_LABELS = {
      estimation: 'Estimation Prepared',
      wip: 'Work in Progress',
      ready: 'Ready for Delivery',
      delivered: 'Delivered',
      invoiced: 'Invoiced & Completed',
      cancelled: 'Cancelled'
    };

    res.json({
      job_no: job.job_no,
      reg_no: job.reg_no,
      car_name: job.car_name,
      owner_name: job.owner_name,
      status: job.status,
      status_label: STATUS_LABELS[job.status] || job.status,
      job_date: job.job_date,
      service_type: job.service_type,
      vehicle_make: job.vehicle_make,
      vehicle_model: job.vehicle_model,
      is_quick_job: job.is_quick_job,
      services: services.map(s => ({
        name: s.service_name,
        type: s.item_type,
        qty: s.qty,
        rate: s.rate,
        amount: s.amount
      })),
      total,
      media
    });
  } catch (err) {
    console.error('GET /public/job-card/:token error:', err);
    res.status(500).json({ error: 'Failed to fetch job card status' });
  }
});

// ===============================================================
// GET /api/public/document/:token — Full document view (no auth)
// Returns all data needed to render estimate/invoice/job card
// ===============================================================
router.get('/document/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { type } = req.query; // estimate | invoice | job_card

    if (!token || token.length < 10) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Fetch full job card data using public_token
    const [rows] = await db.query(
      `SELECT jc.*, s.full_name as assigned_staff_name,
              c.customer_name as cust_name, c.mobile_no as cust_mobile,
              c.company_name, c.gstin, c.email as cust_email,
              c.address_line, c.colony_street, c.city, c.state, c.pincode,
              v.make, v.model as vehicle_model, v.year as vehicle_year,
              v.variant, v.vin, v.engine_no, v.fuel_type, v.vehicle_color
       FROM job_cards jc
       LEFT JOIN staff s ON jc.assigned_staff_id = s.id
       LEFT JOIN customers c ON jc.customer_id = c.id
       LEFT JOIN vehicles v ON jc.vehicle_id = v.id
       WHERE jc.public_token = ?
       LIMIT 1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const job = rows[0];

    // Services
    const [services] = await db.query(
      'SELECT * FROM job_card_services WHERE job_card_id = ? ORDER BY id',
      [job.id]
    );
    job.services = services;

    // Concerns
    const [concerns] = await db.query(
      'SELECT * FROM customer_concerns WHERE job_card_id = ? ORDER BY id',
      [job.id]
    );
    job.concerns = concerns;

    // Invoice or Estimate data
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

    // Normalize customer field aliases for public view rendering
    job.customer_name = job.cust_name || job.customer_name || job.owner_name || '';
    job.email = job.cust_email || job.email || '';
    job.mobile_no = job.cust_mobile || job.mobile_no || '';
    job.address = [job.address_line, job.colony_street, job.city, job.state, job.pincode].filter(Boolean).join(', ');

    // Business settings
    let settings = {};
    try {
      const [settingsRows] = await db.query('SELECT setting_key, setting_value FROM settings');
      settingsRows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    } catch { /* table may not exist */ }

    // Mask sensitive data — hide full mobile number for public view
    if (job.mobile_no) {
      job.mobile_no = '******' + job.mobile_no.slice(-4);
    }

    res.json({
      job,
      business: {
        business_name: settings.business_name || 'Happy Car Wash',
        business_address: settings.business_address || 'Happy Car Wash, Opp YES Bank Next To Chocolate Room, Gotri Vasna Road, Vadodara, Gujarat (GJ) - 390007.',
        business_phone: settings.business_phone || '0000000000',
        business_email: settings.business_email || 'contact@happycarwash.com',
        business_gstin: settings.business_gstin || '00AAAAA0000A1Z5',
      }
    });
  } catch (err) {
    console.error('GET /public/document/:token error:', err);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// ===============================================================
// GET /api/public/invoice-html/:token — Public token-based invoice/estimate HTML view
// Redirects to the internal invoice-html route using the resolved job card ID
// ===============================================================
router.get('/invoice-html/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 10) {
      return res.status(400).send('Invalid token');
    }
    const [rows] = await db.query('SELECT id FROM job_cards WHERE public_token = ? LIMIT 1', [token]);
    if (rows.length === 0) {
      return res.status(404).send('<h2>Document not found</h2>');
    }
    // Redirect to the existing invoice-html route (already public, no auth)
    res.redirect(`/api/job-cards/${rows[0].id}/invoice-html`);
  } catch (err) {
    console.error('GET /public/invoice-html/:token error:', err);
    res.status(500).send('Failed to load document');
  }
});

module.exports = router;



