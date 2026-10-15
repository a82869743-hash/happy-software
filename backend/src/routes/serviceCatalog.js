const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ===============================================================
// GET /api/service-catalog — Search & filter service catalog
// ===============================================================
router.get('/', async (req, res) => {
  try {
    const search = req.query.search || req.query.q;
    const { category, item_type, limit = 50 } = req.query;
    
    // Unified query from service_catalog (labour/parts) and parts (inventory with stock)
    let query = `
      SELECT * FROM (
        SELECT 
          id, 
          name AS item_name, 
          category, 
          item_type, 
          default_rate, 
          hsn_sac, 
          tax_pct AS default_tax_pct, 
          NULL AS part_no, 
          NULL AS labour_code,
          NULL AS part_code, 
          NULL AS stock_qty,
          NULL AS unit,
          'catalog' AS source
        FROM service_catalog
        WHERE is_active = 1

        UNION ALL

        SELECT 
          id, 
          part_name AS item_name, 
          category, 
          'part' AS item_type, 
          selling_price AS default_rate, 
          hsn_sac, 
          18 AS default_tax_pct, 
          part_code AS part_no, 
          NULL AS labour_code,
          part_code, 
          stock_qty,
          unit,
          'inventory' AS source
        FROM parts
      ) AS combined
    `;

    const conditions = [];
    const params = [];

    if (category && category !== 'all' && category !== 'all_services') {
      conditions.push('category = ?');
      params.push(category);
    }
    if (item_type && item_type !== 'all') {
      conditions.push('item_type = ?');
      params.push(item_type);
    }
    if (search) {
      conditions.push('(item_name LIKE ? OR part_code LIKE ? OR part_no LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const parsedLimit = (!req.query.limit || req.query.limit === '1000' || req.query.limit === 'all') ? 1000 : (parseInt(req.query.limit) || 500);

    query += ' ORDER BY category, item_name LIMIT ?';
    params.push(parsedLimit);

    const [rows] = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /service-catalog error:', err);
    res.status(500).json({ error: 'Failed to fetch service catalog' });
  }
});

// ===============================================================
// GET /api/service-catalog/categories — Get category list with counts
// ===============================================================
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT category, COUNT(*) as count FROM service_catalog WHERE is_active = 1 GROUP BY category ORDER BY category`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /service-catalog/categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ===============================================================
// POST /api/service-catalog — Add new catalog item
// ===============================================================
router.post('/', async (req, res) => {
  try {
    const { name, category, item_type, default_rate, hsn_sac, tax_pct } = req.body;
    if (!name) return res.status(400).json({ error: 'Service name is required' });

    const [result] = await db.execute(
      `INSERT INTO service_catalog (name, category, item_type, default_rate, hsn_sac, tax_pct)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, category || 'general', item_type || 'labour', default_rate || 0, hsn_sac || null, tax_pct || 18]
    );

    res.status(201).json({ id: result.insertId, message: 'Catalog item added' });
  } catch (err) {
    console.error('POST /service-catalog error:', err);
    res.status(500).json({ error: 'Failed to add catalog item' });
  }
});

// ===============================================================
// GET /api/service-catalog/concern-presets — Preset concern chips
// ===============================================================
router.get('/concern-presets', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, concern_text, category FROM concern_presets WHERE is_active = 1 ORDER BY sort_order, id'
    );
    res.json({ data: rows });
  } catch (err) {
    // Graceful fallback if table doesn't exist yet
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ data: [] });
    }
    console.error('GET /concern-presets error:', err);
    res.status(500).json({ error: 'Failed to fetch concern presets' });
  }
});

