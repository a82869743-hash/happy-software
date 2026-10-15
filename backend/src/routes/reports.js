const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── GET /api/reports/daily?date= ─────
router.get('/daily', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const company = req.query.company || 'all';

    // Section 1: Invoices (completed jobs with GST)
    const [invoices] = await db.query(
      `SELECT i.invoice_no, jc.job_no, jc.reg_no, jc.car_name,
              i.subtotal, i.gst_percent, i.gst_amount, i.total_amount, i.payment_mode,
              COALESCE(jc.company, 'Detailing Studio') as company
       FROM invoices i
       JOIN job_cards jc ON i.job_card_id = jc.id
       WHERE DATE(COALESCE(jc.job_date, i.created_at)) = ?`, [date]
    );

    // Section 1b: Non-GST Invoices (completed jobs without GST)
    const [nonGstInvoices] = await db.query(
      `SELECT i.invoice_no, jc.job_no, jc.reg_no, jc.car_name,
              i.subtotal, 0.00 as gst_percent, 0.00 as gst_amount, i.total_amount, i.payment_mode,
              COALESCE(jc.company, 'Detailing Studio') as company
       FROM invoices_non_gst i
       JOIN job_cards jc ON i.job_card_id = jc.id
       WHERE DATE(COALESCE(jc.job_date, i.created_at)) = ? AND i.deleted_at IS NULL`, [date]
    );

    const allInvoices = [...invoices, ...nonGstInvoices];

    // Section 2: Estimates (both job-card linked and standalone estimates)
    const [estimates] = await db.query(
      `SELECT e.estimate_no, COALESCE(jc.job_no, e.estimate_no) as job_no,
              COALESCE(jc.reg_no, e.reg_no, '') as reg_no,
              COALESCE(jc.car_name, e.car_name, '') as car_name,
              COALESCE(e.total_amount, e.subtotal) as subtotal, e.payment_mode,
              COALESCE(jc.company, e.company_name, 'Detailing Studio') as company
       FROM estimates e
       LEFT JOIN job_cards jc ON e.job_card_id = jc.id
       WHERE DATE(COALESCE(jc.job_date, e.created_at)) = ? AND e.is_archived = 0`, [date]
    );

    // Section 3: Product Sales
    const [products] = await db.query(
      `SELECT product_name, price, customer_name, payment_mode,
              'Accessories' as company
       FROM product_sales WHERE DATE(sale_date) = ?`, [date]
    );

    // Section 3b: Parts Sales
    const [partsSales] = await db.query(
      `SELECT CONCAT(p.part_name, ' (x', ps.quantity, ')') as product_name,
              ps.total_amount as price,
              ps.customer_name,
              ps.payment_mode,
              'Accessories' as company
       FROM parts_sales ps
       JOIN parts p ON ps.part_id = p.id
       WHERE DATE(ps.sale_date) = ?`, [date]
    );

    const allProducts = [...products, ...partsSales];

    // Section 4: Cash In
    const [cashIn] = await db.query(
      `SELECT category, description, amount, entry_date,
              COALESCE(company, 'General') as company
       FROM cash_ledger 
       WHERE entry_type = 'in' 
         AND category NOT LIKE 'Customer Payment%' 
         AND category NOT LIKE 'Product Sale%' 
         AND category NOT LIKE 'Spare Parts Sale%'
         AND DATE(entry_date) = ?`, [date]
    );

    // Section 5: All Cash Out Expenses
    const [cashOut] = await db.query(
      `SELECT category, description, amount, entry_date,
              COALESCE(company, 'General') as company
       FROM cash_ledger 
       WHERE entry_type = 'out' 
         AND DATE(entry_date) = ?`, [date]
    );

    // Section 6: Staff Payments from staff_payments
    const [salaries] = await db.query(
      `SELECT s.full_name, sp.payment_month, sp.paid_amount, sp.payment_mode, sp.payment_type,
              'General' as company
       FROM staff_payments sp JOIN staff s ON sp.staff_id = s.id WHERE DATE(sp.payment_date) = ?`, [date]
    );

    // Section 6b: Staff Ledger Activity
    const [staffLedgerRows] = await db.query(
      `SELECT staff_name, veh_no, description, credit_amount, debit_amount, entry_date
       FROM staff_ledger WHERE DATE(entry_date) = ?`, [date]
    );

    // Section 7: Attendance
    const [attendance] = await db.query(
      `SELECT s.full_name, a.status FROM attendance a JOIN staff s ON a.staff_id = s.id WHERE a.attendance_date = ?`, [date]
    );

    // Section 8: Customer Payments & Advance Payments Received
    const [customerPayments] = await db.query(
      `SELECT cp.amount, cp.payment_mode, cp.remarks, cp.payment_date,
              COALESCE(jc.job_no, est.estimate_no) as ref_no,
              COALESCE(jc.reg_no, est.reg_no) as reg_no,
              COALESCE(jc.owner_name, est.customer_name) as customer_name,
              COALESCE(jc.company, 'Detailing Studio') as company
       FROM customer_payments cp
       LEFT JOIN job_cards jc ON cp.job_card_id = jc.id
       LEFT JOIN estimates est ON cp.estimate_id = est.id
       WHERE cp.payment_mode != 'discount' AND DATE(cp.payment_date) = ?
       
       UNION ALL

       SELECT ap.amount, COALESCE(ap.payment_type, 'cash') as payment_mode, 'Advance Payment' as remarks, COALESCE(ap.payment_date, DATE(ap.created_at)) as payment_date,
              jc.job_no as ref_no,
              jc.reg_no as reg_no,
              jc.owner_name as customer_name,
              COALESCE(jc.company, 'Detailing Studio') as company
       FROM advance_payments ap
       JOIN job_cards jc ON ap.job_card_id = jc.id
       WHERE DATE(COALESCE(ap.payment_date, ap.created_at)) = ?`, [date, date]
    );

    // 3-Company Breakdown (Pre-filtering)
    const detailingRev = allInvoices.filter(i => i.company === 'Detailing Studio').reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)
      + estimates.filter(e => e.company === 'Detailing Studio').reduce((s, r) => s + parseFloat(r.subtotal || 0), 0);
    const carWashRev = allInvoices.filter(i => i.company === 'Car Wash').reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)
      + estimates.filter(e => e.company === 'Car Wash').reduce((s, r) => s + parseFloat(r.subtotal || 0), 0);
    const accessoriesRev = allProducts.reduce((s, r) => s + parseFloat(r.price || 0), 0);

    // Apply company filter if selected
    let filteredInvoices = allInvoices;
    let filteredEstimates = estimates;
    let filteredProducts = allProducts;
    let filteredCashIn = cashIn;
    let filteredCustomerPayments = customerPayments;

    if (company && company !== 'all') {
      filteredInvoices = allInvoices.filter(i => i.company?.toLowerCase() === company.toLowerCase());
      filteredEstimates = estimates.filter(e => e.company?.toLowerCase() === company.toLowerCase());
      filteredProducts = company.toLowerCase() === 'accessories' ? allProducts : [];
      filteredCashIn = cashIn.filter(c => c.company?.toLowerCase() === company.toLowerCase());
      filteredCustomerPayments = customerPayments.filter(cp => cp.company?.toLowerCase() === company.toLowerCase());
    }

    // Totals
    const invoiceTotal = filteredInvoices.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
    const estimateTotal = filteredEstimates.reduce((s, r) => s + parseFloat(r.subtotal || 0), 0);
    const productTotal = filteredProducts.reduce((s, r) => s + parseFloat(r.price || 0), 0);
    const cashInTotal = filteredCashIn.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const cashOutTotal = cashOut.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const salaryTotal = salaries.reduce((s, r) => s + parseFloat(r.paid_amount || 0), 0);
    const customerPaymentTotal = filteredCustomerPayments.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

    // Income = Billed Product/Parts sales + collected customer payments + other non-sale inflows
    const totalIncome = customerPaymentTotal + productTotal + cashInTotal;
    const totalExpense = cashOutTotal;

    // Calculate automatic opening balance
    const [openingBalRow] = await db.query(
      `SELECT (
        (SELECT COALESCE(SUM(amount), 0) FROM cash_ledger WHERE entry_type = 'in' AND DATE(entry_date) < ?) -
        (SELECT COALESCE(SUM(amount), 0) FROM cash_ledger WHERE entry_type = 'out' AND DATE(entry_date) < ?)
      ) as opening_balance`,
      [date, date]
    );
    const openingBalance = parseFloat(openingBalRow[0].opening_balance || 0);

    res.json({
      date,
      company,
      company_breakdown: {
        detailing_studio: detailingRev,
        car_wash: carWashRev,
        accessories: accessoriesRev,
        total: detailingRev + carWashRev + accessoriesRev
      },
      sections: {
        invoices: filteredInvoices,
        estimates: filteredEstimates,
        products: filteredProducts,
        cashIn: filteredCashIn,
        cashOut,
        salaries,
        staffLedger: staffLedgerRows,
        attendance,
        customerPayments: filteredCustomerPayments
      },
      totals: {
        invoiceTotal,
        estimateTotal,
        productTotal,
        cashInTotal,
        cashOutTotal,
        salaryTotal,
        customerPaymentTotal,
        totalIncome,
        totalExpense
      },
      opening_balance: openingBalance,
      net_balance: totalIncome - totalExpense
    });
  } catch (err) {
    console.error('GET /reports/daily error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
