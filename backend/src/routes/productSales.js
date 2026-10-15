const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const auth = require('../middleware/auth');
const router = express.Router();

// Authenticate all routes except standalone printable /invoice-html and single invoice preview GET /:id
router.use((req, res, next) => {
  if (req.path.endsWith('/invoice-html') || (req.method === 'GET' && /^\/\d+(\/.*)?$/.test(req.path))) {
    return next();
  }
  return auth(req, res, next);
});

// Ensure product_sales extra columns exist
(async () => {
  try { await db.query("ALTER TABLE product_sales ADD COLUMN company VARCHAR(100) DEFAULT 'Accessories'"); } catch {}
  try { await db.query("ALTER TABLE product_sales ADD COLUMN items LONGTEXT NULL"); } catch {}
  try { await db.query("ALTER TABLE product_sales ADD COLUMN car_name VARCHAR(150) NULL"); } catch {}
  try { await db.query("ALTER TABLE product_sales ADD COLUMN vehicle_no VARCHAR(50) NULL"); } catch {}
})();

// Helper for number to words
function numberToWords(n) {
  n = Math.round(Number(n) || 0);
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numberToWords(n % 100) : '');
  if (n < 100000) return numberToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numberToWords(n % 1000) : '');
  if (n < 10000000) return numberToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numberToWords(n % 100000) : '');
  return numberToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numberToWords(n % 10000000) : '');
}

function fmt(val) {
  return parseFloat(String(val || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeSale(sale) {
  if (!sale) return sale;
  let items = [];
  if (sale.items) {
    try {
      items = typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items;
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items) || items.length === 0) {
    items = [{
      product_name: sale.product_name || 'Accessory Item',
      price: parseFloat(sale.price || 0),
      qty: parseInt(sale.qty || 1, 10),
      total: parseFloat(sale.price || 0)
    }];
  } else {
    items = items.map(it => {
      const q = parseInt(it.qty || 1, 10) || 1;
      const p = parseFloat(it.price || it.rate || 0);
      const tot = it.total !== undefined ? parseFloat(it.total) : (q * p);
      return {
        product_name: it.product_name || 'Accessory Item',
        qty: q,
        price: p,
        total: tot
      };
    });
  }
  return {
    ...sale,
    items
  };
}

// ───── GET /api/product-sales ─────
router.get('/', async (req, res) => {
  try {
    const { date, from, to } = req.query;
    let query = 'SELECT * FROM product_sales';
    const params = [];

    if (date && date !== 'all') {
      query += ' WHERE DATE(sale_date) = ?';
      params.push(date);
    } else if (from && to) {
      query += ' WHERE DATE(sale_date) BETWEEN ? AND ?';
      params.push(from, to);
    }
    query += ' ORDER BY sale_date DESC, id DESC';

    const [rows] = await db.query(query, params);
    res.json({ data: rows.map(r => normalizeSale(r)) });
  } catch (err) {
    console.error('GET /product-sales error:', err);
    res.status(500).json({ error: 'Failed to fetch product sales' });
  }
});

// ───── GET /api/product-sales/:id ─────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM product_sales WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Accessory sale not found' });
    const sale = normalizeSale(rows[0]);

    // Fetch business settings
    let business = {
      name: 'Happy Car Wash & Accessories',
      address: '8/9 GIDC - Vadsar Main Road Mohangiri, opp. Uma Co Op Bank Ltd, near Bank Of Baroda, Makarpura, Vadodara, Gujarat 390010',
      phone: '99986 25511',
      email: 'contact@happycarwash.com',
      gstin: ''
    };
    try {
      const [sRows] = await db.query('SELECT setting_key, setting_value FROM settings');
      for (const r of sRows) {
        if (r.setting_key === 'business_name') business.name = r.setting_value || business.name;
        if (r.setting_key === 'business_address') business.address = r.setting_value || business.address;
        if (r.setting_key === 'business_phone') business.phone = r.setting_value || business.phone;
        if (r.setting_key === 'business_email') business.email = r.setting_value || business.email;
        if (r.setting_key === 'business_gstin') business.gstin = r.setting_value || business.gstin;
      }
    } catch { /* ignore */ }

    res.json({ data: sale, business });
  } catch (err) {
    console.error('GET /product-sales/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch accessory sale' });
  }
});