// ===============================================================
// PUT /api/service-catalog/:id — Update catalog item
// ===============================================================
router.put('/:id', async (req, res) => {
  try {
    const { name, category, item_type, default_rate, hsn_sac, tax_pct } = req.body;
    if (!name) return res.status(400).json({ error: 'Service name is required' });

    await db.execute(
      `UPDATE service_catalog 
       SET name = ?, category = ?, item_type = ?, default_rate = ?, hsn_sac = ?, tax_pct = ?
       WHERE id = ?`,
      [name, category || 'general', item_type || 'labour', default_rate || 0, hsn_sac || null, tax_pct || 18, req.params.id]
    );

    res.json({ message: 'Catalog item updated' });
  } catch (err) {
    console.error('PUT /service-catalog/:id error:', err);
    res.status(500).json({ error: 'Failed to update catalog item' });
  }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// DELETE /api/service-catalog/:id — Soft delete catalog item (by ID or name)
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.delete('/:id', async (req, res) => {
  try {
    const target = req.params.id;
    if (!isNaN(target)) {
      const [rows] = await db.query('SELECT name FROM service_catalog WHERE id = ?', [target]);
      if (rows.length > 0) {
        await db.execute('UPDATE service_catalog SET is_active = 0 WHERE id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?))', [target, rows[0].name]);
      } else {
        await db.execute('UPDATE service_catalog SET is_active = 0 WHERE id = ?', [target]);
      }
    } else {
      await db.execute('UPDATE service_catalog SET is_active = 0 WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [target]);
    }
    res.json({ message: 'Catalog item deleted successfully' });
  } catch (err) {
    console.error('DELETE /service-catalog/:id error:', err);
    res.status(500).json({ error: 'Failed to delete catalog item' });
  }
});

// ===============================================================
// POST /api/service-catalog/concern-presets — Add concern preset
// ===============================================================
router.post('/concern-presets', async (req, res) => {
  try {
    const { concern_text, category, sort_order } = req.body;
    if (!concern_text) return res.status(400).json({ error: 'Concern text is required' });

    // Check if table exists, create if not
    await db.execute(`
      CREATE TABLE IF NOT EXISTS concern_presets (
        id           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
        concern_text VARCHAR(255)     NOT NULL,
        category     VARCHAR(100)     NOT NULL DEFAULT 'General',
        sort_order   INT UNSIGNED     NOT NULL DEFAULT 0,
        is_active    TINYINT(1)       NOT NULL DEFAULT 1,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [result] = await db.execute(
      `INSERT INTO concern_presets (concern_text, category, sort_order) VALUES (?, ?, ?)`,
      [concern_text, category || 'General', sort_order || 0]
    );

    res.status(201).json({ id: result.insertId, message: 'Concern preset added' });
  } catch (err) {
    console.error('POST /concern-presets error:', err);
    res.status(500).json({ error: 'Failed to add concern preset' });
  }
});

// ===============================================================
// PUT /api/service-catalog/concern-presets/:id — Update concern preset
// ===============================================================
router.put('/concern-presets/:id', async (req, res) => {
  try {
    const { concern_text, category, sort_order } = req.body;
    if (!concern_text) return res.status(400).json({ error: 'Concern text is required' });

    await db.execute(
      `UPDATE concern_presets SET concern_text = ?, category = ?, sort_order = ? WHERE id = ?`,
      [concern_text, category || 'General', sort_order || 0, req.params.id]
    );

    res.json({ message: 'Concern preset updated' });
  } catch (err) {
    console.error('PUT /concern-presets/:id error:', err);
    res.status(500).json({ error: 'Failed to update concern preset' });
  }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// DELETE /api/service-catalog/concern-presets/:id — Soft delete concern preset
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
router.delete('/concern-presets/:id', async (req, res) => {
  try {
    await db.execute('UPDATE concern_presets SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Concern preset deleted' });
  } catch (err) {
    console.error('DELETE /concern-presets/:id error:', err);
    res.status(500).json({ error: 'Failed to delete concern preset' });
  }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// Package Presets Schema Initialization & Seeder
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
const ensurePackageTables = async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS service_packages (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name         VARCHAR(255) NOT NULL UNIQUE,
      category     VARCHAR(100) NOT NULL DEFAULT 'General',
      description  TEXT NULL,
      is_active    TINYINT(1) NOT NULL DEFAULT 1,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS service_package_items (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      package_id  INT UNSIGNED NOT NULL,
      item_name   VARCHAR(255) NOT NULL,
      item_type   ENUM('part', 'labour') NOT NULL DEFAULT 'labour',
      FOREIGN KEY (package_id) REFERENCES service_packages(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [rows] = await db.query('SELECT COUNT(*) as count FROM service_packages');
  if (rows[0].count === 0) {
    console.log('Seeding default GMS service packages...');
    const defaultPackages = [
      {
        name: 'Paid Service (Standard)',
        category: 'Mechanic',
        parts: ['Engine Oil (5W-30)', 'Oil Filter', 'Air Filter'],
        labour: ['Paid Service Labour', '4 Wheel Brake Service']
      },
      {
        name: 'Premium Service',
        category: 'Mechanic',
        parts: ['Synthetic Oil', 'Oil Filter', 'Air Filter', 'Cabin Filter', 'Spark Plug'],
        labour: ['Premium Service Labour', 'Brake Service', 'AC Service', 'Wheel Alignment']
      },
      {
        name: 'Major Service (50,000 km)',
        category: 'Mechanic',
        parts: ['Synthetic Oil', 'Oil Filter', 'Air Filter', 'Cabin Filter', 'Spark Plug', 'Coolant', 'Brake Fluid'],
        labour: ['Major Service Labour', 'Brake Service', 'AC Service', 'Wheel Alignment', 'Coolant Flush']
      },
      {
        name: 'Happy Recommended Detailing',
        category: 'Detailing',
        parts: [],
        labour: ['Interior Detailing & Sanitisation', 'Exterior Rubbing & Polishing']
      },
      {
        name: 'Premium Detailing',
        category: 'Detailing',
        parts: ['Ceramic Coating Kit'],
        labour: ['Interior Detailing', 'Exterior Polishing', 'Ceramic Application', 'Headlight Polish']
      },
      {
        name: 'AC Service Package',
        category: 'Mechanic',
        parts: ['AC Gas (R134a)', 'Cabin Filter'],
        labour: ['AC Service', 'Coil Cleaning', 'Vent Sanitisation']
      }
    ];

    for (const pkg of defaultPackages) {
      const [res] = await db.execute(
        'INSERT INTO service_packages (name, category) VALUES (?, ?)',
        [pkg.name, pkg.category]
      );
      const pkgId = res.insertId;

      for (const part of pkg.parts) {
        await db.execute(
          'INSERT INTO service_package_items (package_id, item_name, item_type) VALUES (?, ?, ?)',
          [pkgId, part, 'part']
        );
      }
      for (const lab of pkg.labour) {
        await db.execute(
          'INSERT INTO service_package_items (package_id, item_name, item_type) VALUES (?, ?, ?)',
          [pkgId, lab, 'labour']
        );
      }
    }
    console.log('✅ Default GMS service packages seeded.');
  }
};

// ===============================================================
// GET /api/service-catalog/packages — Fetch active packages with items
// ===============================================================
router.get('/packages', async (req, res) => {
  try {
    await ensurePackageTables();
    const [packages] = await db.query('SELECT * FROM service_packages WHERE is_active = 1 ORDER BY name');
    const [items] = await db.query('SELECT * FROM service_package_items');

    const data = packages.map(pkg => {
      const pkgItems = items.filter(item => item.package_id === pkg.id);
      return {
        id: pkg.id,
        name: pkg.name,
        category: pkg.category,
        description: pkg.description,
        parts: pkgItems.filter(i => i.item_type === 'part').map(i => i.item_name),
        labour: pkgItems.filter(i => i.item_type === 'labour').map(i => i.item_name)
      };
    });

    res.json({ data });
  } catch (err) {
    console.error('GET /packages error:', err);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// ===============================================================
// POST /api/service-catalog/packages — Create package
// ===============================================================
router.post('/packages', async (req, res) => {
  try {
    await ensurePackageTables();
    const { name, category, description, parts, labour } = req.body;
    if (!name) return res.status(400).json({ error: 'Package name is required' });

    const [result] = await db.execute(
      'INSERT INTO service_packages (name, category, description) VALUES (?, ?, ?)',
      [name, category || 'General', description || '']
    );
    const packageId = result.insertId;

    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (part.trim()) {
          await db.execute(
            'INSERT INTO service_package_items (package_id, item_name, item_type) VALUES (?, ?, ?)',
            [packageId, part.trim(), 'part']
          );
        }
      }
    }

    if (Array.isArray(labour)) {
      for (const lab of labour) {
        if (lab.trim()) {
          await db.execute(
            'INSERT INTO service_package_items (package_id, item_name, item_type) VALUES (?, ?, ?)',
            [packageId, lab.trim(), 'labour']
          );
        }
      }
    }

    res.status(201).json({ id: packageId, message: 'Package added successfully' });
  } catch (err) {
    console.error('POST /packages error:', err);
    res.status(500).json({ error: 'Failed to add package' });
  }
});

// ===============================================================
// PUT /api/service-catalog/packages/:id — Update package
// ===============================================================
router.put('/packages/:id', async (req, res) => {
  try {
    await ensurePackageTables();
    const { name, category, description, parts, labour } = req.body;
    if (!name) return res.status(400).json({ error: 'Package name is required' });

    const packageId = req.params.id;
    await db.execute(
      'UPDATE service_packages SET name = ?, category = ?, description = ? WHERE id = ?',
      [name, category || 'General', description || '', packageId]
    );

    await db.execute('DELETE FROM service_package_items WHERE package_id = ?', [packageId]);

    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (part.trim()) {
          await db.execute(
            'INSERT INTO service_package_items (package_id, item_name, item_type) VALUES (?, ?, ?)',
            [packageId, part.trim(), 'part']
          );
        }
      }
    }

    if (Array.isArray(labour)) {
      for (const lab of labour) {
        if (lab.trim()) {
          await db.execute(
            'INSERT INTO service_package_items (package_id, item_name, item_type) VALUES (?, ?, ?)',
            [packageId, lab.trim(), 'labour']
          );
        }
      }
    }

    res.json({ message: 'Package updated successfully' });
  } catch (err) {
    console.error('PUT /packages/:id error:', err);
    res.status(500).json({ error: 'Failed to update package' });
  }
});

// ===============================================================
// DELETE /api/service-catalog/packages/:id — Soft delete package
// ===============================================================
router.delete('/packages/:id', async (req, res) => {
  try {
    await ensurePackageTables();
    await db.execute('UPDATE service_packages SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Package deleted successfully' });
  } catch (err) {
    console.error('DELETE /packages/:id error:', err);
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

// ===============================================================
// GET /api/service-catalog/recommended-services — Get active recommended presets
// ===============================================================
router.get('/recommended-services', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, category, item_type, period, is_active FROM recommended_services WHERE is_active = 1 ORDER BY category, name'
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /recommended-services error:', err);
    res.status(500).json({ error: 'Failed to fetch recommended services' });
  }
});

// ===============================================================
// POST /api/service-catalog/recommended-services — Add new recommended preset
// ===============================================================
router.post('/recommended-services', async (req, res) => {
  try {
    const { name, category, item_type, period } = req.body;
    if (!name || !category || !period) {
      return res.status(400).json({ error: 'Name, category, and period are required' });
    }

    const [result] = await db.execute(
      'INSERT INTO recommended_services (name, category, item_type, period, is_active) VALUES (?, ?, ?, ?, 1)',
      [name, category, item_type || 'labour', period]
    );

    res.status(201).json({ id: result.insertId, message: 'Recommended service preset created' });
  } catch (err) {
    console.error('POST /recommended-services error:', err);
    res.status(500).json({ error: 'Failed to create recommended service preset' });
  }
});

// ===============================================================
// PUT /api/service-catalog/recommended-services/:id — Update recommended preset
// ===============================================================
router.put('/recommended-services/:id', async (req, res) => {
  try {
    const { name, category, item_type, period, is_active } = req.body;
    if (!name || !category || !period) {
      return res.status(400).json({ error: 'Name, category, and period are required' });
    }

    await db.execute(
      'UPDATE recommended_services SET name = ?, category = ?, item_type = ?, period = ?, is_active = ? WHERE id = ?',
      [name, category, item_type || 'labour', period, is_active !== undefined ? is_active : 1, req.params.id]
    );

    res.json({ message: 'Recommended service preset updated' });
  } catch (err) {
    console.error('PUT /recommended-services/:id error:', err);
    res.status(500).json({ error: 'Failed to update recommended service preset' });
  }
});

// ===============================================================
// DELETE /api/service-catalog/recommended-services/:id — Soft delete recommended preset
// ===============================================================
router.delete('/recommended-services/:id', async (req, res) => {
  try {
    await db.execute('UPDATE recommended_services SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Recommended service preset deleted' });
  } catch (err) {
    console.error('DELETE /recommended-services/:id error:', err);
    res.status(500).json({ error: 'Failed to delete recommended service preset' });
  }
});

// ===============================================================
// GET /api/service-catalog/custom-categories — Get all unique categories (preset + suggestion)
// ===============================================================
router.get('/custom-categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT suggestion_text AS category FROM service_suggestions WHERE suggestion_type = 'category' AND suggestion_text IS NOT NULL AND suggestion_text != ''
       UNION
       SELECT DISTINCT category FROM service_catalog WHERE category IS NOT NULL AND category != ''
       ORDER BY category`
    );
    res.json({ data: rows.map(r => r.category).filter(Boolean) });
  } catch (err) {
    console.error('GET /custom-categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ===============================================================
// POST /api/service-catalog/custom-categories — Persist a custom category
// ===============================================================
router.post('/custom-categories', async (req, res) => {
  try {
    const { category } = req.body;
    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    await db.execute(
      `INSERT INTO service_suggestions (suggestion_text, suggestion_type, usage_count)
       VALUES (?, 'category', 1)
       ON DUPLICATE KEY UPDATE usage_count = usage_count + 1`,
      [category.trim()]
    );
    res.status(201).json({ message: 'Custom category persisted successfully' });
  } catch (err) {
    console.error('POST /custom-categories error:', err);
    res.status(500).json({ error: 'Failed to save custom category' });
  }
});

module.exports = router;

