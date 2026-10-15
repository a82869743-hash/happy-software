const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Allowed suggestion types
const ALLOWED_SUGGESTION_TYPES = new Set([
  'client_name',
  'customer_name',
  'owner_name',
  'mobile_no',
  'alt_mobile',
  'reg_no',
  'vehicle_no',
  'car_name',
  'email',
  'address_line',
  'customer_address',
  'colony_street',
  'city',
  'state',
  'pincode',
  'company_name',
  'company',
  'gstin',
  'service_name',
  'product_name',
  'part_name',
  'category',
  'remarks',
  'notes',
  'insurance_company',
  'odometer'
]);

// Map aliases to standard suggestion_type
function canonicalType(rawType) {
  if (!rawType) return '';
  const t = String(rawType).toLowerCase().trim();
  if (t === 'customer_name' || t === 'owner_name') return 'client_name';
  if (t === 'vehicle_no') return 'reg_no';
  if (t === 'company') return 'company_name';
  if (t === 'customer_address') return 'address_line';
  if (t === 'notes') return 'remarks';
  if (t === 'part_name') return 'product_name';
  return t;
}

// Normalization function based on type
function normalizeSuggestion(type, rawText) {
  if (!rawText) return null;
  let text = String(rawText).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (
    !text ||
    text === '-' ||
    text === '—' ||
    text.toLowerCase() === 'null' ||
    text.toLowerCase() === 'undefined' ||
    text.toLowerCase() === 'na' ||
    text.toLowerCase() === 'n/a'
  ) {
    return null;
  }

  const cType = canonicalType(type);

  if (cType === 'reg_no') {
    text = text.toUpperCase().replace(/[\s\-_]/g, '');
    if (text.length < 4 || text.length > 15) return null;
    return text;
  }

  if (cType === 'mobile_no' || cType === 'alt_mobile') {
    const digits = text.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      text = digits.slice(2);
    } else if (digits.length === 10) {
      text = digits;
    } else {
      return null;
    }
    return text;
  }

  if (cType === 'email') {
    text = text.toLowerCase();
    if (!text.includes('@') || !text.includes('.')) return null;
    return text;
  }

  if (cType === 'pincode') {
    const digits = text.replace(/\D/g, '');
    if (digits.length === 6) return digits;
    return null;
  }

  if (cType === 'gstin') {
    text = text.toUpperCase().replace(/[\s\-]/g, '');
    if (text.length !== 15) return null;
    return text;
  }

  if (text.length < 1) return null;
  return text;
}

