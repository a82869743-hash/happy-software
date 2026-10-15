/**
 * Attendance Routes — V4 Upgrade
 * Feature 9: Check In/Out Time Tracking + Overtime
 */
const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// Ensure status column on attendance table supports all status strings without ENUM truncation
(async () => {
  try {
    await db.query("ALTER TABLE attendance MODIFY COLUMN status VARCHAR(20) NOT NULL");
  } catch (err) {
    // Column already modified
  }
})();

// ───── Column Helper and Cache ─────
let attendanceColumnsCache = null;
async function getAttendanceColumns() {
  if (attendanceColumnsCache) return attendanceColumnsCache;
  try {
    const [rows] = await db.query('SHOW COLUMNS FROM attendance');
    const cols = rows.map(r => r.Field);
    attendanceColumnsCache = {
      entry_time: cols.includes('entry_time'),
      exit_time: cols.includes('exit_time'),
      check_in_time: cols.includes('check_in_time'),
      check_out_time: cols.includes('check_out_time'),
      overtime_hours: cols.includes('overtime_hours'),
    };
    return attendanceColumnsCache;
  } catch (err) {
    console.error('Error fetching attendance columns:', err);
    return {
      entry_time: false,
      exit_time: false,
      check_in_time: false,
      check_out_time: false,
      overtime_hours: false,
    };
  }
}

