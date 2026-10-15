const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const list = [];

    // 1. Low Stock Alerts
    try {
      let threshold = 5;
      try {
        const [settingRows] = await db.query(
          "SELECT setting_value FROM settings WHERE setting_key = 'low_stock_threshold'"
        );
        if (settingRows.length > 0) threshold = parseInt(settingRows[0].setting_value) || 5;
      } catch (e) {
        // Settings table might not exist yet
      }

      const [partRows] = await db.query(
        `SELECT id, part_code, part_name, category, stock_qty, low_stock_alert
         FROM parts WHERE stock_qty <= COALESCE(low_stock_alert, ?)
         ORDER BY stock_qty ASC`,
        [threshold]
      );

      for (const part of partRows) {
        list.push({
          id: `low_stock_${part.id}`,
          type: 'low_stock',
          title: 'Low Inventory Alert',
          message: `Part "${part.part_name}" (${part.part_code}) has low stock: only ${part.stock_qty} left.`,
          link: '/parts',
          timestamp: new Date().toISOString(), // Use current time since low stock is active state
          severity: 'warning'
        });
      }
    } catch (err) {
      console.warn('Notifications: Failed to fetch low stock parts:', err.message);
    }

    // 2. Upcoming Service Bookings
    try {
      const [serviceRows] = await db.query(
        `SELECT id, booking_no, customer_name, mobile_no, booking_date, booking_time, booking_status, car_number, car_name
         FROM service_bookings
         WHERE booking_status NOT IN ('completed', 'cancelled')
           AND booking_date >= CURDATE()
         ORDER BY booking_date ASC, booking_time ASC`
      );

      for (const sb of serviceRows) {
        const dateStr = sb.booking_date ? new Date(sb.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        const timeStr = sb.booking_time || 'anytime';
        list.push({
          id: `service_booking_${sb.id}`,
          type: 'service_booking',
          title: 'Upcoming Service Booking',
          message: `Booking ${sb.booking_no} for ${sb.customer_name} (${sb.car_number || 'No Car No.'}) is scheduled on ${dateStr} at ${timeStr}.`,
          link: '/service-bookings',
          timestamp: new Date(sb.booking_date).toISOString(),
          severity: 'info'
        });
      }
    } catch (err) {
      console.warn('Notifications: Failed to fetch service bookings:', err.message);
    }

    // 3. Upcoming Advance Bookings
    try {
      const [advanceRows] = await db.query(
        `SELECT id, booking_no, customer_name, mobile_no, booking_date, booking_time, status, reg_no, car_name
         FROM advance_bookings
         WHERE status NOT IN ('arrived', 'cancelled')
           AND booking_date >= CURDATE()
         ORDER BY booking_date ASC, booking_time ASC`
      );

      for (const ab of advanceRows) {
        const dateStr = ab.booking_date ? new Date(ab.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        const timeStr = ab.booking_time || 'anytime';
        list.push({
          id: `advance_booking_${ab.id}`,
          type: 'advance_booking',
          title: 'Upcoming Advance Booking',
          message: `Advance Booking ${ab.booking_no} for ${ab.customer_name} (${ab.reg_no || 'No Reg No.'}) on ${dateStr} at ${timeStr}.`,
          link: '/advance-bookings',
          timestamp: new Date(ab.booking_date).toISOString(),
          severity: 'info'
        });
      }
    } catch (err) {
      console.warn('Notifications: Failed to fetch advance bookings:', err.message);
    }

    // 4. Recent Status Changes (last 2 days)
    try {
      const [statusRows] = await db.query(
        `SELECT sn.id, sn.job_card_id, sn.status, sn.message, sn.created_at, jc.job_no, jc.reg_no, jc.car_name
         FROM status_notifications sn
         JOIN job_cards jc ON sn.job_card_id = jc.id
         WHERE sn.created_at >= DATE_SUB(NOW(), INTERVAL 2 DAY)
         ORDER BY sn.created_at DESC`
      );

      for (const sn of statusRows) {
        list.push({
          id: `status_change_${sn.id}`,
          type: 'status_change',
          title: 'Job Card Status Change',
          message: `Job Card ${sn.job_no} (${sn.reg_no}) status changed to "${sn.status.toUpperCase()}". Message: "${sn.message || ''}"`,
          link: `/job-cards/${sn.job_card_id}/edit`,
          timestamp: sn.created_at,
          severity: sn.status === 'delivered' || sn.status === 'ready' ? 'success' : 'info'
        });
      }
    } catch (err) {
      console.warn('Notifications: Failed to fetch status notifications:', err.message);
    }

    // 5. New Job Cards created (last 2 days)
    try {
      const [jcRows] = await db.query(
        `SELECT id, job_no, reg_no, owner_name, car_name, status, created_at
         FROM job_cards
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 2 DAY)
         ORDER BY created_at DESC`
      );

      for (const jc of jcRows) {
        list.push({
          id: `new_jobcard_${jc.id}`,
          type: 'new_jobcard',
          title: 'New Job Card Created',
          message: `New Job Card ${jc.job_no} created for ${jc.owner_name} (${jc.reg_no}) - Status: ${jc.status.toUpperCase()}`,
          link: `/job-cards/${jc.id}/edit`,
          timestamp: jc.created_at,
          severity: 'success'
        });
      }
    } catch (err) {
      console.warn('Notifications: Failed to fetch new job cards:', err.message);
    }

    // Sort notifications: newest first
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ data: list });
  } catch (err) {
    console.error('GET /notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

module.exports = router;
