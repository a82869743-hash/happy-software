const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── Part Code Generator ─────
async function generatePartCode() {
  const [rows] = await db.query('SELECT part_code FROM parts ORDER BY id DESC LIMIT 1');
  if (rows.length === 0) return 'SAC-PRT-001';
  const last = rows[0].part_code;
  const num = parseInt(last.split('-')[2]) + 1;
  return `SAC-PRT-${String(num).padStart(3, '0')}`;
}

// ───── GET /api/parts ─────
router.get('/', async (req, res) => {
  try {
    const { category, low_stock, search } = req.query;
    let query = 'SELECT *, (stock_qty <= low_stock_alert) as is_low FROM parts';
    const conditions = [];
    const params = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (low_stock === 'true') {
      conditions.push('stock_qty <= low_stock_alert');
    }
    if (search) {
      conditions.push('(part_name LIKE ? OR part_code LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q);
    }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY part_code ASC';

    const [rows] = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /parts error:', err);
    res.status(500).json({ error: 'Failed to fetch parts' });
  }
});

// ───── POST /api/parts ─────
router.post('/', async (req, res) => {
  try {
    const { part_name, category, unit, buying_price, selling_price, stock_qty, low_stock_alert, hsn_sac } = req.body;
    if (!part_name || !selling_price) {
      return res.status(400).json({ error: 'Part name and selling price required' });
    }
    const part_code = await generatePartCode();
    const [result] = await db.execute(
      `INSERT INTO parts (part_code, part_name, category, unit, buying_price, selling_price, stock_qty, low_stock_alert, hsn_sac)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [part_code, part_name, category || 'General', unit || 'pc', buying_price || 0, selling_price, stock_qty || 0, low_stock_alert || 5, hsn_sac || '8708']
    );

    // Record parts purchase expense in cash ledger if initial stock is specified
    const initialQty = parseFloat(stock_qty || 0);
    const cost = parseFloat(buying_price || 0);
    if (initialQty > 0 && cost > 0) {
      await db.execute(
        `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date)
         VALUES (?, ?, ?, ?, NOW())`,
        ['out', cost * initialQty, 'Spare Parts Purchase', `Initial stock purchase for part: ${part_code} - ${part_name} (x${initialQty})`]
      );
    }

    res.status(201).json({ id: result.insertId, part_code, message: 'Part added' });
  } catch (err) {
    console.error('POST /parts error:', err);
    res.status(500).json({ error: 'Failed to add part' });
  }
});

// ───── GET /api/parts/low-stock-alerts ─────
// Feature 9: Dedicated low-stock alert endpoint for dashboard
router.get('/low-stock-alerts', async (req, res) => {
  try {
    // Try to read threshold from settings, fallback to 5
    let threshold = 5;
    try {
      const [settingRows] = await db.query(
        "SELECT setting_value FROM settings WHERE setting_key = 'low_stock_threshold'"
      );
      if (settingRows.length > 0) threshold = parseInt(settingRows[0].setting_value) || 5;
    } catch (e) { /* settings table may not exist yet */ }

    const [rows] = await db.query(
      `SELECT id, part_code, part_name, category, stock_qty, low_stock_alert, selling_price
       FROM parts WHERE stock_qty <= COALESCE(low_stock_alert, ?)
       ORDER BY stock_qty ASC`,
      [threshold]
    );

    res.json({
      alerts: rows,
      count: rows.length,
      threshold
    });
  } catch (err) {
    console.error('GET /parts/low-stock-alerts error:', err);
    res.status(500).json({ error: 'Failed to fetch low-stock alerts' });
  }
});

// ───── PUT /api/parts/:id ─────
router.put('/:id', async (req, res) => {
  try {
    const allowedFields = ['part_name', 'category', 'unit', 'buying_price', 'selling_price', 'stock_qty', 'low_stock_alert', 'hsn_sac'];
    const updates = [];
    const values = [];
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    await db.execute(`UPDATE parts SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Part updated' });
  } catch (err) {
    console.error('PUT /parts/:id error:', err);
    res.status(500).json({ error: 'Failed to update part' });
  }
});

// ───── PATCH /api/parts/:id/stock ─────
router.patch('/:id/stock', async (req, res) => {
  try {
    const { adjustment } = req.body;
    if (adjustment === undefined || adjustment === 0) {
      return res.status(400).json({ error: 'Adjustment value required' });
    }
    await db.execute(
      'UPDATE parts SET stock_qty = stock_qty + ? WHERE id = ?',
      [parseFloat(adjustment), req.params.id]
    );

    // Record parts purchase expense in cash ledger if restocking (adjustment is positive)
    if (parseFloat(adjustment) > 0) {
      const [partRows] = await db.query('SELECT part_code, part_name, buying_price FROM parts WHERE id = ?', [req.params.id]);
      if (partRows.length > 0) {
        const { part_code, part_name, buying_price } = partRows[0];
        const cost = parseFloat(buying_price || 0);
        if (cost > 0) {
          await db.execute(
            `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date)
             VALUES (?, ?, ?, ?, NOW())`,
            ['out', cost * parseFloat(adjustment), 'Spare Parts Purchase', `Restocked part: ${part_code} - ${part_name} (x${adjustment})`]
          );
        }
      }
    }

    const [rows] = await db.query('SELECT stock_qty FROM parts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Stock adjusted', new_stock: rows[0]?.stock_qty });
  } catch (err) {
    console.error('PATCH /parts/:id/stock error:', err);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

module.exports = router;
