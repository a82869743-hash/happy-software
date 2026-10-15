/**
 * Settings Route — System Configuration
 * 
 * Provides endpoints for managing system-wide settings like
 * business info, tax config, notification preferences, etc.
 * All settings stored as key-value pairs in the `settings` table.
 */
const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// --- Default settings (fallback values if not in DB) ---
const DEFAULTS = {
  business_name: 'Happy Car Wash',
  business_address: '8/9 GIDC - Vadsar Main Road Mohangiri, opp. Uma Co Op Bank Ltd, near Bank Of Baroda, Makarpura, Vadodara, Gujarat 390010',
  business_phone: '99986 25511',
  business_email: 'contact@happycarwash.com',
  business_gstin: '',
  business_state: 'Gujarat',
  business_state_code: '24',
  default_gst_percent: '18',
  default_payment_mode: 'cash',
  invoice_prefix: 'INV',
  estimate_prefix: 'EST',
  job_prefix: 'HCW',
  rfe_prefix: 'RFE',
  whatsapp_enabled: 'false',
  sms_enabled: 'false',
  low_stock_threshold: '5',
  currency_symbol: '₹',
  financial_year_start: '04',
  msg91_auth_key: '',
  msg91_sender_id: 'HAPPY',
  msg91_dlt_entity_id: '',
  msg91_job_opened_template_id: '',
  msg91_invoice_template_id: '',
  msg91_status_estimation_template_id: '',
  msg91_status_wip_template_id: '',
  msg91_status_ready_template_id: '',
  msg91_status_delivered_template_id: '',
  msg91_status_invoiced_template_id: '',
  msg91_status_cancelled_template_id: '',
  sms_job_opened_enabled: 'true',
  sms_status_update_enabled: 'true',
  sms_invoice_manual_enabled: 'true',
  sms_template_job_opened: 'Dear {#var#}, your vehicle {#var#} has been received at Happy Car Wash, Vadodara. Job No: {#var#}. - HAPPY',
  sms_template_status_estimation: 'Dear {#var#}, estimate for vehicle {#var#} amounting to Rs.{#var#} is ready for review. - HAPPY',
  sms_template_status_wip: 'Dear {#var#}, service on your vehicle {#var#} is currently in progress at Happy Car Wash. - HAPPY',
  sms_template_status_ready: 'Dear {#var#}, your vehicle {#var#} is ready for delivery at Happy Car Wash, Vadodara. - HAPPY',
  sms_template_status_delivered: 'Dear {#var#}, your vehicle {#var#} has been delivered. Thank you for choosing Happy Car Wash! - HAPPY',
  sms_template_status_invoiced: 'Dear {#var#}, invoice for vehicle {#var#} has been generated. Thank you for your business! - HAPPY',
  sms_template_status_cancelled: 'Dear {#var#}, service for vehicle {#var#} has been cancelled. Please contact us for details. - HAPPY',
  sms_template_invoice: 'Dear {#var#}, invoice {#var#} for vehicle {#var#} amounting to Rs.{#var#} is ready. Thank you - Happy Car Wash. - HAPPY',
};

// ===============================================================
// GET /api/settings — Get all settings
// ===============================================================
router.get('/', async (req, res) => {
  try {
    let rows = [];
    try {
      [rows] = await db.query('SELECT setting_key, setting_value FROM settings ORDER BY setting_key');
    } catch (err) {
      // Table may not exist yet — return defaults
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return res.json({ data: DEFAULTS });
      }
      throw err;
    }

    const settings = { ...DEFAULTS };
    for (const row of rows) {
      settings[row.setting_key] = row.setting_value;
    }

    res.json({ data: settings });
  } catch (err) {
    console.error('GET /settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ===============================================================
// GET /api/settings/:key — Get a single setting
// ===============================================================
router.get('/:key', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT setting_value FROM settings WHERE setting_key = ?', [req.params.key]);
    const value = rows.length > 0 ? rows[0].setting_value : (DEFAULTS[req.params.key] || null);
    res.json({ key: req.params.key, value });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ key: req.params.key, value: DEFAULTS[req.params.key] || null });
    }
    console.error('GET /settings/:key error:', err);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// ===============================================================
// PUT /api/settings — Upsert multiple settings
// ===============================================================
router.put('/', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object required' });
    }

    // Ensure table exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        id           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
        setting_key  VARCHAR(100)     NOT NULL UNIQUE,
        setting_value TEXT            NULL,
        updated_by   INT UNSIGNED     NULL,
        updated_at   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_setting_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    for (const [key, value] of Object.entries(settings)) {
      await db.execute(
        `INSERT INTO settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [key, value !== null ? String(value) : null, req.user?.id || null]
      );
    }

    res.json({ message: 'Settings updated', count: Object.keys(settings).length });
  } catch (err) {
    console.error('PUT /settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ===============================================================
// POST /api/settings/test-sms — Send a test SMS to verify config
// ===============================================================
router.post('/test-sms', async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ error: 'Mobile number required' });

    const msg91 = require('../utils/msg91');
    const cfg = await msg91.getSmsConfig();

    const authKey = cfg.msg91_auth_key || process.env.MSG91_AUTH_KEY;
    const senderId = cfg.msg91_sender_id || process.env.MSG91_SENDER_ID || 'HAPPY';
    const templateId = cfg.msg91_status_wip_template_id || process.env.MSG91_SMS_TEMPLATE_ID;

    if (!authKey || !senderId) {
      return res.status(400).json({ error: 'MSG91 Auth Key and Sender ID must be configured before testing' });
    }
    if (!templateId) {
      return res.status(400).json({ error: 'At least one DLT Template ID must be configured. Please set the WIP status template ID.' });
    }

    const result = await msg91.sendSMS({
      to: mobile,
      message: `This is a test SMS from Happy Car Wash GMS. Your SMS configuration is working correctly. - HAPPY`,
      jobCardId: null,
      userId: req.user?.id || null,
      templateId,
      senderId,
      authKey,
      bypassEnabledCheck: true,
      variables: ['Test Customer', 'GJ-06-XX-0000']
    });

    res.json({ message: 'Test SMS dispatched', result });
  } catch (err) {
    console.error('POST /settings/test-sms error:', err);
    res.status(500).json({ error: 'Test SMS failed: ' + err.message });
  }
});

module.exports = router;



