const path = require('path');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const pool = require('../src/config/db');

// File path to the excel workbook
const EXCEL_PATH = path.join(__dirname, '../../2024_HAAPY CAR WASH WROKING SHEET...xlsx');

async function importSeptember2026(dryRun = false) {
  console.log(`\n======================================================`);
  console.log(`Starting September 2026 Import (Dry Run: ${dryRun})`);
  console.log(`======================================================\n`);

  const wb = XLSX.readFile(EXCEL_PATH);
  if (!wb.Sheets['SEP 2026']) {
    throw new Error("Sheet 'SEP 2026' not found in workbook!");
  }

  const ws = wb.Sheets['SEP 2026'];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Filter valid data rows (row index >= 1)
  const validRows = [];
  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.length === 0) continue;
    const hasVal = r.some(c => c !== null && c !== undefined && String(c).trim() !== '');
    if (hasVal) {
      validRows.push({ rowIndex: i + 1, data: r });
    }
  }

  console.log(`Found ${validRows.length} valid rows in 'SEP 2026'.`);

  // Parse and prepare all records
  const preparedJobs = [];
  const preparedAccessories = [];

  // Group by date to generate realistic sequential timestamps (e.g. 09:15 + n * 15 min)
  const dateCounts = {};

  for (let idx = 0; idx < validRows.length; idx++) {
    const { rowIndex, data: r } = validRows[idx];
    const [dateSerial, rawName, rawMobile, rawAddress, rawCarName, rawRegNo, rawServiceType, rawAmount, rawRemarks, col9, col10] = r;

    // 1. Date
    let dateObj;
    if (typeof dateSerial === 'number') {
      const parsed = XLSX.SSF.parse_date_code(dateSerial);
      dateObj = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    } else if (dateSerial) {
      dateObj = new Date(dateSerial);
    } else {
      dateObj = new Date('2026-09-01');
    }

    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Sequential timestamp within day
    dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    const itemOfDay = dateCounts[dateStr];
    const totalMinutes = 9 * 60 + (itemOfDay * 15);
    const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    const seconds = String((itemOfDay * 7) % 60).padStart(2, '0');
    const dateTimeStr = `${dateStr} ${hours}:${minutes}:${seconds}`;

    // 2. Customer fields
    const nameStr = rawName ? String(rawName).trim() : '';
    const mobileStr = rawMobile ? String(rawMobile).replace(/[^0-9]/g, '').slice(-10) : '';
    const addressStr = rawAddress ? String(rawAddress).trim() : '';
    const customerName = nameStr || (rawRegNo ? `Customer (${String(rawRegNo).trim()})` : 'Walk-in Customer');

    // 3. Vehicle fields
    const regNoStr = rawRegNo ? String(rawRegNo).toUpperCase().replace(/\s+/g, ' ').trim() : `GJ-HCW-${String(idx + 1).padStart(3, '0')}`;
    const carNameStr = rawCarName ? String(rawCarName).trim() : 'Car';

    // 4. Service and Amount
    const serviceName = rawServiceType ? String(rawServiceType).trim() : 'Executive Wash';
    const amountVal = parseFloat(rawAmount) || 0;

    // Normalize service name
    let normalizedService = serviceName;
    if (serviceName.toLowerCase() === 'executive wash') normalizedService = 'Executive Wash';
    else if (serviceName.toLowerCase() === 'delux wash') normalizedService = 'Delux Wash';
    else if (serviceName.toLowerCase() === 'wash') normalizedService = 'Wash';
    else if (serviceName.toLowerCase() === 'ppf coting') normalizedService = 'PPF Coating';
    else if (serviceName.toLowerCase() === 'teflon coting') normalizedService = 'Teflon Coating';
    else if (serviceName.toLowerCase() === 'ceramic coting') normalizedService = 'Ceramic Coating';
    else if (serviceName.toLowerCase() === 'glass bufing') normalizedService = 'Glass Buffing';
    else if (serviceName.toLowerCase() === 'ppf intrior') normalizedService = 'PPF Interior';
    else if (serviceName.toLowerCase() === 'flooring clean') normalizedService = 'Flooring Clean';
    else if (serviceName.toLowerCase() === 'one step compound') normalizedService = 'One Step Compound';

    // 5. Company categorization
    const detailingServices = [
      'PPF Coating', 'PPF Coting', 'One Step Compound', 'One step compound',
      'Teflon Coating', 'Teflon Coting', 'Ceramic Coating', 'Ceramic Coting',
      'Glass Buffing', 'Glass Bufing', 'PPF Interior', 'PPF Intrior', 'Flooring Clean', 'Flooring clean'
    ];
    const isDetailing = detailingServices.some(s => s.toLowerCase() === normalizedService.toLowerCase());
    const company = isDetailing ? 'Detailing Studio' : 'Car Wash';

    // 6. Remarks and Payment Status
    const remarksStr = rawRemarks ? String(rawRemarks).trim() : '';
    const remarksLower = remarksStr.toLowerCase();
    const isPending = remarksLower.includes('pending') || remarksLower.includes('baki');
    const paymentMode = isPending ? 'pending' : 'cash';
    const paymentStatus = isPending ? 'outstanding' : 'approved';

    // Extra notes if staff or wax or details mentioned in remarks or col9
    const notesArr = [];
    if (remarksStr && !['pending'].includes(remarksLower)) notesArr.push(remarksStr);
    if (col9 && typeof col9 === 'string' && isNaN(Number(col9))) notesArr.push(String(col9).trim());
    if (col9 && !isNaN(Number(col9)) && String(col9).length === 10) notesArr.push(`Alt Mobile: ${col9}`);
    if (col10 && typeof col10 === 'string' && isNaN(Number(col10)) && !['ppf', '9d', 'key cover', 'mudfalb'].includes(String(col10).toLowerCase().trim())) {
      notesArr.push(String(col10).trim());
    }
    const notes = notesArr.length > 0 ? notesArr.join(' | ') : null;

    preparedJobs.push({
      customerName,
      mobile: mobileStr || null,
      address: addressStr || null,
      regNo: regNoStr,
      carName: carNameStr,
      serviceName: normalizedService,
      amount: amountVal,
      company,
      isPending,
      paymentMode,
      paymentStatus,
      dateTimeStr,
      dateStr,
      notes,
      sourceRow: rowIndex
    });

    // Check row 243 for extra PPF Detailing job
    if (col9 && !isNaN(parseFloat(col9)) && col10 && String(col10).toLowerCase().includes('ppf')) {
      const extraPpfAmount = parseFloat(col9);
      preparedJobs.push({
        customerName,
        mobile: mobileStr || null,
        address: addressStr || null,
        regNo: regNoStr,
        carName: carNameStr,
        serviceName: 'PPF Coating',
        amount: extraPpfAmount,
        company: 'Detailing Studio',
        isPending: false,
        paymentMode: 'cash',
        paymentStatus: 'approved',
        dateTimeStr: `${dateStr} ${hours}:${minutes}:${String(Number(seconds) + 1).padStart(2, '0')}`,
        dateStr,
        notes: 'PPF Full Body Detailing (from working sheet)',
        sourceRow: rowIndex
      });
    }

    // Check for accessories in col9/col10 (rows 244, 245, 246)
    if (col9 && !isNaN(parseFloat(col9)) && col10 && !String(col10).toLowerCase().includes('ppf')) {
      const accPrice = parseFloat(col9);
      const accName = String(col10).trim();
      let formattedAccName = accName;
      if (accName === '9D') formattedAccName = '9D Matting';
      else if (accName.toUpperCase() === 'KEY COVER') formattedAccName = 'Key Cover';
      else if (accName.toUpperCase() === 'MUDFALB') formattedAccName = 'Mud Flap';

      preparedAccessories.push({
        productName: formattedAccName,
        price: accPrice,
        customerName,
        customerMobile: mobileStr || null,
        customerAddress: addressStr || null,
        paymentMode: 'cash', // enum('cash','upi','card','bank')
        saleDate: dateTimeStr,
        company: 'Accessories',
        sourceRow: rowIndex
      });
    }
  }

  console.log(`Prepared Summary for September 2026:`);
  console.log(`- Job Cards: ${preparedJobs.length}`);
  console.log(`  - Car Wash: ${preparedJobs.filter(j => j.company === 'Car Wash').length}`);
  console.log(`  - Detailing Studio: ${preparedJobs.filter(j => j.company === 'Detailing Studio').length}`);
  console.log(`  - Payment Done (Paid): ${preparedJobs.filter(j => !j.isPending).length}`);
  console.log(`  - Payment Pending (Outstanding): ${preparedJobs.filter(j => j.isPending).length}`);
  console.log(`  - Total Job Revenue: Rs. ${preparedJobs.reduce((s, j) => s + j.amount, 0).toLocaleString('en-IN')}`);
  console.log(`- Accessories Sales: ${preparedAccessories.length}`);
  preparedAccessories.forEach(a => console.log(`  - ${a.productName} for ${a.customerName}: Rs. ${a.price} (${a.paymentMode})`));

  if (dryRun) {
    console.log('\n[Dry Run Mode] No changes made to MySQL database.');
    return;
  }

  // Execute database operations within transaction
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    console.log('\n1. Cleaning previous test operational records (Clean Slate)...');
    await conn.query('DELETE FROM customer_payments');
    await conn.query('DELETE FROM invoices');
    await conn.query('DELETE FROM invoices_non_gst');
    await conn.query('DELETE FROM job_card_services');
    await conn.query('DELETE FROM job_card_media');
    await conn.query('DELETE FROM customer_concerns');
    await conn.query('DELETE FROM advance_payments');
    await conn.query("DELETE FROM cash_ledger WHERE category IN ('Customer Payment', 'Product Sale')");
    await conn.query('DELETE FROM product_sales');
    await conn.query('DELETE FROM job_cards');
    await conn.query('DELETE FROM vehicles');
    await conn.query('DELETE FROM customers');

    // Reset auto-increment counters
    await conn.query('ALTER TABLE customers AUTO_INCREMENT = 1');
    await conn.query('ALTER TABLE vehicles AUTO_INCREMENT = 1');
    await conn.query('ALTER TABLE job_cards AUTO_INCREMENT = 1');
    await conn.query('ALTER TABLE job_card_services AUTO_INCREMENT = 1');
    await conn.query('ALTER TABLE invoices AUTO_INCREMENT = 1');
    await conn.query('ALTER TABLE customer_payments AUTO_INCREMENT = 1');
    await conn.query('ALTER TABLE product_sales AUTO_INCREMENT = 1');

    console.log('Operational tables cleared.');

    // Cache customer and vehicle IDs
    const customerCache = new Map(); // key: mobile || name
    const vehicleCache = new Map();  // key: regNo

    console.log('\n2. Inserting Customers, Vehicles, Job Cards, Services, Invoices, and Payments...');

    let jobSeq = 1;

    for (let i = 0; i < preparedJobs.length; i++) {
      const job = preparedJobs[i];

      // A. Customer
      const custKey = job.mobile ? job.mobile : `${job.customerName.toLowerCase()}_${job.regNo}`;
      let customerId = customerCache.get(custKey);

      if (!customerId) {
        const [cRes] = await conn.execute(
          `INSERT INTO customers (customer_name, mobile_no, address_line, customer_type, created_at)
           VALUES (?, ?, ?, 'individual', ?)`,
          [job.customerName, job.mobile || '', job.address || null, job.dateTimeStr]
        );
        customerId = cRes.insertId;
        customerCache.set(custKey, customerId);
      }

      // B. Vehicle
      let vehicleId = vehicleCache.get(job.regNo);
      if (!vehicleId) {
        const [vRes] = await conn.execute(
          `INSERT INTO vehicles (customer_id, reg_no, model, make, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [customerId, job.regNo, job.carName, job.carName, job.dateTimeStr]
        );
        vehicleId = vRes.insertId;
        vehicleCache.set(job.regNo, vehicleId);
      }

      // C. Sequential Numbers
      const jobNo = `HCW${String(jobSeq).padStart(3, '0')}`;
      const rfeNo = `HCW${String(jobSeq).padStart(3, '0')}`;
      const invoiceNo = `HCW${String(jobSeq).padStart(3, '0')}`;
      const publicToken = uuidv4();

      // D. Insert Job Card
      const [jcRes] = await conn.execute(
        `INSERT INTO job_cards (
          job_no, rfe_no, reg_no, car_name, owner_name, mobile_no,
          customer_id, vehicle_id, service_type, status, completion_type,
          final_amount, payment_mode, notes, company, job_date, closed_at,
          created_at, updated_at, public_token, is_quick_job,
          invoice_status, gst_invoice_status
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, 'invoiced', 'invoice',
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, 1,
          ?, ?
        )`,
        [
          jobNo, rfeNo, job.regNo, job.carName, job.customerName, job.mobile,
          customerId, vehicleId, job.serviceName,
          job.amount, job.paymentMode, job.notes, job.company, job.dateTimeStr, job.dateTimeStr,
          job.dateTimeStr, job.dateTimeStr, publicToken,
          job.isPending ? 'pending' : 'paid',
          job.isPending ? 'pending' : 'paid'
        ]
      );
      const jobCardId = jcRes.insertId;

      // E. Insert Job Card Service Item
      await conn.execute(
        `INSERT INTO job_card_services (
          job_card_id, service_name, item_type, qty, rate, amount,
          tax_pct, tax_amount, is_selected, created_at
        ) VALUES (?, ?, 'labour', 1, ?, ?, 0.00, 0.00, 1, ?)`,
        [jobCardId, job.serviceName, job.amount, job.amount, job.dateTimeStr]
      );

      // F. Insert Standard Invoice with 0% GST (matching exact amount)
      await conn.execute(
        `INSERT INTO invoices (
          job_card_id, invoice_no, subtotal, gst_percent, gst_amount,
          total_amount, payment_mode, gst_type, payment_status, created_at
        ) VALUES (?, ?, ?, 0.00, 0.00, ?, ?, 'without_gst', ?, ?)`,
        [
          jobCardId, invoiceNo, job.amount, job.amount,
          job.paymentMode, job.paymentStatus, job.dateTimeStr
        ]
      );

      // G. If payment is DONE, record Customer Payment & Cash Ledger entry
      if (!job.isPending) {
        await conn.execute(
          `INSERT INTO customer_payments (
            job_card_id, amount, payment_mode, payment_date, remarks, created_by, created_at
          ) VALUES (?, ?, 'cash', ?, ?, 1, ?)`,
          [
            jobCardId, job.amount, job.dateStr,
            `Payment received for Invoice ${invoiceNo}`,
            job.dateTimeStr
          ]
        );

        await conn.execute(
          `INSERT INTO cash_ledger (
            entry_type, amount, category, description, entry_date, company, created_at
          ) VALUES ('in', ?, 'Customer Payment', ?, ?, ?, ?)`,
          [
            job.amount,
            `Payment received for Job Card ${jobNo} (Invoice ${invoiceNo}) via cash`,
            job.dateTimeStr,
            job.company,
            job.dateTimeStr
          ]
        );
      }

      jobSeq++;
    }

    console.log(`Successfully created ${preparedJobs.length} Job Cards with Invoices!`);

    // 3. Insert Accessories Sales
    console.log('\n3. Inserting Accessory Sales & Invoices...');
    let accSeq = 1;
    for (const acc of preparedAccessories) {
      const invoiceNo = `ACC-${String(accSeq).padStart(4, '0')}`;
      await conn.execute(
        `INSERT INTO product_sales (
          invoice_no, product_name, price, qty, tax_pct, tax_amount,
          customer_name, customer_mobile, customer_address, payment_mode,
          sale_date, created_at, company
        ) VALUES (?, ?, ?, 1, 0.00, 0.00, ?, ?, ?, ?, ?, ?, 'Accessories')`,
        [
          invoiceNo, acc.productName, acc.price,
          acc.customerName, acc.customerMobile, acc.customerAddress,
          acc.paymentMode, acc.saleDate, acc.saleDate
        ]
      );

      // Record in cash ledger
      await conn.execute(
        `INSERT INTO cash_ledger (
          entry_type, amount, category, description, entry_date, company, created_at
        ) VALUES ('in', ?, 'Product Sale', ?, ?, 'Accessories', ?)`,
        [
          acc.price,
          `Sold accessory: ${acc.productName} (${invoiceNo}) to ${acc.customerName}`,
          acc.saleDate,
          acc.saleDate
        ]
      );

      accSeq++;
    }
    console.log(`Successfully created ${preparedAccessories.length} Accessory Sales & Invoices!`);

    await conn.commit();
    conn.release();
    console.log('\n======================================================');
    console.log('✅ ALL SEPTEMBER 2026 DATA COMMITTED SUCCESSFULLY!');
    console.log('======================================================\n');

  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('❌ Import failed and rolled back:', err);
    throw err;
  }
}

// Check CLI arguments
const isDry = process.argv.includes('--dry');
importSeptember2026(isDry)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
