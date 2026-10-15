const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// Helper to map staff roles to admin roles
function mapStaffRoleToAdminRole(staffRole) {
  if (!staffRole) return 'staff';
  const sr = staffRole.toLowerCase();
  if (sr === 'admin') return 'admin';
  if (sr.includes('advisor')) return 'service_advisor';
  if (sr.includes('tech') || sr.includes('mechanic') || sr.includes('electrician') || sr.includes('painter')) return 'technician';
  return 'staff';
}

// ───── Staff Code Generator ─────
async function generateStaffCode() {
  const [rows] = await db.query('SELECT staff_code FROM staff ORDER BY id DESC LIMIT 1');
  if (rows.length === 0) return 'SAC-STF-001';
  const last = rows[0].staff_code; // e.g. SAC-STF-004
  const num = parseInt(last.split('-')[2]) + 1;
  return `SAC-STF-${String(num).padStart(3, '0')}`;
}

// ───── GET /api/staff ─────
router.get('/', async (req, res) => {
  try {
    const { is_active } = req.query;
    let query = `
      SELECT s.*, au.username as login_username
      FROM staff s
      LEFT JOIN admin_users au ON s.admin_user_id = au.id
    `;
    const params = [];
    if (is_active !== undefined) {
      query += ' WHERE s.is_active = ?';
      params.push(parseInt(is_active));
    }
    query += ' ORDER BY s.staff_code ASC';
    const [rows] = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /staff error:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// ───── POST /api/staff ─────
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { full_name, role, mobile_no, date_of_joining, monthly_salary, username, password } = req.body;
    if (!full_name || !role || !monthly_salary) {
      await conn.rollback();
      return res.status(400).json({ error: 'Full name, role, and monthly salary are required' });
    }

    let admin_user_id = null;
    if (username) {
      if (!password) {
        await conn.rollback();
        return res.status(400).json({ error: 'Password is required to create a login account' });
      }
      // Check duplicate username
      const [existing] = await conn.execute('SELECT id FROM admin_users WHERE username = ?', [username]);
      if (existing.length > 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Username already taken' });
      }
      
      const password_hash = await bcrypt.hash(password, 10);
      const mappedRole = mapStaffRoleToAdminRole(role);
      const [userResult] = await conn.execute(
        'INSERT INTO admin_users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        [username, password_hash, full_name, mappedRole]
      );
      admin_user_id = userResult.insertId;
    }

    const staff_code = await generateStaffCode();
    const [result] = await conn.execute(
      `INSERT INTO staff (staff_code, full_name, role, mobile_no, date_of_joining, monthly_salary, admin_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [staff_code, full_name, role, mobile_no || null, date_of_joining || null, parseFloat(monthly_salary), admin_user_id]
    );

    await conn.commit();
    res.status(201).json({ id: result.insertId, staff_code, message: 'Staff member added' });
  } catch (err) {
    await conn.rollback();
    console.error('POST /staff error:', err);
    res.status(500).json({ error: 'Failed to add staff: ' + err.message });
  } finally {
    conn.release();
  }
});

// ───── PUT /api/staff/:id ─────
router.put('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch existing staff details
    const [staffRows] = await conn.query('SELECT * FROM staff WHERE id = ?', [req.params.id]);
    if (staffRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Staff member not found' });
    }
    const currentStaff = staffRows[0];

    const { full_name, role, mobile_no, date_of_joining, monthly_salary, is_active, username, password, disable_login } = req.body;

    let admin_user_id = currentStaff.admin_user_id;

    if (disable_login) {
      // Disabling/deleting login
      if (admin_user_id) {
        await conn.execute('DELETE FROM admin_users WHERE id = ?', [admin_user_id]);
        admin_user_id = null;
      }
    } else if (username) {
      // Check if user already exists
      if (admin_user_id) {
        // Edit existing admin user
        const [existing] = await conn.execute('SELECT id FROM admin_users WHERE username = ? AND id != ?', [username, admin_user_id]);
        if (existing.length > 0) {
          await conn.rollback();
          return res.status(400).json({ error: 'Username already taken' });
        }

        const mappedRole = mapStaffRoleToAdminRole(role || currentStaff.role);
        if (password) {
          const password_hash = await bcrypt.hash(password, 10);
          await conn.execute(
            'UPDATE admin_users SET username = ?, password_hash = ?, full_name = ?, role = ? WHERE id = ?',
            [username, password_hash, full_name || currentStaff.full_name, mappedRole, admin_user_id]
          );
        } else {
          await conn.execute(
            'UPDATE admin_users SET username = ?, full_name = ?, role = ? WHERE id = ?',
            [username, full_name || currentStaff.full_name, mappedRole, admin_user_id]
          );
        }
      } else {
        // Create new admin user
        const [existing] = await conn.execute('SELECT id FROM admin_users WHERE username = ?', [username]);
        if (existing.length > 0) {
          await conn.rollback();
          return res.status(400).json({ error: 'Username already taken' });
        }
        if (!password) {
          await conn.rollback();
          return res.status(400).json({ error: 'Password is required to create a login account' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const mappedRole = mapStaffRoleToAdminRole(role || currentStaff.role);
        const [userResult] = await conn.execute(
          'INSERT INTO admin_users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
          [username, password_hash, full_name || currentStaff.full_name, mappedRole]
        );
        admin_user_id = userResult.insertId;
      }
    }

    // Update staff record
    const allowedFields = ['full_name', 'role', 'mobile_no', 'date_of_joining', 'monthly_salary', 'is_active'];
    const updates = [];
    const values = [];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    // Include the updated admin_user_id (which could be new, unchanged, or null)
    updates.push('admin_user_id = ?');
    values.push(admin_user_id);

    values.push(req.params.id);
    await conn.execute(`UPDATE staff SET ${updates.join(', ')} WHERE id = ?`, values);

    await conn.commit();
    res.json({ message: 'Staff updated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /staff/:id error:', err);
    res.status(500).json({ error: 'Failed to update staff: ' + err.message });
  } finally {
    conn.release();
  }
});

// ───── PATCH /api/staff/:id/toggle ─────
router.patch('/:id/toggle', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT is_active FROM staff WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Staff not found' });
    const newStatus = rows[0].is_active === 1 ? 0 : 1;
    await db.execute('UPDATE staff SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
    res.json({ message: `Staff ${newStatus ? 'activated' : 'deactivated'}`, is_active: newStatus });
  } catch (err) {
    console.error('PATCH /staff/:id/toggle error:', err);
    res.status(500).json({ error: 'Failed to toggle staff status' });
  }
});

// ───── DELETE /api/staff/:id — Permanently Delete Staff ─────
router.delete('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [staffRows] = await conn.query('SELECT admin_user_id, full_name FROM staff WHERE id = ?', [req.params.id]);
    if (staffRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const adminUserId = staffRows[0].admin_user_id;
    const staffName = staffRows[0].full_name;
    const staffId = req.params.id;

    // 1. Delete associated salary & payment records
    await conn.execute('DELETE FROM staff_payments WHERE staff_id = ?', [staffId]);

    // 2. Delete associated daily attendance records
    await conn.execute('DELETE FROM attendance WHERE staff_id = ?', [staffId]);

    // 3. Delete associated staff ledger entries
    await conn.execute('DELETE FROM staff_ledger WHERE staff_id = ? OR LOWER(staff_name) = LOWER(?)', [staffId, staffName]);

    // 4. Unassign from any job cards
    await conn.execute('UPDATE job_cards SET assigned_staff_id = NULL WHERE assigned_staff_id = ?', [staffId]);

    // 5. Delete staff record
    await conn.execute('DELETE FROM staff WHERE id = ?', [staffId]);

    // 6. If linked login user exists, delete login user account too
    if (adminUserId) {
      await conn.execute('DELETE FROM admin_users WHERE id = ?', [adminUserId]);
    }

    await conn.commit();
    res.json({ message: 'Staff member permanently deleted' });
  } catch (err) {
    await conn.rollback();
    console.error('DELETE /staff/:id error:', err);
    res.status(500).json({ error: 'Failed to delete staff: ' + err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
