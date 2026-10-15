const express = require('express');
const db = require('../config/db');
const auth = require('../middleware/auth');
const ExcelJS = require('exceljs');

const router = express.Router();
router.use(auth);

// Helper to format date string to YYYY-MM-DD
function formatDate(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? new Date().toISOString().slice(0, 10) : dt.toISOString().slice(0, 10);
}

// ===============================================================
// GET /api/staff-ledger/tabs — Get staff members & partners for dynamic tabs
// ===============================================================
router.get('/tabs', async (req, res) => {
  try {
    const [staffRows] = await db.query(
      'SELECT id, staff_code, full_name, role FROM staff WHERE is_active = 1 ORDER BY id ASC'
    );
    
    // Default tabs: Registered staff + Partners + Total balance
    const tabs = staffRows.map(s => ({
      id: s.id,
      name: s.full_name,
      code: s.staff_code,
      role: s.role,
      is_partner: false
    }));

    tabs.push({
      id: null,
      name: 'Partners',
      code: 'PRT',
      role: 'Partner Account',
      is_partner: true
    });

    res.json({ data: tabs });
  } catch (err) {
    console.error('GET /staff-ledger/tabs error:', err);
    res.status(500).json({ error: 'Failed to fetch staff tabs' });
  }
});

// ===============================================================
// GET /api/staff-ledger — Fetch staff ledger with computed line-by-line running balance
// ===============================================================
router.get('/', async (req, res) => {
  try {
    const { staff_name, staff_id, from, to } = req.query;

    // Auto-correct staff_ledger salary/UPAD entries from debit to credit
    try {
      await db.execute(
        "UPDATE staff_ledger SET credit_amount = debit_amount, debit_amount = 0.00 WHERE (payment_id IS NOT NULL OR description LIKE 'Payment - %' OR veh_no IN ('UPAD', 'SALARY')) AND debit_amount > 0 AND credit_amount = 0"
      );
    } catch { /* ignore */ }

    let query = 'SELECT * FROM staff_ledger';
    const conditions = [];
    const params = [];

    if (staff_name && staff_name.trim()) {
      conditions.push('LOWER(staff_name) = LOWER(?)');
      params.push(staff_name.trim());
    } else if (staff_id) {
      conditions.push('staff_id = ?');
      params.push(parseInt(staff_id));
    }

    if (from) {
      conditions.push('entry_date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('entry_date <= ?');
      params.push(to);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY entry_date ASC, id ASC';

    const [rows] = await db.query(query, params);

    // Compute line-by-line running balance
    let runningBalance = 0;
    const entries = rows.map(row => {
      const credit = parseFloat(row.credit_amount) || 0;
      const debit = parseFloat(row.debit_amount) || 0;
      runningBalance = runningBalance + credit - debit;
      return {
        ...row,
        credit_amount: credit,
        debit_amount: debit,
        balance: parseFloat(runningBalance.toFixed(2))
      };
    });

    // Summary calculation for the active view
    const totalCredit = entries.reduce((s, r) => s + r.credit_amount, 0);
    const totalDebit = entries.reduce((s, r) => s + r.debit_amount, 0);
    const netBalance = totalCredit - totalDebit;

    // Fetch summary across ALL staff members for Total Balance overview
    const [allRows] = await db.query(
      'SELECT staff_name, SUM(credit_amount) as total_credit, SUM(debit_amount) as total_debit FROM staff_ledger GROUP BY staff_name'
    );
    const summaryByStaff = allRows.map(r => ({
      staff_name: r.staff_name,
      total_credit: parseFloat(r.total_credit || 0),
      total_debit: parseFloat(r.total_debit || 0),
      net_balance: parseFloat((parseFloat(r.total_credit || 0) - parseFloat(r.total_debit || 0)).toFixed(2))
    }));

    const grandTotalCredit = summaryByStaff.reduce((s, r) => s + r.total_credit, 0);
    const grandTotalDebit = summaryByStaff.reduce((s, r) => s + r.total_debit, 0);
    const grandNetBalance = grandTotalCredit - grandTotalDebit;

    res.json({
      data: entries,
      summary: {
        total_credit: parseFloat(totalCredit.toFixed(2)),
        total_debit: parseFloat(totalDebit.toFixed(2)),
        net_balance: parseFloat(netBalance.toFixed(2))
      },
      grand_summary: {
        total_credit: parseFloat(grandTotalCredit.toFixed(2)),
        total_debit: parseFloat(grandTotalDebit.toFixed(2)),
        net_balance: parseFloat(grandNetBalance.toFixed(2)),
        by_staff: summaryByStaff
      }
    });
  } catch (err) {
    console.error('GET /staff-ledger error:', err);
    res.status(500).json({ error: 'Failed to fetch staff ledger' });
  }
});

// ===============================================================
// POST /api/staff-ledger — Add manual staff ledger entry
// ===============================================================
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      staff_name, staff_id, entry_date, veh_no, description,
      entry_type, amount, sync_cash_ledger
    } = req.body;

    if (!staff_name || !staff_name.trim()) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Staff name is required' });
    }
    if (!description || !description.trim()) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Description is required' });
    }

    const numAmt = parseFloat(amount) || 0;
    if (numAmt <= 0) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const isCredit = entry_type === 'credit';
    const creditAmt = isCredit ? numAmt : 0;
    const debitAmt = !isCredit ? numAmt : 0;
    const dateStr = formatDate(entry_date);

    let cashLedgerId = null;
    let isSynced = 0;

    // Cash Ledger Sync option
    if (sync_cash_ledger) {
      const cashEntryType = isCredit ? 'in' : 'out';
      const cashCategory = isCredit ? 'Staff Credit' : 'Staff Debit';
      const cashDesc = `[Staff Ledger - ${staff_name.trim()}] ${description.trim()}${veh_no ? ' (' + veh_no.trim() + ')' : ''}`;
      const nowTime = new Date().toTimeString().slice(0, 8);
      const entryDateTime = dateStr ? `${dateStr} ${nowTime}` : new Date();

      const [cashRes] = await conn.execute(
        `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date)
         VALUES (?, ?, ?, ?, ?)`,
        [cashEntryType, numAmt, cashCategory, cashDesc, entryDateTime]
      );
      cashLedgerId = cashRes.insertId;
      isSynced = 1;
    }

    const [result] = await conn.execute(
      `INSERT INTO staff_ledger (staff_id, staff_name, entry_date, veh_no, description, credit_amount, debit_amount, is_cash_ledger_synced, cash_ledger_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        staff_id ? parseInt(staff_id) : null,
        staff_name.trim(),
        dateStr,
        veh_no ? veh_no.trim() : null,
        description.trim(),
        creditAmt,
        debitAmt,
        isSynced,
        cashLedgerId
      ]
    );

    await conn.commit(); conn.release();

    res.status(201).json({
      id: result.insertId,
      message: 'Staff ledger entry recorded successfully'
    });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('POST /staff-ledger error:', err);
    res.status(500).json({ error: 'Failed to record staff ledger entry' });
  }
});

// ===============================================================
// PUT /api/staff-ledger/:id — Update entry
// ===============================================================
router.put('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT * FROM staff_ledger WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: 'Ledger entry not found' });
    }
    const current = existing[0];

    const { staff_name, entry_date, veh_no, description, entry_type, amount, sync_cash_ledger } = req.body;

    const name = staff_name ? staff_name.trim() : current.staff_name;
    const desc = description ? description.trim() : current.description;
    const dateStr = entry_date ? formatDate(entry_date) : formatDate(current.entry_date);
    const vehicle = veh_no !== undefined ? (veh_no ? veh_no.trim() : null) : current.veh_no;

    const numAmt = amount !== undefined ? parseFloat(amount) || 0 : (current.credit_amount > 0 ? current.credit_amount : current.debit_amount);
    const isCredit = entry_type ? entry_type === 'credit' : current.credit_amount > 0;
    const creditAmt = isCredit ? numAmt : 0;
    const debitAmt = !isCredit ? numAmt : 0;

    let cashLedgerId = current.cash_ledger_id;
    let isSynced = current.is_cash_ledger_synced;

    if (sync_cash_ledger && !cashLedgerId) {
      const cashEntryType = isCredit ? 'in' : 'out';
      const cashCategory = isCredit ? 'Staff Credit' : 'Staff Debit';
      const cashDesc = `[Staff Ledger - ${name}] ${desc}${vehicle ? ' (' + vehicle + ')' : ''}`;

      const [cashRes] = await conn.execute(
        `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date)
         VALUES (?, ?, ?, ?, ?)`,
        [cashEntryType, numAmt, cashCategory, cashDesc, `${dateStr} 00:00:00`]
      );
      cashLedgerId = cashRes.insertId;
      isSynced = 1;
    } else if (cashLedgerId) {
      const cashEntryType = isCredit ? 'in' : 'out';
      const cashDesc = `[Staff Ledger - ${name}] ${desc}${vehicle ? ' (' + vehicle + ')' : ''}`;
      await conn.execute(
        `UPDATE cash_ledger SET entry_type = ?, amount = ?, description = ?, entry_date = ? WHERE id = ?`,
        [cashEntryType, numAmt, cashDesc, `${dateStr} 00:00:00`, cashLedgerId]
      );
    }

    await conn.execute(
      `UPDATE staff_ledger 
       SET staff_name = ?, entry_date = ?, veh_no = ?, description = ?, credit_amount = ?, debit_amount = ?, is_cash_ledger_synced = ?, cash_ledger_id = ?
       WHERE id = ?`,
      [name, dateStr, vehicle, desc, creditAmt, debitAmt, isSynced, cashLedgerId, req.params.id]
    );

    await conn.commit(); conn.release();

    res.json({ message: 'Staff ledger entry updated successfully' });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('PUT /staff-ledger/:id error:', err);
    res.status(500).json({ error: 'Failed to update ledger entry' });
  }
});

// ===============================================================
// DELETE /api/staff-ledger/:id — Delete entry
// ===============================================================
router.delete('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT cash_ledger_id FROM staff_ledger WHERE id = ?', [req.params.id]);
    if (existing.length > 0 && existing[0].cash_ledger_id) {
      await conn.execute('DELETE FROM cash_ledger WHERE id = ?', [existing[0].cash_ledger_id]);
    }

    await conn.execute('DELETE FROM staff_ledger WHERE id = ?', [req.params.id]);

    await conn.commit(); conn.release();
    res.json({ message: 'Ledger entry deleted' });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error('DELETE /staff-ledger/:id error:', err);
    res.status(500).json({ error: 'Failed to delete ledger entry' });
  }
});

// ===============================================================
// GET /api/staff-ledger/export — Perfectly styled Excel Statement export
// ===============================================================
router.get('/export', async (req, res) => {
  try {
    const { staff_name, from, to } = req.query;

    // Auto-correct existing automated salary/UPAD entries to credit_amount if incorrectly set as debit_amount
    try {
      await db.execute(
        `UPDATE staff_ledger SET credit_amount = debit_amount, debit_amount = 0.00 WHERE (payment_id IS NOT NULL OR description LIKE 'Payment - %') AND debit_amount > 0 AND credit_amount = 0`
      );
    } catch { /* ignore migration error */ }
    
    // 1. Calculate Opening Balance before 'from' date
    let openingBalance = 0;
    if (from) {
      let priorQuery = 'SELECT SUM(credit_amount) as prior_cr, SUM(debit_amount) as prior_dr FROM staff_ledger WHERE entry_date < ?';
      const priorParams = [from];
      if (staff_name && staff_name.trim()) {
        priorQuery += ' AND LOWER(staff_name) = LOWER(?)';
        priorParams.push(staff_name.trim());
      }
      const [priorRows] = await db.query(priorQuery, priorParams);
      if (priorRows.length > 0) {
        const priorCr = parseFloat(priorRows[0].prior_cr) || 0;
        const priorDr = parseFloat(priorRows[0].prior_dr) || 0;
        openingBalance = priorCr - priorDr;
      }
    }

    // 2. Fetch ledger rows for the specified date range & staff
    let query = 'SELECT * FROM staff_ledger';
    const conditions = [];
    const params = [];

    if (staff_name && staff_name.trim()) {
      conditions.push('LOWER(staff_name) = LOWER(?)');
      params.push(staff_name.trim());
    }
    if (from) {
      conditions.push('entry_date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('entry_date <= ?');
      params.push(to);
    }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY entry_date ASC, id ASC';

    const [rows] = await db.query(query, params);

    const formatExcelDate = (dateStr) => {
      if (!dateStr) return '';
      const parts = String(dateStr).slice(0, 10).split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
      }
      return dateStr;
    };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Happy Car Wash GMS';
    wb.created = new Date();

    const sheetTitle = staff_name ? staff_name.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 30) : 'Staff Ledger';
    const ws = wb.addWorksheet(sheetTitle, {
      views: [{ showGridLines: true }]
    });

    // 1. Title Banner (Row 1)
    ws.mergeCells('A1:G1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'Happy Car Wash - STAFF LEDGER STATEMENT';
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 36;

    // 2. Subtitle Meta Bar (Row 2)
    ws.mergeCells('A2:C2');
    ws.mergeCells('D2:G2');

    const sub1 = ws.getCell('A2');
    sub1.value = `Staff Member: ${staff_name ? staff_name.toUpperCase() : 'ALL STAFF MEMBERS'}`;
    sub1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    sub1.alignment = { horizontal: 'left', vertical: 'middle' };

    const sub2 = ws.getCell('D2');
    sub2.value = `Period: ${from ? formatExcelDate(from) : 'Beginning'} to ${to ? formatExcelDate(to) : 'Present'}`;
    sub2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    sub2.alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getRow(2).height = 24;

    ws.getRow(3).height = 8; // Spacing row

    // 3. Table Column Headers (Row 4)
    const headers = ['Date', 'Staff Name', 'Veh. No. / Ref', 'Description', 'Credit (₹)', 'Debit (₹)', 'Balance (₹)'];
    const headerRow = ws.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0F172A' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };
    });

    // 4. Opening Balance Row (Row 5)
    const openRow = ws.addRow(['-', staff_name || 'ALL STAFF', '-', 'Opening Balance', null, null, parseFloat(openingBalance.toFixed(2))]);
    openRow.height = 22;
    openRow.eachCell((cell, colIndex) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
      if (colIndex === 7) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colIndex === 1 || colIndex === 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    let runningBal = openingBalance;
    let totalCr = 0;
    let totalDr = 0;

    // 5. Data Rows
    rows.forEach((r, idx) => {
      const cr = parseFloat(r.credit_amount) || 0;
      const dr = parseFloat(r.debit_amount) || 0;
      totalCr += cr;
      totalDr += dr;
      runningBal = runningBal + cr - dr;

      const dataRow = ws.addRow([
        formatExcelDate(r.entry_date),
        r.staff_name || '',
        r.veh_no || '-',
        r.description || '',
        cr > 0 ? parseFloat(cr.toFixed(2)) : null,
        dr > 0 ? parseFloat(dr.toFixed(2)) : null,
        parseFloat(runningBal.toFixed(2))
      ]);

      dataRow.height = 22;
      const bgColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

      dataRow.eachCell((cell, colIndex) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        if (colIndex === 1 || colIndex === 3) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 10 };
        } else if (colIndex === 5) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } };
          cell.numFmt = '#,##0.00';
        } else if (colIndex === 6) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF991B1B' } };
          cell.numFmt = '#,##0.00';
        } else if (colIndex === 7) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
          cell.numFmt = '#,##0.00';
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 10 };
        }
      });
    });

    // 6. Summary Totals / Closing Balance Row
    const totalsRow = ws.addRow(['TOTALS', 'Net Summary', `${rows.length} Entries`, 'Closing Balance', parseFloat(totalCr.toFixed(2)), parseFloat(totalDr.toFixed(2)), parseFloat(runningBal.toFixed(2))]);
    totalsRow.height = 26;
    totalsRow.eachCell((cell, colIndex) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0F172A' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      if (colIndex === 5) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } };
        cell.numFmt = '#,##0.00';
      } else if (colIndex === 6) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF991B1B' } };
        cell.numFmt = '#,##0.00';
      } else if (colIndex === 7) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        cell.numFmt = '#,##0.00';
      } else if (colIndex === 1 || colIndex === 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10, bold: true };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10, bold: true };
      }
    });

    // 7. Column Widths
    ws.columns = [
      { width: 14 },
      { width: 22 },
      { width: 18 },
      { width: 45 },
      { width: 16 },
      { width: 16 },
      { width: 18 }
    ];

    const filename = staff_name
      ? `Staff_Ledger_${staff_name.toLowerCase().replace(/\s+/g, '_')}.xlsx`
      : 'Staff_Ledger.xlsx';

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Export staff ledger error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;

