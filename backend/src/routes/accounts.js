const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ───── GET /api/accounts/summary ─────
router.get('/summary', async (req, res) => {
  try {
    const from = req.query.from || new Date().toISOString().slice(0, 10);
    const to = req.query.to || from;
    const company = req.query.company || 'all';

    // 1. Calculate company-wise breakdowns (regardless of filter)
    const [detailingInv] = await db.query(
      `SELECT (
        (SELECT COALESCE(SUM(i.total_amount), 0) FROM invoices i JOIN job_cards jc ON i.job_card_id = jc.id WHERE jc.company = 'Detailing Studio' AND DATE(COALESCE(jc.job_date, i.created_at)) BETWEEN ? AND ?) +
        (SELECT COALESCE(SUM(i.total_amount), 0) FROM invoices_non_gst i JOIN job_cards jc ON i.job_card_id = jc.id WHERE jc.company = 'Detailing Studio' AND i.deleted_at IS NULL AND DATE(COALESCE(jc.job_date, i.created_at)) BETWEEN ? AND ?) +
        (SELECT COALESCE(SUM(COALESCE(e.total_amount, e.subtotal)), 0) FROM estimates e LEFT JOIN job_cards jc ON e.job_card_id = jc.id WHERE COALESCE(jc.company, e.company_name, 'Detailing Studio') = 'Detailing Studio' AND DATE(COALESCE(jc.job_date, e.created_at)) BETWEEN ? AND ? AND e.is_archived = 0)
      ) as total`,
      [from, to, from, to, from, to]
    );

    const [carWashInv] = await db.query(
      `SELECT (
        (SELECT COALESCE(SUM(i.total_amount), 0) FROM invoices i JOIN job_cards jc ON i.job_card_id = jc.id WHERE jc.company = 'Car Wash' AND DATE(COALESCE(jc.job_date, i.created_at)) BETWEEN ? AND ?) +
        (SELECT COALESCE(SUM(i.total_amount), 0) FROM invoices_non_gst i JOIN job_cards jc ON i.job_card_id = jc.id WHERE jc.company = 'Car Wash' AND i.deleted_at IS NULL AND DATE(COALESCE(jc.job_date, i.created_at)) BETWEEN ? AND ?) +
        (SELECT COALESCE(SUM(COALESCE(e.total_amount, e.subtotal)), 0) FROM estimates e LEFT JOIN job_cards jc ON e.job_card_id = jc.id WHERE COALESCE(jc.company, e.company_name, 'Detailing Studio') = 'Car Wash' AND DATE(COALESCE(jc.job_date, e.created_at)) BETWEEN ? AND ? AND e.is_archived = 0)
      ) as total`,
      [from, to, from, to, from, to]
    );

    const [accessoriesTotal] = await db.query(
      `SELECT (
        (SELECT COALESCE(SUM(price), 0) FROM product_sales WHERE DATE(sale_date) BETWEEN ? AND ?) +
        (SELECT COALESCE(SUM(total_amount), 0) FROM parts_sales WHERE DATE(sale_date) BETWEEN ? AND ?)
      ) as total`,
      [from, to, from, to]
    );

    const detailingTotalRev = parseFloat(detailingInv[0].total || 0);
    const carWashTotalRev = parseFloat(carWashInv[0].total || 0);
    const accessoriesTotalRev = parseFloat(accessoriesTotal[0].total || 0);

    // 2. Query data based on company filter
    let invoiceRevTotal = 0;
    let nonGstInvoiceRevTotal = 0;
    let estimateRevTotal = 0;
    let productRevTotal = 0;
    let partsRevTotal = 0;
    let cashInTotal = 0;

    if (company === 'Detailing Studio') {
      const [inv] = await db.query(
        "SELECT COALESCE(SUM(i.total_amount), 0) as total FROM invoices i JOIN job_cards jc ON i.job_card_id = jc.id WHERE jc.company = 'Detailing Studio' AND DATE(COALESCE(jc.job_date, i.created_at)) BETWEEN ? AND ?",
        [from, to]
      );
      const [ngst] = await db.query(
        "SELECT COALESCE(SUM(i.total_amount), 0) as total FROM invoices_non_gst i JOIN job_cards jc ON i.job_card_id = jc.id WHERE jc.company = 'Detailing Studio' AND i.deleted_at IS NULL AND DATE(COALESCE(jc.job_date, i.created_at)) BETWEEN ? AND ?",
        [from, to]
      );
      const [est] = await db.query(
        "SELECT COALESCE(SUM(COALESCE(e.total_amount, e.subtotal)), 0) as total FROM estimates e LEFT JOIN job_cards jc ON e.job_card_id = jc.id WHERE COALESCE(jc.company, e.company_name, 'Detailing Studio') = 'Detailing Studio' AND DATE(COALESCE(jc.job_date, e.created_at)) BETWEEN ? AND ? AND e.is_archived = 0",
        [from, to]
      );
      const [cin] = await db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'in' AND company = 'Detailing Studio' AND DATE(entry_date) BETWEEN ? AND ?",
        [from, to]
      );
      invoiceRevTotal = parseFloat(inv[0].total);
      nonGstInvoiceRevTotal = parseFloat(ngst[0].total);
      estimateRevTotal = parseFloat(est[0].total);
      cashInTotal = parseFloat(cin[0].total);
    } else if (company === 'Car Wash') {
      const [inv] = await db.query(
        "SELECT COALESCE(SUM(i.total_amount), 0) as total FROM invoices i JOIN job_cards jc ON i.job_card_id = jc.id WHERE jc.company = 'Car Wash' AND DATE(COALESCE(jc.job_date, i.created_at)) BETWEEN ? AND ?",
        [from, to]
      );
      const [ngst] = await db.query(
        "SELECT COALESCE(SUM(i.total_amount), 0) as total FROM invoices_non_gst i JOIN job_cards jc ON i.job_card_id = jc.id WHERE jc.company = 'Car Wash' AND i.deleted_at IS NULL AND DATE(COALESCE(jc.job_date, i.created_at)) BETWEEN ? AND ?",
        [from, to]
      );
      const [est] = await db.query(
        "SELECT COALESCE(SUM(COALESCE(e.total_amount, e.subtotal)), 0) as total FROM estimates e LEFT JOIN job_cards jc ON e.job_card_id = jc.id WHERE COALESCE(jc.company, e.company_name, 'Detailing Studio') = 'Car Wash' AND DATE(COALESCE(jc.job_date, e.created_at)) BETWEEN ? AND ? AND e.is_archived = 0",
        [from, to]
      );
      const [cin] = await db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'in' AND company = 'Car Wash' AND DATE(entry_date) BETWEEN ? AND ?",
        [from, to]
      );
      invoiceRevTotal = parseFloat(inv[0].total);
      nonGstInvoiceRevTotal = parseFloat(ngst[0].total);
      estimateRevTotal = parseFloat(est[0].total);
      cashInTotal = parseFloat(cin[0].total);
    } else if (company === 'Accessories') {
      const [prod] = await db.query(
        "SELECT COALESCE(SUM(price), 0) as total FROM product_sales WHERE DATE(sale_date) BETWEEN ? AND ?",
        [from, to]
      );
      const [parts] = await db.query(
        "SELECT COALESCE(SUM(total_amount), 0) as total FROM parts_sales WHERE DATE(sale_date) BETWEEN ? AND ?",
        [from, to]
      );
      const [cin] = await db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'in' AND (company = 'Accessories' OR category LIKE 'Product Sale%') AND DATE(entry_date) BETWEEN ? AND ?",
        [from, to]
      );
      productRevTotal = parseFloat(prod[0].total);
      partsRevTotal = parseFloat(parts[0].total);
      cashInTotal = parseFloat(cin[0].total);
    } else {
      // 'all'
      const [invoiceRev] = await db.query(
        "SELECT COALESCE(SUM(i.total_amount), 0) as total FROM invoices i LEFT JOIN job_cards jc ON i.job_card_id = jc.id WHERE DATE(COALESCE(jc.job_date, i.created_at)) BETWEEN ? AND ?",
        [from, to]
      );
      const [nonGstInvoiceRev] = await db.query(
        "SELECT COALESCE(SUM(i.total_amount), 0) as total FROM invoices_non_gst i LEFT JOIN job_cards jc ON i.job_card_id = jc.id WHERE i.deleted_at IS NULL AND DATE(COALESCE(jc.job_date, i.created_at)) BETWEEN ? AND ?",
        [from, to]
      );
      const [estimateRev] = await db.query(
        "SELECT COALESCE(SUM(COALESCE(e.total_amount, e.subtotal)), 0) as total FROM estimates e LEFT JOIN job_cards jc ON e.job_card_id = jc.id WHERE DATE(COALESCE(jc.job_date, e.created_at)) BETWEEN ? AND ? AND e.is_archived = 0",
        [from, to]
      );
      const [productRev] = await db.query(
        "SELECT COALESCE(SUM(price), 0) as total FROM product_sales WHERE DATE(sale_date) BETWEEN ? AND ?",
        [from, to]
      );
      const [partsRev] = await db.query(
        "SELECT COALESCE(SUM(total_amount), 0) as total FROM parts_sales WHERE DATE(sale_date) BETWEEN ? AND ?",
        [from, to]
      );
      const [cashIn] = await db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'in' AND category NOT LIKE 'Product Sale%' AND category NOT LIKE 'Spare Parts Sale%' AND category NOT LIKE 'Customer Payment%' AND DATE(entry_date) BETWEEN ? AND ?",
        [from, to]
      );
      invoiceRevTotal = parseFloat(invoiceRev[0].total);
      nonGstInvoiceRevTotal = parseFloat(nonGstInvoiceRev[0].total);
      estimateRevTotal = parseFloat(estimateRev[0].total);
      productRevTotal = parseFloat(productRev[0].total);
      partsRevTotal = parseFloat(partsRev[0].total);
      cashInTotal = parseFloat(cashIn[0].total);
    }

    // Staff payments
    const [staffPay] = await db.query(
      "SELECT COALESCE(SUM(paid_amount), 0) as total FROM staff_payments WHERE DATE(payment_date) BETWEEN ? AND ?",
      [from, to]
    );
    // Cash out (other)
    const [cashOut] = await db.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'out' AND category != 'Staff Salary' AND DATE(entry_date) BETWEEN ? AND ?",
      [from, to]
    );
    // Parts Purchases (restocking cost)
    const [partsPurchases] = await db.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'out' AND category = 'Spare Parts Purchase' AND DATE(entry_date) BETWEEN ? AND ?",
      [from, to]
    );
    // Other operating expenses (cash out other than parts purchase and salaries)
    const [otherExpenses] = await db.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'out' AND category NOT IN ('Spare Parts Purchase', 'Staff Salary') AND DATE(entry_date) BETWEEN ? AND ?",
      [from, to]
    );

    // Cumulative outstanding Accounts Receivable (overall up to current date filter)
    const [totalBilledOverall] = await db.query(
      `SELECT (
        (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE DATE(created_at) <= ?) +
        (SELECT COALESCE(SUM(total_amount), 0) FROM invoices_non_gst WHERE deleted_at IS NULL AND DATE(created_at) <= ?) +
        (SELECT COALESCE(SUM(total_amount), 0) FROM estimates WHERE DATE(created_at) <= ?)
      ) as total`,
      [to, to, to]
    );

    const [totalPaidOverall] = await db.query(
      `SELECT (
        (SELECT COALESCE(SUM(amount), 0) FROM customer_payments WHERE DATE(payment_date) <= ?) +
        (SELECT COALESCE(SUM(amount), 0) FROM advance_payments WHERE DATE(payment_date) <= ?)
      ) as total`,
      [to, to]
    );

    const outstandingReceivable = Math.max(0, parseFloat(totalBilledOverall[0].total) - parseFloat(totalPaidOverall[0].total));

    // Get total discounts given in the period
    const [discounts] = await db.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments WHERE payment_mode = 'discount' AND DATE(payment_date) BETWEEN ? AND ?",
      [from, to]
    );
    const totalDiscounts = parseFloat(discounts[0].total || 0);

    // Cash Ledger Inflows in the period (Actual cash collected)
    const [totalCashLedgerIn] = await db.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE entry_type = 'in' AND DATE(entry_date) BETWEEN ? AND ?",
      [from, to]
    );

    const oldIncome = {
      invoice_revenue: invoiceRevTotal,
      estimate_revenue: estimateRevTotal + nonGstInvoiceRevTotal,
      product_revenue: productRevTotal + partsRevTotal,
      cash_in_other: cashInTotal,
    };
    oldIncome.total = oldIncome.invoice_revenue + oldIncome.estimate_revenue + oldIncome.product_revenue + oldIncome.cash_in_other - totalDiscounts;

    const oldExpense = {
      staff_payments: parseFloat(staffPay[0].total),
      cash_out_other: parseFloat(cashOut[0].total),
    };
    oldExpense.total = oldExpense.staff_payments + oldExpense.cash_out_other;

    const totalAccrual = invoiceRevTotal + nonGstInvoiceRevTotal + estimateRevTotal + productRevTotal + partsRevTotal - totalDiscounts;
    const totalExpenses = parseFloat(staffPay[0].total) + parseFloat(partsPurchases[0].total) + parseFloat(otherExpenses[0].total);

    res.json({
      from,
      to,
      company,
      company_breakdown: {
        detailing_studio: detailingTotalRev,
        car_wash: carWashTotalRev,
        accessories: accessoriesTotalRev,
        total: detailingTotalRev + carWashTotalRev + accessoriesTotalRev
      },
      income: {
        ...oldIncome,
        non_gst_invoice_revenue: nonGstInvoiceRevTotal,
        estimate_revenue_only: estimateRevTotal,
        product_sales_revenue: productRevTotal,
        parts_sales_revenue: partsRevTotal,
        total_accrual: totalAccrual,
        total_cash_inflow: parseFloat(totalCashLedgerIn[0].total)
      },
      expense: {
        ...oldExpense,
        parts_purchases: parseFloat(partsPurchases[0].total),
        other_expenses: parseFloat(otherExpenses[0].total),
      },
      net_balance: oldIncome.total - oldExpense.total,
      outstanding_receivable: outstandingReceivable,
      net_profit_accrual: totalAccrual - totalExpenses,
      net_cash_flow: parseFloat(totalCashLedgerIn[0].total) - totalExpenses
    });
  } catch (err) {
    console.error('GET /accounts/summary error:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ───── GET /api/accounts/transactions ─────
router.get('/transactions', async (req, res) => {
  try {
    const from = req.query.from || new Date().toISOString().slice(0, 10);
    const to = req.query.to || from;
    const company = req.query.company || 'all';

    const [rows] = await db.query(
      `(SELECT i.created_at as date,
              CONCAT('Invoice: ', i.invoice_no, ' - ', jc.reg_no, ' (', jc.car_name, ')') COLLATE utf8mb4_general_ci as description,
              i.total_amount as amount, 'invoice' COLLATE utf8mb4_general_ci as type, i.invoice_no COLLATE utf8mb4_general_ci as reference,
              COALESCE(jc.company, 'Detailing Studio') COLLATE utf8mb4_general_ci as company
       FROM invoices i
       JOIN job_cards jc ON i.job_card_id = jc.id
       WHERE DATE(i.created_at) BETWEEN ? AND ?)
      UNION ALL
      (SELECT i.created_at as date,
              CONCAT('Invoice: ', i.invoice_no, ' - ', jc.reg_no, ' (', jc.car_name, ')') COLLATE utf8mb4_general_ci as description,
              i.total_amount as amount, 'invoice' COLLATE utf8mb4_general_ci as type, i.invoice_no COLLATE utf8mb4_general_ci as reference,
              COALESCE(jc.company, 'Detailing Studio') COLLATE utf8mb4_general_ci as company
       FROM invoices_non_gst i
       JOIN job_cards jc ON i.job_card_id = jc.id
       WHERE i.deleted_at IS NULL AND DATE(i.created_at) BETWEEN ? AND ?)
      UNION ALL
      (SELECT e.created_at as date,
              CONCAT('Invoice: ', e.estimate_no, ' - ', jc.reg_no, ' (', jc.car_name, ')') COLLATE utf8mb4_general_ci as description,
              COALESCE(e.total_amount, e.subtotal) as amount, 'estimate' COLLATE utf8mb4_general_ci as type, e.estimate_no COLLATE utf8mb4_general_ci as reference,
              COALESCE(jc.company, 'Detailing Studio') COLLATE utf8mb4_general_ci as company
       FROM estimates e
       JOIN job_cards jc ON e.job_card_id = jc.id
       WHERE DATE(e.created_at) BETWEEN ? AND ?)
      UNION ALL
      (SELECT sale_date as date, CONCAT('Product/Accessory: ', product_name) COLLATE utf8mb4_general_ci as description,
              price as amount, 'product' COLLATE utf8mb4_general_ci as type, CONCAT('#', id) COLLATE utf8mb4_general_ci as reference,
              'Accessories' COLLATE utf8mb4_general_ci as company
       FROM product_sales
       WHERE DATE(sale_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT ps.sale_date as date, CONCAT('Part Sale: ', p.part_name, ' (x', ps.quantity, ')') COLLATE utf8mb4_general_ci as description,
              ps.total_amount as amount, 'product' COLLATE utf8mb4_general_ci as type, p.part_code COLLATE utf8mb4_general_ci as reference,
              'Accessories' COLLATE utf8mb4_general_ci as company
       FROM parts_sales ps
       JOIN parts p ON ps.part_id = p.id
       WHERE DATE(ps.sale_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT entry_date as date, description COLLATE utf8mb4_general_ci as description, amount, 'cash_in' COLLATE utf8mb4_general_ci as type, category COLLATE utf8mb4_general_ci as reference,
              COALESCE(company, 'General') COLLATE utf8mb4_general_ci as company
       FROM cash_ledger WHERE entry_type = 'in' AND category NOT LIKE 'Product Sale%' AND category NOT LIKE 'Spare Parts Sale%' AND category NOT LIKE 'Customer Payment%' AND DATE(entry_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT entry_date as date, description COLLATE utf8mb4_general_ci as description, amount, 'cash_out' COLLATE utf8mb4_general_ci as type, category COLLATE utf8mb4_general_ci as reference,
              COALESCE(company, 'General') COLLATE utf8mb4_general_ci as company
       FROM cash_ledger WHERE entry_type = 'out' AND category != 'Staff Salary' AND DATE(entry_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT sp.payment_date as date, CONCAT('Salary: ', s.full_name, ' - ', sp.payment_month) COLLATE utf8mb4_general_ci as description,
              sp.paid_amount as amount, 'salary' COLLATE utf8mb4_general_ci as type, s.staff_code COLLATE utf8mb4_general_ci as reference,
              'General' COLLATE utf8mb4_general_ci as company
       FROM staff_payments sp JOIN staff s ON sp.staff_id = s.id
       WHERE DATE(sp.payment_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT cp.payment_date as date,
              CONCAT('Customer Payment: ', COALESCE(jc.job_no, est.estimate_no), ' - ', COALESCE(jc.reg_no, est.reg_no), ' (', COALESCE(jc.owner_name, est.customer_name), ')') COLLATE utf8mb4_general_ci as description,
              cp.amount, 'income' COLLATE utf8mb4_general_ci as type, cp.payment_mode COLLATE utf8mb4_general_ci as reference,
              COALESCE(jc.company, 'Detailing Studio') COLLATE utf8mb4_general_ci as company
       FROM customer_payments cp
       LEFT JOIN job_cards jc ON cp.job_card_id = jc.id
       LEFT JOIN estimates est ON cp.estimate_id = est.id
       WHERE cp.payment_mode != 'discount' AND DATE(cp.payment_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT COALESCE(ap.payment_date, DATE(ap.created_at)) as date,
              CONCAT('Advance Payment: ', jc.job_no, ' - ', jc.reg_no, ' (', jc.owner_name, ')') COLLATE utf8mb4_general_ci as description,
              ap.amount, 'income' COLLATE utf8mb4_general_ci as type, COALESCE(ap.payment_type, 'cash') COLLATE utf8mb4_general_ci as reference,
              COALESCE(jc.company, 'Detailing Studio') COLLATE utf8mb4_general_ci as company
       FROM advance_payments ap
       JOIN job_cards jc ON ap.job_card_id = jc.id
       WHERE DATE(COALESCE(ap.payment_date, ap.created_at)) BETWEEN ? AND ?)
      ORDER BY date DESC`,
      [from, to, from, to, from, to, from, to, from, to, from, to, from, to, from, to, from, to, from, to]
    );

    let filteredRows = rows;
    if (company && company !== 'all') {
      filteredRows = rows.filter(r => r.company?.toLowerCase() === company.toLowerCase());
    }

    res.json({ data: filteredRows });
  } catch (err) {
    console.error('GET /accounts/transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

const RESERVED_SYSTEM_CATEGORIES = ['Product Sale', 'Spare Parts Sale', 'Customer Payment', 'Staff Salary', 'Spare Parts Purchase'];

// ───── GET /api/accounts/categories ─────
router.get('/categories', async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS custom_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_name VARCHAR(100) NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    const [rows] = await db.query('SELECT category_name FROM custom_categories ORDER BY category_name ASC');
    const custom = rows.map(r => r.category_name);
    res.json({ custom, reserved: RESERVED_SYSTEM_CATEGORIES });
  } catch (err) {
    console.error('GET /accounts/categories error:', err);
    res.json({ custom: ['Service Fee', 'Vendor Payment', 'Utility Bills'], reserved: RESERVED_SYSTEM_CATEGORIES });
  }
});

// ───── POST /api/accounts/categories ─────
router.post('/categories', async (req, res) => {
  try {
    const { category_name } = req.body;
    if (!category_name || !category_name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const trimmed = category_name.trim();
    if (RESERVED_SYSTEM_CATEGORIES.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
      return res.status(400).json({ error: `"${trimmed}" is a reserved system category name.` });
    }

    await db.execute(
      'INSERT INTO custom_categories (category_name) VALUES (?) ON DUPLICATE KEY UPDATE category_name = VALUES(category_name)',
      [trimmed]
    );

    res.json({ message: 'Category saved successfully', category_name: trimmed });
  } catch (err) {
    console.error('POST /accounts/categories error:', err);
    res.status(500).json({ error: 'Failed to save category' });
  }
});

// ───── POST /api/accounts/cash-ledger ─────
router.post('/cash-ledger', async (req, res) => {
  try {
    const { entry_type, amount, category, description, entry_date, payment_mode, company } = req.body;

    if (!entry_type || !['in', 'out'].includes(entry_type)) {
      return res.status(400).json({ error: 'Entry type must be "in" or "out"' });
    }
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const desc = payment_mode && payment_mode !== 'cash' 
      ? `[${payment_mode.toUpperCase()}] ${description.trim()}`
      : description.trim();

    let formattedDate = entry_date;
    if (!formattedDate) {
      formattedDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    } else if (formattedDate.length === 10) {
      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 8);
      formattedDate = `${formattedDate} ${timeStr}`;
    }

    const [result] = await db.execute(
      `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entry_type, parseFloat(amount), category || 'Other', desc, formattedDate, company || 'General']
    );

    res.status(201).json({ id: result.insertId, message: 'Cash entry recorded successfully' });
  } catch (err) {
    console.error('POST /accounts/cash-ledger error:', err);
    res.status(500).json({ error: 'Failed to record cash entry' });
  }
});

module.exports = router;