// ───── GET /api/attendance?date=YYYY-MM-DD ─────
router.get('/', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const cols = await getAttendanceColumns();

    const selectFields = [
      's.id as staff_id',
      's.full_name as staff_name',
      's.staff_code',
      'a.status',
      'a.id as attendance_id'
    ];

    if (cols.entry_time) selectFields.push("TIME_FORMAT(a.entry_time, '%H:%i') as entry_time");
    if (cols.exit_time) selectFields.push("TIME_FORMAT(a.exit_time, '%H:%i') as exit_time");
    if (cols.check_in_time) selectFields.push("TIME_FORMAT(a.check_in_time, '%H:%i') as check_in_time");
    if (cols.check_out_time) selectFields.push("TIME_FORMAT(a.check_out_time, '%H:%i') as check_out_time");
    if (cols.overtime_hours) selectFields.push('a.overtime_hours');

    const [rows] = await db.query(
      `SELECT ${selectFields.join(', ')}
       FROM staff s
       LEFT JOIN attendance a ON a.staff_id = s.id AND a.attendance_date = ?
       WHERE s.is_active = 1
       ORDER BY s.staff_code ASC`,
      [date]
    );

    const normalizedRecords = rows.map(r => ({
      staff_id: r.staff_id,
      staff_name: r.staff_name,
      staff_code: r.staff_code,
      status: r.status || null,
      attendance_id: r.attendance_id || null,
      entry_time: r.entry_time || null,
      exit_time: r.exit_time || null,
      check_in_time: r.check_in_time || null,
      check_out_time: r.check_out_time || null,
      overtime_hours: r.overtime_hours || 0
    }));

    res.json({ date, records: normalizedRecords });
  } catch (err) {
    console.error('GET /attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// ───── POST /api/attendance/bulk ─────
router.post('/bulk', async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.json({ message: 'No records to save', count: 0 });
    }

    const cols = await getAttendanceColumns();
    let count = 0;

    for (const r of records) {
      if (!r.staff_id || !r.status) continue;

      let normalizedStatus = r.status;
      if (normalizedStatus === 'half' || normalizedStatus === 'half_day') normalizedStatus = 'half-day';

      const insertCols = ['staff_id', 'attendance_date', 'status'];
      const placeholders = ['?', '?', '?'];
      const params = [r.staff_id, date, normalizedStatus];
      const updates = ['status = VALUES(status)', 'updated_at = NOW()'];

      if (cols.entry_time) {
        insertCols.push('entry_time');
        placeholders.push('?');
        params.push(r.entry_time || null);
        updates.push('entry_time = VALUES(entry_time)');
      }
      if (cols.exit_time) {
        insertCols.push('exit_time');
        placeholders.push('?');
        params.push(r.exit_time || null);
        updates.push('exit_time = VALUES(exit_time)');
      }
      if (cols.check_in_time) {
        insertCols.push('check_in_time');
        placeholders.push('?');
        params.push(r.check_in_time || null);
        updates.push('check_in_time = VALUES(check_in_time)');
      }
      if (cols.check_out_time) {
        insertCols.push('check_out_time');
        placeholders.push('?');
        params.push(r.check_out_time || null);
        updates.push('check_out_time = VALUES(check_out_time)');
      }
      if (cols.overtime_hours) {
        insertCols.push('overtime_hours');
        placeholders.push('?');
        params.push(r.overtime_hours || 0);
        updates.push('overtime_hours = VALUES(overtime_hours)');
      }

      const sql = `INSERT INTO attendance (${insertCols.join(', ')})
                   VALUES (${placeholders.join(', ')})
                   ON DUPLICATE KEY UPDATE ${updates.join(', ')}`;

      await db.execute(sql, params);
      count++;
    }

    res.json({ message: 'Attendance saved', count });
  } catch (err) {
    console.error('POST /attendance/bulk error:', err);
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

// ───── POST /api/attendance/check-in ─────
router.post('/check-in', async (req, res) => {
  try {
    const { staff_id } = req.body;
    if (!staff_id) return res.status(400).json({ error: 'Staff ID required' });

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 5);
    const cols = await getAttendanceColumns();

    const insertCols = ['staff_id', 'attendance_date', 'status'];
    const placeholders = ['?', '?', "'present'"];
    const params = [staff_id, today];
    const updates = ["status = 'present'", 'updated_at = NOW()'];

    if (cols.check_in_time) {
      insertCols.push('check_in_time');
      placeholders.push('?');
      params.push(now);
      updates.push('check_in_time = VALUES(check_in_time)');
    }
    if (cols.entry_time) {
      insertCols.push('entry_time');
      placeholders.push('?');
      params.push(now);
      updates.push('entry_time = COALESCE(entry_time, VALUES(entry_time))');
    }

    const sql = `INSERT INTO attendance (${insertCols.join(', ')})
                 VALUES (${placeholders.join(', ')})
                 ON DUPLICATE KEY UPDATE ${updates.join(', ')}`;

    await db.execute(sql, params);

    res.json({ message: `Checked in at ${now}` });
  } catch (err) {
    console.error('POST /attendance/check-in error:', err);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// ───── POST /api/attendance/check-out ─────
router.post('/check-out', async (req, res) => {
  try {
    const { staff_id, overtime_hours } = req.body;
    if (!staff_id) return res.status(400).json({ error: 'Staff ID required' });

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 5);
    const cols = await getAttendanceColumns();

    const updates = ['updated_at = NOW()'];
    const params = [];

    if (cols.check_out_time) {
      updates.push('check_out_time = ?');
      params.push(now);
    }
    if (cols.exit_time) {
      updates.push('exit_time = ?');
      params.push(now);
    }
    if (cols.overtime_hours) {
      updates.push('overtime_hours = ?');
      params.push(overtime_hours || 0);
    }

    params.push(staff_id, today);

    const sql = `UPDATE attendance SET ${updates.join(', ')}
                 WHERE staff_id = ? AND attendance_date = ?`;

    await db.execute(sql, params);

    res.json({ message: `Checked out at ${now}` });
  } catch (err) {
    console.error('POST /attendance/check-out error:', err);
    res.status(500).json({ error: 'Failed to check out' });
  }
});

// ───── GET /api/attendance/summary/:staffId ─────
router.get('/summary/:staffId', async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year query params required' });
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);
    const cols = await getAttendanceColumns();

    const selectFields = ['attendance_date', 'status'];
    if (cols.entry_time) selectFields.push("TIME_FORMAT(entry_time, '%H:%i') as entry_time");
    if (cols.exit_time) selectFields.push("TIME_FORMAT(exit_time, '%H:%i') as exit_time");
    if (cols.check_in_time) selectFields.push("TIME_FORMAT(check_in_time, '%H:%i') as check_in_time");
    if (cols.check_out_time) selectFields.push("TIME_FORMAT(check_out_time, '%H:%i') as check_out_time");
    if (cols.overtime_hours) selectFields.push('overtime_hours');

    const [records] = await db.query(
      `SELECT ${selectFields.join(', ')}
       FROM attendance
       WHERE staff_id = ? AND attendance_date BETWEEN ? AND ?
       ORDER BY attendance_date ASC`,
      [req.params.staffId, startDate, endDate]
    );

    const normalizedRecords = records.map(r => ({
      attendance_date: r.attendance_date,
      status: r.status,
      entry_time: r.entry_time || null,
      exit_time: r.exit_time || null,
      check_in_time: r.check_in_time || null,
      check_out_time: r.check_out_time || null,
      overtime_hours: r.overtime_hours || 0
    }));

    const present = normalizedRecords.filter(r => r.status === 'present').length;
    const absent = normalizedRecords.filter(r => r.status === 'absent').length;
    const half = normalizedRecords.filter(r => r.status === 'half' || r.status === 'half-day' || r.status === 'half_day').length;
    const totalOT = normalizedRecords.reduce((sum, r) => sum + parseFloat(r.overtime_hours || 0), 0);

    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    res.json({
      staff_id: parseInt(req.params.staffId),
      month: `${monthNames[parseInt(month)]} ${year}`,
      present,
      absent,
      half,
      effective_days: present + (half * 0.5),
      total_overtime_hours: totalOT,
      records: normalizedRecords
    });
  } catch (err) {
    console.error('GET /attendance/summary error:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

module.exports = router;