// ───── GET /api/suggestions ─────
// Query parameters: type (required), q (optional, 1+ char), limit (optional, max 25)
// Ranking: prefix match first (0), contains match second (1), then usage_count DESC, then alphabet
router.get('/', async (req, res) => {
  try {
    const { type, q, limit } = req.query;
    if (!type) {
      return res.status(400).json({ error: 'Suggestion type is required' });
    }

    const cType = canonicalType(type);
    if (!ALLOWED_SUGGESTION_TYPES.has(type) && !ALLOWED_SUGGESTION_TYPES.has(cType)) {
      return res.status(400).json({ error: `Invalid suggestion type: ${type}` });
    }

    const limitNum = Math.min(Math.max(parseInt(String(limit || 10), 10) || 10, 1), 25);
    const searchStr = q ? String(q).trim() : '';

    let rows = [];
    if (searchStr.length > 0) {
      // Clean search prefix for reg_no or mobile if applicable
      let formattedSearch = searchStr;
      if (cType === 'reg_no') {
        formattedSearch = searchStr.toUpperCase().replace(/[\s\-_]/g, '');
      }

      const [queryResult] = await db.query(
        `SELECT suggestion_text, usage_count
         FROM global_suggestions
         WHERE (suggestion_type = ? OR suggestion_type = ?)
           AND suggestion_text LIKE ?
         ORDER BY
           CASE WHEN suggestion_text LIKE ? THEN 0 ELSE 1 END,
           usage_count DESC,
           suggestion_text ASC
         LIMIT ?`,
        [cType, type, `%${formattedSearch}%`, `${formattedSearch}%`, limitNum]
      );
      rows = queryResult;
    } else {
      const [queryResult] = await db.query(
        `SELECT suggestion_text, usage_count
         FROM global_suggestions
         WHERE suggestion_type = ? OR suggestion_type = ?
         ORDER BY usage_count DESC, suggestion_text ASC
         LIMIT ?`,
        [cType, type, limitNum]
      );
      rows = queryResult;
    }

    res.json({
      success: true,
      data: rows.map(r => r.suggestion_text)
    });
  } catch (err) {
    console.error('GET /api/suggestions error:', err);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// ───── POST /api/suggestions/record ─────
// Records single { type, text } or batch { items: [{ type, text }, ...] }
router.post('/record', async (req, res) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items)
      ? body.items
      : body.type && body.text !== undefined
      ? [{ type: body.type, text: body.text }]
      : [];

    if (items.length === 0) {
      return res.status(400).json({ error: 'Suggestion type and text are required' });
    }

    let recordedCount = 0;
    for (const item of items) {
      const { type, text } = item;
      if (!type || !text) continue;

      const cType = canonicalType(type);
      if (!ALLOWED_SUGGESTION_TYPES.has(type) && !ALLOWED_SUGGESTION_TYPES.has(cType)) {
        continue;
      }

      const cleanText = normalizeSuggestion(cType, text);
      if (!cleanText) continue;

      await db.execute(
        `INSERT INTO global_suggestions (suggestion_type, suggestion_text, usage_count)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE usage_count = usage_count + 1`,
        [cType, cleanText]
      );
      recordedCount++;
    }

    res.json({ success: true, recorded: recordedCount });
  } catch (err) {
    console.error('POST /api/suggestions/record error:', err);
    res.status(500).json({ error: 'Failed to record suggestion' });
  }
});

