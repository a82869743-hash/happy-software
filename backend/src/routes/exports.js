const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');
const { createExcelResponse } = require('../utils/excel');

const router = express.Router();
router.use(auth);

// ----- GET /api/exports/job-cards -----
router.get('/job-cards', async (req, res) => {
  try {
    const from = req.query.from || '2020-01-01';
    const to = req.query.to || '2099-12-31';
    const [rows] = await db.query(
      `SELECT 
          jc.job_no as 'Job No',
          IF(jc.is_quick_job = 1, 'Quick', 'Standard') as 'Type',
          jc.job_date as 'Job Date',
          jc.status as 'Status',
          jc.reg_no as 'Reg No',
          jc.car_name as 'Car Name',
          COALESCE(v.make, jc.vehicle_make, '') as 'Make',
          COALESCE(v.model, jc.vehicle_model, '') as 'Model',
          COALESCE(v.variant, '') as 'Variant',
          COALESCE(v.year, '') as 'Year',
          COALESCE(v.vehicle_color, '') as 'Color',
          COALESCE(v.fuel_type, '') as 'Fuel Type',
          COALESCE(jc.odometer, 0) as 'Odometer (KM)',
          COALESCE(v.vin, '') as 'VIN / Chassis No',
          COALESCE(jc.owner_name, c.customer_name, '') as 'Customer Name',
          COALESCE(jc.mobile_no, c.mobile_no, '') as 'Customer Mobile',
          COALESCE(c.email, '') as 'Customer Email',
          COALESCE(c.address_line, '') as 'Address',
          COALESCE(c.city, '') as 'City',
          COALESCE(c.state, '') as 'State',
          COALESCE(c.pincode, '') as 'Pincode',
          COALESCE(c.gstin, '') as 'Customer GSTIN',
          COALESCE(jc.service_advisor, '') as 'Service Advisor',
          COALESCE(s.full_name, '') as 'Assigned Staff',
          COALESCE(jc.service_type, '') as 'Service Type',
          COALESCE(jc.job_category, '') as 'Job Category',
          COALESCE(jc.insurance_company, '') as 'Insurance Company',
          COALESCE(jc.insurance_claim_no, jc.claim_no, '') as 'Claim No',
          (SELECT GROUP_CONCAT(CONCAT('[', UPPER(item_type), '] ', service_name, ' (x', qty, ' @₹', rate, ')') SEPARATOR '; ') 
           FROM job_card_services WHERE job_card_id = jc.id) as 'Line Items Summary',
          COALESCE((SELECT SUM(amount) FROM job_card_services WHERE job_card_id = jc.id AND (item_type = 'part' OR item_type = 'spare' OR item_type = 'consumable')), 0.00) as 'Parts Subtotal ₹',
          COALESCE((SELECT SUM(amount) FROM job_card_services WHERE job_card_id = jc.id AND item_type = 'labour'), 0.00) as 'Labour Subtotal ₹',
          COALESCE((SELECT SUM(amount) FROM job_card_services WHERE job_card_id = jc.id), 0.00) as 'Subtotal Before Tax ₹',
          COALESCE((SELECT SUM(tax_amount) FROM job_card_services WHERE job_card_id = jc.id), 0.00) as 'GST Amount ₹',
          0.00 as 'Discount Amount ₹',
          COALESCE(jc.final_amount, (SELECT SUM(amount + tax_amount) FROM job_card_services WHERE job_card_id = jc.id), 0.00) as 'Grand Total ₹',
          COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp WHERE cp.job_card_id = jc.id AND cp.payment_mode != 'discount'), 0.00) as 'Paid Amount ₹',
          COALESCE(jc.final_amount - (SELECT COALESCE(SUM(cp.amount), 0) FROM customer_payments cp WHERE cp.job_card_id = jc.id AND cp.payment_mode != 'discount'), 0.00) as 'Outstanding Balance ₹',
          IF(COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp WHERE cp.job_card_id = jc.id AND cp.payment_mode != 'discount'), 0) >= COALESCE(jc.final_amount, 0) AND jc.final_amount > 0, 'Paid', IF(COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp WHERE cp.job_card_id = jc.id AND cp.payment_mode != 'discount'), 0) > 0, 'Partial', 'Pending')) as 'Payment Status',
          COALESCE(jc.payment_mode, '') as 'Payment Mode',
          jc.created_at as 'Created At',
          jc.closed_at as 'Closed At'
       FROM job_cards jc
       LEFT JOIN staff s ON jc.assigned_staff_id = s.id
       LEFT JOIN customers c ON jc.customer_id = c.id
       LEFT JOIN vehicles v ON jc.vehicle_id = v.id
       WHERE DATE(jc.job_date) BETWEEN ? AND ? AND jc.is_deleted = 0
       ORDER BY jc.job_date DESC`,
      [from, to]
    );
    createExcelResponse(res, `HAPPYGMS_JobCards_Full_Registry.xlsx`, [
      { sheetName: 'Job Registry Detailed', data: rows.length ? rows : [{ 'No Data': 'No job cards in range' }] }
    ]);
  } catch (err) {
    console.error('GET /exports/job-cards error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ----- GET /api/exports/staff-attendance -----
router.get('/staff-attendance', async (req, res) => {
  try {
    const month = req.query.month || (new Date().getMonth() + 1);
    const year = req.query.year || new Date().getFullYear();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);

    const [staffRows] = await db.query(
      `SELECT staff_code as 'Staff Code', full_name as 'Name', role as 'Role',
              mobile_no as 'Mobile', date_of_joining as 'Joining Date',
              monthly_salary as 'Salary', IF(is_active, 'Active', 'Inactive') as 'Status'
       FROM staff ORDER BY staff_code`
    );

    const [attRows] = await db.query(
      `SELECT s.full_name as 'Staff', a.attendance_date as 'Date', a.status as 'Status'
       FROM attendance a JOIN staff s ON a.staff_id = s.id
       WHERE a.attendance_date BETWEEN ? AND ?
       ORDER BY s.full_name, a.attendance_date`,
      [startDate, endDate]
    );

    createExcelResponse(res, `HAPPYGMS_StaffAttendance.xlsx`, [
      { sheetName: 'Staff Master', data: staffRows.length ? staffRows : [{ 'No Data': 'No staff' }] },
      { sheetName: 'Attendance', data: attRows.length ? attRows : [{ 'No Data': 'No attendance' }] }
    ]);
  } catch (err) {
    console.error('GET /exports/staff-attendance error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ----- GET /api/exports/parts-inventory -----
router.get('/parts-inventory', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT part_code as 'Part Code', part_name as 'Name', category as 'Category',
              unit as 'Unit', buying_price as 'Buy Price', selling_price as 'Sell Price',
              stock_qty as 'Stock Qty', low_stock_alert as 'Low Stock Alert'
       FROM parts ORDER BY part_code`
    );
    createExcelResponse(res, `HAPPYGMS_PartsInventory.xlsx`, [
      { sheetName: 'Parts', data: rows.length ? rows : [{ 'No Data': 'No parts' }] }
    ]);
  } catch (err) {
    console.error('GET /exports/parts-inventory error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ----- GET /api/exports/accounts -----
router.get('/accounts', async (req, res) => {
  try {
    const from = req.query.from || new Date().toISOString().slice(0, 10);
    const to = req.query.to || from;

    const [rows] = await db.query(
      `(SELECT DATE(closed_at) as 'Date', 'Job Revenue' COLLATE utf8mb4_general_ci as 'Type',
              CONCAT(job_no, ' - ', reg_no) COLLATE utf8mb4_general_ci as 'Description',
              final_amount as 'Amount', job_no COLLATE utf8mb4_general_ci as 'Reference'
       FROM job_cards WHERE status = 'done' AND DATE(closed_at) BETWEEN ? AND ?)
      UNION ALL
      (SELECT DATE(ps.sale_date), 'Parts Sale' COLLATE utf8mb4_general_ci,
              CONCAT(p.part_name, ' x', ps.quantity) COLLATE utf8mb4_general_ci,
              ps.total_amount, p.part_code COLLATE utf8mb4_general_ci
       FROM parts_sales ps JOIN parts p ON ps.part_id = p.id WHERE DATE(ps.sale_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT DATE(entry_date), 'Cash In' COLLATE utf8mb4_general_ci,
              description COLLATE utf8mb4_general_ci, amount,
              category COLLATE utf8mb4_general_ci
       FROM cash_ledger WHERE entry_type = 'in' AND category NOT IN ('Product Sale', 'Spare Parts Sale', 'Customer Payment') AND DATE(entry_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT DATE(entry_date), 'Cash Out' COLLATE utf8mb4_general_ci,
              description COLLATE utf8mb4_general_ci, amount,
              category COLLATE utf8mb4_general_ci
       FROM cash_ledger WHERE entry_type = 'out' AND category != 'Staff Salary' AND DATE(entry_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT DATE(sp.payment_date), 'Staff Payment' COLLATE utf8mb4_general_ci,
              CONCAT(s.full_name, ' - ', sp.payment_month) COLLATE utf8mb4_general_ci,
              sp.paid_amount, s.staff_code COLLATE utf8mb4_general_ci
       FROM staff_payments sp JOIN staff s ON sp.staff_id = s.id WHERE DATE(sp.payment_date) BETWEEN ? AND ?)
      UNION ALL
      (SELECT DATE(cp.payment_date), 'Customer Payment' COLLATE utf8mb4_general_ci,
              CONCAT(COALESCE(jc.job_no, est.estimate_no), ' - ', COALESCE(jc.reg_no, est.reg_no), ' (', COALESCE(jc.owner_name, est.customer_name), ')') COLLATE utf8mb4_general_ci,
              cp.amount, cp.payment_mode COLLATE utf8mb4_general_ci
       FROM customer_payments cp
       LEFT JOIN job_cards jc ON cp.job_card_id = jc.id
       LEFT JOIN estimates est ON cp.estimate_id = est.id
       WHERE DATE(cp.payment_date) BETWEEN ? AND ?)
      ORDER BY 1 DESC`,
      [from, to, from, to, from, to, from, to, from, to, from, to]
    );

    createExcelResponse(res, `HAPPYGMS_Accounts.xlsx`, [
      { sheetName: 'Transactions', data: rows.length ? rows : [{ 'No Data': 'No transactions' }] }
    ]);
  } catch (err) {
    console.error('GET /exports/accounts error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ----- GET /api/exports/daily-report -----
router.get('/daily-report', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const displayDate = date.split('-').reverse().join('-'); // '2026-07-10' -> '10-07-2026'

    // 1. Cash Inflows (mode = 'cash')
    const [custCashIn] = await db.query(
      `SELECT cp.amount, 'CASH' as payment_mode, 
              CONCAT(COALESCE(jc.reg_no, est.reg_no, ''), ' - ', COALESCE(jc.owner_name, est.customer_name, ''), ' (', COALESCE(jc.job_no, est.estimate_no, ''), ')') as description
       FROM customer_payments cp
       LEFT JOIN job_cards jc ON cp.job_card_id = jc.id
       LEFT JOIN estimates est ON cp.estimate_id = est.id
       WHERE cp.payment_mode = 'cash' AND DATE(cp.payment_date) = ?`,
      [date]
    );

    const [advCashIn] = await db.query(
      `SELECT ap.amount, 'CASH' as payment_mode,
              CONCAT(jc.reg_no, ' - ', jc.owner_name, ' (Job Card Advance ', jc.job_no, ')') as description
       FROM advance_payments ap
       JOIN job_cards jc ON ap.job_card_id = jc.id
       WHERE ap.payment_type = 'cash' AND DATE(ap.payment_date) = ?`,
      [date]
    );

    const [prodCashIn] = await db.query(
      `SELECT ps.price as amount, 'CASH' as payment_mode,
              CONCAT('Product Sale: ', ps.product_name, ' - ', ps.customer_name) as description
       FROM product_sales ps
       WHERE ps.payment_mode = 'cash' AND DATE(ps.sale_date) = ?`,
      [date]
    );

    const [partCashIn] = await db.query(
      `SELECT ps.total_amount as amount, 'CASH' as payment_mode,
              CONCAT('Parts Counter Sale: ', p.part_name, ' - ', ps.customer_name) as description
       FROM parts_sales ps
       JOIN parts p ON ps.part_id = p.id
       WHERE ps.payment_mode = 'cash' AND DATE(ps.sale_date) = ?`,
      [date]
    );

    const [ledgerCashIn] = await db.query(
      `SELECT cl.amount, 'CASH' as payment_mode, cl.description
       FROM cash_ledger cl
       WHERE cl.entry_type = 'in'
         AND cl.category NOT IN ('Customer Payment', 'Product Sale', 'Spare Parts Sale')
         AND DATE(cl.entry_date) = ?`,
      [date]
    );

    const cashInflows = [
      ...custCashIn,
      ...advCashIn,
      ...prodCashIn,
      ...partCashIn,
      ...ledgerCashIn
    ];

    // 2. Card / cashless inflows (mode != 'cash' and != 'discount')
    const [custCardIn] = await db.query(
      `SELECT cp.amount, UPPER(cp.payment_mode) as payment_mode, 
              CONCAT(COALESCE(jc.reg_no, est.reg_no, ''), ' - ', COALESCE(jc.owner_name, est.customer_name, ''), ' (', COALESCE(jc.job_no, est.estimate_no, ''), ')') as description
       FROM customer_payments cp
       LEFT JOIN job_cards jc ON cp.job_card_id = jc.id
       LEFT JOIN estimates est ON cp.estimate_id = est.id
       WHERE cp.payment_mode != 'cash' AND cp.payment_mode != 'discount' AND DATE(cp.payment_date) = ?`,
      [date]
    );

    const [advCardIn] = await db.query(
      `SELECT ap.amount, UPPER(ap.payment_type) as payment_mode,
              CONCAT(jc.reg_no, ' - ', jc.owner_name, ' (Job Card Advance ', jc.job_no, ')') as description
       FROM advance_payments ap
       JOIN job_cards jc ON ap.job_card_id = jc.id
       WHERE ap.payment_type != 'cash' AND DATE(ap.payment_date) = ?`,
      [date]
    );

    const [prodCardIn] = await db.query(
      `SELECT ps.price as amount, UPPER(ps.payment_mode) as payment_mode,
              CONCAT('Product Sale: ', ps.product_name, ' - ', ps.customer_name) as description
       FROM product_sales ps
       WHERE ps.payment_mode != 'cash' AND DATE(ps.sale_date) = ?`,
      [date]
    );

    const [partCardIn] = await db.query(
      `SELECT ps.total_amount as amount, UPPER(ps.payment_mode) as payment_mode,
              CONCAT('Parts Counter Sale: ', p.part_name, ' - ', ps.customer_name) as description
       FROM parts_sales ps
       JOIN parts p ON ps.part_id = p.id
       WHERE ps.payment_mode != 'cash' AND DATE(ps.sale_date) = ?`,
      [date]
    );

    const cashlessInflows = [
      ...custCardIn,
      ...advCardIn,
      ...prodCardIn,
      ...partCardIn
    ];

    // 3. Cash Expenses/Deposit (outflows paid in cash)
    const [salaryCashOut] = await db.query(
      `SELECT sp.paid_amount as amount, 'CASH' as payment_mode,
              CONCAT('Salary: ', s.full_name, ' for ', sp.payment_month) as description,
              s.full_name as person_name
       FROM staff_payments sp
       JOIN staff s ON sp.staff_id = s.id
       WHERE sp.payment_mode = 'cash' AND DATE(sp.payment_date) = ?`,
      [date]
    );

    const [ledgerCashOut] = await db.query(
      `SELECT cl.amount, 'CASH' as payment_mode, cl.description, '—' as person_name
       FROM cash_ledger cl
       WHERE cl.entry_type = 'out'
         AND cl.category != 'Staff Salary'
         AND DATE(cl.entry_date) = ?`,
      [date]
    );

    const cashOutflows = [
      ...salaryCashOut,
      ...ledgerCashOut
    ];

    // 4. Online Outflows (paid online)
    const [salaryOnlineOut] = await db.query(
      `SELECT sp.paid_amount as amount, UPPER(sp.payment_mode) as payment_mode,
              CONCAT('Salary: ', s.full_name, ' for ', sp.payment_month) as description,
              s.full_name as person_name
       FROM staff_payments sp
       JOIN staff s ON sp.staff_id = s.id
       WHERE sp.payment_mode != 'cash' AND DATE(sp.payment_date) = ?`,
      [date]
    );

    const onlineOutflows = [
      ...salaryOnlineOut
    ];

    // 5. Automatic Opening Balance (inflows before qDate minus outflows before qDate)
    const [openingBalRow] = await db.query(
      `SELECT (
        (SELECT COALESCE(SUM(amount), 0) FROM cash_ledger WHERE entry_type = 'in' AND DATE(entry_date) < ?) -
        (SELECT COALESCE(SUM(amount), 0) FROM cash_ledger WHERE entry_type = 'out' AND DATE(entry_date) < ?)
      ) as opening_balance`,
      [date, date]
    );
    const openingBalance = parseFloat(openingBalRow[0].opening_balance || 0);

    // Build side-by-side ExcelJS Worksheet
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Daily Closing', {
      views: [{ showGridLines: true }]
    });

    // Set Column Widths
    ws.columns = [
      { key: 'A', width: 14 }, // Amount
      { key: 'B', width: 16 }, // Payment mode
      { key: 'C', width: 36 }, // Description
      { key: 'D', width: 4 },  // Spacer
      { key: 'E', width: 14 }, // Amount
      { key: 'F', width: 16 }, // Payment mode
      { key: 'G', width: 32 }, // Description
      { key: 'H', width: 20 }, // Person Name
      { key: 'I', width: 4 },  // Spacer
      { key: 'J', width: 24 }, // Denom / Metric Title
      { key: 'K', width: 14 }, // Count / Value
      { key: 'L', width: 16 }  // Value
    ];

    // Styling Helpers
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    const fills = {
      blueHeader: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } },
      orangeHeader: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE46C0A' } },
      darkHeader: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF343D46' } },
      subHeader: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } },
      blueTotal: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } },
      orangeTotal: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCD5B4' } },
      amberTotal: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } },
      skyTotal: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } },
      slateLight: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
    };

    const fontWhiteBold = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    const fontSubHeader = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF334155' } };
    const fontRegular = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
    const fontBold = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };

    function styleCell(cell, opts = {}) {
      if (opts.fill) cell.fill = opts.fill;
      if (opts.font) cell.font = opts.font;
      if (opts.alignment) cell.alignment = opts.alignment;
      if (opts.border) cell.border = opts.border;
      if (opts.numFmt) cell.numFmt = opts.numFmt;
    }

    // ROW 1: Titles
    const r1 = ws.getRow(1);
    r1.height = 26;
    r1.getCell(1).value = "Date :";
    styleCell(r1.getCell(1), { font: fontBold, alignment: { vertical: 'middle', horizontal: 'right' } });
    r1.getCell(2).value = displayDate;
    styleCell(r1.getCell(2), { font: fontBold, alignment: { vertical: 'middle', horizontal: 'left' } });

    r1.getCell(3).value = "Today Credit Cash";
    styleCell(r1.getCell(3), { fill: fills.blueHeader, font: fontWhiteBold, alignment: { vertical: 'middle', horizontal: 'center' } });

    ws.mergeCells('E1:H1');
    const e1 = r1.getCell(5);
    e1.value = "Today Expances and Cash Deposit";
    styleCell(e1, { fill: fills.blueHeader, font: fontWhiteBold, alignment: { vertical: 'middle', horizontal: 'center' } });

    ws.mergeCells('J1:L1');
    const j1 = r1.getCell(10);
    j1.value = "Denominations";
    styleCell(j1, { fill: fills.darkHeader, font: fontWhiteBold, alignment: { vertical: 'middle', horizontal: 'center' } });

    // ROW 2: Column Headers
    const r2 = ws.getRow(2);
    r2.height = 20;
    const colHeaders = [
      { col: 1, val: 'Amount', align: 'right' },
      { col: 2, val: 'Payment mode', align: 'center' },
      { col: 3, val: 'Description', align: 'left' },
      { col: 5, val: 'Amount', align: 'right' },
      { col: 6, val: 'Payment mode', align: 'center' },
      { col: 7, val: 'Description', align: 'left' },
      { col: 8, val: 'Person Name', align: 'left' },
      { col: 10, val: 'Note', align: 'center' },
      { col: 11, val: 'Count', align: 'center' },
      { col: 12, val: 'Value', align: 'right' }
    ];
    colHeaders.forEach(h => {
      const cell = r2.getCell(h.col);
      cell.value = h.val;
      styleCell(cell, { fill: fills.subHeader, font: fontSubHeader, border: thinBorder, alignment: { vertical: 'middle', horizontal: h.align } });
    });

    // Populate Left Block (Credit Cash - 10 rows: Rows 3 to 12)
    for (let i = 0; i < 10; i++) {
      const rIdx = 3 + i;
      const row = ws.getRow(rIdx);
      row.height = 20;
      const item = cashInflows[i] || { amount: 0, payment_mode: '—', description: '—' };
      
      const c1 = row.getCell(1);
      c1.value = parseFloat(item.amount || 0);
      styleCell(c1, { font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '#,##0' });

      const c2 = row.getCell(2);
      c2.value = item.payment_mode || '—';
      styleCell(c2, { font: fontRegular, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'center' } });

      const c3 = row.getCell(3);
      c3.value = item.description || '—';
      styleCell(c3, { font: fontRegular, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });
    }

    // Row 13 Left: Total Credit Cash
    const r13 = ws.getRow(13);
    r13.height = 22;
    const c13_1 = r13.getCell(1);
    c13_1.value = { formula: 'SUM(A3:A12)' };
    styleCell(c13_1, { fill: fills.blueTotal, font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '#,##0' });

    const c13_2 = r13.getCell(2);
    c13_2.value = '';
    styleCell(c13_2, { fill: fills.blueTotal, border: thinBorder });

    const c13_3 = r13.getCell(3);
    c13_3.value = 'TOTAL';
    styleCell(c13_3, { fill: fills.blueTotal, font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });

    // Row 14 Left: Card Swipe Section Header
    const r14 = ws.getRow(14);
    r14.height = 24;
    ws.mergeCells('A14:C14');
    const a14 = r14.getCell(1);
    a14.value = 'Today Card Swipe / G-pay / PhonePe';
    styleCell(a14, { fill: fills.orangeHeader, font: fontWhiteBold, alignment: { vertical: 'middle', horizontal: 'center' } });

    // Row 15 Left: Card Swipe Table Headers
    const r15 = ws.getRow(15);
    r15.height = 20;
    const cardHeaders = [
      { col: 1, val: 'Amount', align: 'right' },
      { col: 2, val: 'Payment mode', align: 'center' },
      { col: 3, val: 'Description', align: 'left' }
    ];
    cardHeaders.forEach(h => {
      const cell = r15.getCell(h.col);
      cell.value = h.val;
      styleCell(cell, { fill: fills.subHeader, font: fontSubHeader, border: thinBorder, alignment: { vertical: 'middle', horizontal: h.align } });
    });

    // Rows 16 to 25 Left: Card Swipe Data (10 rows)
    for (let i = 0; i < 10; i++) {
      const rIdx = 16 + i;
      const row = ws.getRow(rIdx);
      row.height = 20;
      const item = cashlessInflows[i] || { amount: 0, payment_mode: '—', description: '—' };

      const c1 = row.getCell(1);
      c1.value = parseFloat(item.amount || 0);
      styleCell(c1, { font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '#,##0' });

      const c2 = row.getCell(2);
      c2.value = item.payment_mode || '—';
      styleCell(c2, { font: fontRegular, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'center' } });

      const c3 = row.getCell(3);
      c3.value = item.description || '—';
      styleCell(c3, { font: fontRegular, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });
    }

    // Row 26 Left: Card Swipe Total
    const r26 = ws.getRow(26);
    r26.height = 22;
    const c26_1 = r26.getCell(1);
    c26_1.value = { formula: 'SUM(A16:A25)' };
    styleCell(c26_1, { fill: fills.orangeTotal, font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '#,##0' });

    const c26_2 = r26.getCell(2);
    c26_2.value = '';
    styleCell(c26_2, { fill: fills.orangeTotal, border: thinBorder });

    const c26_3 = r26.getCell(3);
    c26_3.value = 'TOTAL';
    styleCell(c26_3, { fill: fills.orangeTotal, font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });

    // Populate Middle Block (Expenses - 15 rows: Rows 3 to 17)
    for (let i = 0; i < 15; i++) {
      const rIdx = 3 + i;
      const row = ws.getRow(rIdx);
      const item = cashOutflows[i] || { amount: 0, payment_mode: '—', description: '—', person_name: '—' };

      const c5 = row.getCell(5);
      c5.value = parseFloat(item.amount || 0);
      styleCell(c5, { font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '#,##0' });

      const c6 = row.getCell(6);
      c6.value = item.payment_mode || '—';
      styleCell(c6, { font: fontRegular, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'center' } });

      const c7 = row.getCell(7);
      c7.value = item.description || '—';
      styleCell(c7, { font: fontRegular, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });

      const c8 = row.getCell(8);
      c8.value = item.person_name || '—';
      styleCell(c8, { font: fontRegular, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });
    }

    // Row 18 Middle: Expenses Total
    const r18 = ws.getRow(18);
    r18.height = 22;
    const c18_5 = r18.getCell(5);
    c18_5.value = { formula: 'SUM(E3:E17)' };
    styleCell(c18_5, { fill: fills.blueTotal, font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '#,##0' });

    const c18_6 = r18.getCell(6);
    c18_6.value = '';
    styleCell(c18_6, { fill: fills.blueTotal, border: thinBorder });

    const c18_7 = r18.getCell(7);
    c18_7.value = 'TOTAL';
    styleCell(c18_7, { fill: fills.blueTotal, font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });

    const c18_8 = r18.getCell(8);
    c18_8.value = '';
    styleCell(c18_8, { fill: fills.blueTotal, border: thinBorder });

    // Row 19 Middle: Today Online Payment Section Header
    const r19 = ws.getRow(19);
    r19.height = 24;
    ws.mergeCells('E19:H19');
    const e19 = r19.getCell(5);
    e19.value = 'Today Online Payment';
    styleCell(e19, { fill: fills.orangeHeader, font: fontWhiteBold, alignment: { vertical: 'middle', horizontal: 'center' } });

    // Row 20 Middle: Online Payment Table Headers
    const r20 = ws.getRow(20);
    r20.height = 20;
    const onlineHeaders = [
      { col: 5, val: 'Amount', align: 'right' },
      { col: 6, val: 'Payment mode', align: 'center' },
      { col: 7, val: 'Description', align: 'left' },
      { col: 8, val: 'Person Name', align: 'left' }
    ];
    onlineHeaders.forEach(h => {
      const cell = r20.getCell(h.col);
      cell.value = h.val;
      styleCell(cell, { fill: fills.subHeader, font: fontSubHeader, border: thinBorder, alignment: { vertical: 'middle', horizontal: h.align } });
    });

    // Rows 21 to 30 Middle: Online Expenses Data (10 rows)
    for (let i = 0; i < 10; i++) {
      const rIdx = 21 + i;
      const row = ws.getRow(rIdx);
      row.height = 20;
      const item = onlineOutflows[i] || { amount: 0, payment_mode: '—', description: '—', person_name: '—' };

      const c5 = row.getCell(5);
      c5.value = parseFloat(item.amount || 0);
      styleCell(c5, { font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '#,##0' });

      const c6 = row.getCell(6);
      c6.value = item.payment_mode || '—';
      styleCell(c6, { font: fontRegular, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'center' } });

      const c7 = row.getCell(7);
      c7.value = item.description || '—';
      styleCell(c7, { font: fontRegular, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });

      const c8 = row.getCell(8);
      c8.value = item.person_name || '—';
      styleCell(c8, { font: fontRegular, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });
    }

    // Row 31 Middle: Online Expenses Total
    const r31 = ws.getRow(31);
    r31.height = 22;
    const c31_5 = r31.getCell(5);
    c31_5.value = { formula: 'SUM(E21:E30)' };
    styleCell(c31_5, { fill: fills.orangeTotal, font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '#,##0' });

    const c31_6 = r31.getCell(6);
    c31_6.value = '';
    styleCell(c31_6, { fill: fills.orangeTotal, border: thinBorder });

    const c31_7 = r31.getCell(7);
    c31_7.value = 'TOTAL';
    styleCell(c31_7, { fill: fills.orangeTotal, font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });

    const c31_8 = r31.getCell(8);
    c31_8.value = '';
    styleCell(c31_8, { fill: fills.orangeTotal, border: thinBorder });

    // Populate Right Block (Denominations: Rows 3 to 9)
    const denoms = [500, 200, 100, 50, 20, 10, 5];
    denoms.forEach((denom, idx) => {
      const rIdx = 3 + idx;
      const row = ws.getRow(rIdx);

      const c10 = row.getCell(10);
      c10.value = denom;
      styleCell(c10, { font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'center' } });

      const c11 = row.getCell(11);
      c11.value = 0;
      styleCell(c11, { font: fontRegular, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'center' } });

      const c12 = row.getCell(12);
      c12.value = { formula: `J${rIdx}*K${rIdx}` };
      styleCell(c12, { font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '#,##0' });
    });

    // Row 10 Right: Denomination Total
    const r10 = ws.getRow(10);
    r10.height = 22;
    const c10_10 = r10.getCell(10);
    c10_10.value = 'TOTAL';
    styleCell(c10_10, { fill: fills.subHeader, font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'center' } });

    const c10_11 = r10.getCell(11);
    c10_11.value = { formula: 'SUM(K3:K9)' };
    styleCell(c10_11, { fill: fills.subHeader, font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'center' } });

    const c10_12 = r10.getCell(12);
    c10_12.value = { formula: 'SUM(L3:L9)' };
    styleCell(c10_12, { fill: fills.subHeader, font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '"₹"#,##0' });

    // Populate Right Block (Financial Summary: Rows 13 to 17)
    // Row 13 Right: OPENING BALANCE
    ws.mergeCells('K13:L13');
    const c13_10 = r13.getCell(10);
    c13_10.value = 'OPENING BALANCE';
    styleCell(c13_10, { fill: fills.slateLight, font: fontSubHeader, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });

    const c13_11 = r13.getCell(11);
    c13_11.value = openingBalance;
    styleCell(c13_11, { font: fontBold, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '"₹"#,##0' });
    styleCell(r13.getCell(12), { border: thinBorder });

    // Row 14 Right: CREDIT CASH
    ws.mergeCells('K14:L14');
    const c14_10 = r14.getCell(10);
    c14_10.value = 'CREDIT CASH';
    styleCell(c14_10, { fill: fills.slateLight, font: fontSubHeader, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });

    const c14_11 = r14.getCell(11);
    c14_11.value = { formula: 'A13' };
    styleCell(c14_11, { font: { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF166534' } }, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '"₹"#,##0' });
    styleCell(r14.getCell(12), { border: thinBorder });

    // Row 15 Right: TOTAL CREDIT CASH
    const r15_summary = ws.getRow(15);
    ws.mergeCells('K15:L15');
    const c15_10 = r15_summary.getCell(10);
    c15_10.value = 'TOTAL CREDIT CASH';
    styleCell(c15_10, { fill: fills.amberTotal, font: { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF78350F' } }, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });

    const c15_11 = r15_summary.getCell(11);
    c15_11.value = { formula: 'K13+K14' };
    styleCell(c15_11, { fill: fills.amberTotal, font: { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFB45309' } }, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '"₹"#,##0' });
    styleCell(r15_summary.getCell(12), { border: thinBorder });

    // Row 16 Right: EXPANCES
    const r16_summary = ws.getRow(16);
    ws.mergeCells('K16:L16');
    const c16_10 = r16_summary.getCell(10);
    c16_10.value = 'EXPANCES';
    styleCell(c16_10, { fill: fills.slateLight, font: fontSubHeader, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });

    const c16_11 = r16_summary.getCell(11);
    c16_11.value = { formula: 'E18' };
    styleCell(c16_11, { font: { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFDC2626' } }, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '"₹"#,##0' });
    styleCell(r16_summary.getCell(12), { border: thinBorder });

    // Row 17 Right: TODAY TOTAL CASH
    const r17_summary = ws.getRow(17);
    ws.mergeCells('K17:L17');
    const c17_10 = r17_summary.getCell(10);
    c17_10.value = 'TODAY TOTAL CASH';
    styleCell(c17_10, { fill: fills.skyTotal, font: { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF075985' } }, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'left' } });

    const c17_11 = r17_summary.getCell(11);
    c17_11.value = { formula: 'K15-K16' };
    styleCell(c17_11, { fill: fills.skyTotal, font: { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0284C7' } }, border: thinBorder, alignment: { vertical: 'middle', horizontal: 'right' }, numFmt: '"₹"#,##0' });
    styleCell(r17_summary.getCell(12), { border: thinBorder });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="HAPPYGMS_DailyReport_${date}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('GET /exports/daily-report error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ----- GET /api/exports/sql-backup -----
router.get('/sql-backup', async (req, res) => {
  try {
    const [tables] = await db.query('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);

    let sqlOutput = `-- ===============================================================\n`;
    sqlOutput += `-- HAPPY CAR WASH GMS — FULL DATABASE BACKUP DUMP\n`;
    sqlOutput += `-- Date: ${new Date().toISOString()}\n`;
    sqlOutput += `-- ===============================================================\n\n`;
    sqlOutput += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    for (const table of tableNames) {
      sqlOutput += `-- ------------------------------------------------------\n`;
      sqlOutput += `-- Table structure for table \`${table}\`\n`;
      sqlOutput += `-- ------------------------------------------------------\n`;
      sqlOutput += `DROP TABLE IF EXISTS \`${table}\`;\n`;

      const [createTable] = await db.query(`SHOW CREATE TABLE \`${table}\``);
      let createSQL = createTable[0]['Create Table'];
      createSQL = createSQL.replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_general_ci');
      sqlOutput += `${createSQL};\n\n`;

      const [rows] = await db.query(`SELECT * FROM \`${table}\``);
      if (rows.length > 0) {
        sqlOutput += `-- Dumping data for table \`${table}\`\n`;
        sqlOutput += `LOCK TABLES \`${table}\` WRITE;\n`;

        const columns = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');

        for (const row of rows) {
          const values = Object.values(row).map(val => {
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            if (val instanceof Date) {
              return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            }

            let strVal = '';
            if (typeof val === 'object') {
              strVal = JSON.stringify(val);
            } else {
              strVal = val.toString();
            }

            const escaped = strVal
              .replace(/\\/g, '\\\\')
              .replace(/'/g, "\\'")
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r');
            return `'${escaped}'`;
          }).join(', ');

          sqlOutput += `INSERT INTO \`${table}\` (${columns}) VALUES (${values});\n`;
        }

        sqlOutput += `UNLOCK TABLES;\n\n`;
      }
    }

    sqlOutput += `SET FOREIGN_KEY_CHECKS = 1;\n`;

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `HAPPYGMS_Full_Database_Backup_${dateStr}.sql`;

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(sqlOutput);
  } catch (err) {
    console.error('GET /exports/sql-backup error:', err);
    res.status(500).json({ error: 'Failed to generate database SQL backup' });
  }
});

module.exports = router;


