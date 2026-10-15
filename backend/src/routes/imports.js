/**
 * Data Import Routes
 * Unified Import System for:
 * 1. Complete Operations & Working Sheet (Customers, Vehicles, Job Cards, Car Wash, Detailing, Accessories & Payments)
 * 2. Customers
 * 3. Vehicles
 * 4. Service Catalog
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// Ensure uploads/imports dir exists
const importDir = path.join(__dirname, '../../uploads/imports/');
if (!fs.existsSync(importDir)) {
  fs.mkdirSync(importDir, { recursive: true });
}

const upload = multer({
  dest: importDir,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Only XLSX, XLS, and CSV files are supported'));
  }
});

function detectMake(carName) {
  if (!carName) return 'Other';
  const s = carName.toLowerCase();
  if (s.includes('maruti') || s.includes('suzuki') || s.includes('swift') || s.includes('wagon') || s.includes('baleno') || s.includes('alto') || s.includes('dzire') || s.includes('ertiga') || s.includes('brezza') || s.includes('celerio') || s.includes('ignis') || s.includes('ciaz') || s.includes('fronx') || s.includes('grand vitara')) return 'Maruti Suzuki';
  if (s.includes('hyundai') || s.includes('creta') || s.includes('i20') || s.includes('i10') || s.includes('venue') || s.includes('verna') || s.includes('tucson') || s.includes('aura') || s.includes('alcazar')) return 'Hyundai';
  if (s.includes('tata') || s.includes('nexon') || s.includes('harrier') || s.includes('safari') || s.includes('tiago') || s.includes('tigor') || s.includes('altroz') || s.includes('punch')) return 'Tata';
  if (s.includes('mahindra') || s.includes('scorpio') || s.includes('xuv') || s.includes('thar') || s.includes('bolero')) return 'Mahindra';
  if (s.includes('toyota') || s.includes('innova') || s.includes('fortuner') || s.includes('glanza') || s.includes('hyryder')) return 'Toyota';
  if (s.includes('honda') || s.includes('city') || s.includes('amaze') || s.includes('civic') || s.includes('elevate')) return 'Honda';
  if (s.includes('kia') || s.includes('seltos') || s.includes('sonet') || s.includes('carens') || s.includes('carnival')) return 'Kia';
  if (s.includes('volkswagen') || s.includes('vw') || s.includes('polo') || s.includes('vento') || s.includes('taigun') || s.includes('virtus')) return 'Volkswagen';
  if (s.includes('skoda') || s.includes('slavia') || s.includes('kushaq') || s.includes('rapid') || s.includes('octavia')) return 'Skoda';
  if (s.includes('mg') || s.includes('hector') || s.includes('astor') || s.includes('zs') || s.includes('gloster')) return 'MG';
  if (s.includes('renault') || s.includes('kwid') || s.includes('triber') || s.includes('kiger') || s.includes('duster')) return 'Renault';
  if (s.includes('nissan') || s.includes('magnite')) return 'Nissan';
  if (s.includes('ford') || s.includes('ecosport') || s.includes('endeavour') || s.includes('figo')) return 'Ford';
  if (s.includes('bmw')) return 'BMW';
  if (s.includes('mercedes') || s.includes('benz')) return 'Mercedes-Benz';
  if (s.includes('audi')) return 'Audi';
  return 'Other';
}

function inferYearMonthFromSheet(sheetName) {
  const current = new Date();
  let year = current.getFullYear();
  let month = current.getMonth(); // 0-indexed

  if (!sheetName) return { year, month };

  const s = String(sheetName).toLowerCase();
  const yearMatch = s.match(/\b(20\d\d)\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  const monthMap = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
  };

  for (const [key, mIndex] of Object.entries(monthMap)) {
    if (s.includes(key)) {
      month = mIndex;
      break;
    }
  }

  return { year, month };
}

function parseExcelDate(val, sheetName) {
  const context = inferYearMonthFromSheet(sheetName);
  if (!val && val !== 0) return new Date(context.year, context.month, 1, 12, 0, 0);

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return new Date(context.year, context.month, 1, 12, 0, 0);
    return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 12, 0, 0);
  }

  if (typeof val === 'number') {
    // If integer between 1 and 31, it's a day of month in the sheet's month
    if (Number.isInteger(val) && val >= 1 && val <= 31) {
      return new Date(context.year, context.month, val, 12, 0, 0);
    }
    try {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        return new Date(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0);
      }
    } catch (e) {}
    const utcDays = Math.floor(val - 25569);
    const dateInfo = new Date(utcDays * 86400 * 1000);
    return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate(), 12, 0, 0);
  }

  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return new Date(context.year, context.month, 1, 12, 0, 0);

    // If pure number string 1..31
    if (/^\d{1,2}$/.test(s)) {
      const d = parseInt(s, 10);
      if (d >= 1 && d <= 31) {
        return new Date(context.year, context.month, d, 12, 0, 0);
      }
    }

    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (dmy) {
      let day = parseInt(dmy[1], 10);
      let month = parseInt(dmy[2], 10);
      let year = parseInt(dmy[3], 10);
      if (year < 100) year += 2000;
      return new Date(year, month - 1, day, 12, 0, 0);
    }

    // YYYY-MM-DD
    const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymd) {
      return new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10), 12, 0, 0);
    }

    // DD-Mon-YYYY or DD Mon YYYY or DD-Mon (e.g. 10-Oct-2026, 15 Oct, 12-Sep-26)
    const monthNames = {
      jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
      apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
      aug: 8, august: 8, sep: 9, sept: 9, september: 9,
      oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
    };
    const dMonY = s.match(/^(\d{1,2})[\s\/\-\.]([A-Za-z]+)(?:[\s\/\-\.](\d{2,4}))?$/);
    if (dMonY) {
      let day = parseInt(dMonY[1], 10);
      let mStr = dMonY[2].toLowerCase();
      let mNum = monthNames[mStr];
      if (mNum) {
        let year = dMonY[3] ? parseInt(dMonY[3], 10) : context.year;
        if (year < 100) year += 2000;
        return new Date(year, mNum - 1, day, 12, 0, 0);
      }
    }

    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);
    }
  }

  return new Date(context.year, context.month, 1, 12, 0, 0);
}

function formatDateStr(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) {
    d = new Date();
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateTimeStr(d) {
  return `${formatDateStr(d)} 12:00:00`;
}

// Helper to resolve cell value by header aliases
function getValueByAliases(row, aliases) {
  if (!row) return undefined;
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== '') return row[alias];
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key of Object.keys(row)) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanKey === cleanAlias && row[key] !== undefined && row[key] !== '') {
        return row[key];
      }
    }
  }
  return undefined;
}

// Helper to normalize and smartly align date range or day range with sheet year
function normalizeDateRange(fromDate, toDate, minDateStr, maxDateStr, fromDay, toDay) {
  const numFromDay = fromDay !== undefined && fromDay !== null && String(fromDay).trim() !== '' ? parseInt(String(fromDay), 10) : null;
  const numToDay = toDay !== undefined && toDay !== null && String(toDay).trim() !== '' ? parseInt(String(toDay), 10) : null;

  if (numFromDay !== null && numToDay !== null && minDateStr) {
    const [y, m] = minDateStr.split('-');
    const startD = Math.min(numFromDay, numToDay);
    const endD = Math.max(numFromDay, numToDay);
    return {
      fromDate: `${y}-${m}-${String(startD).padStart(2, '0')}`,
      toDate: `${y}-${m}-${String(endD).padStart(2, '0')}`,
      fromDay: startD,
      toDay: endD
    };
  }

  let f = (fromDate || '').trim() || null;
  let t = (toDate || '').trim() || null;
  if (!f && !t) return { fromDate: null, toDate: null, fromDay: null, toDay: null };

  // If minDateStr is available, align year if user picked in current year or different year
  if (minDateStr) {
    const sheetYear = minDateStr.slice(0, 4);
    if (f && f.length === 10) {
      const fYear = f.slice(0, 4);
      if (fYear !== sheetYear) {
        f = `${sheetYear}-${f.slice(5)}`;
      }
    }
    if (t && t.length === 10) {
      const tYear = t.slice(0, 4);
      if (tYear !== sheetYear) {
        t = `${sheetYear}-${t.slice(5)}`;
      }
    }
  }

  return { fromDate: f, toDate: t, fromDay: numFromDay, toDay: numToDay };
}

// ───── POST /api/imports/preview ─────
router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { type, sheet_name, from_date, to_date, from_day, to_day, filter_by_date } = req.body;
    const validTypes = ['working_sheet', 'operations', 'job_cards', 'customers', 'vehicles', 'service_catalog'];
    const activeType = type || 'working_sheet';
    if (!validTypes.includes(activeType)) {
      return res.status(400).json({ error: 'Valid import type required' });
    }

    const wb = XLSX.readFile(req.file.path);
    const sheetNames = wb.SheetNames;
    if (!sheetNames || sheetNames.length === 0) {
      return res.status(400).json({ error: 'The uploaded Excel file has no sheets' });
    }

    // Determine target sheet
    let targetSheet = sheet_name && wb.Sheets[sheet_name] ? sheet_name : sheetNames[0];
    let data = XLSX.utils.sheet_to_json(wb.Sheets[targetSheet], { blankrows: false, defval: '' });
    if (data.length === 0 && sheetNames.length > 1) {
      for (const s of sheetNames) {
        const testData = XLSX.utils.sheet_to_json(wb.Sheets[s], { blankrows: false, defval: '' });
        if (testData.length > 0) {
          targetSheet = s;
          data = testData;
          break;
        }
      }
    }

    if (!data.length) return res.status(400).json({ error: 'The selected sheet contains no rows' });

    // Track dates statistics
    const datesBreakdown = {};
    const uniqueDatesSet = new Set();
    let minDateStr = null;
    let maxDateStr = null;

    // Parse all meaningful rows
    const allParsedRows = [];

    for (const r of data) {
      let cust = getValueByAliases(r, ['name_of_customer', 'customer_name', 'name', 'owner_name', 'customer', 'client_name', 'client', 'party']) || '';
      let mobile = getValueByAliases(r, ['mobile_no', 'mobile', 'phone', 'contact', 'mobile_number', 'cell', 'phone_number', 'contact_no']) || '';
      let car = getValueByAliases(r, ['car_name', 'vehicle_name', 'car', 'vehicle', 'model', 'vehicle_model']) || '';
      let reg = getValueByAliases(r, ['car_reg_no', 'reg_no', 'registration_no', 'registration', 'vehicle_no', 'car_no', 'plate_no', 'plate', 'number']) || '';
      let svc = getValueByAliases(r, ['service_type', 'service', 'job', 'work', 'package', 'particulars', 'description']) || '';
      let amt = getValueByAliases(r, ['amount', 'service_type_1', 'servicetype1', 'rate', 'price', 'total', 'bill_amount', 'bill', 'cost', 'charge']);
      let rem = getValueByAliases(r, ['remarks', 'remark', 'payment_status', 'status', 'mode', 'payment_mode', 'notes']) || '';
      const dateVal = getValueByAliases(r, ['date', 'job_date', 'entry_date', 'bill_date', 'invoice_date']) || '';

      const rowVals = Object.values(r);
      let numAmt = parseFloat(String(amt || 0).replace(/[^0-9.]/g, '')) || 0;
      if (numAmt === 0 && rowVals.length >= 7) {
        for (const idx of [7, 6, 8]) {
          const val = rowVals[idx];
          if (typeof val === 'number' && val > 0 && val < 500000) {
            numAmt = val;
            break;
          } else if (typeof val === 'string') {
            const cleanNum = parseFloat(val.replace(/[^0-9.]/g, ''));
            if (!isNaN(cleanNum) && cleanNum > 0 && cleanNum < 500000 && !/^\d{10}$/.test(val.trim())) {
              numAmt = cleanNum;
              break;
            }
          }
        }
      }

      if (!svc && rowVals.length >= 7) {
        for (const idx of [6, 7]) {
          const val = rowVals[idx];
          if (typeof val === 'string' && val.trim().length > 1 && !/^\d+$/.test(val.trim())) {
            svc = val.trim();
            break;
          }
        }
      }

      if (!car && rowVals.length >= 5 && typeof rowVals[4] === 'string' && rowVals[4].trim().length > 1) {
        car = rowVals[4].trim();
      }

      if (!reg && rowVals.length >= 6 && typeof rowVals[5] === 'string' && rowVals[5].trim().length > 2) {
        reg = rowVals[5].trim();
      }

      // Skip pure headers or blank lines
      if (!cust && !reg && !numAmt && !svc) continue;
      if (String(cust).toLowerCase().includes('name of customer') || String(reg).toLowerCase().includes('reg. no')) continue;

      const isPending = /pending|unpaid|due/i.test(String(rem));
      const isAcc = /mat|matting|mud\s*flap|perfume|freshener|pillow|cover|cloth|shiner|polish|accessory|accessories|wiper|horn|led|light/i.test(String(svc));
      const dObj = parseExcelDate(dateVal, targetSheet);
      const rowDateStr = formatDateStr(dObj);

      // Record date stats
      uniqueDatesSet.add(rowDateStr);
      datesBreakdown[rowDateStr] = (datesBreakdown[rowDateStr] || 0) + 1;
      if (!minDateStr || rowDateStr < minDateStr) minDateStr = rowDateStr;
      if (!maxDateStr || rowDateStr > maxDateStr) maxDateStr = rowDateStr;

      const isTeflonOrDeluxe = /delux|dlx|teflon|taflon/i.test(String(svc)) || /delux|dlx|teflon|taflon/i.test(String(rem));
      const isDetSvc =
        !isTeflonOrDeluxe && (
          /coat|coting|ceram|ciram|ppf|paint|polish|detail|rubb|buff|studio|interior|dry\s*clean|deep\s*clean|graphene|glass|headlight|spa|decontam/i.test(String(svc)) ||
          /coat|coting|ceram|ciram|ppf|paint|polish|detail|rubb|buff|studio|interior|dry\s*clean|deep\s*clean|graphene|glass|headlight|spa|decontam/i.test(String(rem)) ||
          (numAmt >= 1500 && !/^(car\s*wash|wash|foam\s*wash|water\s*wash|body\s*wash|diesel\s*wash|delux.*|dlx.*|teflon.*)$/i.test(String(svc).trim()))
        );

      allParsedRows.push({
        ...r,
        _parsed_date: rowDateStr,
        _parsed_customer: cust || 'Walk-in Customer',
        _parsed_mobile: mobile ? String(mobile).replace(/[^0-9]/g, '').slice(-10) : '',
        _parsed_car: `${car} ${reg}`.trim(),
        _parsed_service: svc || 'Car Wash & Service',
        _parsed_amount: numAmt,
        _parsed_status: isPending ? 'Pending Payment' : 'Paid',
        _parsed_category: isAcc ? 'Accessory' : (isTeflonOrDeluxe ? 'Car Wash' : (isDetSvc ? 'Detailing Studio' : (/wash/i.test(String(svc)) ? 'Car Wash' : 'Detailing Studio')))
      });
    }

    const uniqueDates = Array.from(uniqueDatesSet).sort();

    // Smart Date Filter resolution
    const normFilter = normalizeDateRange(from_date, to_date, minDateStr, maxDateStr, from_day, to_day);
    const isFilterActive = filter_by_date === 'true' || Boolean(from_date || to_date || from_day || to_day || normFilter.fromDate || normFilter.fromDay !== null);

    // Apply date filter if active
    let matchedRows = allParsedRows;
    if (isFilterActive) {
      matchedRows = allParsedRows.filter(r => {
        // 1. Day of month filter
        if (normFilter.fromDay !== null || normFilter.toDay !== null) {
          const rDay = parseInt(r._parsed_date.slice(8, 10), 10);
          if (normFilter.fromDay !== null && rDay < normFilter.fromDay) return false;
          if (normFilter.toDay !== null && rDay > normFilter.toDay) return false;
          return true;
        }
        // 2. Full date string filter
        if (normFilter.fromDate && r._parsed_date < normFilter.fromDate) return false;
        if (normFilter.toDate && r._parsed_date > normFilter.toDate) return false;
        return true;
      });
    }

    const previewRows = matchedRows.slice(0, 50);

    res.json({
      file_name: req.file.originalname,
      import_type: activeType,
      sheet_names: sheetNames,
      selected_sheet: targetSheet,
      total_rows: allParsedRows.length,
      filtered_rows: matchedRows.length,
      date_filter: {
        active: isFilterActive,
        from_date: normFilter.fromDate || from_date || null,
        to_date: normFilter.toDate || to_date || null,
        from_day: normFilter.fromDay,
        to_day: normFilter.toDay,
        min_date: minDateStr,
        max_date: maxDateStr,
        unique_dates: uniqueDates,
        dates_breakdown: datesBreakdown
      },
      file_columns: Object.keys(data[0] || {}),
      preview: previewRows,
      file_path: req.file.path
    });
  } catch (err) {
    console.error('Import preview error:', err);
    res.status(500).json({ error: 'Failed to preview import: ' + err.message });
  }
});

// ───── POST /api/imports/execute ─────
router.post('/execute', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { type, skip_duplicates, sheet_name, from_date, to_date, from_day, to_day, filter_by_date } = req.body;
    const activeType = type || 'working_sheet';
    const isDateFilterActive = filter_by_date === 'true' || Boolean(from_date || to_date || from_day || to_day);

    const wb = XLSX.readFile(req.file.path);
    const sheetsToProcess = [];

    if (sheet_name === 'all') {
      sheetsToProcess.push(...wb.SheetNames);
    } else if (sheet_name && wb.Sheets[sheet_name]) {
      sheetsToProcess.push(sheet_name);
    } else {
      sheetsToProcess.push(wb.SheetNames[0]);
    }

    let imported = 0, skipped = 0, skippedDateFilter = 0, errors = [];
    let jobCardsCreated = 0, accessoriesCreated = 0, pendingCount = 0, paidCount = 0;

    // Highest sequential job number counter
    const [lastJc] = await db.query("SELECT job_no FROM job_cards ORDER BY id DESC LIMIT 1");
    let nextJobNum = 1;
    if (lastJc.length > 0 && lastJc[0].job_no) {
      const match = lastJc[0].job_no.match(/(\d+)$/);
      if (match) nextJobNum = parseInt(match[1], 10) + 1;
    }

    // Highest sequential accessory invoice counter
    const [lastSale] = await db.query("SELECT invoice_no FROM product_sales ORDER BY id DESC LIMIT 1");
    let nextAccNum = 1;
    if (lastSale.length > 0 && lastSale[0].invoice_no) {
      const match = lastSale[0].invoice_no.match(/(\d+)$/);
      if (match) nextAccNum = parseInt(match[1], 10) + 1;
    }

    // Process all designated sheets
    for (const curSheetName of sheetsToProcess) {
      const sheet = wb.Sheets[curSheetName];
      if (!sheet) continue;
      const data = XLSX.utils.sheet_to_json(sheet, { blankrows: false, defval: '' });

      const curContext = inferYearMonthFromSheet(curSheetName);
      const curSheetMinStr = `${curContext.year}-${String(curContext.month + 1).padStart(2, '0')}-01`;
      const curSheetMaxStr = `${curContext.year}-${String(curContext.month + 1).padStart(2, '0')}-31`;
      const curNormFilter = normalizeDateRange(from_date, to_date, curSheetMinStr, curSheetMaxStr, from_day, to_day);

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // ==========================================
          // 1. OPERATIONS / WORKING SHEET IMPORT
          // ==========================================
          if (activeType === 'working_sheet' || activeType === 'operations' || activeType === 'job_cards') {
            const dateRaw = getValueByAliases(row, ['date', 'job_date', 'entry_date', 'bill_date', 'invoice_date']);
            let custName = getValueByAliases(row, ['name_of_customer', 'customer_name', 'name', 'owner_name', 'customer', 'client_name', 'client', 'party']);
            let mobile = getValueByAliases(row, ['mobile_no', 'mobile', 'phone', 'contact', 'mobile_number', 'cell', 'phone_number', 'contact_no']);
            let address = getValueByAliases(row, ['address', 'address_line', 'location', 'city', 'area']);
            let carName = getValueByAliases(row, ['car_name', 'vehicle_name', 'car', 'vehicle', 'model', 'vehicle_model']);
            let regNo = getValueByAliases(row, ['car_reg_no', 'reg_no', 'registration_no', 'registration', 'vehicle_no', 'car_no', 'plate_no', 'plate', 'number']);
            let serviceType = getValueByAliases(row, ['service_type', 'service', 'job', 'work', 'package', 'particulars', 'description']);
            let amount = getValueByAliases(row, ['amount', 'service_type_1', 'servicetype1', 'rate', 'price', 'total', 'bill_amount', 'bill', 'cost', 'charge']);
            let remarks = getValueByAliases(row, ['remarks', 'remark', 'payment_status', 'status', 'mode', 'payment_mode', 'notes']);

            const rowVals = Object.values(row);
            let numAmount = parseFloat(String(amount || 0).replace(/[^0-9.]/g, '')) || 0;

            // Positional fallback for amount if 0
            if (numAmount === 0 && rowVals.length >= 7) {
              for (const idx of [7, 6, 8]) {
                const val = rowVals[idx];
                if (typeof val === 'number' && val > 0 && val < 500000) {
                  numAmount = val;
                  break;
                } else if (typeof val === 'string') {
                  const cleanNum = parseFloat(val.replace(/[^0-9.]/g, ''));
                  if (!isNaN(cleanNum) && cleanNum > 0 && cleanNum < 500000 && !/^\d{10}$/.test(val.trim())) {
                    numAmount = cleanNum;
                    break;
                  }
                }
              }
            }

            // Positional fallback for serviceType if empty
            if (!serviceType && rowVals.length >= 7) {
              for (const idx of [6, 7]) {
                const val = rowVals[idx];
                if (typeof val === 'string' && val.trim().length > 1 && !/^\d+$/.test(val.trim())) {
                  serviceType = val.trim();
                  break;
                }
              }
            }

            // Positional fallback for carName if empty
            if (!carName && rowVals.length >= 5 && typeof rowVals[4] === 'string' && rowVals[4].trim().length > 1) {
              carName = rowVals[4].trim();
            }

            // Positional fallback for regNo if empty
            if (!regNo && rowVals.length >= 6 && typeof rowVals[5] === 'string' && rowVals[5].trim().length > 2) {
              regNo = rowVals[5].trim();
            }

            // Ignore blank or header repetition rows
            if (!custName && !regNo && !numAmount && !serviceType) {
              continue;
            }
            if (String(custName).toLowerCase().includes('name of customer') || String(regNo).toLowerCase().includes('reg. no')) {
              continue;
            }

            const finalMobile = mobile ? mobile.toString().replace(/[^0-9]/g, '').slice(-10) : null;
            const finalAddress = address ? address.toString().trim() : null;
            const finalCarName = (carName || 'Vehicle').toString().trim();
            const rawReg = (regNo || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
            const finalRegNo = rawReg || 'NO-REG';
            const finalService = (serviceType || 'Car Wash & Detailing Service').toString().trim();
            const strRemarks = (remarks || '').toString().trim();

            const targetDate = parseExcelDate(dateRaw, curSheetName);
            const targetDateStr = formatDateStr(targetDate);
            const targetDateTimeStr = formatDateTimeStr(targetDate);

            // Date Filter Check: skip rows outside specified date range
            if (isDateFilterActive) {
              if (curNormFilter.fromDay !== null || curNormFilter.toDay !== null) {
                const targetDay = targetDate.getDate();
                if (curNormFilter.fromDay !== null && targetDay < curNormFilter.fromDay) {
                  skippedDateFilter++;
                  continue;
                }
                if (curNormFilter.toDay !== null && targetDay > curNormFilter.toDay) {
                  skippedDateFilter++;
                  continue;
                }
              } else {
                if (curNormFilter.fromDate && targetDateStr < curNormFilter.fromDate) {
                  skippedDateFilter++;
                  continue;
                }
                if (curNormFilter.toDate && targetDateStr > curNormFilter.toDate) {
                  skippedDateFilter++;
                  continue;
                }
              }
            }

            // Determine Pending vs Paid
            const isPending = /pending|unpaid|due/i.test(strRemarks);

            // Determine Payment Mode
            let payMode = 'cash';
            if (/upi|gpay|google\s*pay|phonepe|paytm|online|qr|scan/i.test(strRemarks)) payMode = 'upi';
            else if (/card|pos|debit|credit/i.test(strRemarks)) payMode = 'card';
            else if (/bank|transfer|neft|rtgs|cheque/i.test(strRemarks)) payMode = 'bank';

            // Check Duplicate (if enabled)
            if (skip_duplicates === 'true' && finalRegNo !== 'NO-REG' && numAmount > 0) {
              const [dupJc] = await db.query(
                "SELECT id FROM job_cards WHERE reg_no = ? AND DATE(job_date) = ? AND ABS(final_amount - ?) < 1",
                [finalRegNo, targetDateStr, numAmount]
              );
              if (dupJc.length > 0) {
                skipped++;
                continue;
              }
            }

            // A. Customer Upsert & Lookup
            let finalCustName = (custName || '').toString().trim();
            let customerId = null;

            if (finalMobile && finalMobile.length >= 10) {
              const [exCust] = await db.query("SELECT id, customer_name, address_line FROM customers WHERE mobile_no = ? LIMIT 1", [finalMobile]);
              if (exCust.length > 0) {
                customerId = exCust[0].id;
                if (!finalCustName && exCust[0].customer_name) {
                  finalCustName = exCust[0].customer_name;
                }
                if (finalAddress && !exCust[0].address_line) {
                  await db.execute("UPDATE customers SET address_line = ? WHERE id = ?", [finalAddress, customerId]);
                }
              } else {
                const nameToInsert = finalCustName || 'Walk-in Customer';
                const [cRes] = await db.execute(
                  "INSERT INTO customers (customer_type, customer_name, mobile_no, address_line) VALUES ('individual', ?, ?, ?)",
                  [nameToInsert, finalMobile, finalAddress]
                );
                customerId = cRes.insertId;
                if (!finalCustName) finalCustName = nameToInsert;
              }
            } else if (finalCustName && finalCustName.toLowerCase() !== 'walk-in customer') {
              const [exCustName] = await db.query("SELECT id FROM customers WHERE customer_name = ? LIMIT 1", [finalCustName]);
              if (exCustName.length > 0) customerId = exCustName[0].id;
            }

            // If name is still empty, try to lookup by vehicle registration
            if (!finalCustName || finalCustName.toLowerCase() === 'walk-in customer') {
              if (finalRegNo && finalRegNo !== 'NO-REG') {
                const [vehCust] = await db.query(
                  "SELECT c.id as cust_id, c.customer_name, c.mobile_no FROM vehicles v JOIN customers c ON v.customer_id = c.id WHERE v.reg_no = ? LIMIT 1",
                  [finalRegNo]
                );
                if (vehCust.length > 0) {
                  if (!customerId) customerId = vehCust[0].cust_id;
                  finalCustName = vehCust[0].customer_name;
                }
              }
            }
            if (!finalCustName) finalCustName = 'Walk-in Customer';

            // B. Vehicle Upsert
            let vehicleId = null;
            if (finalRegNo && finalRegNo !== 'NO-REG') {
              const [exVeh] = await db.query("SELECT id FROM vehicles WHERE reg_no = ? LIMIT 1", [finalRegNo]);
              if (exVeh.length > 0) {
                vehicleId = exVeh[0].id;
              } else {
                const [vRes] = await db.execute(
                  "INSERT INTO vehicles (customer_id, reg_no, model, make) VALUES (?, ?, ?, ?)",
                  [customerId, finalRegNo, finalCarName, detectMake(finalCarName)]
                );
                vehicleId = vRes.insertId;
              }
            }

            // C. Accessory Sale record (if service is an accessory)
            const isAccessory = /mat|matting|mud\s*flap|perfume|freshener|pillow|cover|cloth|shiner|polish|accessory|accessories|wiper|horn|led|light/i.test(finalService);
            if (isAccessory && numAmount > 0) {
              try {
                const accInvNo = `ACC-${String(nextAccNum++).padStart(4, '0')}`;
                const itemsJson = JSON.stringify([{
                  product_name: finalService,
                  qty: 1,
                  price: numAmount,
                  total: numAmount
                }]);
                const accCarName = finalCarName && finalCarName !== 'Vehicle' ? finalCarName : null;
                const accVehNo = finalRegNo && finalRegNo !== 'NO-REG' ? finalRegNo : null;
                await db.execute(
                  `INSERT INTO product_sales (invoice_no, product_name, price, qty, customer_name, customer_mobile, customer_address, payment_mode, sale_date, company, items, car_name, vehicle_no)
                   VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 'Accessories', ?, ?, ?)`,
                  [accInvNo, finalService, numAmount, finalCustName, finalMobile, finalAddress, isPending ? 'pending' : payMode, targetDateStr, itemsJson, accCarName, accVehNo]
                );
                accessoriesCreated++;
              } catch (accErr) {
                console.warn('Accessory sale insert warning:', accErr.message);
              }
            }

            // D. Job Card Creation
            const job_no = `HCW${String(nextJobNum++).padStart(3, '0')}`;
            const public_token = uuidv4();
            let company = 'Car Wash';
            let jobCategory = 'wash';
            let isQuickJob = 1;

            const isTeflonOrDeluxe = /delux|dlx|teflon|taflon/i.test(finalService) || /delux|dlx|teflon|taflon/i.test(strRemarks);
            const isDetailingService =
              !isTeflonOrDeluxe && (
                /coat|coting|ceram|ciram|ppf|paint|polish|detail|rubb|buff|studio|interior|dry\s*clean|deep\s*clean|graphene|glass|headlight|spa|decontam/i.test(finalService) ||
                /coat|coting|ceram|ciram|ppf|paint|polish|detail|rubb|buff|studio|interior|dry\s*clean|deep\s*clean|graphene|glass|headlight|spa|decontam/i.test(strRemarks) ||
                (numAmount >= 1500 && !/^(car\s*wash|wash|foam\s*wash|water\s*wash|body\s*wash|diesel\s*wash|delux.*|dlx.*|teflon.*)$/i.test(finalService.trim()))
              );

            if (isDetailingService) {
              company = 'Detailing Studio';
              jobCategory = 'detailing';
              isQuickJob = 0;
            } else if (isAccessory && !/wash/i.test(finalService)) {
              company = 'Accessories';
              jobCategory = 'accessories';
              isQuickJob = 0;
            } else {
              company = 'Car Wash';
              jobCategory = 'wash';
              isQuickJob = 1;
            }

            const invStatus = isPending ? 'pending' : 'paid';

            const [jcRes] = await db.execute(
              `INSERT INTO job_cards (job_no, reg_no, car_name, owner_name, mobile_no, customer_id, vehicle_id, status, completion_type, final_amount, payment_mode, notes, service_type, job_category, vehicle_make, vehicle_model, job_date, closed_at, is_quick_job, public_token, invoice_status, non_gst_invoice_status, company)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'delivered', 'invoice', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                job_no, finalRegNo, finalCarName, finalCustName, finalMobile, customerId, vehicleId,
                numAmount, isPending ? 'pending' : payMode, strRemarks || null, finalService, jobCategory,
                detectMake(finalCarName), finalCarName, targetDateStr, targetDateTimeStr,
                isQuickJob, public_token, invStatus, invStatus, company
              ]
            );
            const jobId = jcRes.insertId;
            jobCardsCreated++;

            // E. Job Card Service Line Item
            await db.execute(
              `INSERT INTO job_card_services (job_card_id, service_name, item_type, qty, rate, amount, tax_pct, tax_amount, is_selected, hsn_sac, job_category)
               VALUES (?, ?, 'labour', 1, ?, ?, 0, 0, 1, '998714', ?)`,
              [jobId, finalService, numAmount, numAmount, jobCategory]
            );

            // F. Non-GST Invoice Record
            const estInvNo = `EST-${job_no}`;
            await db.execute(
              `INSERT INTO invoices_non_gst (job_card_id, invoice_no, subtotal, total_amount, payment_mode, customer_name, mobile_no, reg_no, car_name, payment_status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                jobId, estInvNo, numAmount, numAmount, isPending ? 'pending' : payMode,
                finalCustName, finalMobile, finalRegNo, finalCarName, invStatus, targetDateTimeStr
              ]
            );

            // G. Payment & Cash Ledger if Paid
            if (!isPending && numAmount > 0) {
              const servicesSnapshot = JSON.stringify([{
                service_name: finalService,
                rate: numAmount,
                qty: 1,
                amount: numAmount
              }]);
              await db.execute(
                `INSERT INTO customer_payments (job_card_id, amount, payment_mode, payment_date, remarks, created_by, owner_name, mobile_no, reg_no, car_name, address, services_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  jobId, numAmount, payMode, targetDateStr,
                  strRemarks ? `Imported: ${strRemarks}` : 'Imported Paid',
                  req.user?.id || 1,
                  finalCustName, finalMobile, finalRegNo, finalCarName, finalAddress,
                  servicesSnapshot
                ]
              );
              paidCount++;

              try {
                const ledgerDesc = `Payment received for Job Card ${job_no} (${finalRegNo}) (Mode: ${payMode})`;
                await db.execute(
                  `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
                   VALUES ('in', ?, 'Customer Payment', ?, ?, ?)`,
                  [numAmount, ledgerDesc.slice(0, 480), targetDateTimeStr, company]
                );
              } catch (ledgErr) {
                console.warn('Cash ledger insert warning in import:', ledgErr.message);
              }
            } else if (isPending) {
              pendingCount++;
            }

            imported++;

          // ==========================================
          // 2. CUSTOMERS ONLY IMPORT
          // ==========================================
          } else if (activeType === 'customers') {
            const custName = getValueByAliases(row, ['customer_name', 'name', 'customer name', 'owner_name', 'owner name', 'contact_name', 'client_name', 'client']);
            const mobile = getValueByAliases(row, ['mobile_no', 'mobile', 'mobile_number', 'phone', 'phone_number', 'contact_no', 'contact']);
            
            if (!custName || !mobile) { 
              errors.push({ row: i+2, errors: ['Customer name and mobile number are required'] }); 
              continue; 
            }
            
            const cleanMobile = mobile.toString().replace(/[^0-9]/g, '').slice(-10);
            if (skip_duplicates === 'true') {
              const [ex] = await db.query('SELECT id FROM customers WHERE mobile_no = ?', [cleanMobile]);
              if (ex.length) { skipped++; continue; }
            }
            
            let cType = (getValueByAliases(row, ['customer_type', 'type', 'customer type']) || 'individual').toString().toLowerCase().trim();
            if (!['individual', 'corporate', 'fleet'].includes(cType)) cType = 'individual';
            
            const companyName = getValueByAliases(row, ['company_name', 'company', 'company name', 'firm_name', 'firm']) || null;
            const gstin = getValueByAliases(row, ['gstin', 'gst', 'gst_no', 'gst_number']) || null;
            const email = getValueByAliases(row, ['email', 'email_address', 'mail']) || null;
            const city = getValueByAliases(row, ['city', 'town']) || null;
            const state = getValueByAliases(row, ['state', 'region']) || null;
            const pincode = getValueByAliases(row, ['pincode', 'pin', 'zip', 'zipcode']) || null;
            const addressLine = getValueByAliases(row, ['address', 'address_line', 'street', 'location']) || null;

            await db.execute('INSERT INTO customers (customer_type,customer_name,company_name,gstin,mobile_no,email,city,state,pincode,address_line) VALUES (?,?,?,?,?,?,?,?,?,?)',
              [cType, custName.toString().trim(), companyName, gstin, cleanMobile, email, city, state, pincode, addressLine]);
            imported++;

          // ==========================================
          // 3. VEHICLES ONLY IMPORT
          // ==========================================
          } else if (activeType === 'vehicles') {
            const regNo = getValueByAliases(row, ['reg_no', 'registration_no', 'registration', 'reg number', 'vehicle_number', 'vehicle_no', 'plate_no', 'plate', 'car_number', 'car_no']);
            if (!regNo) { 
              errors.push({ row: i+2, errors: ['Registration number (reg_no) is required'] }); 
              continue; 
            }
            
            const cleanReg = regNo.toString().toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
            if (skip_duplicates === 'true') {
              const [ex] = await db.query('SELECT id FROM vehicles WHERE reg_no = ?', [cleanReg]);
              if (ex.length) { skipped++; continue; }
            }
            
            const custMobile = getValueByAliases(row, ['customer_mobile', 'mobile', 'owner_mobile', 'customer_phone', 'mobile_no']);
            let custId = null;
            if (custMobile) { 
              const [c] = await db.query('SELECT id FROM customers WHERE mobile_no = ? LIMIT 1', [custMobile.toString().replace(/[^0-9]/g, '').slice(-10)]); 
              if (c.length) custId = c[0].id; 
            }
            
            const make = getValueByAliases(row, ['make', 'brand', 'company', 'manufacturer']) || null;
            const model = getValueByAliases(row, ['model', 'vehicle_model', 'car_model', 'car_name']) || null;
            const year = getValueByAliases(row, ['year', 'mfg_year', 'manufacturing_year']) || null;
            let fuel = (getValueByAliases(row, ['fuel_type', 'fuel', 'engine_type']) || 'petrol').toString().toLowerCase().trim();
            if (!['petrol', 'diesel', 'cng', 'electric', 'hybrid'].includes(fuel)) fuel = 'petrol';
            
            const color = getValueByAliases(row, ['vehicle_color', 'color', 'colour']) || null;
            const variant = getValueByAliases(row, ['variant', 'version']) || null;
            const vin = getValueByAliases(row, ['vin', 'chassis_no', 'chassis']) || null;
            const engineNo = getValueByAliases(row, ['engine_no', 'engine_number', 'engine']) || null;

            await db.execute('INSERT INTO vehicles (customer_id,reg_no,make,model,year,fuel_type,vehicle_color,variant,vin,engine_no) VALUES (?,?,?,?,?,?,?,?,?,?)',
              [custId, cleanReg, make || detectMake(model), model, year, fuel, color, variant, vin, engineNo]);
            imported++;

          // ==========================================
          // 4. SERVICE CATALOG IMPORT
          // ==========================================
          } else if (activeType === 'service_catalog') {
            const itemName = getValueByAliases(row, ['name', 'item_name', 'service_name', 'description', 'title', 'part_name']);
            if (!itemName) { 
              errors.push({ row: i+2, errors: ['Item name is required'] }); 
              continue; 
            }
            
            let cat = (getValueByAliases(row, ['category', 'group']) || 'general').toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
            const validCats = ['relevant_parts', 'all_services', 'wheel_alignment', 'wheel_balancing', 'wash_detailing', 'pms_checkup', 'tyres_services', 'general'];
            if (!validCats.includes(cat)) cat = 'general';
            
            let iType = (getValueByAliases(row, ['item_type', 'type', 'service_type']) || 'labour').toString().toLowerCase().trim();
            if (iType === 'service' || iType === 'labor') iType = 'labour';
            if (!['part', 'labour'].includes(iType)) iType = 'labour';
            
            const rate = parseFloat(getValueByAliases(row, ['rate', 'default_rate', 'price', 'amount', 'cost']) || 0);
            const hsnSac = getValueByAliases(row, ['hsn_sac', 'hsn', 'sac', 'part_no', 'code']) || null;
            const taxPct = parseFloat(getValueByAliases(row, ['tax_pct', 'tax_percent', 'gst_percent']) || 18);

            await db.execute('INSERT INTO service_catalog (name, category, item_type, default_rate, hsn_sac, tax_pct) VALUES (?, ?, ?, ?, ?, ?)',
              [itemName.toString().trim(), cat, iType, rate, hsnSac, taxPct]);
            imported++;
          }
        } catch (rowErr) { 
          errors.push({ row: i+2, sheet: curSheetName, errors: [rowErr.message] }); 
        }
      }
    }

    // Clean up uploaded file
    try {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    } catch { /* ignore */ }

    let successMsg = `Successfully imported ${imported} records.`;
    if (activeType === 'working_sheet' || activeType === 'operations' || activeType === 'job_cards') {
      if (isDateFilterActive) {
        const rangeText = (cleanFromDate && cleanToDate)
          ? `${cleanFromDate} to ${cleanToDate}`
          : (cleanFromDate ? `from ${cleanFromDate}` : `up to ${cleanToDate}`);
        successMsg = `Import completed! Created ${jobCardsCreated} Job Cards (${paidCount} Paid, ${pendingCount} Pending Payments) and ${accessoriesCreated} Accessory entries for dates ${rangeText} (${skippedDateFilter} records outside this range were skipped).`;
      } else {
        successMsg = `Import completed! Created ${jobCardsCreated} Job Cards (${paidCount} Paid, ${pendingCount} Pending Payments) and ${accessoriesCreated} Accessory entries.`;
      }
    }

    res.json({
      message: successMsg,
      imported,
      skipped,
      skipped_date_filter: skippedDateFilter,
      date_filter: isDateFilterActive ? {
        active: true,
        from_date: cleanFromDate,
        to_date: cleanToDate,
        skipped: skippedDateFilter
      } : { active: false },
      job_cards_created: jobCardsCreated,
      accessories_created: accessoriesCreated,
      pending_payments_count: pendingCount,
      paid_payments_count: paidCount,
      errors: errors.length,
      error_details: errors.slice(0, 50)
    });
  } catch (err) {
    console.error('Import execute error:', err);
    res.status(500).json({ error: 'Failed to execute import: ' + err.message });
  }
});

module.exports = router;
