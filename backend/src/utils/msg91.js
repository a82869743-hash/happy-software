/**
 * MSG91 — WhatsApp & SMS Dispatch Utility
 * 
 * Handles sending invoice/estimate notifications via WhatsApp and SMS
 * using MSG91's API. Includes audit logging to bill_dispatch_log table.
 * 
 * Safety: If MSG91 credentials are missing, dispatch is skipped gracefully.
 */

const db = require('../config/db');

const MSG91_BASE = 'https://control.msg91.com/api/v5';

/**
 * Send WhatsApp message via MSG91
 */
async function sendWhatsApp({ to, templateName, params, jobCardId, userId }) {
  const cfg = await getSmsConfig();
  const whatsappEnabled = (cfg.whatsapp_enabled || process.env.WHATSAPP_ENABLED || 'false') === 'true';
  if (!whatsappEnabled) {
    console.warn('[MSG91] WhatsApp is globally disabled — skipping dispatch');
    return { success: false, reason: 'whatsapp_disabled' };
  }

  const authKey = cfg.msg91_auth_key || process.env.MSG91_AUTH_KEY;
  const waNumber = cfg.whatsapp_number || process.env.MSG91_WA_NUMBER;

  if (!authKey || !waNumber) {
    console.warn('[MSG91] WhatsApp credentials not configured — skipping dispatch');
    return { success: false, reason: 'credentials_missing' };
  }

  try {
    const payload = {
      integrated_number: waNumber,
      content_type: 'template',
      payload: {
        to: to.startsWith('91') ? to : `91${to}`,
        type: 'template',
        template: {
          name: templateName || process.env.MSG91_WA_TEMPLATE_NAME || 'invoice_notification',
          language: { code: 'en', policy: 'deterministic' },
          components: params ? [{ type: 'body', parameters: params }] : []
        }
      }
    };

    const response = await fetch(`${MSG91_BASE}/whatsapp/whatsapp/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const success = response.ok && data.type !== 'error';

    // Log dispatch
    await logDispatch({
      jobCardId,
      type: 'whatsapp',
      recipientNo: to,
      templateName,
      status: success ? 'sent' : 'failed',
      providerRef: data.id || data.request_id || null,
      errorMessage: success ? null : JSON.stringify(data),
      userId
    });

    return { success, data };
  } catch (err) {
    console.error('[MSG91] WhatsApp error:', err.message);
    await logDispatch({
      jobCardId,
      type: 'whatsapp',
      recipientNo: to,
      templateName,
      status: 'failed',
      providerRef: null,
      errorMessage: err.message,
      userId
    });
    return { success: false, error: err.message };
  }
}

/**
 * Send SMS via MSG91
 */
async function sendSMS({ to, message, jobCardId, userId, templateId, senderId, authKey, bypassEnabledCheck = false, variables = [] }) {
  const cfg = await getSmsConfig();

  if (!bypassEnabledCheck) {
    const smsEnabled = (cfg.sms_enabled || process.env.SMS_ENABLED || 'false') === 'true';
    if (!smsEnabled) {
      console.warn('[MSG91] SMS is globally disabled — skipping dispatch');
      return { success: false, reason: 'sms_disabled' };
    }
  }

  const finalAuthKey = authKey || cfg.msg91_auth_key || process.env.MSG91_AUTH_KEY;
  const finalSenderId = senderId || cfg.msg91_sender_id || process.env.MSG91_SENDER_ID || 'HAPPY';
  const finalTemplateId = templateId || cfg.msg91_job_opened_template_id || process.env.MSG91_SMS_TEMPLATE_ID;

  if (!finalAuthKey || !finalSenderId || !finalTemplateId) {
    console.warn('[MSG91] SMS credentials not configured — skipping dispatch');
    return { success: false, reason: 'credentials_missing' };
  }

  try {
    const mobile = to.startsWith('91') ? to : `91${to}`;

    // Build recipients payload with both indexed and semantic variable variations for maximum flexibility
    const recipientObj = {
      mobiles: mobile
    };

    if (variables && Array.isArray(variables)) {
      variables.forEach((val, idx) => {
        const strVal = String(val);
        recipientObj[`VAR${idx + 1}`] = strVal;
        recipientObj[`var${idx + 1}`] = strVal;
      });

      // Semantic mappings
      if (variables.length >= 1) {
        recipientObj['name'] = String(variables[0]);
        recipientObj['NAME'] = String(variables[0]);
        recipientObj['customer_name'] = String(variables[0]);
      }
      if (variables.length >= 2) {
        recipientObj['reg_no'] = String(variables[1]);
        recipientObj['REG_NO'] = String(variables[1]);
        recipientObj['regno'] = String(variables[1]);
        recipientObj['REGNO'] = String(variables[1]);
        recipientObj['vehicle_no'] = String(variables[1]);
      }
      if (variables.length === 3) {
        recipientObj['tracking_url'] = String(variables[2]);
        recipientObj['TRACKING_URL'] = String(variables[2]);
        recipientObj['url'] = String(variables[2]);
        recipientObj['URL'] = String(variables[2]);
        recipientObj['link'] = String(variables[2]);
      } else if (variables.length === 4) {
        recipientObj['invoice_no'] = String(variables[1]);
        recipientObj['INVOICE_NO'] = String(variables[1]);
        recipientObj['reg_no'] = String(variables[2]);
        recipientObj['REG_NO'] = String(variables[2]);
        recipientObj['amount'] = String(variables[3]);
        recipientObj['AMOUNT'] = String(variables[3]);
        recipientObj['total'] = String(variables[3]);
      }
    }

    const payload = {
      template_id: finalTemplateId,
      sender: finalSenderId,
      short_url: '1',
      recipients: [recipientObj]
    };

    const response = await fetch(`${MSG91_BASE}/flow/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': finalAuthKey,
        'accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const success = response.ok && data.type !== 'error';

    await logDispatch({
      jobCardId,
      type: 'sms',
      recipientNo: to,
      templateName: finalTemplateId,
      status: success ? 'sent' : 'failed',
      providerRef: data.request_id || null,
      errorMessage: success ? null : JSON.stringify(data),
      userId
    });

    return { success, data };
  } catch (err) {
    console.error('[MSG91] SMS error:', err.message);
    await logDispatch({
      jobCardId,
      type: 'sms',
      recipientNo: to,
      templateName: finalTemplateId,
      status: 'failed',
      providerRef: null,
      errorMessage: err.message,
      userId
    });
    return { success: false, error: err.message };
  }
}

/**
 * Log dispatch event to bill_dispatch_log
 */
async function logDispatch({ jobCardId, type, recipientNo, templateName, status, providerRef, errorMessage, userId }) {
  try {
    await db.execute(
      `INSERT INTO bill_dispatch_log 
        (job_card_id, dispatch_type, recipient_no, template_name, status, provider_ref, error_message, dispatched_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobCardId, type, recipientNo, templateName || null, status, providerRef || null, errorMessage || null, userId || null]
    );
  } catch (err) {
    console.error('[MSG91] Failed to log dispatch:', err.message);
  }
}

/**
 * Get dispatch history for a job card
 */
async function getDispatchHistory(jobCardId) {
  const [rows] = await db.query(
    `SELECT bdl.*, au.full_name as dispatched_by_name
     FROM bill_dispatch_log bdl
     LEFT JOIN admin_users au ON bdl.dispatched_by = au.id
     WHERE bdl.job_card_id = ?
     ORDER BY bdl.created_at DESC`,
    [jobCardId]
  );
  return rows;
}

/**
 * Read SMS/MSG91 config from settings table (falls back to process.env)
 * Call this at dispatch time so settings changes take effect immediately
 */
async function getSmsConfig() {
  try {
    const [rows] = await db.query(
      `SELECT setting_key, setting_value FROM settings 
       WHERE setting_key IN (
         'sms_enabled', 'whatsapp_enabled', 'msg91_auth_key', 'msg91_sender_id',
         'msg91_dlt_entity_id', 'msg91_job_opened_template_id',
         'msg91_invoice_template_id',
         'msg91_status_estimation_template_id',
         'msg91_status_wip_template_id',
         'msg91_status_ready_template_id', 'msg91_status_delivered_template_id',
         'msg91_status_invoiced_template_id', 'msg91_status_cancelled_template_id',
         'sms_job_opened_enabled', 'sms_status_update_enabled', 'sms_invoice_manual_enabled',
         'sms_template_job_opened', 'sms_template_invoice',
         'sms_template_status_estimation',
         'sms_template_status_wip',
         'sms_template_status_ready', 'sms_template_status_delivered',
         'sms_template_status_invoiced', 'sms_template_status_cancelled'
       )`
    );
    const cfg = {};
    for (const r of rows) cfg[r.setting_key] = r.setting_value;
    return cfg;
  } catch (err) {
    // settings table might not exist yet — return empty, will fall back to env
    return {};
  }
}

/**
 * Build SMS message from DLT template stored in settings
 * Replaces {#var#} placeholders in order with provided variables array
 */
function buildSmsFromTemplate(template, variables) {
  if (!template) return null;
  let msg = template;
  for (const v of variables) {
    msg = msg.replace('{#var#}', v);
  }
  return msg;
}

/**
 * Send SMS when a job card is first opened (normal job card creation)
 * Trigger: POST /api/job-cards (after successful insert)
 */
async function sendJobOpenedSMS({ ownerName, regNo, carName, trackingUrl, mobile, jobCardId, userId }) {
  try {
    const cfg = await getSmsConfig();
    const smsEnabled = (cfg.sms_enabled || process.env.SMS_ENABLED || 'false') === 'true';
    const openedEnabled = (cfg.sms_job_opened_enabled || 'true') === 'true';
    if (!smsEnabled || !openedEnabled) return { success: false, reason: 'sms_disabled' };
    if (!mobile) return { success: false, reason: 'no_mobile' };

    const authKey = cfg.msg91_auth_key || process.env.MSG91_AUTH_KEY;
    const senderId = cfg.msg91_sender_id || process.env.MSG91_SENDER_ID || 'HAPPY';
    const templateId = cfg.msg91_job_opened_template_id || process.env.MSG91_JOB_OPENED_TEMPLATE_ID;
    const templateText = cfg.sms_template_job_opened;

    if (!authKey || !senderId || !templateId) {
      console.warn('[MSG91] Job opened SMS: credentials/template not configured — skipping');
      return { success: false, reason: 'credentials_missing' };
    }

    const message = buildSmsFromTemplate(templateText, [ownerName, regNo, trackingUrl]) 
      || `Dear ${ownerName}, your vehicle ${regNo} has been received at Happy Car Wash. Track your service live: ${trackingUrl} - HAPPY`;

    return await sendSMS({ to: mobile, message, jobCardId, userId, templateId, senderId, authKey, bypassEnabledCheck: true });
  } catch (err) {
    console.warn('[MSG91] sendJobOpenedSMS error (non-fatal):', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send SMS on status pipeline change
 * Trigger: PATCH /api/job-cards/:id/status (after successful update)
 */
async function sendStatusSMS({ status, ownerName, regNo, carName, mobile, jobCardId, userId }) {
  try {
    const cfg = await getSmsConfig();
    const smsEnabled = (cfg.sms_enabled || process.env.SMS_ENABLED || 'false') === 'true';
    const statusEnabled = (cfg.sms_status_update_enabled || 'true') === 'true';
    if (!smsEnabled || !statusEnabled) return { success: false, reason: 'sms_disabled' };
    if (!mobile) return { success: false, reason: 'no_mobile' };

    const authKey = cfg.msg91_auth_key || process.env.MSG91_AUTH_KEY;
    const senderId = cfg.msg91_sender_id || process.env.MSG91_SENDER_ID || 'HAPPY';
    const templateIdKey = `msg91_status_${status}_template_id`;
    const templateId = cfg[templateIdKey] || process.env[`MSG91_STATUS_${status.toUpperCase()}_TEMPLATE_ID`];
    const templateTextKey = `sms_template_status_${status}`;
    const templateText = cfg[templateTextKey];

    if (!authKey || !senderId || !templateId) {
      console.warn(`[MSG91] Status SMS (${status}): template not configured — skipping`);
      return { success: false, reason: 'template_not_configured' };
    }

    const message = buildSmsFromTemplate(templateText, [ownerName, regNo])
      || `Dear ${ownerName}, your vehicle ${regNo} status has been updated to: ${status}. - Happy Car Wash`;

    return await sendSMS({ to: mobile, message, jobCardId, userId, templateId, senderId, authKey, bypassEnabledCheck: true });
  } catch (err) {
    console.warn(`[MSG91] sendStatusSMS error (non-fatal):`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send invoice notification SMS — MANUAL TRIGGER from admin UI
 */
async function sendInvoiceSMS({ ownerName, regNo, carName, invoiceNo, totalAmount, mobile, jobCardId, userId }) {
  try {
    const cfg = await getSmsConfig();
    const smsEnabled = (cfg.sms_enabled || process.env.SMS_ENABLED || 'false') === 'true';
    const invoiceEnabled = (cfg.sms_invoice_manual_enabled || 'true') === 'true';
    if (!smsEnabled || !invoiceEnabled) return { success: false, reason: 'sms_disabled' };

    const authKey = cfg.msg91_auth_key || process.env.MSG91_AUTH_KEY;
    const senderId = cfg.msg91_sender_id || process.env.MSG91_SENDER_ID || 'HAPPY';
    const templateId = cfg.msg91_invoice_template_id || process.env.MSG91_INVOICE_TEMPLATE_ID;
    const templateText = cfg.sms_template_invoice;

    if (!authKey || !senderId || !templateId) {
      return { success: false, reason: 'credentials_missing' };
    }

    const message = buildSmsFromTemplate(templateText, [ownerName, invoiceNo, regNo, String(totalAmount)])
      || `Dear ${ownerName}, your invoice ${invoiceNo} for vehicle ${regNo} totalling Rs.${totalAmount} is ready. Thank you - Happy Car Wash`;

    return await sendSMS({ to: mobile, message, jobCardId, userId, templateId, senderId, authKey, bypassEnabledCheck: true });
  } catch (err) {
    console.warn('[MSG91] sendInvoiceSMS error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendWhatsApp,
  sendSMS,
  sendJobOpenedSMS,
  sendStatusSMS,
  sendInvoiceSMS,
  getSmsConfig,
  buildSmsFromTemplate,
  getDispatchHistory
};

