const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── GET /api/customers — List / Search ─────
router.get('/', async (req, res) => {
  try {
    const { search, type, page = 1, limit = 50 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ' AND (c.customer_name LIKE ? OR c.mobile_no LIKE ? OR c.company_name LIKE ? OR c.gstin LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }
    if (type && type !== 'all') {
      where += ' AND c.customer_type = ?';
      params.push(type);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [countRows] = await db.query(`SELECT COUNT(*) as total FROM customers c ${where}`, params);
    const [rows] = await db.query(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM vehicles WHERE customer_id = c.id) as vehicle_count,
        (SELECT COUNT(*) FROM job_cards WHERE customer_id = c.id) as job_count
       FROM customers c ${where}
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ data: rows, total: countRows[0].total, page: parseInt(page) });
  } catch (err) {
    console.error('GET /customers error:', err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// ───── GET /api/customers/search — Autocomplete ─────
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ data: [] });

    const [rows] = await db.query(
      `SELECT c.id, c.customer_name, c.mobile_no, c.customer_type, c.company_name,
              c.email, c.city, c.state,
              GROUP_CONCAT(v.reg_no SEPARATOR ', ') as vehicles
       FROM customers c
       LEFT JOIN vehicles v ON v.customer_id = c.id
       WHERE c.customer_name LIKE ? OR c.mobile_no LIKE ? OR c.company_name LIKE ?
       GROUP BY c.id
       LIMIT 10`,
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /customers/search-error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ───── GET /api/customers/search-connected — Autocomplete for connected customer & vehicle info ─────
router.get('/search-connected', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ data: [] });

    const searchPattern = `%${q}%`;
    const [rows] = await db.query(
      `SELECT 
        'vehicle' as record_type,
        v.id as vehicle_id,
        v.reg_no,
        v.make,
        v.model,
        v.year,
        v.variant,
        v.fuel_type,
        v.vehicle_color,
        c.id as customer_id,
        c.customer_name,
        c.mobile_no as customer_mobile,
        c.email as customer_email,
        c.city as customer_city,
        c.state as customer_state,
        c.company_name,
        c.customer_type,
        c.alt_mobile,
        c.gstin,
        c.ref_no,
        c.contact_person,
        c.driver_name,
        c.address_line,
        c.colony_street,
        c.state_code,
        c.pincode
       FROM vehicles v
       LEFT JOIN customers c ON v.customer_id = c.id
       WHERE v.reg_no LIKE ? OR c.customer_name LIKE ? OR c.mobile_no LIKE ?
       
       UNION
       
       SELECT 
        'customer' as record_type,
        NULL as vehicle_id,
        NULL as reg_no,
        NULL as make,
        NULL as model,
        NULL as year,
        NULL as variant,
        NULL as fuel_type,
        NULL as vehicle_color,
        c.id as customer_id,
        c.customer_name,
        c.mobile_no as customer_mobile,
        c.email as customer_email,
        c.city as customer_city,
        c.state as customer_state,
        c.company_name,
        c.customer_type,
        c.alt_mobile,
        c.gstin,
        c.ref_no,
        c.contact_person,
        c.driver_name,
        c.address_line,
        c.colony_street,
        c.state_code,
        c.pincode
       FROM customers c
       WHERE (c.customer_name LIKE ? OR c.mobile_no LIKE ?)
         AND c.id NOT IN (SELECT DISTINCT customer_id FROM vehicles WHERE customer_id IS NOT NULL)
       LIMIT 10`,
      [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error('GET /customers/search-connected error:', err);
    res.status(500).json({ error: 'Connected search failed' });
  }
});

// ───── GET /api/customers/:id — Single customer with vehicles ─────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

    const customer = rows[0];
    const [vehicles] = await db.query('SELECT * FROM vehicles WHERE customer_id = ? ORDER BY created_at DESC', [customer.id]);
    customer.vehicles = vehicles;

    const [jobs] = await db.query(
      `SELECT jc.id, jc.job_no, jc.reg_no, jc.car_name, jc.status, jc.job_date, jc.final_amount
       FROM job_cards jc WHERE jc.customer_id = ? ORDER BY jc.created_at DESC LIMIT 20`,
      [customer.id]
    );
    customer.job_history = jobs;

    res.json(customer);
  } catch (err) {
    console.error('GET /customers/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// ───── POST /api/customers — Create ─────
router.post('/', async (req, res) => {
  try {
    const {
      customer_type, customer_name, company_name, gstin, ref_no,
      mobile_no, alt_mobile, email, contact_person, driver_name,
      address_line, colony_street, city, state, state_code, pincode,
      birth_date, is_sez
    } = req.body;

    if (!customer_name || !mobile_no) {
      return res.status(400).json({ error: 'Customer name and mobile number required' });
    }

    const [result] = await db.execute(
      `INSERT INTO customers (customer_type, customer_name, company_name, gstin, ref_no,
        mobile_no, alt_mobile, email, contact_person, driver_name,
        address_line, colony_street, city, state, state_code, pincode, birth_date, is_sez)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_type || 'individual', customer_name, company_name || null, gstin || null, ref_no || null,
        mobile_no, alt_mobile || null, email || null, contact_person || null, driver_name || null,
        address_line || null, colony_street || null, city || null, state || null,
        state_code || null, pincode || null, birth_date || null, is_sez ? 1 : 0
      ]
    );

    res.status(201).json({ id: result.insertId, message: 'Customer created' });
  } catch (err) {
    console.error('POST /customers error:', err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// ───── PUT /api/customers/:id — Update ─────
router.put('/:id', async (req, res) => {
  try {
    const allowed = [
      'customer_type', 'customer_name', 'company_name', 'gstin', 'ref_no',
      'mobile_no', 'alt_mobile', 'email', 'contact_person', 'driver_name',
      'address_line', 'colony_street', 'city', 'state', 'state_code', 'pincode',
      'birth_date', 'is_sez'
    ];
    const updates = [];
    const values = [];
    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    await db.execute(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, values);

    // Sync updated info to job cards and invoices
    const [custRows] = await db.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (custRows.length > 0) {
      const c = custRows[0];
      // Update job cards
      await db.execute(
        'UPDATE job_cards SET owner_name = ?, mobile_no = ? WHERE customer_id = ?',
        [c.customer_name, c.mobile_no, c.id]
      );
      // Update invoices_non_gst
      await db.execute(
        'UPDATE invoices_non_gst SET customer_name = ?, mobile_no = ? WHERE job_card_id IN (SELECT id FROM job_cards WHERE customer_id = ?)',
        [c.customer_name, c.mobile_no, c.id]
      );
    }

    res.json({ message: 'Customer updated and synced' });
  } catch (err) {
    console.error('PUT /customers/:id error:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

module.exports = router;
