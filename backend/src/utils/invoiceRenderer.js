let QRCode = null;
try {
  QRCode = require('qrcode');
} catch (e) {
  console.warn('Optional module qrcode not found, falling back to static/URI QR codes.');
}
const fs = require('fs');
const path = require('path');

function numberToWords(n) {
  if (!n || n === 0) return 'Zero Rupees only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(num) {
    if (num === 0) return '';
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + convertChunk(num % 100) : '');
  }

  let num = Math.floor(Math.abs(n));
  const crores = Math.floor(num / 10000000);
  num %= 10000000;
  const lakhs = Math.floor(num / 100000);
  num %= 100000;
  const thousands = Math.floor(num / 1000);
  num %= 1000;
  const remaining = num;

  let str = '';
  if (crores > 0) str += convertChunk(crores) + ' Crore ';
  if (lakhs > 0) str += convertChunk(lakhs) + ' Lakh ';
  if (thousands > 0) str += convertChunk(thousands) + ' Thousand ';
  if (remaining > 0) str += convertChunk(remaining);

  return str.trim() + ' Rupees only';
}

function fmtMoney(val) {
  return '₹ ' + (parseFloat(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDivisionConfig(company, isQuickJob, jobNo, serviceType) {
  const comp = (company || '').toLowerCase().trim();
  const jNo = (jobNo || '').toUpperCase().trim();
  const svc = (serviceType || '').toLowerCase().trim();
  const isQuick = isQuickJob === 1 || isQuickJob === true;

  const isTeflonOrDeluxe = /delux|dlx|teflon|taflon/i.test(svc) || /delux|dlx|teflon|taflon/i.test(comp);

  // 1. Explicit Accessories check
  const isAccessories =
    !isTeflonOrDeluxe &&
    (comp === 'accessories' ||
      comp.includes('accessories') ||
      comp.includes('product') ||
      jNo.startsWith('ACC-'));

  if (isAccessories) {
    return {
      division: 'accessories',
      title: 'HAPPY CAR WASH & ACCESSORIES',
      addressLines: [
        '8-9, MOHANGIRI, OPP.BANK OF BARODA, GIDC-VADSAR',
        'MAIN ROAD, MAKARPURA, VADODARA.'
      ],
      contactLine: 'Phone no.: 8154891275 Email: prempatel1612@gmail.com',
      stateLine: 'State: 24-Gujarat',
      bankName: 'PUNJAB NATIONAL BANK, MANJALPUR( DISTT- VADODARA)',
      accountNo: '7599002100002403',
      ifsc: 'PUNB0759900',
      accountHolder: 'HAPPY CAR WASH & ACCESSORIES',
      upiId: '8154891275@paytm',
      payeeName: 'Happy Car Wash & Accessories',
    };
  }

  // 2. Teflon Coating or Deluxe Wash check -> ALWAYS Car Wash
  if (isTeflonOrDeluxe) {
    return {
      division: 'car_wash',
      title: 'HAPPY CAR WASH',
      addressLines: [
        '8-9, MOHANGIRI, OPP.BANK OF BARODA, GIDC-VADSAR',
        'MAIN ROAD, MAKARPURA, VADODARA.'
      ],
      contactLine: 'Phone no.: 99986 25511 Email: prempatel1612@gmail.com',
      stateLine: 'State: 24-Gujarat',
      bankName: 'PUNJAB NATIONAL BANK, MANJALPUR( DISTT- VADODARA)',
      accountNo: '7599002100000843',
      ifsc: 'PUNB0759900',
      accountHolder: 'HAPPY CAR WASH',
      upiId: '9998625511@paytm',
      payeeName: 'Happy Car Wash',
    };
  }

  // Detailing keywords check (spelling-tolerant: ciram, coting, ceram, coat, ppf, polish, etc.)
  const hasDetailingKeywords = /coat|coting|ceram|ciram|ppf|detail|rubb|buff|polish|paint|graph|interior|dry\s*clean|deep\s*clean|headlight|glass|spa|studio/.test(svc);

  // 3. Detailing Studio check (takes precedence over generic wash)
  const isDetailing =
    comp === 'detailing studio' ||
    comp === 'detailing' ||
    comp.includes('detailing') ||
    hasDetailingKeywords;

  // 4. Explicit Car Wash check
  const isCarWash =
    !isDetailing &&
    (comp === 'car wash' ||
      (comp.includes('wash') && !comp.includes('detail')) ||
      (isQuick && !hasDetailingKeywords) ||
      jNo.startsWith('CW-'));

  if (isCarWash) {
    return {
      division: 'car_wash',
      title: 'HAPPY CAR WASH',
      addressLines: [
        '8-9, MOHANGIRI, OPP.BANK OF BARODA, GIDC-VADSAR',
        'MAIN ROAD, MAKARPURA, VADODARA.'
      ],
      contactLine: 'Phone no.: 99986 25511 Email: prempatel1612@gmail.com',
      stateLine: 'State: 24-Gujarat',
      bankName: 'PUNJAB NATIONAL BANK, MANJALPUR( DISTT- VADODARA)',
      accountNo: '7599002100000843',
      ifsc: 'PUNB0759900',
      accountHolder: 'HAPPY CAR WASH',
      upiId: '9998625511@paytm',
      payeeName: 'Happy Car Wash',
    };
  }

  // Detailing Studio (default for all standard job cards, HCW orders, and detailing studio)
  return {
    division: 'detailing',
    title: 'HAPPY CAR DETAILING STUDIO',
    addressLines: [
      '8-9, MOHANGIRI, OPP.BANK OF BARODA, GIDC-VADSAR',
      'MAIN ROAD, MAKARPURA, VADODARA.'
    ],
    contactLine: 'Phone no.: 99986 25511 Email: prempatel1612@gmail.com',
    stateLine: 'State: 24-Gujarat',
    bankName: 'PUNJAB NATIONAL BANK, MANJALPUR( DISTT- VADODARA)',
    accountNo: '7599002100002689',
    ifsc: 'PUNB0759900',
    accountHolder: 'HAPPY CAR DETAILING STUDIO',
    upiId: '9998625511m3@pnb',
    payeeName: 'HAPPY CAR DETAILING STUDIO',
  };
}

async function renderRetailInvoiceHtml({
  divisionHeading,
  company,
  isQuickJob,
  jobNo,
  serviceType,
  invNo,
  invDate,
  customerName,
  customerAddress,
  customerMobile,
  customerGstin,
  carName,
  regNo,
  items = [],
  finalAmount = 0,
  advancePaid = 0,
  isPaid = false
}) {
  // Load logo as base64
  let logoBase64 = '';
  try {
    const logoPath = path.join(__dirname, '../../uploads/happy-logo.png');
    if (fs.existsSync(logoPath)) {
      logoBase64 = fs.readFileSync(logoPath).toString('base64');
    }
  } catch { /* ignore */ }

  const itemNames = (items || []).map(it => it.service_name || it.item_name || it.name || '').join(' ');
  const combinedService = `${serviceType || ''} ${itemNames}`.trim();
  const config = getDivisionConfig(company, isQuickJob, jobNo, combinedService);
  if (divisionHeading) {
    config.title = divisionHeading;
  }

  const itemsList = items.length > 0 ? items : [
    {
      service_name: 'Car Care & Service',
      hsn_sac: '',
      qty: 1,
      unit: 'Pcs',
      rate: finalAmount || 0,
      amount: finalAmount || 0
    }
  ];

  let totalQty = 0;
  let subTotal = 0;
  const itemsRowsHtml = itemsList.map((svc, idx) => {
    const sQty = parseFloat(svc.qty) || 1;
    const sRate = parseFloat(svc.rate !== undefined ? svc.rate : (svc.price !== undefined ? svc.price : (svc.amount / sQty))) || 0;
    const sAmt = parseFloat(svc.amount !== undefined ? svc.amount : (svc.total !== undefined ? svc.total : (sRate * sQty))) || 0;
    totalQty += sQty;
    subTotal += sAmt;
    return `<tr>
      <td style="padding: 6px 6px; text-align: center; border-right: 1.5px solid #222; vertical-align: top;">${idx + 1}</td>
      <td style="padding: 6px 8px; border-right: 1.5px solid #222; font-weight: 600; vertical-align: top;">${svc.service_name || svc.item_name || svc.product_name || 'Car Service'}</td>
      <td style="padding: 6px 6px; text-align: center; border-right: 1.5px solid #222; vertical-align: top;">${svc.hsn_sac || '—'}</td>
      <td style="padding: 6px 6px; text-align: center; border-right: 1.5px solid #222; vertical-align: top;">${sQty}</td>
      <td style="padding: 6px 6px; text-align: center; border-right: 1.5px solid #222; vertical-align: top;">${svc.unit || 'Pcs'}</td>
      <td style="padding: 6px 8px; text-align: right; border-right: 1.5px solid #222; vertical-align: top;">${fmtMoney(sRate)}</td>
      <td style="padding: 6px 8px; text-align: right; font-weight: 600; vertical-align: top;">${fmtMoney(sAmt)}</td>
    </tr>`;
  }).join('');

  const spacerRowsHtml = itemsList.length < 5 ? `
    <tr style="height: ${Math.max(30, (5 - itemsList.length) * 26)}px;">
      <td style="border-right: 1.5px solid #222;"></td>
      <td style="border-right: 1.5px solid #222;"></td>
      <td style="border-right: 1.5px solid #222;"></td>
      <td style="border-right: 1.5px solid #222;"></td>
      <td style="border-right: 1.5px solid #222;"></td>
      <td style="border-right: 1.5px solid #222;"></td>
      <td></td>
    </tr>` : '';

  const total = parseFloat(finalAmount || subTotal || 0);
  const received = advancePaid > 0 ? advancePaid : (isPaid ? total : 0);
  const balance = Math.max(0, total - received);

  // Dynamic UPI QR code with exact amount (am pre-fills amount, mam=1.00 signals that amount is editable)
  const qrAmount = balance > 0 ? balance : total;
  const am = Math.max(1, qrAmount).toFixed(2);
  const mcParam = config.division === 'detailing' ? '&mc=5521&mode=02' : '';
  const upiUrl = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.payeeName)}&am=${am}&mam=1.00&cu=INR&tn=${encodeURIComponent(invNo || 'Payment')}${mcParam}`;
  let qrDataUrl = '';
  if (QRCode) {
    try {
      qrDataUrl = await QRCode.toDataURL(upiUrl, {
        margin: 1,
        width: 140,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' }
      });
    } catch (e) {
      console.error('QR generation error in invoiceRenderer:', e);
    }
  }
  // Graceful fallback to static QR image if QRCode module failed or unavailable
  if (!qrDataUrl) {
    if (config.division === 'car_wash') {
      qrDataUrl = '/uploads/paytm_qr_carwash.png';
    } else if (config.division === 'accessories') {
      qrDataUrl = '/uploads/paytm_qr_accessories.png';
    } else {
      qrDataUrl = '/uploads/pnb_qr_detailing.png';
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Retail Invoice - ${invNo} - ${customerName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; background: #f5f5f5; padding: 20px 10px; }
    .no-print { max-width: 820px; margin: 0 auto 16px auto; display: flex; justify-content: flex-end; gap: 10px; }
    .no-print button { padding: 8px 18px; border: 1px solid #ccc; background: #fff; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .no-print button.primary { background: #E04E1D; color: #fff; border: none; font-weight: 700; }
    .invoice-wrapper { max-width: 820px; margin: 0 auto; }
    .invoice-title { text-align: center; font-size: 15px; font-weight: 700; margin: 0 0 8px 0; color: #111; letter-spacing: 0.5px; }
    .invoice-box { border: 1.5px solid #222; background: #fff; color: #000; font-size: 11px; }
    .invoice-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1.5px solid #222; }
    .logo-box { width: 95px; height: 75px; background: #000; border-radius: 4px; display: flex; align-items: center; justify-content: center; padding: 4px; }
    .logo-box img { max-width: 85px; max-height: 67px; object-fit: contain; }
    .header-info { text-align: right; }
    .header-info h1 { margin: 0 0 3px 0; font-size: 19px; font-weight: 900; font-family: serif, "Times New Roman", Arial; letter-spacing: 0.5px; color: #111; }
    .header-info p { margin: 0; font-size: 10px; line-height: 1.35; color: #222; }
    
    .orange-header { background: #E04E1D; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 10px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; }
    .col-left { border-right: 1.5px solid #222; border-bottom: 1.5px solid #222; }
    .col-right { border-bottom: 1.5px solid #222; }
    .details-body { padding: 8px 10px; min-height: 75px; font-size: 10.5px; line-height: 1.45; }

    table.items-table { width: 100%; border-collapse: collapse; text-align: left; }
    table.items-table th { background: #E04E1D; color: #fff; font-size: 10.5px; font-weight: 700; padding: 4px 6px; }
    table.items-table td { font-size: 10.5px; }

    @media print {
      body { background: #fff !important; padding: 0 !important; }
      .no-print { display: none !important; }
      @page { size: A4 portrait; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.close()">✕ Close</button>
    <button class="primary" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="invoice-wrapper">
    <div class="invoice-title">Retail Invoice</div>

    <div class="invoice-box">
      <!-- Header -->
      <div class="invoice-header">
        <div class="logo-box">
          ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="HAPPY Logo" />` : '<div style="color:#d97706;font-weight:900;font-size:12px;">HAPPY</div>'}
        </div>
        <div class="header-info">
          <h1>${config.title}</h1>
          ${config.addressLines.map(l => `<p>${l}</p>`).join('')}
          <p>${config.contactLine}</p>
          <p>${config.stateLine}</p>
        </div>
      </div>

      <!-- Bill To & Invoice Details Bar -->
      <div class="grid-2">
        <div class="col-left">
          <div class="orange-header">Bill To</div>
          <div class="details-body">
            <p style="margin: 0 0 2px 0; font-weight: bold; font-size: 11px; text-transform: uppercase;">${customerName}</p>
            ${customerAddress ? `<p style="margin: 0 0 2px 0; color: #222; text-transform: uppercase;">${customerAddress}</p>` : ''}
            ${customerMobile ? `<p style="margin: 0; color: #333;">Phone: ${customerMobile}</p>` : ''}
            ${customerGstin ? `<p style="margin: 0; color: #333;">GSTIN: ${customerGstin}</p>` : ''}
          </div>
        </div>

        <div class="col-right">
          <div class="orange-header">Invoice Details</div>
          <div class="details-body">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #222;">Invoice No.:</span>
              <span style="font-weight: bold;">${invNo}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #222;">Date:</span>
              <span>${invDate}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #222;">Car Name:</span>
              <span style="font-weight: bold;">${carName}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #222;">Reg No.:</span>
              <span style="font-weight: bold; font-family: monospace;">${regNo}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th style="text-align: center; width: 35px; border-right: 1px solid #ff8860;">#</th>
            <th style="padding-left: 8px; border-right: 1px solid #ff8860;">Item name</th>
            <th style="text-align: center; width: 75px; border-right: 1px solid #ff8860;">HSN/ SAC</th>
            <th style="text-align: center; width: 60px; border-right: 1px solid #ff8860;">Quantity</th>
            <th style="text-align: center; width: 50px; border-right: 1px solid #ff8860;">Unit</th>
            <th style="text-align: right; width: 90px; padding-right: 8px; border-right: 1px solid #ff8860;">Price/ Unit</th>
            <th style="text-align: right; width: 100px; padding-right: 8px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
          ${spacerRowsHtml}
        </tbody>
        <tfoot>
          <tr style="border-top: 1.5px solid #222; border-bottom: 1.5px solid #222; font-weight: 700; font-size: 11px;">
            <td style="padding: 5px 6px; border-right: 1.5px solid #222;"></td>
            <td style="padding: 5px 8px; border-right: 1.5px solid #222;">Total</td>
            <td style="padding: 5px 6px; border-right: 1.5px solid #222;"></td>
            <td style="padding: 5px 6px; text-align: center; border-right: 1.5px solid #222;">${totalQty}</td>
            <td style="padding: 5px 6px; border-right: 1.5px solid #222;"></td>
            <td style="padding: 5px 8px; border-right: 1.5px solid #222;"></td>
            <td style="padding: 5px 8px; text-align: right;">${fmtMoney(subTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Amount In Words & Amounts Section -->
      <div class="grid-2">
        <div class="col-left">
          <div class="orange-header">Invoice Amount In Words</div>
          <div style="padding: 12px 10px; min-height: 85px; font-size: 11px; color: #111; font-style: italic;">
            ${numberToWords(Math.round(total))}
          </div>
        </div>

        <div class="col-right">
          <div class="orange-header">Amounts</div>
          <div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
              <tbody>
                <tr style="border-bottom: 1px solid #e5e5e5;">
                  <td style="padding: 4px 10px; color: #333;">Sub Total</td>
                  <td style="padding: 4px 10px; text-align: right; font-weight: 600;">${fmtMoney(subTotal)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e5e5;">
                  <td style="padding: 4px 10px; font-weight: 700;">Total</td>
                  <td style="padding: 4px 10px; text-align: right; font-weight: 700;">${fmtMoney(total)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e5e5;">
                  <td style="padding: 4px 10px; color: #333;">Received</td>
                  <td style="padding: 4px 10px; text-align: right;">${fmtMoney(received)}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 10px; font-weight: 700; color: #111;">Balance</td>
                  <td style="padding: 5px 10px; text-align: right; font-weight: 700; color: #111;">${fmtMoney(balance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Bank Details & Terms Section -->
      <div class="grid-2">
        <div style="border-right: 1.5px solid #222;">
          <div class="orange-header">Bank Details</div>
          <div style="padding: 10px; display: flex; gap: 12px; align-items: center;">
            <!-- Dynamic QR Code -->
            <div style="text-align: center; flex-shrink: 0;">
              ${qrDataUrl ? `<img src="${qrDataUrl}" alt="UPI QR Code" style="width: 85px; height: 85px; display: block; border: 1px solid #ccc;" />` : ''}
              <div style="margin-top: 3px; border: 1px solid #059669; border-radius: 2px; padding: 1px 3px; font-size: 7.5px; font-weight: 800; color: #047857; display: flex; align-items: center; justify-content: center; gap: 2px;">
                <span style="background: #047857; color: #fff; padding: 0 2px; border-radius: 1px; font-size: 6.5px;">UPI</span>
                <span>SCAN TO PAY</span>
              </div>
            </div>

            <!-- Bank info -->
            <div style="font-size: 9.5px; line-height: 1.45; color: #111;">
              <p style="margin: 0 0 2px 0;"><strong>Name:</strong> ${config.bankName}</p>
              <p style="margin: 0 0 2px 0;"><strong>Account No.:</strong> ${config.accountNo}</p>
              <p style="margin: 0 0 2px 0;"><strong>IFSC code:</strong> ${config.ifsc}</p>
              <p style="margin: 0;"><strong>Account Holder's Name:</strong> ${config.accountHolder}</p>
            </div>
          </div>
        </div>

        <div>
          <div class="orange-header">Terms and conditions</div>
          <div style="padding: 10px 12px; font-size: 9px; line-height: 1.45; color: #222;">
            <p style="margin: 0 0 3px 0;">1) Please do not left anything in car companies not responsible for any loss or damage.</p>
            <p style="margin: 0 0 3px 0;">2) Please take the car on the same day.</p>
            <p style="margin: 0 0 3px 0;">3) On the event loss of job card car would be delivered only after sufficient verifications.</p>
            <p style="margin: 0;">4) Company is not responsible for any technical and mechanical faults.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  renderRetailInvoiceHtml,
  numberToWords,
  fmtMoney,
  getDivisionConfig
};