// ───── GET /api/suggestions/linked ─────
// Linked autofill helper: fetches associated details when a reg_no or mobile_no is picked
router.get('/linked', async (req, res) => {
  try {
    const { type, value } = req.query;
    if (!type || !value) {
      return res.status(400).json({ error: 'Type and value are required' });
    }

    const cType = canonicalType(type);

    if (cType === 'reg_no') {
      const reg = String(value).toUpperCase().replace(/[\s\-_]/g, '');

      // 1. Try vehicle + customer
      const [vRows] = await db.query(
        `SELECT v.*,
                c.customer_name, c.mobile_no as customer_mobile, c.alt_mobile,
                c.email, c.company_name, c.gstin, c.address_line, c.colony_street,
                c.city, c.state, c.pincode
         FROM vehicles v
         LEFT JOIN customers c ON v.customer_id = c.id
         WHERE REPLACE(REPLACE(REPLACE(UPPER(v.reg_no), ' ', ''), '-', ''), '_', '') = ?
         LIMIT 1`,
        [reg]
      );

      if (vRows.length > 0) {
        const v = vRows[0];
        let carName = '';
        if (v.make && v.model) carName = `${v.make} ${v.model}`.trim();
        else if (v.model) carName = v.model;

        // If carName is missing, check latest job_card
        if (!carName) {
          const [jc] = await db.query(
            `SELECT car_name FROM job_cards WHERE REPLACE(REPLACE(REPLACE(UPPER(reg_no), ' ', ''), '-', ''), '_', '') = ? ORDER BY id DESC LIMIT 1`,
            [reg]
          );
          if (jc.length > 0) carName = jc[0].car_name;
        }

        return res.json({
          found: true,
          data: {
            reg_no: v.reg_no || reg,
            car_name: carName,
            client_name: v.customer_name || '',
            mobile_no: v.customer_mobile || '',
            alt_mobile: v.alt_mobile || '',
            email: v.email || '',
            address_line: v.address_line || '',
            colony_street: v.colony_street || '',
            city: v.city || '',
            state: v.state || '',
            pincode: v.pincode || '',
            company_name: v.company_name || '',
            gstin: v.gstin || ''
          }
        });
      }

      // 2. Try latest job_cards
      const [jcRows] = await db.query(
        `SELECT jc.reg_no, jc.car_name, jc.owner_name, jc.mobile_no, jc.corporate_name,
                c.email, c.address_line, c.colony_street, c.city, c.state, c.pincode, c.gstin
         FROM job_cards jc
         LEFT JOIN customers c ON jc.customer_id = c.id
         WHERE REPLACE(REPLACE(REPLACE(UPPER(jc.reg_no), ' ', ''), '-', ''), '_', '') = ?
         ORDER BY jc.id DESC LIMIT 1`,
        [reg]
      );

      if (jcRows.length > 0) {
        const j = jcRows[0];
        return res.json({
          found: true,
          data: {
            reg_no: j.reg_no || reg,
            car_name: j.car_name || '',
            client_name: j.owner_name || '',
            mobile_no: j.mobile_no || '',
            company_name: j.corporate_name || '',
            email: j.email || '',
            address_line: j.address_line || '',
            colony_street: j.colony_street || '',
            city: j.city || '',
            state: j.state || '',
            pincode: j.pincode || '',
            gstin: j.gstin || ''
          }
        });
      }

      // 3. Try product_sales
      const [psRows] = await db.query(
        `SELECT vehicle_no, car_name, customer_name, customer_mobile, customer_address, company
         FROM product_sales
         WHERE REPLACE(REPLACE(REPLACE(UPPER(vehicle_no), ' ', ''), '-', ''), '_', '') = ?
         ORDER BY id DESC LIMIT 1`,
        [reg]
      );

      if (psRows.length > 0) {
        const p = psRows[0];
        return res.json({
          found: true,
          data: {
            reg_no: p.vehicle_no || reg,
            car_name: p.car_name || '',
            client_name: p.customer_name || '',
            mobile_no: p.customer_mobile || '',
            address_line: p.customer_address || '',
            company_name: p.company || ''
          }
        });
      }

      return res.json({ found: false });
    }

    if (cType === 'mobile_no') {
      const mob = String(value).replace(/\D/g, '').slice(-10);
      if (mob.length !== 10) return res.json({ found: false });

      // 1. Try customer
      const [cRows] = await db.query(
        `SELECT c.*, v.reg_no, v.make, v.model
         FROM customers c
         LEFT JOIN vehicles v ON v.customer_id = c.id
         WHERE c.mobile_no = ?
         ORDER BY v.id DESC LIMIT 1`,
        [mob]
      );

      if (cRows.length > 0) {
        const c = cRows[0];
        let carName = '';
        if (c.make && c.model) carName = `${c.make} ${c.model}`.trim();
        else if (c.model) carName = c.model;

        return res.json({
          found: true,
          data: {
            client_name: c.customer_name || '',
            mobile_no: c.mobile_no || mob,
            alt_mobile: c.alt_mobile || '',
            email: c.email || '',
            address_line: c.address_line || '',
            colony_street: c.colony_street || '',
            city: c.city || '',
            state: c.state || '',
            pincode: c.pincode || '',
            company_name: c.company_name || '',
            gstin: c.gstin || '',
            reg_no: c.reg_no || '',
            car_name: carName
          }
        });
      }

      // 2. Try job_cards
      const [jcRows] = await db.query(
        `SELECT reg_no, car_name, owner_name, mobile_no, corporate_name
         FROM job_cards
         WHERE mobile_no = ?
         ORDER BY id DESC LIMIT 1`,
        [mob]
      );

      if (jcRows.length > 0) {
        const j = jcRows[0];
        return res.json({
          found: true,
          data: {
            client_name: j.owner_name || '',
            mobile_no: j.mobile_no || mob,
            reg_no: j.reg_no || '',
            car_name: j.car_name || '',
            company_name: j.corporate_name || ''
          }
        });
      }

      return res.json({ found: false });
    }

    return res.json({ found: false });
  } catch (err) {
    console.error('GET /api/suggestions/linked error:', err);
    res.status(500).json({ error: 'Linked lookup failed' });
  }
});

module.exports = router;
module.exports.canonicalType = canonicalType;
module.exports.normalizeSuggestion = normalizeSuggestion;