// ───── GET /api/product-sales/:id/invoice-html ─────
router.get('/:id/invoice-html', async (req, res) => {
  try {
    const { renderRetailInvoiceHtml } = require('../utils/invoiceRenderer');
    const [rows] = await db.query('SELECT * FROM product_sales WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).send('Accessory sale record not found');
    const sale = normalizeSale(rows[0]);

    const invNo = sale.invoice_no || `ACC-${String(sale.id).padStart(4, '0')}`;
    const saleDateRaw = sale.sale_date ? new Date(sale.sale_date) : new Date(sale.created_at);
    const invDate = saleDateRaw.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

    const items = Array.isArray(sale.items) && sale.items.length > 0
      ? sale.items.map(it => ({
          service_name: it.product_name || it.item_name || 'Accessory Item',
          hsn_sac: it.hsn_sac || '',
          qty: parseFloat(it.qty) || 1,
          unit: it.unit || 'Pcs',
          rate: parseFloat(it.price !== undefined ? it.price : (it.total / (it.qty || 1))) || 0,
          amount: parseFloat(it.total !== undefined ? it.total : (it.price * (it.qty || 1))) || 0
        }))
      : [{
          service_name: sale.product_name || 'Accessory Item',
          hsn_sac: '',
          qty: parseInt(sale.qty) || 1,
          unit: 'Pcs',
          rate: parseFloat(sale.price) || 0,
          amount: parseFloat(sale.price || sale.final_amount) || 0
        }];

    const subtotal = items.reduce((s, it) => s + it.amount, 0);
    const finalAmount = parseFloat(sale.final_amount || subtotal);
    const isPaid = sale.payment_status === 'paid' || sale.payment_mode === 'cash' || sale.payment_mode === 'upi';
    const received = parseFloat(sale.received_amount || sale.paid_amount || (isPaid ? finalAmount : 0));

    const html = await renderRetailInvoiceHtml({
      company: 'Accessories',
      jobNo: invNo,
      invNo,
      invDate,
      customerName: sale.customer_name || 'Counter Customer',
      customerAddress: sale.customer_address || sale.address || '',
      customerMobile: sale.customer_mobile || sale.mobile || '',
      customerGstin: sale.gstin || '',
      carName: (sale.car_name && sale.car_name !== sale.product_name) ? sale.car_name : '—',
      regNo: sale.vehicle_no || sale.reg_no || '—',
      items,
      finalAmount,
      advancePaid: received,
      isPaid
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('GET /product-sales/:id/invoice-html error:', err);
    res.status(500).send('Failed to generate accessory invoice');
  }
});

// ───── POST /api/product-sales ─────
router.post('/', async (req, res) => {
  try {
    const { product_name, price, customer_name, customer_mobile, customer_address, qty = 1, payment_mode, tax_pct = 0, sale_date, items, car_name, vehicle_no, reg_no } = req.body;

    let parsedItems = [];
    if (Array.isArray(items) && items.length > 0) {
      parsedItems = items
        .filter(it => it && (it.product_name || '').trim())
        .map(it => {
          const q = parseInt(it.qty || 1, 10) || 1;
          const p = parseFloat(it.price || it.rate || 0);
          const tot = it.total !== undefined ? parseFloat(it.total) : (q * p);
          return {
            product_name: it.product_name.trim(),
            qty: q,
            price: p,
            total: tot
          };
        });
    }

    if (parsedItems.length === 0) {
      const numP = parseFloat(price);
      if (isNaN(numP) || numP <= 0) {
        return res.status(400).json({ error: 'Valid accessory price is required' });
      }
      parsedItems = [{
        product_name: (product_name || 'Accessory Item').trim(),
        qty: parseInt(qty, 10) || 1,
        price: numP,
        total: numP
      }];
    }

    const numPrice = parsedItems.reduce((acc, it) => acc + (parseFloat(it.total) || 0), 0);
    const numQty = parsedItems.reduce((acc, it) => acc + (parseInt(it.qty) || 1), 0);
    const finalProductName = parsedItems.map(it => it.product_name).join(', ').slice(0, 195);
    const itemsJson = JSON.stringify(parsedItems);

    const cleanPayMode = (payment_mode || 'cash').toString().toLowerCase().trim() || 'cash';
    const numTaxPct = parseFloat(tax_pct) || 0;
    const numTaxAmt = numTaxPct > 0 ? parseFloat(((numPrice * numTaxPct) / 100).toFixed(2)) : 0;
    
    let targetSaleDate = new Date();
    if (sale_date) {
      const parsedDate = new Date(sale_date);
      if (!isNaN(parsedDate.getTime())) {
        targetSaleDate = parsedDate;
      }
    }

    const cleanCarName = car_name ? car_name.trim() : null;
    const cleanVehNo = (vehicle_no || reg_no) ? (vehicle_no || reg_no).trim().toUpperCase() : null;

    const [result] = await db.execute(
      `INSERT INTO product_sales (product_name, price, customer_name, customer_mobile, customer_address, qty, tax_pct, tax_amount, payment_mode, sale_date, company, items, car_name, vehicle_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Accessories', ?, ?, ?)`,
      [finalProductName, numPrice, customer_name?.trim() || null, customer_mobile?.trim() || null, customer_address?.trim() || null, numQty, numTaxPct, numTaxAmt, cleanPayMode, targetSaleDate, itemsJson, cleanCarName, cleanVehNo]
    );

    const generatedInvNo = `ACC-${String(result.insertId).padStart(4, '0')}`;
    await db.execute('UPDATE product_sales SET invoice_no = ? WHERE id = ?', [generatedInvNo, result.insertId]);

    // Record in cash ledger defensively (skip if credit)
    if (cleanPayMode !== 'credit') {
      try {
        const rawDesc = `Sold accessory: ${finalProductName} (${generatedInvNo}) to ${customer_name || 'Walk-in'} (Mode: ${cleanPayMode})`;
        const cleanDesc = rawDesc.slice(0, 480);
        await db.execute(
          `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
           VALUES (?, ?, ?, ?, ?, 'Accessories')`,
          ['in', numPrice + numTaxAmt, 'Product Sale', cleanDesc, targetSaleDate]
        );
      } catch (ledgerErr) {
        console.warn('POST /product-sales cash ledger warning:', ledgerErr.message);
      }
    }

    res.status(201).json({
      id: result.insertId,
      invoice_no: generatedInvNo,
      product_name: finalProductName,
      price: numPrice,
      qty: numQty,
      items: parsedItems,
      customer_name,
      sale_date: targetSaleDate,
      message: 'Accessory sale recorded successfully'
    });
  } catch (err) {
    console.error('POST /product-sales error:', err);
    res.status(500).json({ error: 'Failed to record sale: ' + err.message });
  }
});

// ───── PUT /api/product-sales/:id (Edit Bill) ─────
router.put('/:id', async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM product_sales WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Accessory sale not found' });
    const old = existing[0];

    const { product_name, price, customer_name, customer_mobile, customer_address, qty = 1, payment_mode, tax_pct, sale_date, items, car_name, vehicle_no, reg_no } = req.body;

    let parsedItems = [];
    if (Array.isArray(items) && items.length > 0) {
      parsedItems = items
        .filter(it => it && (it.product_name || '').trim())
        .map(it => {
          const q = parseInt(it.qty || 1, 10) || 1;
          const p = parseFloat(it.price || it.rate || 0);
          const tot = it.total !== undefined ? parseFloat(it.total) : (q * p);
          return {
            product_name: it.product_name.trim(),
            qty: q,
            price: p,
            total: tot
          };
        });
    }

    let numPrice, numQty, finalProductName, itemsJson;
    if (parsedItems.length > 0) {
      numPrice = parsedItems.reduce((acc, it) => acc + (parseFloat(it.total) || 0), 0);
      numQty = parsedItems.reduce((acc, it) => acc + (parseInt(it.qty) || 1), 0);
      finalProductName = parsedItems.map(it => it.product_name).join(', ').slice(0, 195);
      itemsJson = JSON.stringify(parsedItems);
    } else {
      finalProductName = (product_name || old.product_name || 'Accessory Item').trim();
      numPrice = price !== undefined ? parseFloat(price) : parseFloat(old.price);
      numQty = qty !== undefined ? (parseInt(qty, 10) || 1) : (parseInt(old.qty, 10) || 1);
      parsedItems = [{ product_name: finalProductName, price: numPrice, qty: numQty, total: numPrice }];
      itemsJson = old.items || JSON.stringify(parsedItems);
    }

    if (isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }

    const cleanPayMode = (payment_mode || old.payment_mode || 'cash').toString().toLowerCase().trim() || 'cash';
    const numTaxPct = tax_pct !== undefined ? parseFloat(tax_pct) : parseFloat(old.tax_pct || 0);
    const numTaxAmt = numTaxPct > 0 ? parseFloat(((numPrice * numTaxPct) / 100).toFixed(2)) : 0;
    
    let targetSaleDate = old.sale_date || new Date();
    if (sale_date) {
      const parsedDate = new Date(sale_date);
      if (!isNaN(parsedDate.getTime())) {
        targetSaleDate = parsedDate;
      }
    }

    const cleanCarName = car_name !== undefined ? (car_name ? car_name.trim() : null) : old.car_name;
    const cleanVehNo = (vehicle_no || reg_no) !== undefined ? ((vehicle_no || reg_no) ? (vehicle_no || reg_no).trim().toUpperCase() : null) : old.vehicle_no;

    await db.execute(
      `UPDATE product_sales 
       SET product_name = ?, price = ?, customer_name = ?, customer_mobile = ?, customer_address = ?, qty = ?, tax_pct = ?, tax_amount = ?, payment_mode = ?, sale_date = ?, items = ?, car_name = ?, vehicle_no = ?
       WHERE id = ?`,
      [
        finalProductName, numPrice, customer_name !== undefined ? (customer_name?.trim() || null) : old.customer_name,
        customer_mobile !== undefined ? (customer_mobile?.trim() || null) : old.customer_mobile,
        customer_address !== undefined ? (customer_address?.trim() || null) : old.customer_address,
        numQty, numTaxPct, numTaxAmt, cleanPayMode, targetSaleDate, itemsJson, cleanCarName, cleanVehNo, req.params.id
      ]
    );

    const invNo = old.invoice_no || `ACC-${String(old.id).padStart(4, '0')}`;
    const newTotal = numPrice + numTaxAmt;
    const rawDesc = `Sold accessory: ${finalProductName} (${invNo}) to ${customer_name || old.customer_name || 'Walk-in'} (Mode: ${cleanPayMode})`;
    const cleanDesc = rawDesc.slice(0, 480);

    // Update or sync cash ledger defensively
    try {
      const [ledgerMatches] = await db.query(
        "SELECT id FROM cash_ledger WHERE category = 'Product Sale' AND (description LIKE ? OR description LIKE ?)",
        [`%(${invNo})%`, `%${old.product_name}%`]
      );
      if (cleanPayMode === 'credit') {
        if (ledgerMatches.length > 0) {
          await db.execute("DELETE FROM cash_ledger WHERE id = ?", [ledgerMatches[0].id]);
        }
      } else {
        if (ledgerMatches.length > 0) {
          await db.execute(
            "UPDATE cash_ledger SET amount = ?, description = ?, entry_date = ?, company = 'Accessories' WHERE id = ?",
            [newTotal, cleanDesc, targetSaleDate, ledgerMatches[0].id]
          );
        } else {
          await db.execute(
            `INSERT INTO cash_ledger (entry_type, amount, category, description, entry_date, company)
             VALUES (?, ?, ?, ?, ?, 'Accessories')`,
            ['in', newTotal, 'Product Sale', cleanDesc, targetSaleDate]
          );
        }
      }
    } catch (ledgerErr) {
      console.warn('PUT /product-sales cash ledger warning:', ledgerErr.message);
    }

    res.json({
      id: old.id,
      invoice_no: invNo,
      product_name: finalProductName,
      price: numPrice,
      qty: numQty,
      items: parsedItems,
      customer_name: customer_name !== undefined ? customer_name : old.customer_name,
      payment_mode: cleanPayMode,
      sale_date: targetSaleDate,
      message: 'Accessory bill updated successfully'
    });
  } catch (err) {
    console.error('PUT /product-sales/:id error:', err);
    res.status(500).json({ error: 'Failed to update accessory sale: ' + err.message });
  }
});

// ───── DELETE /api/product-sales/:id ─────
router.delete('/:id', async (req, res) => {
  try {
    const [existing] = await db.query('SELECT * FROM product_sales WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Accessory sale not found' });
    const old = existing[0];
    const invNo = old.invoice_no || `ACC-${String(old.id).padStart(4, '0')}`;

    await db.execute('DELETE FROM product_sales WHERE id = ?', [req.params.id]);
    try {
      await db.execute("DELETE FROM cash_ledger WHERE category = 'Product Sale' AND description LIKE ?", [`%(${invNo})%`]);
    } catch (ledgerDelErr) {
      console.warn('DELETE /product-sales cash ledger cleanup warning:', ledgerDelErr.message);
    }

    res.json({ message: 'Accessory sale deleted successfully' });
  } catch (err) {
    console.error('DELETE /product-sales/:id error:', err);
    res.status(500).json({ error: 'Failed to delete accessory sale' });
  }
});

module.exports = router;

