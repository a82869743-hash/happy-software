/**
 * Service Bookings Routes
 * Feature 10: Service Booking & Advance Module
 * Feature 11: Automatic Booking WhatsApp
 */
const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');
const { sendWhatsApp } = require('../utils/msg91');

const router = express.Router();
router.use(auth);

// ───── Generate Booking Number ─────
async function generateBookingNo() {
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = today.replace(/-/g, '');
  const [rows] = await db.query(
    'SELECT COUNT(*) as cnt FROM service_bookings WHERE DATE(created_at) = ?',
    [today]
  );
  return `BKG-${dateStr.slice(2)}-${String(rows[0].cnt + 1).padStart(3, '0')}`;
}

// ───── GET /api/service-bookings ─────
router.get('/', async (req, res) => {
  try {
    const { date, status, from, to, search } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (date) {
      where += ' AND sb.booking_date = ?';
      params.push(date);
    }
    if (status && status !== 'all') {
      where += ' AND sb.booking_status = ?';
      params.push(status);
    }
    if (from) {
      where += ' AND sb.booking_date >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND sb.booking_date <= ?';
      params.push(to);
    }
    if (search) {
      where += ' AND (sb.customer_name LIKE ? OR sb.mobile_no LIKE ? OR sb.car_number LIKE ? OR sb.booking_no LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }

    const [rows] = await db.query(
      `SELECT sb.*, au.full_name as created_by_name
       FROM service_bookings sb
       LEFT JOIN admin_users au ON sb.created_by = au.id
       ${where}
       ORDER BY sb.booking_date ASC, sb.booking_time ASC`,
      params
    );

    res.json({ data: rows });
  } catch (err) {
    console.error('GET /service-bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ───── GET /api/service-bookings/calendar ─────
router.get('/calendar', async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const [rows] = await db.query(
      `SELECT booking_date, COUNT(*) as count,
              GROUP_CONCAT(CONCAT(customer_name, ' - ', COALESCE(car_number, 'N/A')) SEPARATOR '||') as bookings
       FROM service_bookings
       WHERE MONTH(booking_date) = ? AND YEAR(booking_date) = ?
         AND booking_status NOT IN ('cancelled')
       GROUP BY booking_date
       ORDER BY booking_date`,
      [m, y]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error('GET /service-bookings/calendar error:', err);
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
});

// ───── GET /api/service-bookings/:id ─────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT sb.*, au.full_name as created_by_name
       FROM service_bookings sb
       LEFT JOIN admin_users au ON sb.created_by = au.id
       WHERE sb.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /service-bookings/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// ───── POST /api/service-bookings ─────
router.post('/', async (req, res) => {
  try {
    const {
      customer_name, mobile_no, car_number, car_name,
      booking_date, booking_time, concerns,
      advance_amount, advance_mode, notes
    } = req.body;

    const finalCustomerName = (customer_name && customer_name.trim()) || 'Customer';

    if (!mobile_no || !booking_date) {
      return res.status(400).json({ error: 'Mobile and booking date are required' });
    }

    const booking_no = await generateBookingNo();

    const [result] = await db.execute(
      `INSERT INTO service_bookings 
        (booking_no, customer_name, mobile_no, car_number, car_name,
         booking_date, booking_time, concerns, advance_amount, advance_mode, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        booking_no, finalCustomerName, mobile_no,
        car_number || null, car_name || null,
        booking_date, booking_time || null,
        concerns || null,
        advance_amount || 0, advance_mode || null,
        notes || null, req.user.id
      ]
    );

    // Feature 11: Send WhatsApp confirmation
    try {
      const formattedDate = new Date(booking_date).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      
      await sendWhatsApp({
        to: mobile_no,
        templateName: process.env.MSG91_BOOKING_TEMPLATE || 'booking_confirmation',
        params: [
          { type: 'text', text: customer_name },
          { type: 'text', text: car_number || 'N/A' },
          { type: 'text', text: formattedDate },
          { type: 'text', text: booking_time || 'As per schedule' },
          { type: 'text', text: booking_no }
        ],
        jobCardId: null,
        userId: req.user.id
      });
    } catch (whatsappErr) {
      console.warn('Booking WhatsApp notification failed:', whatsappErr.message);
    }

    res.status(201).json({ id: result.insertId, booking_no, message: 'Booking created' });
  } catch (err) {
    console.error('POST /service-bookings error:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// ───── PATCH /api/service-bookings/:id/status ─────
router.patch('/:id/status', async (req, res) => {
  try {
    const { booking_status } = req.body;
    const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(booking_status)) {
      return res.status(400).json({ error: 'Invalid booking status' });
    }

    await db.execute(
      'UPDATE service_bookings SET booking_status = ? WHERE id = ?',
      [booking_status, req.params.id]
    );

    res.json({ message: `Booking status updated to ${booking_status}` });
  } catch (err) {
    console.error('PATCH /service-bookings/:id/status error:', err);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// ───── PUT /api/service-bookings/:id ─────
router.put('/:id', async (req, res) => {
  try {
    const {
      customer_name, mobile_no, car_number, car_name,
      booking_date, booking_time, concerns,
      advance_amount, advance_mode, notes
    } = req.body;

    const updates = [];
    const values = [];

    if (customer_name !== undefined) { updates.push('customer_name = ?'); values.push(customer_name); }
    if (mobile_no !== undefined) { updates.push('mobile_no = ?'); values.push(mobile_no); }
    if (car_number !== undefined) { updates.push('car_number = ?'); values.push(car_number); }
    if (car_name !== undefined) { updates.push('car_name = ?'); values.push(car_name); }
    if (booking_date !== undefined) { updates.push('booking_date = ?'); values.push(booking_date); }
    if (booking_time !== undefined) { updates.push('booking_time = ?'); values.push(booking_time); }
    if (concerns !== undefined) { updates.push('concerns = ?'); values.push(concerns); }
    if (advance_amount !== undefined) { updates.push('advance_amount = ?'); values.push(advance_amount); }
    if (advance_mode !== undefined) { updates.push('advance_mode = ?'); values.push(advance_mode); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(req.params.id);
    await db.execute(`UPDATE service_bookings SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ message: 'Booking updated' });
  } catch (err) {
    console.error('PUT /service-bookings/:id error:', err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

module.exports = router;
