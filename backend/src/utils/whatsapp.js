/**
 * whatsapp.js — WhatsApp Business Cloud API integration
 *
 * Sends messages via Meta's WhatsApp Cloud API.
 * Falls back to wa.me deep link if API credentials are not configured.
 *
 * Setup:
 *   1. Go to https://developers.facebook.com
 *   2. Create a Meta Business App -> Add WhatsApp product
 *   3. In WhatsApp -> API Setup, get your:
 *      - Phone Number ID  -> WA_PHONE_NUMBER_ID
 *      - Temporary/Permanent Access Token -> WA_ACCESS_TOKEN
 *   4. Add a phone number (0000000000) and verify it
 *   5. Fill these values in your .env file
 */

const axios = require('axios');

const WA_API_URL = 'https://graph.facebook.com/v21.0';

/**
 * Check if WhatsApp Cloud API is configured
 */
function isWaConfigured() {
  return !!(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN);
}

/**
 * Send a plain text WhatsApp message via Cloud API
 * @param {string} to - Phone number (10-digit Indian or with country code)
 * @param {string} message - Text message to send
 * @returns {Promise<{success: boolean, messageId?: string, error?: string, fallbackUrl?: string}>}
 */
async function sendWhatsAppMessage(to, message) {
  // Clean phone number — ensure 91 prefix
  let phone = to.replace(/\D/g, '');
  if (phone.length === 10) phone = '91' + phone;
  if (!phone.startsWith('91')) phone = '91' + phone;

  // If API not configured, return fallback URL
  if (!isWaConfigured()) {
    const fallbackUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    return {
      success: false,
      error: 'WhatsApp API not configured. Using fallback link.',
      fallbackUrl
    };
  }

  try {
    const res = await axios.post(
      `${WA_API_URL}/${process.env.WA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: {
          preview_url: false,
          body: message
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const msgId = res.data?.messages?.[0]?.id;
    console.log(`✅ WhatsApp sent to ${phone} | ID: ${msgId}`);
    return { success: true, messageId: msgId };

  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    console.error(`âŒ WhatsApp failed to ${phone}:`, errMsg);

    // Return fallback URL so frontend can open wa.me
    const fallbackUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    return {
      success: false,
      error: errMsg,
      fallbackUrl
    };
  }
}

/**
 * Build service reminder message
 */
function buildReminderMessage(reminder) {
  const name = reminder.customer_name || 'Customer';
  const vehicle = reminder.vehicle_reg_no || '';
  const type = reminder.reminder_type || 'service';
  const date = reminder.reminder_date
    ? new Date(reminder.reminder_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'upcoming';
  const notes = reminder.notes || '';
  const km = reminder.km_at_next ? `${Number(reminder.km_at_next).toLocaleString()} km` : '';
  const bizNumber = process.env.WA_BUSINESS_NUMBER || '0000000000';

  let msg = `Hello ${name},\n\nThis is a friendly reminder from *Happy Car Wash* regarding your vehicle *${vehicle}*.\n\n`;
  msg += `*Service:* ${type}\n`;
  msg += `*Due:* ${date}\n`;
  if (km) msg += `*Next service at:* ${km}\n`;
  if (notes) msg += `*Note:* ${notes}\n`;
  msg += `\nPlease schedule your visit at your convenience.\n+91 ${bizNumber.replace(/(\d{5})(\d{5})/, '$1 $2')}\n\nThank you,\n*Happy Car Wash, Vadodara*`;
  return msg;
}

module.exports = { sendWhatsAppMessage, buildReminderMessage, isWaConfigured };



