const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

async function getRolePermissions(roleName) {
  const defaultPerms = {
    perm_create_job_card: 1,
    perm_delete_invoice: 1,
    perm_view_accounts: 1,
    perm_view_payments: 1,
    perm_edit_estimate: 1,
    perm_inventory: 1,
    perm_customer: 1,
    perm_reports: 1,
    perm_settings: 1
  };
  try {
    const [rows] = await db.execute('SELECT * FROM roles WHERE role_name = ?', [roleName]);
    if (rows.length > 0) {
      return {
        perm_create_job_card: rows[0].perm_create_job_card,
        perm_delete_invoice: rows[0].perm_delete_invoice,
        perm_view_accounts: rows[0].perm_view_accounts,
        perm_view_payments: rows[0].perm_view_payments,
        perm_edit_estimate: rows[0].perm_edit_estimate,
        perm_inventory: rows[0].perm_inventory,
        perm_customer: rows[0].perm_customer,
        perm_reports: rows[0].perm_reports,
        perm_settings: rows[0].perm_settings
      };
    }
  } catch (err) {
    console.warn('Failed to load permissions for role', roleName, err.message);
  }
  return defaultPerms;
}


// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const [rows] = await db.execute(
      'SELECT id, username, full_name, role, password_hash FROM admin_users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role || 'staff' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const perms = await getRolePermissions(user.role || 'staff');

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role || 'staff',
        permissions: perms
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, username, full_name, role FROM admin_users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const perms = await getRolePermissions(rows[0].role || 'staff');
    res.json({
      ...rows[0],
      permissions: perms
    });
  } catch (err) {
    console.error('Auth/me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// User Accounts CRUD routes (Admin Only)
// ═══════════════════════════════════════════════════════════════

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied: Admin role required' });
  }
};

