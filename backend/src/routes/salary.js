const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// Ensure advance_deducted column exists on staff_payments table
(async () => {
  try {
    await db.query("ALTER TABLE staff_payments ADD COLUMN advance_deducted DECIMAL(10,2) DEFAULT 0.00");
  } catch (err) {
    // column already exists
  }
})();

// ───── GET /api/salary — list payments ─────
router.get('/', async (req, res) => {
  try {
    const { staff_id, payment_month } = req.query;
    let query = `SELECT sp.*, s.full_name as staff_name, s.staff_code
                 FROM staff_payments sp
                 JOIN staff s ON sp.staff_id = s.id`;
    const conditions = [];
    const params = [];

    if (staff_id) {
      conditions.push('sp.staff_id = ?');
      params.push(parseInt(staff_id));
    }
    if (payment_month) {
      conditions.push('sp.payment_month = ?');
      params.push(payment_month);
    }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY sp.payment_date DESC';

    const [rows] = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('GET /salary error:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// ───── GET /api/salary/calculate/:staffId ─────
router.get('/calculate/:staffId', async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year required' });
    }

    // Get staff info
    const [staffRows] = await db.query('SELECT id, full_name, monthly_salary FROM staff WHERE id = ?', [req.params.staffId]);
    if (staffRows.length === 0) return res.status(404).json({ error: 'Staff not found' });
    const staff = staffRows[0];

    // Get attendance for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const totalDays = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;

    const [records] = await db.query(
      `SELECT status FROM attendance WHERE staff_id = ? AND attendance_date BETWEEN ? AND ?`,
      [req.params.staffId, startDate, endDate]
    );

    const present = records.filter(r => r.status === 'present').length;
    const half = records.filter(r => r.status === 'half' || r.status === 'half-day' || r.status === 'half_day').length;
    const effectiveDays = present + (half * 0.5);

    // Formula: if effectiveDays >= totalDays, monthly_salary. Else, pro-rated by totalDays.
    const monthlySalary = parseFloat(staff.monthly_salary);
    let calculatedSalary = monthlySalary;
    if (effectiveDays < totalDays) {
      const dailyRate = monthlySalary / totalDays;
      calculatedSalary = dailyRate * effectiveDays;
    }
    calculatedSalary = Math.round(calculatedSalary * 100) / 100;

    // Get gross advance payments recorded for this staff member across staff_payments, staff_ledger, and customer_payments
    // 1. staff_payments advance
    const [spAdvanceRows] = await db.query(
      `SELECT COALESCE(SUM(paid_amount), 0) AS total
       FROM staff_payments
       WHERE staff_id = ? AND payment_type = 'advance'`,
      [req.params.staffId]
    );
    const spAdvance = parseFloat(spAdvanceRows[0].total || 0);

    // 2. staff_ledger (debit amounts with UPAD or advance in description)
    const [slAdvanceRows] = await db.query(
      `SELECT COALESCE(SUM(debit_amount), 0) AS total
       FROM staff_ledger
       WHERE staff_id = ?
         AND (LOWER(veh_no) = 'upad' OR LOWER(description) LIKE '%advance%' OR LOWER(description) LIKE '%upad%')
         AND (payment_id IS NULL OR NOT EXISTS (SELECT 1 FROM staff_payments WHERE id = staff_ledger.payment_id AND payment_type = 'advance'))`,
      [req.params.staffId]
    );
    const slAdvance = parseFloat(slAdvanceRows[0].total || 0);

    // 3. Deduct all advance amounts already recovered in past salary payments
    let prevDeducted = 0;
    try {
      const [deductedRows] = await db.query(
        `SELECT COALESCE(SUM(advance_deducted), 0) AS total
         FROM staff_payments
         WHERE staff_id = ? AND payment_type = 'salary'`,
        [req.params.staffId]
      );
      prevDeducted = parseFloat(deductedRows[0].total || 0);
    } catch (e) {
      // Column might not exist yet
    }

    const grossAdvance = spAdvance + slAdvance;
    const totalAdvance = Math.max(0, Math.round((grossAdvance - prevDeducted) * 100) / 100);
    const netSalary = Math.max(0, Math.round((calculatedSalary - totalAdvance) * 100) / 100);

    res.json({
      staff_id: staff.id,
      staff_name: staff.full_name,
      monthly_salary: monthlySalary,
      days_present: present,
      half_days: half,
      effective_days: effectiveDays,
      total_days_in_month: totalDays,
      calculated_salary: calculatedSalary, // gross
      total_advance: totalAdvance,
      net_salary: netSalary
    });
  } catch (err) {
    console.error('GET /salary/calculate error:', err);
    res.status(500).json({ error: 'Failed to calculate salary' });
  }
});

// ───── POST /api/salary — record payment ─────
router.post('/', async (req, res) => {
  try {
    const {
      staff_id, payment_date, payment_month, days_present,
      calculated_salary, paid_amount, payment_type, payment_mode, notes,
      advance_deducted
    } = req.body;

    if (!staff_id || !payment_date || !payment_month || paid_amount === undefined || !payment_type || !payment_mode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const advDeductedVal = parseFloat(advance_deducted) || 0;
    let result;

    try {
      const [resExec] = await db.execute(
        `INSERT INTO staff_payments (staff_id, payment_date, payment_month, days_present, calculated_salary, paid_amount, payment_type, payment_mode, notes, advance_deducted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [staff_id, payment_date, payment_month, days_present || 0, calculated_salary || 0, parseFloat(paid_amount), payment_type, payment_mode, notes || null, advDeductedVal]
      );
      result = resExec;
    } catch (dbErr) {
      const [resExec] = await db.execute(
        `INSERT INTO staff_payments (staff_id, payment_date, payment_month, days_present, calculated_salary, paid_amount, payment_type, payment_mode, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [staff_id, payment_date, payment_month, days_present || 0, calculated_salary || 0, parseFloat(paid_amount), payment_type, payment_mode, notes || null]
      );
      result = resExec;
    }

    // Record in cash ledger and staff ledger
    try {
      const [staffRows] = await db.query('SELECT full_name, staff_code FROM staff WHERE id = ?', [staff_id]);
      const staffName = staffRows.length > 0 ? staffRows[0].full_name : `#${staff_id}`;
      
      const nowTime = new Date().toTimeString().slice(0, 8);
      const entryDateTime = payment_date ? `${payment_date} ${nowTime}` : new Date();

      const cashEntryType = payment_type === 'deduction' ? 'in' : 'out';
      const cashCategory = payment_type === 'advance' ? 'Staff Advance' : payment_type === 'bonus' ? 'Staff Bonus' : payment_type === 'deduction' ? 'Staff Deduction' : 'Staff Salary';
      const cashDesc = `${payment_type === 'advance' ? 'Advance paid to' : payment_type === 'deduction' ? 'Salary deduction recovered from' : payment_type === 'bonus' ? 'Bonus paid to' : 'Salary paid to'} ${staffName} for ${payment_month} (${payment_type}) via ${payment_mode}`;

      const [cashRes] = await db.execute(
        `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date)
         VALUES (?, ?, ?, ?, ?)`,
        [
          cashEntryType,
          parseFloat(paid_amount),
          cashCategory,
          cashDesc,
          entryDateTime
        ]
      );

      // Auto insert into staff_ledger with accurate accounting classification
      const isAdvance = payment_type === 'advance';
      const isDeduction = payment_type === 'deduction';
      const vehNoLabel = isAdvance ? 'UPAD' : payment_type === 'bonus' ? 'BONUS' : isDeduction ? 'DEDUCTION' : 'SALARY';
      const creditAmt = isAdvance || isDeduction ? 0.00 : parseFloat(paid_amount);
      const debitAmt = isAdvance || isDeduction ? parseFloat(paid_amount) : 0.00;

      await db.execute(
        `INSERT INTO staff_ledger (staff_id, staff_name, entry_date, veh_no, description, credit_amount, debit_amount, is_cash_ledger_synced, cash_ledger_id, payment_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          parseInt(staff_id),
          staffName,
          payment_date,
          vehNoLabel,
          `Payment - ${staffName} (${payment_month})`,
          creditAmt,
          debitAmt,
          cashRes.insertId,
          result.insertId
        ]
      );
    } catch (e) {
      console.error('Failed to log salary payment to cash/staff ledger:', e.message);
    }

    res.status(201).json({ id: result.insertId, message: 'Payment recorded' });
  } catch (err) {
    console.error('POST /salary error:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

module.exports = router;
