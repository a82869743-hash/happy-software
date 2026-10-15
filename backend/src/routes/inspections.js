/**
 * After-Service Concerns & Post-Service Inspection Routes
 * Feature 8: After Service Concern Management
 * Feature 15: Post-Service Inspection
 * Feature 17: Concern Checklist
 */
const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ═══════ FEATURE 8: After Service Concerns ═══════

// GET /api/inspections/concerns/:jobCardId
router.get('/concerns/:jobCardId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM after_service_concerns WHERE job_card_id = ? ORDER BY id',
      [req.params.jobCardId]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('GET concerns error:', err);
    res.status(500).json({ error: 'Failed to fetch concerns' });
  }
});

// POST /api/inspections/concerns
router.post('/concerns', async (req, res) => {
  try {
    const { job_card_id, concern_name, resolved_status, remarks } = req.body;
    if (!job_card_id || !concern_name) {
      return res.status(400).json({ error: 'Job card ID and concern name required' });
    }
    const [result] = await db.execute(
      'INSERT INTO after_service_concerns (job_card_id, concern_name, resolved_status, remarks) VALUES (?, ?, ?, ?)',
      [job_card_id, concern_name, resolved_status || 'not_resolved', remarks || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Concern added' });
  } catch (err) {
    console.error('POST concern error:', err);
    res.status(500).json({ error: 'Failed to add concern' });
  }
});

// PATCH /api/inspections/concerns/:id
router.patch('/concerns/:id', async (req, res) => {
  try {
    const { resolved_status, remarks } = req.body;
    const updates = [];
    const values = [];
    if (resolved_status) { updates.push('resolved_status = ?'); values.push(resolved_status); }
    if (remarks !== undefined) { updates.push('remarks = ?'); values.push(remarks); }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    await db.execute(`UPDATE after_service_concerns SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Concern updated' });
  } catch (err) {
    console.error('PATCH concern error:', err);
    res.status(500).json({ error: 'Failed to update concern' });
  }
});

// ═══════ FEATURE 15: Post-Service Inspection ═══════

// GET /api/inspections/checklist/:jobCardId
router.get('/checklist/:jobCardId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM post_service_inspection WHERE job_card_id = ?',
      [req.params.jobCardId]
    );
    res.json(rows[0] || { concern_resolved: 0, vehicle_cleaned: 0, photos_uploaded: 0, quality_check: 0 });
  } catch (err) {
    console.error('GET inspection error:', err);
    res.status(500).json({ error: 'Failed to fetch inspection' });
  }
});

// POST /api/inspections/checklist
router.post('/checklist', async (req, res) => {
  try {
    const { job_card_id, concern_resolved, vehicle_cleaned, photos_uploaded, quality_check, notes } = req.body;
    if (!job_card_id) return res.status(400).json({ error: 'Job card ID required' });

    await db.execute(
      `INSERT INTO post_service_inspection (job_card_id, concern_resolved, vehicle_cleaned, photos_uploaded, quality_check, inspected_by, inspected_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE concern_resolved=VALUES(concern_resolved), vehicle_cleaned=VALUES(vehicle_cleaned),
         photos_uploaded=VALUES(photos_uploaded), quality_check=VALUES(quality_check),
         inspected_by=VALUES(inspected_by), inspected_at=NOW(), notes=VALUES(notes)`,
      [job_card_id, concern_resolved ? 1 : 0, vehicle_cleaned ? 1 : 0, photos_uploaded ? 1 : 0, quality_check ? 1 : 0, req.user.id, notes || null]
    );
    res.json({ message: 'Inspection saved' });
  } catch (err) {
    console.error('POST inspection error:', err);
    res.status(500).json({ error: 'Failed to save inspection' });
  }
});

// GET /api/inspections/can-deliver/:jobCardId
router.get('/can-deliver/:jobCardId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM post_service_inspection WHERE job_card_id = ?', [req.params.jobCardId]);
    if (rows.length === 0) return res.json({ can_deliver: false, reason: 'Inspection not completed' });
    const insp = rows[0];
    const allChecked = insp.concern_resolved && insp.vehicle_cleaned && insp.photos_uploaded && insp.quality_check;
    res.json({ can_deliver: !!allChecked, inspection: insp, reason: allChecked ? null : 'All inspection items must be checked' });
  } catch (err) {
    console.error('GET can-deliver error:', err);
    res.status(500).json({ error: 'Failed to check delivery eligibility' });
  }
});

// ═══════ FEATURE 17: Concern Checklist ═══════

// GET /api/inspections/concern-checklist/:jobCardId
router.get('/concern-checklist/:jobCardId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM job_card_concern_checklist WHERE job_card_id = ? ORDER BY id',
      [req.params.jobCardId]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('GET concern-checklist error:', err);
    res.status(500).json({ error: 'Failed to fetch checklist' });
  }
});

// POST /api/inspections/concern-checklist
router.post('/concern-checklist', async (req, res) => {
  try {
    const { job_card_id, concern_name } = req.body;
    if (!job_card_id || !concern_name) return res.status(400).json({ error: 'Job card ID and concern name required' });
    const [result] = await db.execute(
      'INSERT INTO job_card_concern_checklist (job_card_id, concern_name) VALUES (?, ?)',
      [job_card_id, concern_name]
    );
    res.status(201).json({ id: result.insertId, message: 'Checklist item added' });
  } catch (err) {
    console.error('POST concern-checklist error:', err);
    res.status(500).json({ error: 'Failed to add checklist item' });
  }
});

// PATCH /api/inspections/concern-checklist/:id/toggle
router.patch('/concern-checklist/:id/toggle', async (req, res) => {
  try {
    await db.execute(
      'UPDATE job_card_concern_checklist SET is_checked = NOT is_checked, checked_by = ?, checked_at = NOW() WHERE id = ?',
      [req.user.id, req.params.id]
    );
    res.json({ message: 'Checklist item toggled' });
  } catch (err) {
    console.error('PATCH concern-checklist error:', err);
    res.status(500).json({ error: 'Failed to toggle checklist item' });
  }
});

// POST /api/inspections/concern-checklist/bulk
router.post('/concern-checklist/bulk', async (req, res) => {
  try {
    const { job_card_id, concerns } = req.body;
    if (!job_card_id || !concerns || !Array.isArray(concerns)) {
      return res.status(400).json({ error: 'Job card ID and concerns array required' });
    }
    let count = 0;
    for (const c of concerns) {
      if (c && c.trim()) {
        await db.execute('INSERT INTO job_card_concern_checklist (job_card_id, concern_name) VALUES (?, ?)', [job_card_id, c.trim()]);
        count++;
      }
    }
    res.json({ message: `${count} checklist items added` });
  } catch (err) {
    console.error('POST bulk concern-checklist error:', err);
    res.status(500).json({ error: 'Failed to add checklist items' });
  }
});

module.exports = router;