// GET /api/auth/users
router.get('/users', auth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, full_name, role FROM admin_users ORDER BY username'
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /auth/users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/auth/users
router.post('/users', auth, requireAdmin, async (req, res) => {
  try {
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if username already exists
    const [existing] = await db.execute('SELECT id FROM admin_users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO admin_users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [username, passwordHash, full_name, role]
    );

    res.status(201).json({ id: result.insertId, message: 'User account created successfully' });
  } catch (err) {
    console.error('POST /auth/users error:', err);
    res.status(500).json({ error: 'Failed to create user account' });
  }
});

// PUT /api/auth/users/:id
router.put('/users/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { username, password, full_name, role } = req.body;
    if (!username || !full_name || !role) {
      return res.status(400).json({ error: 'Username, full name, and role are required' });
    }

    // Check if username is taken by another user
    const [existing] = await db.execute('SELECT id FROM admin_users WHERE username = ? AND id != ?', [username, req.params.id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    if (password && password.trim()) {
      const passwordHash = await bcrypt.hash(password, 10);
      await db.execute(
        'UPDATE admin_users SET username = ?, password_hash = ?, full_name = ?, role = ? WHERE id = ?',
        [username, passwordHash, full_name, role, req.params.id]
      );
    } else {
      await db.execute(
        'UPDATE admin_users SET username = ?, full_name = ?, role = ? WHERE id = ?',
        [username, full_name, role, req.params.id]
      );
    }

    res.json({ message: 'User account updated successfully' });
  } catch (err) {
    console.error('PUT /auth/users/:id error:', err);
    res.status(500).json({ error: 'Failed to update user account' });
  }
});

// DELETE /api/auth/users/:id
router.delete('/users/:id', auth, requireAdmin, async (req, res) => {
  try {
    // Prevent deleting own account
    if (parseInt(req.params.id) === parseInt(req.user.id)) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    await db.execute('DELETE FROM admin_users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User account deleted successfully' });
  } catch (err) {
    console.error('DELETE /auth/users/:id error:', err);
    res.status(500).json({ error: 'Failed to delete user account' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Roles CRUD routes (Admin Only)
// ═══════════════════════════════════════════════════════════════

// GET /api/auth/roles
router.get('/roles', auth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM roles ORDER BY role_name');
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /auth/roles error:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// POST /api/auth/roles
router.post('/roles', auth, requireAdmin, async (req, res) => {
  try {
    const {
      role_name, perm_create_job_card, perm_delete_invoice, perm_view_accounts,
      perm_view_payments, perm_edit_estimate, perm_inventory, perm_customer,
      perm_reports, perm_settings
    } = req.body;

    if (!role_name) return res.status(400).json({ error: 'Role name is required' });

    const normalizedRole = role_name.toLowerCase().trim();

    // Check duplicate role
    const [existing] = await db.execute('SELECT id FROM roles WHERE role_name = ?', [normalizedRole]);
    if (existing.length > 0) {
      return res.status(400).json({ error: `Role '${role_name}' already exists` });
    }

    const [result] = await db.execute(
      `INSERT INTO roles (role_name, perm_create_job_card, perm_delete_invoice, perm_view_accounts,
                         perm_view_payments, perm_edit_estimate, perm_inventory, perm_customer,
                         perm_reports, perm_settings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalizedRole,
        perm_create_job_card ? 1 : 0,
        perm_delete_invoice ? 1 : 0,
        perm_view_accounts ? 1 : 0,
        perm_view_payments ? 1 : 0,
        perm_edit_estimate ? 1 : 0,
        perm_inventory ? 1 : 0,
        perm_customer ? 1 : 0,
        perm_reports ? 1 : 0,
        perm_settings ? 1 : 0
      ]
    );

    res.status(201).json({ id: result.insertId, message: 'Role created successfully' });
  } catch (err) {
    console.error('POST /auth/roles error:', err);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// PUT /api/auth/roles/:id
router.put('/roles/:id', auth, requireAdmin, async (req, res) => {
  try {
    const {
      role_name, perm_create_job_card, perm_delete_invoice, perm_view_accounts,
      perm_view_payments, perm_edit_estimate, perm_inventory, perm_customer,
      perm_reports, perm_settings
    } = req.body;

    if (!role_name) return res.status(400).json({ error: 'Role name is required' });

    const normalizedRole = role_name.toLowerCase().trim();

    // Check duplicate role (excluding current ID)
    const [existing] = await db.execute('SELECT id FROM roles WHERE role_name = ? AND id != ?', [normalizedRole, req.params.id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: `Role '${role_name}' already exists` });
    }

    await db.execute(
      `UPDATE roles SET role_name = ?, perm_create_job_card = ?, perm_delete_invoice = ?,
                       perm_view_accounts = ?, perm_view_payments = ?, perm_edit_estimate = ?,
                       perm_inventory = ?, perm_customer = ?, perm_reports = ?, perm_settings = ?
       WHERE id = ?`,
      [
        normalizedRole,
        perm_create_job_card ? 1 : 0,
        perm_delete_invoice ? 1 : 0,
        perm_view_accounts ? 1 : 0,
        perm_view_payments ? 1 : 0,
        perm_edit_estimate ? 1 : 0,
        perm_inventory ? 1 : 0,
        perm_customer ? 1 : 0,
        perm_reports ? 1 : 0,
        perm_settings ? 1 : 0,
        req.params.id
      ]
    );

    res.json({ message: 'Role updated successfully' });
  } catch (err) {
    console.error('PUT /auth/roles/:id error:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/auth/roles/:id
router.delete('/roles/:id', auth, requireAdmin, async (req, res) => {
  try {
    const [roleRows] = await db.query('SELECT role_name FROM roles WHERE id = ?', [req.params.id]);
    if (roleRows.length > 0) {
      const name = roleRows[0].role_name;
      if (['admin', 'service_advisor', 'technician'].includes(name)) {
        return res.status(400).json({ error: 'System roles cannot be deleted' });
      }
    }
    await db.execute('DELETE FROM roles WHERE id = ?', [req.params.id]);
    res.json({ message: 'Role deleted successfully' });
  } catch (err) {
    console.error('DELETE /auth/roles/:id error:', err);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

module.exports = router;
