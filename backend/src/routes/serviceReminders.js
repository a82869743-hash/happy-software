const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');
const { sendWhatsAppMessage, buildReminderMessage, isWaConfigured } = require('../utils/whatsapp');

const r = express.Router();
r.use(auth);

// ═══════════════════════════════════════════════════════════════
// GET /  — List all reminders with optional filters
// ═══════════════════════════════════════════════════════════════
r.get('/', async (req, res) => {
  try {
    const { status, search, date, page = 1, limit = 50 } = req.query;
    let where = '1=1';
    const params = [];

    if (status === 'overdue') {
      where += ' AND sr.is_done = 0 AND sr.reminder_date < CURDATE()';
    } else if (status === 'due_soon') {
      where += ' AND sr.is_done = 0 AND sr.reminder_date >= CURDATE() AND sr.reminder_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)';
    } else if (status === 'upcoming') {
      where += ' AND sr.is_done = 0 AND sr.reminder_date > DATE_ADD(CURDATE(), INTERVAL 7 DAY)';
    } else if (status === 'done') {
      where += ' AND sr.is_done = 1';
    } else {
      // 'all' — no filter
    }

    if (search) {
      where += ' AND (sr.vehicle_reg_no LIKE ? OR sr.customer_name LIKE ? OR sr.job_no LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    if (date) {
      where += ' AND sr.reminder_date = ?';
      params.push(date);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(
      `SELECT sr.* FROM service_reminders sr
       WHERE ${where}
       ORDER BY sr.is_done ASC, sr.reminder_date ASC
       LIMIT ? OFFSET ?`,
      params
    );

    // Get total count
    const countParams = params.slice(0, -2); // remove limit/offset
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM service_reminders sr WHERE ${where}`,
      countParams
    );

    res.json({ data: rows, total: countRows[0].total });
  } catch (err) {
    console.error('GET /service-reminders error:', err);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /stats  — Dashboard summary stats
// ═══════════════════════════════════════════════════════════════
r.get('/stats', async (req, res) => {
  try {
    const [[overdue]] = await db.query(
      'SELECT COUNT(*) as count FROM service_reminders WHERE is_done = 0 AND reminder_date < CURDATE()'
    );
    const [[dueThisWeek]] = await db.query(
      'SELECT COUNT(*) as count FROM service_reminders WHERE is_done = 0 AND reminder_date >= CURDATE() AND reminder_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)'
    );
    const [[upcoming30]] = await db.query(
      'SELECT COUNT(*) as count FROM service_reminders WHERE is_done = 0 AND reminder_date >= CURDATE() AND reminder_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)'
    );
    const [[wpSent]] = await db.query(
      'SELECT COUNT(*) as count FROM service_reminders WHERE wp_sent_at IS NOT NULL'
    );

    res.json({
      overdue: overdue.count,
      due_this_week: dueThisWeek.count,
      upcoming_30: upcoming30.count,
      wp_sent: wpSent.count
    });
  } catch (err) {
    console.error('GET /service-reminders/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /:id  — Get single reminder
// ═══════════════════════════════════════════════════════════════
r.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM service_reminders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /service-reminders/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch reminder' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /  — Create a new reminder
// ═══════════════════════════════════════════════════════════════
r.post('/', async (req, res) => {
  try {
    const {
      job_card_id, vehicle_reg_no, job_no,
      customer_name, customer_mobile,
      reminder_type, reminder_date, notes,
      km_at_next, notify_via
    } = req.body;

    if (!job_card_id || !vehicle_reg_no || !customer_name || !reminder_date) {
      return res.status(400).json({ error: 'job_card_id, vehicle_reg_no, customer_name, and reminder_date are required' });
    }

    const [result] = await db.execute(
      `INSERT INTO service_reminders
        (job_card_id, vehicle_reg_no, job_no, customer_name, customer_mobile,
         reminder_type, reminder_date, notes, km_at_next, notify_via)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job_card_id,
        vehicle_reg_no,
        job_no || null,
        customer_name,
        customer_mobile || null,
        reminder_type || null,
        reminder_date,
        notes || null,
        km_at_next || null,
        notify_via || 'whatsapp'
      ]
    );

    res.status(201).json({ id: result.insertId, message: 'Reminder created' });
  } catch (err) {
    console.error('POST /service-reminders error:', err);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /:id  — Update a reminder
// ═══════════════════════════════════════════════════════════════
r.put('/:id', async (req, res) => {
  try {
    const {
      reminder_type, reminder_date, notes,
      km_at_next, notify_via
    } = req.body;

    await db.execute(
      `UPDATE service_reminders SET
        reminder_type = ?, reminder_date = ?, notes = ?,
        km_at_next = ?, notify_via = ?
       WHERE id = ?`,
      [
        reminder_type || null,
        reminder_date,
        notes || null,
        km_at_next || null,
        notify_via || 'whatsapp',
        req.params.id
      ]
    );

    res.json({ message: 'Reminder updated' });
  } catch (err) {
    console.error('PUT /service-reminders/:id error:', err);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /:id/done  — Toggle done status
// ═══════════════════════════════════════════════════════════════
r.patch('/:id/done', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT is_done FROM service_reminders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const newDone = rows[0].is_done ? 0 : 1;
    await db.execute('UPDATE service_reminders SET is_done = ? WHERE id = ?', [newDone, req.params.id]);

    res.json({ is_done: newDone, message: newDone ? 'Marked as done' : 'Marked as pending' });
  } catch (err) {
    console.error('PATCH /service-reminders/:id/done error:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /:id/toggle-wp  — Toggle WhatsApp sent
// ═══════════════════════════════════════════════════════════════
r.patch('/:id/toggle-wp', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT wp_sent_at FROM service_reminders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const newVal = rows[0].wp_sent_at ? null : new Date();
    await db.execute('UPDATE service_reminders SET wp_sent_at = ? WHERE id = ?', [newVal, req.params.id]);

    res.json({ wp_sent_at: newVal, message: newVal ? 'WhatsApp marked as sent' : 'WhatsApp unmarked' });
  } catch (err) {
    console.error('PATCH /service-reminders/:id/toggle-wp error:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /:id  — Delete a reminder
// ═══════════════════════════════════════════════════════════════
r.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM service_reminders WHERE id = ?', [req.params.id]);
    res.json({ message: 'Reminder deleted' });
  } catch (err) {
    console.error('DELETE /service-reminders/:id error:', err);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /wa-status  — Check if WhatsApp API is configured
// ═══════════════════════════════════════════════════════════════
r.get('/wa-status', async (req, res) => {
  res.json({ configured: isWaConfigured() });
});

// ═══════════════════════════════════════════════════════════════
// POST /:id/send-whatsapp  — Send WhatsApp message automatically
// ═══════════════════════════════════════════════════════════════
r.post('/:id/send-whatsapp', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM service_reminders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });

    const reminder = rows[0];
    if (!reminder.customer_mobile) {
      return res.status(400).json({ error: 'No mobile number for this customer' });
    }

    // Build the message
    const message = buildReminderMessage(reminder);

    // Send via WhatsApp Cloud API
    const result = await sendWhatsAppMessage(reminder.customer_mobile, message);

    if (result.success) {
      // Mark as WP sent
      await db.execute('UPDATE service_reminders SET wp_sent_at = NOW() WHERE id = ?', [req.params.id]);
      res.json({
        success: true,
        message: 'WhatsApp message sent successfully!',
        messageId: result.messageId
      });
    } else {
      // API failed — return fallback URL so frontend can open wa.me
      res.json({
        success: false,
        error: result.error,
        fallbackUrl: result.fallbackUrl
      });
    }
  } catch (err) {
    console.error('POST /service-reminders/:id/send-whatsapp error:', err);
    res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
});

module.exports = r;
