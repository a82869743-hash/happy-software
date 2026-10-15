/**
 * Dashboard Routes — V4 Enhanced
 * Feature 20: Dashboard with pipeline metrics, payments, bookings
 */
const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/dashboard/today — Enhanced with CRM metrics
router.get('/today', async (req, res) => {
  try {
    // Pipeline counts
    let rfeCount = 0, estimationCount = 0, sparesCount = 0, wipCount = 0, readyCount = 0;
    try {
      const [rows] = await db.query("SELECT COUNT(*) as cnt FROM job_cards WHERE status = 'rfe'");
      rfeCount = rows[0].cnt;
    } catch (e) {}
    try {
      const [rows] = await db.query("SELECT COUNT(*) as cnt FROM job_cards WHERE status = 'estimation'");
      estimationCount = rows[0].cnt;
    } catch (e) {}
    try {
      const [rows] = await db.query("SELECT COUNT(*) as cnt FROM job_cards WHERE status = 'spares_pending'");
      sparesCount = rows[0].cnt;
    } catch (e) {}
    try {
      const [rows] = await db.query("SELECT COUNT(*) as cnt FROM job_cards WHERE status = 'wip'");
      wipCount = rows[0].cnt;
    } catch (e) {}
    try {
      const [rows] = await db.query("SELECT COUNT(*) as cnt FROM job_cards WHERE status = 'ready'");
      readyCount = rows[0].cnt;
    } catch (e) {}

    // Pipeline values
    let rfeVal = 0, estimationVal = 0, wipVal = 0, readyVal = 0, sparesVal = 0;
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(jcs.amount), 0) as total FROM job_card_services jcs JOIN job_cards jc ON jcs.job_card_id = jc.id WHERE jc.status = 'rfe'"
      );
      rfeVal = parseFloat(rows[0].total);
    } catch (e) {}
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(jcs.amount), 0) as total FROM job_card_services jcs JOIN job_cards jc ON jcs.job_card_id = jc.id WHERE jc.status = 'estimation'"
      );
      estimationVal = parseFloat(rows[0].total);
    } catch (e) {}
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(jcs.amount), 0) as total FROM job_card_services jcs JOIN job_cards jc ON jcs.job_card_id = jc.id WHERE jc.status = 'wip'"
      );
      wipVal = parseFloat(rows[0].total);
    } catch (e) {}
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(jcs.amount), 0) as total FROM job_card_services jcs JOIN job_cards jc ON jcs.job_card_id = jc.id WHERE jc.status = 'ready'"
      );
      readyVal = parseFloat(rows[0].total);
    } catch (e) {}
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(jcs.amount), 0) as total FROM job_card_services jcs JOIN job_cards jc ON jcs.job_card_id = jc.id WHERE jc.status = 'spares_pending'"
      );
      sparesVal = parseFloat(rows[0].total);
    } catch (e) {}

    // Active count (estimation + wip + ready)
    const active_jobs = estimationCount + wipCount + readyCount;

    // Standard vs Quick job card counts (non-deleted)
    let standardJobCards = 0, quickJobCards = 0;
    let standardJobValue = 0, quickJobValue = 0;
    try {
      const [rows] = await db.query("SELECT COUNT(*) as cnt FROM job_cards WHERE is_quick_job = 0 AND is_deleted = 0");
      standardJobCards = rows[0].cnt;
    } catch (e) {}
    try {
      const [rows] = await db.query("SELECT COUNT(*) as cnt FROM job_cards WHERE is_quick_job = 1 AND is_deleted = 0");
      quickJobCards = rows[0].cnt;
    } catch (e) {}
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(jcs.amount), 0) as total FROM job_card_services jcs JOIN job_cards jc ON jcs.job_card_id = jc.id WHERE jc.is_quick_job = 0 AND jc.is_deleted = 0"
      );
      standardJobValue = parseFloat(rows[0].total);
    } catch (e) {}
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(jcs.amount), 0) as total FROM job_card_services jcs JOIN job_cards jc ON jcs.job_card_id = jc.id WHERE jc.is_quick_job = 1 AND jc.is_deleted = 0"
      );
      quickJobValue = parseFloat(rows[0].total);
    } catch (e) {}

    // Completed jobs today
    let completed_jobs = 0;
    try {
      const [rows] = await db.query(
        "SELECT COUNT(*) as cnt FROM job_cards WHERE status IN ('delivered','invoiced') AND DATE(closed_at) = CURDATE()"
      );
      completed_jobs = rows[0].cnt;
    } catch (e) {}

    // Today's invoice revenue
    let invoiceRev = 0;
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE DATE(created_at) = CURDATE()"
      );
      invoiceRev = parseFloat(rows[0].total);
    } catch (e) {}

    // Today's estimate revenue
    let estimateRev = 0;
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(subtotal), 0) as total FROM estimates WHERE DATE(created_at) = CURDATE()"
      );
      estimateRev = parseFloat(rows[0].total);
    } catch (e) {}

    // Product sales
    let productRev = 0;
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(price), 0) as total FROM product_sales WHERE DATE(sale_date) = CURDATE()"
      );
      productRev = parseFloat(rows[0].total);
    } catch (e) {}

    // Non-GST invoice revenue
    let nonGstInvoiceRev = 0;
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices_non_gst WHERE deleted_at IS NULL AND DATE(created_at) = CURDATE()"
      );
      nonGstInvoiceRev = parseFloat(rows[0].total);
    } catch (e) {}

    // Parts sales revenue
    let partsRev = 0;
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(total_amount), 0) as total FROM parts_sales WHERE DATE(sale_date) = CURDATE()"
      );
      partsRev = parseFloat(rows[0].total);
    } catch (e) {}

    const today_revenue = invoiceRev + nonGstInvoiceRev + estimateRev + productRev + partsRev;

    // Invoice/Estimate counts (includes non-GST invoices)
    let invoices_today = 0;
    try {
      const [rows] = await db.query(
        "SELECT (SELECT COUNT(*) FROM invoices WHERE DATE(created_at) = CURDATE()) + (SELECT COUNT(*) FROM invoices_non_gst WHERE DATE(created_at) = CURDATE() AND deleted_at IS NULL) as cnt"
      );
      invoices_today = rows[0]?.cnt || 0;
    } catch (e) {}

    let estimates_today = 0;
    try {
      const [rows] = await db.query("SELECT COUNT(*) as cnt FROM estimates WHERE DATE(created_at) = CURDATE()");
      estimates_today = rows[0].cnt;
    } catch (e) {}

    // Cash balance
    let cashIn = 0;
    try {
      const [rows] = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'in'");
      cashIn = parseFloat(rows[0].total);
    } catch (e) {}

    let cashOut = 0;
    try {
      const [rows] = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'out'");
      cashOut = parseFloat(rows[0].total);
    } catch (e) {}

    const cash_balance = cashIn - cashOut;

    // Staff present
    let staff_present = 0;
    try {
      const [rows] = await db.query(
        "SELECT COUNT(*) as cnt FROM attendance WHERE attendance_date = CURDATE() AND status IN ('present', 'half', 'half-day', 'half_day')"
      );
      staff_present = rows[0].cnt;
    } catch (e) {}

    let total_staff = 0;
    try {
      const [rows] = await db.query("SELECT COUNT(*) as cnt FROM staff WHERE is_active = 1");
      total_staff = rows[0].cnt;
    } catch (e) {}

    // V4: Today's payments collected
    let payments_today = 0;
    try {
      const [payRows] = await db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments WHERE payment_date = CURDATE()"
      );
      payments_today = parseFloat(payRows[0].total);
    } catch (e) { /* table may not exist yet */ }

    // V4: Outstanding payments (GST Invoices + Non-GST Invoices + Standalone Estimates)
    let total_outstanding = 0;
    try {
      const [outRows] = await db.query(
        `SELECT COALESCE(SUM(
          GREATEST(0,
            COALESCE(inv.total_amount, ngst.total_amount, est.total_amount, est.subtotal, jc.final_amount, 0) 
            - COALESCE(adv.total_advance, 0) 
            - COALESCE(cp.total_payments, 0)
          )
        ), 0) as outstanding
        FROM job_cards jc
        LEFT JOIN invoices inv ON inv.job_card_id = jc.id
        LEFT JOIN invoices_non_gst ngst ON ngst.job_card_id = jc.id AND ngst.deleted_at IS NULL
        LEFT JOIN estimates est ON est.job_card_id = jc.id
        LEFT JOIN (SELECT job_card_id, SUM(amount) as total_advance FROM advance_payments GROUP BY job_card_id) adv ON adv.job_card_id = jc.id
        LEFT JOIN (SELECT job_card_id, SUM(amount) as total_payments FROM customer_payments WHERE payment_mode != 'discount' GROUP BY job_card_id) cp ON cp.job_card_id = jc.id
        WHERE jc.status IN ('delivered','invoiced') AND jc.is_deleted = 0`
      );
      total_outstanding = parseFloat(outRows[0]?.outstanding || 0);

      const [estOutRows] = await db.query(
        `SELECT COALESCE(SUM(
          GREATEST(0,
            COALESCE(e.total_amount, e.subtotal, 0) - COALESCE(cp.total_payments, 0)
          )
        ), 0) as outstanding
        FROM estimates e
        LEFT JOIN (SELECT estimate_id, SUM(amount) as total_payments FROM customer_payments WHERE payment_mode != 'discount' GROUP BY estimate_id) cp ON cp.estimate_id = e.id
        WHERE e.job_card_id IS NULL AND e.is_archived = 0`
      );
      total_outstanding += parseFloat(estOutRows[0]?.outstanding || 0);
    } catch (e) { /* table may not exist yet */ }

    // V4: Today's bookings
    let bookings_today = 0;
    try {
      const [bkRows] = await db.query(
        "SELECT COUNT(*) as cnt FROM service_bookings WHERE booking_date = CURDATE() AND booking_status NOT IN ('cancelled')"
      );
      bookings_today = bkRows[0].cnt;
    } catch (e) { /* table may not exist yet */ }

    // V4: Upcoming bookings (next 7 days)
    let upcoming_bookings = 0;
    try {
      const [upRows] = await db.query(
        "SELECT COUNT(*) as cnt FROM service_bookings WHERE booking_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND booking_status NOT IN ('cancelled','completed')"
      );
      upcoming_bookings = upRows[0].cnt;
    } catch (e) { /* table may not exist yet */ }

    const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    res.json({
      // Pipeline metrics
      pipeline: {
        rfe: { count: rfeCount, value: rfeVal },
        estimation: { count: estimationCount, value: estimationVal },
        spares_pending: { count: sparesCount, value: sparesVal },
        wip: { count: wipCount, value: wipVal },
        ready: { count: readyCount, value: readyVal },
        standard_job_cards: { count: standardJobCards, value: standardJobValue },
        quick_job_cards: { count: quickJobCards, value: quickJobValue },
      },
      // Legacy compatible
      active_jobs,
      completed_jobs,
      today_revenue,
      invoice_revenue: invoiceRev,
      estimate_revenue: estimateRev,
      invoices_today,
      estimates_today,
      cash_balance,
      staff_present,
      total_staff,
      // V4 additions
      payments_today,
      total_outstanding,
      bookings_today,
      upcoming_bookings,
      date: todayStr
    });
  } catch (err) {
    console.error('GET /dashboard/today error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /api/dashboard/chart-data — Revenue over last 7 days
router.get('/chart-data', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    let invoiceData = [];
    try {
      const [pd] = await db.query(
        `SELECT DATE(created_at) as date, SUM(total_amount) as total
         FROM invoices WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE(created_at) ORDER BY date`,
        [days]
      );
      invoiceData = pd;
    } catch (e) {}

    let estimateData = [];
    try {
      const [pd] = await db.query(
        `SELECT DATE(created_at) as date, SUM(subtotal) as total
         FROM estimates WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE(created_at) ORDER BY date`,
        [days]
      );
      estimateData = pd;
    } catch (e) {}

    let jobsData = [];
    try {
      const [pd] = await db.query(
        `SELECT DATE(job_date) as date, COUNT(*) as count
         FROM job_cards WHERE job_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE(job_date) ORDER BY date`,
        [days]
      );
      jobsData = pd;
    } catch (e) {}

    // V4: Payment data
    let paymentData = [];
    try {
      const [pd] = await db.query(
        `SELECT payment_date as date, SUM(amount) as total
         FROM customer_payments WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY payment_date ORDER BY date`,
        [days]
      );
      paymentData = pd;
    } catch (e) { /* table may not exist yet */ }

    // Non-GST invoice data
    let nonGstInvoiceData = [];
    try {
      const [pd] = await db.query(
        `SELECT DATE(created_at) as date, SUM(total_amount) as total
         FROM invoices_non_gst WHERE deleted_at IS NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE(created_at) ORDER BY date`,
        [days]
      );
      nonGstInvoiceData = pd;
    } catch (e) {}

    res.json({ invoice_revenue: invoiceData, non_gst_invoice_revenue: nonGstInvoiceData, estimate_revenue: estimateData, jobs_created: jobsData, payments: paymentData });
  } catch (err) {
    console.error('GET /dashboard/chart-data error:', err);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

module.exports = router;
