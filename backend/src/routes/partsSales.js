const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── GET /api/parts-sales ─────
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    let query = `SELECT ps.*, p.part_name, p.part_code
                 FROM parts_sales ps
                 JOIN parts p ON ps.part_id = p.id`;
    const params = [];

    if (date) {
      query += ' WHERE DATE(ps.sale_date) = ?';
      params.push(date);
    }
    query += ' ORDER BY ps.sale_date DESC';

    const [rows] = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /parts-sales error:', err);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// ───── POST /api/parts-sales — ATOMIC STOCK DEDUCTION (Fix 4: Transaction) ─────
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { part_id, quantity, unit_price, customer_name, payment_mode, job_card_id } = req.body;

    if (!part_id || !quantity || quantity <= 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Part and valid quantity required' });
    }
    if (!payment_mode) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Payment mode required' });
    }

    // Lock the row and check stock
    const [partRows] = await conn.query('SELECT id, part_name, stock_qty FROM parts WHERE id = ? FOR UPDATE', [part_id]);
    if (partRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Part not found' });
    }
    if (partRows[0].stock_qty < parseFloat(quantity)) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: `Insufficient stock for ${partRows[0].part_name} (Available: ${partRows[0].stock_qty})` });
    }

    // Deduct stock
    await conn.execute('UPDATE parts SET stock_qty = stock_qty - ? WHERE id = ?', [parseFloat(quantity), part_id]);

    const total_amount = parseFloat(unit_price) * parseFloat(quantity);

    // Record sale
    const [insertResult] = await conn.execute(
      `INSERT INTO parts_sales (part_id, quantity, unit_price, total_amount, customer_name, payment_mode, job_card_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [part_id, parseFloat(quantity), parseFloat(unit_price), total_amount, customer_name || null, payment_mode, job_card_id || null]
    );

    // Record in cash ledger
    await conn.execute(
      `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
       VALUES (?, ?, ?, ?, NOW(), 'Accessories')`,
      ['in', total_amount, 'Spare Parts Sale', `Sold part: ${partRows[0].part_name} x ${quantity} to ${customer_name || 'Walk-in'} (Mode: ${payment_mode})`]
    );

    await conn.commit();
    conn.release();

    res.status(201).json({
      id: insertResult.insertId,
      part_name: partRows[0].part_name,
      remaining_stock: partRows[0].stock_qty - parseFloat(quantity),
      total_amount,
      message: 'Sale recorded'
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('POST /parts-sales error:', err);
    res.status(500).json({ error: 'Failed to record sale' });
  }
});

module.exports = router;
