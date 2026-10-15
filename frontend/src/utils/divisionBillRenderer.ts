import { type DivisionConfig, fmtCurrency, numberToWords } from './invoiceFormat';

export interface DivisionBillItem {
  name: string;
  hsn_sac?: string;
  qty: number;
  unit?: string;
  rate: number;
  amount: number;
}

export interface StatementDocumentItem {
  doc_date?: string;
  job_date?: string;
  doc_no?: string;
  job_no?: string;
  reg_no?: string;
  car_name?: string;
  service_type?: string;
  type?: string;
  total_billed: number | string;
  total_paid: number | string;
  balance?: number | string;
}

export interface DivisionBillRenderData {
  mode: 'single' | 'statement';
  billTitle?: string;
  docNo: string;
  dateStr: string;
  customerName: string;
  customerAddress?: string;
  customerMobile?: string;
  customerGstin?: string;

  // Single document specific fields
  carName?: string;
  regNo?: string;
  servicesList?: DivisionBillItem[];
  paymentMode?: string;
  transactionId?: string;
  remarks?: string;
  totalBilled?: number;
  paidAmount?: number;
  balanceDue?: number;

  // Statement document specific fields
  totalVehicles?: number;
  totalJobs?: number;
  documents?: StatementDocumentItem[];
  totalPending?: number;
  isSettled?: boolean;

  // Generated QR data URL
  activeQr?: string;
}

export function renderDivisionBillHtml(config: DivisionConfig, data: DivisionBillRenderData): string {
  const isStatement = data.mode === 'statement';
  const billTitle = data.billTitle || (isStatement
    ? (data.isSettled ? 'Consolidated Settlement Bill' : 'Statement of Dues')
    : 'Retail Invoice');

  const customerName = data.customerName || 'Customer';
  const customerMobile = data.customerMobile || '';
  const customerAddress = data.customerAddress || '';

  // Base amounts calculation
  let subTotal = 0;
  let totalBilled = 0;
  let paidAmount = 0;
  let balanceDue = 0;

  if (isStatement) {
    totalBilled = data.totalBilled || 0;
    paidAmount = data.paidAmount || 0;
    balanceDue = data.totalPending !== undefined ? data.totalPending : (totalBilled - paidAmount);
    subTotal = totalBilled;
  } else {
    const list = data.servicesList || [];
    subTotal = list.reduce((sum, it) => sum + (parseFloat(String(it.amount)) || 0), 0);
    totalBilled = data.totalBilled !== undefined ? data.totalBilled : subTotal;
    paidAmount = data.paidAmount !== undefined ? data.paidAmount : totalBilled;
    balanceDue = data.balanceDue !== undefined ? data.balanceDue : (totalBilled - paidAmount);
  }

  const amountInWords = numberToWords(Math.round(isStatement ? balanceDue : totalBilled));

  // Table rendering based on mode
  let tableHeadersHtml = '';
  let tableBodyRowsHtml = '';
  let tableFootHtml = '';

  if (isStatement) {
    const docs = data.documents || [];
    tableHeadersHtml = `
      <tr style="background: #E04E1D; color: #fff; font-size: 10px; font-weight: 700;">
        <th style="padding: 5px 6px; text-align: center; width: 30px; border-right: 1px solid #ff8860;">#</th>
        <th style="padding: 5px 6px; text-align: left; width: 85px; border-right: 1px solid #ff8860;">Date</th>
        <th style="padding: 5px 6px; text-align: left; width: 100px; border-right: 1px solid #ff8860;">Doc / Job No</th>
        <th style="padding: 5px 8px; text-align: left; width: 155px; border-right: 1px solid #ff8860;">Vehicle (Reg & Model)</th>
        <th style="padding: 5px 8px; text-align: left; border-right: 1px solid #ff8860;">Service / Description</th>
        <th style="padding: 5px 8px; text-align: right; width: 85px; border-right: 1px solid #ff8860;">Billed ₹</th>
        <th style="padding: 5px 8px; text-align: right; width: 80px; border-right: 1px solid #ff8860;">Paid ₹</th>
        <th style="padding: 5px 8px; text-align: right; width: 90px;">${data.isSettled ? 'Settled ₹' : 'Due ₹'}</th>
      </tr>
    `;

    tableBodyRowsHtml = docs.map((doc, idx) => {
      const dDate = (doc.job_date || doc.doc_date)
        ? new Date(doc.job_date || doc.doc_date || '').toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })
        : '—';
      const veh = doc.reg_no
        ? `${doc.reg_no}${doc.car_name ? ` · ${doc.car_name}` : ''}`
        : (doc.car_name || 'Vehicle');
      const sType = doc.service_type || doc.type || 'Car Wash / Detailing';
      const bAmt = parseFloat(String(doc.total_billed || 0));
      const pAmt = parseFloat(String(doc.total_paid || 0));
      const dAmt = parseFloat(String(doc.balance !== undefined ? doc.balance : bAmt - pAmt));

      return `
        <tr style="font-size: 10px; border-bottom: 1px solid #e5e5e5; ${idx % 2 === 1 ? 'background: #fafafa;' : ''}">
          <td style="padding: 5px 6px; text-align: center; border-right: 1px solid #ddd; color: #555;">${idx + 1}</td>
          <td style="padding: 5px 6px; border-right: 1px solid #ddd; white-space: nowrap;">${dDate}</td>
          <td style="padding: 5px 6px; border-right: 1px solid #ddd; font-family: monospace; font-weight: bold; color: #111;">${doc.doc_no || doc.job_no || '—'}</td>
          <td style="padding: 5px 8px; border-right: 1px solid #ddd; font-weight: 600; color: #111;">${veh}</td>
          <td style="padding: 5px 8px; border-right: 1px solid #ddd; color: #222;">${sType}</td>
          <td style="padding: 5px 8px; text-align: right; border-right: 1px solid #ddd; font-weight: 600;">₹${bAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding: 5px 8px; text-align: right; border-right: 1px solid #ddd; font-weight: 600; color: #047857;">₹${pAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding: 5px 8px; text-align: right; font-weight: 700; color: #111;">₹${dAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    tableFootHtml = `
      <tr style="border-top: 1.5px solid #222; border-bottom: 1.5px solid #222; font-weight: 700; font-size: 10.5px; background: #fff;">
        <td style="padding: 5px 6px; border-right: 1.5px solid #222;"></td>
        <td style="padding: 5px 6px; border-right: 1.5px solid #222;" colspan="4">Total (${docs.length} jobs)</td>
        <td style="padding: 5px 8px; text-align: right; border-right: 1.5px solid #222;">${fmtCurrency(totalBilled)}</td>
        <td style="padding: 5px 8px; text-align: right; border-right: 1.5px solid #222; color: #047857;">${fmtCurrency(paidAmount)}</td>
        <td style="padding: 5px 8px; text-align: right; font-weight: 800; color: ${balanceDue > 0 ? '#b91c1c' : '#047857'};">${fmtCurrency(balanceDue)}</td>
      </tr>
    `;
  } else {
    // Single document (Retail Invoice / Payment Bill)
    const list = data.servicesList || [];
    const totalQty = list.reduce((sum, it) => sum + (parseFloat(String(it.qty)) || 1), 0);

    tableHeadersHtml = `
      <tr style="background: #E04E1D; color: #fff; font-size: 10.5px; font-weight: 700;">
        <th style="padding: 4px 6px; text-align: center; width: 35px; border-right: 1px solid #ff8860;">#</th>
        <th style="padding: 4px 8px; border-right: 1px solid #ff8860;">Item name</th>
        <th style="padding: 4px 6px; text-align: center; width: 75px; border-right: 1px solid #ff8860;">HSN/ SAC</th>
        <th style="padding: 4px 6px; text-align: center; width: 60px; border-right: 1px solid #ff8860;">Quantity</th>
        <th style="padding: 4px 6px; text-align: center; width: 50px; border-right: 1px solid #ff8860;">Unit</th>
        <th style="padding: 4px 8px; text-align: right; width: 90px; border-right: 1px solid #ff8860;">Price/ Unit</th>
        <th style="padding: 4px 8px; text-align: right; width: 100px;">Amount</th>
      </tr>
    `;

    tableBodyRowsHtml = list.map((svc, idx) => `
      <tr style="font-size: 10.5px; min-height: 24px;">
        <td style="padding: 6px 6px; text-align: center; border-right: 1.5px solid #222; vertical-align: top;">${idx + 1}</td>
        <td style="padding: 6px 8px; border-right: 1.5px solid #222; font-weight: 600; vertical-align: top;">${svc.name}</td>
        <td style="padding: 6px 6px; text-align: center; border-right: 1.5px solid #222; vertical-align: top;">${svc.hsn_sac || '—'}</td>
        <td style="padding: 6px 6px; text-align: center; border-right: 1.5px solid #222; vertical-align: top;">${svc.qty}</td>
        <td style="padding: 6px 6px; text-align: center; border-right: 1.5px solid #222; vertical-align: top;">${svc.unit || 'Pcs'}</td>
        <td style="padding: 6px 8px; text-align: right; border-right: 1.5px solid #222; vertical-align: top;">${fmtCurrency(svc.rate)}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: 600; vertical-align: top;">${fmtCurrency(svc.amount)}</td>
      </tr>
    `).join('');

    const emptyRowsCount = Math.max(0, 4 - list.length);
    if (emptyRowsCount > 0) {
      tableBodyRowsHtml += `
        <tr style="height: ${emptyRowsCount * 26}px;">
          <td style="border-right: 1.5px solid #222;"></td>
          <td style="border-right: 1.5px solid #222;"></td>
          <td style="border-right: 1.5px solid #222;"></td>
          <td style="border-right: 1.5px solid #222;"></td>
          <td style="border-right: 1.5px solid #222;"></td>
          <td style="border-right: 1.5px solid #222;"></td>
          <td></td>
        </tr>
      `;
    }

    tableFootHtml = `
      <tr style="border-top: 1.5px solid #222; border-bottom: 1.5px solid #222; font-weight: 700; font-size: 11px;">
        <td style="padding: 5px 6px; border-right: 1.5px solid #222;"></td>
        <td style="padding: 5px 8px; border-right: 1.5px solid #222;">Total</td>
        <td style="padding: 5px 6px; border-right: 1.5px solid #222;"></td>
        <td style="padding: 5px 6px; text-align: center; border-right: 1.5px solid #222;">${totalQty}</td>
        <td style="padding: 5px 6px; border-right: 1.5px solid #222;"></td>
        <td style="padding: 5px 8px; border-right: 1.5px solid #222;"></td>
        <td style="padding: 5px 8px; text-align: right;">${fmtCurrency(subTotal)}</td>
      </tr>
    `;
  }

  // Right details block
  const rightDetailsHtml = isStatement
    ? `
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #222;">Statement No.:</span>
        <span style="font-weight: bold; font-family: monospace;">${data.docNo}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #222;">Date:</span>
        <span>${data.dateStr}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #222;">Total Vehicles:</span>
        <span style="font-weight: bold;">${data.totalVehicles || 1}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #222;">Total Jobs:</span>
        <span style="font-weight: bold;">${data.totalJobs || (data.documents ? data.documents.length : 0)}</span>
      </div>
    `
    : `
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #222;">Invoice No.:</span>
        <span style="font-weight: bold;">${data.docNo}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #222;">Date:</span>
        <span>${data.dateStr}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #222;">Car Name:</span>
        <span style="font-weight: bold;">${data.carName || '—'}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #222;">Reg No.:</span>
        <span style="font-weight: bold; font-family: monospace;">${data.regNo || '—'}</span>
      </div>
    `;

  // Terms and conditions block
  const termsHtml = isStatement
    ? `
      <p style="margin: 0 0 3px 0;">1) This statement reflects all outstanding dues for the specified division and vehicles.</p>
      <p style="margin: 0 0 3px 0;">2) Please settle the pending amount via the UPI QR code or bank transfer details shown on the left.</p>
      <p style="margin: 0 0 3px 0;">3) For billing inquiries, contact <strong>+91 99986 25511</strong> or visit our office.</p>
      <p style="margin: 0;">4) Thank you for your continued partnership with Happy Car Wash!</p>
    `
    : `
      <p style="margin: 0 0 3px 0;">1) Please do not left anything in car companies not responsible for any loss or damage.</p>
      <p style="margin: 0 0 3px 0;">2) Please take the car on the same day.</p>
      <p style="margin: 0 0 3px 0;">3) On the event loss of job card car would be delivered only after sufficient verifications.</p>
      <p style="margin: 0;">4) Company is not responsible for any technical and mechanical faults.</p>
    `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${config.title} - ${data.docNo}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm 10mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; margin: 0; padding: 12px; background: #fff; font-size: 11px; line-height: 1.4; }
          .invoice-box { background: #fff; border: 1.5px solid #222; max-width: 820px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { page-break-inside: avoid; }
          .avoid-break { page-break-inside: avoid; }
          @media print {
            body { padding: 0; background: #fff; }
            .invoice-box { border: 1.5px solid #222; box-shadow: none; max-width: 100%; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <!-- Top title -->
          <div style="text-align: center; font-size: 11px; font-weight: 700; padding: 6px 0 2px 0; letter-spacing: 0.5px;">
            ${billTitle}
          </div>

          <!-- Header: Logo + Company Info -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 6px 14px 10px 14px; border-bottom: 1.5px solid #222;">
            <div style="width: 68px; height: 68px; background: #000; border: 1px solid #333; display: flex; align-items: center; justify-content: center;">
              <img src="/happy-logo.png" alt="Logo" style="max-width: 64px; max-height: 64px; object-fit: contain;" onerror="this.style.display='none';" />
            </div>
            <div style="text-align: right;">
              <h1 style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.5px; font-family: serif;">
                ${config.title}
              </h1>
              ${config.addressLines.map(line => `<p style="margin: 0; font-size: 10px; line-height: 1.35; color: #222;">${line}</p>`).join('')}
              <p style="margin: 0; font-size: 10px; line-height: 1.35; color: #222;">${config.contactLine}</p>
              <p style="margin: 0; font-size: 10px; line-height: 1.35; color: #222;">${config.stateLine}</p>
            </div>
          </div>

          <!-- Bill To & Details Bar -->
          <div style="display: grid; grid-template-columns: 1fr 1fr;">
            <!-- Left: Bill To -->
            <div style="border-right: 1.5px solid #222; border-bottom: 1.5px solid #222;">
              <div style="background: #E04E1D; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 10px;">
                Bill To
              </div>
              <div style="padding: 8px 10px; min-height: 75px; font-size: 10.5px; line-height: 1.4;">
                <p style="margin: 0 0 2px 0; font-weight: bold; font-size: 11px; text-transform: uppercase;">
                  ${customerName}
                </p>
                ${customerAddress ? `<p style="margin: 0 0 2px 0; color: #222; text-transform: uppercase;">${customerAddress}</p>` : ''}
                ${customerMobile ? `<p style="margin: 0; color: #333;">Phone: ${customerMobile}</p>` : ''}
                ${data.customerGstin ? `<p style="margin: 0; color: #333;">GSTIN: ${data.customerGstin}</p>` : ''}
              </div>
            </div>

            <!-- Right: Details -->
            <div style="border-bottom: 1.5px solid #222;">
              <div style="background: #E04E1D; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 10px;">
                ${isStatement ? 'Statement Details' : 'Invoice Details'}
              </div>
              <div style="padding: 8px 10px; min-height: 75px; font-size: 10.5px; line-height: 1.5;">
                ${rightDetailsHtml}
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              ${tableHeadersHtml}
            </thead>
            <tbody>
              ${tableBodyRowsHtml}
            </tbody>
            <tfoot>
              ${tableFootHtml}
            </tfoot>
          </table>

          <!-- Amount in words & Amounts breakdown (avoid break across pages) -->
          <div class="avoid-break" style="display: grid; grid-template-columns: 1fr 1fr;">
            <!-- Left: Amount In Words -->
            <div style="border-right: 1.5px solid #222; border-bottom: 1.5px solid #222;">
              <div style="background: #E04E1D; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 10px;">
                ${isStatement ? 'Statement Amount In Words' : 'Invoice Amount In Words'}
              </div>
              <div style="padding: 10px; min-height: 85px; font-size: 11px; color: #111;">
                <div style="font-style: italic; font-weight: 600;">${amountInWords}</div>
                <div style="margin-top: 8px; font-size: 9.5px; color: #555;">
                  <strong>${isStatement ? 'Settlement Status:' : 'Payment Mode:'}</strong>
                  <span style="text-transform: uppercase; font-weight: bold; color: #000;">
                    ${isStatement ? (data.isSettled ? '✓ Paid & Settled in Full' : 'Pending Statement of Dues') : (data.paymentMode || 'Cash')}
                  </span>
                  ${data.transactionId ? ` &nbsp;•&nbsp; <strong>Ref/Txn:</strong> <span style="font-family: monospace;">${data.transactionId}</span>` : ''}
                </div>
                ${data.remarks ? `<div style="margin-top: 3px; font-size: 9.5px; color: #555;"><strong>Remarks:</strong> ${data.remarks}</div>` : ''}
              </div>
            </div>

            <!-- Right: Amounts breakdown -->
            <div style="border-bottom: 1.5px solid #222;">
              <div style="background: #E04E1D; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 10px;">
                Amounts
              </div>
              <div style="padding: 0; font-size: 10.5px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tbody>
                    <tr style="border-bottom: 1px solid #e5e5e5;">
                      <td style="padding: 4px 10px; color: #333;">Total Billed Gross</td>
                      <td style="padding: 4px 10px; text-align: right; font-weight: 600;">${fmtCurrency(totalBilled)}</td>
                    </tr>
                    ${paidAmount > 0 ? `
                      <tr style="border-bottom: 1px solid #e5e5e5;">
                        <td style="padding: 4px 10px; color: #333;">${isStatement ? 'Previously Paid' : 'Received'}</td>
                        <td style="padding: 4px 10px; text-align: right; font-weight: 700; color: #047857;">${fmtCurrency(paidAmount)}</td>
                      </tr>
                    ` : ''}
                    <tr style="border-bottom: 1px solid #e5e5e5;">
                      <td style="padding: 4px 10px; font-weight: 700;">${isStatement ? (data.isSettled ? 'Settled in Full' : 'Net Pending Due') : 'Total'}</td>
                      <td style="padding: 4px 10px; text-align: right; font-weight: 700;">${fmtCurrency(balanceDue)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 10px; font-weight: 700; color: #111;">${isStatement ? (data.isSettled ? 'Net Balance Due:' : 'Total Payable:') : 'Balance'}</td>
                      <td style="padding: 5px 10px; text-align: right; font-weight: 700; color: ${balanceDue > 0 ? '#b91c1c' : '#047857'};">
                        ${data.isSettled ? '₹0.00 (PAID)' : fmtCurrency(balanceDue) + (balanceDue <= 0 ? ' (Settled)' : '')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Bank Details & Terms section (avoid break across pages) -->
          <div class="avoid-break" style="display: grid; grid-template-columns: 1fr 1fr;">
            <!-- Left: Bank Details with Dynamic QR -->
            <div style="border-right: 1.5px solid #222;">
              <div style="background: #E04E1D; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 10px;">
                Bank Details
              </div>
              <div style="padding: 10px; display: flex; gap: 12px; align-items: center;">
                <div style="text-align: center; flex-shrink: 0;">
                  ${data.activeQr ? `<img src="${data.activeQr}" alt="UPI QR Code" style="width: 85px; height: 85px; display: block; border: 1px solid #ccc;" />` : ''}
                  <div style="margin-top: 3px; border: 1px solid #059669; border-radius: 2px; padding: 1px 3px; font-size: 7.5px; font-weight: 800; color: #047857; display: flex; align-items: center; justify-content: center; gap: 2px;">
                    <span style="background: #047857; color: #fff; padding: 0 2px; border-radius: 1px; font-size: 6.5px;">UPI</span>
                    <span>SCAN TO PAY</span>
                  </div>
                </div>
                <div style="font-size: 9.5px; line-height: 1.45; color: #111;">
                  <p style="margin: 0 0 2px 0;"><strong>Name:</strong> ${config.bankName}</p>
                  <p style="margin: 0 0 2px 0;"><strong>Account No.:</strong> ${config.accountNo}</p>
                  <p style="margin: 0 0 2px 0;"><strong>IFSC code:</strong> ${config.ifsc}</p>
                  <p style="margin: 0;"><strong>Account Holder's Name:</strong> ${config.accountHolder}</p>
                </div>
              </div>
            </div>

            <!-- Right: Terms and conditions -->
            <div>
              <div style="background: #E04E1D; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 10px;">
                ${isStatement ? 'Important Notes' : 'Terms and conditions'}
              </div>
              <div style="padding: 10px 12px; font-size: 9px; line-height: 1.45; color: #222;">
                ${termsHtml}
              </div>
            </div>
          </div>

          <!-- Footer Signature (avoid break across pages) -->
          <div class="avoid-break" style="display: flex; justify-content: flex-end; padding: 12px 16px 8px 16px; border-top: 1.5px solid #222;">
            <div style="text-align: center; min-width: 170px;">
              <div style="height: 30px;"></div>
              <div style="border-top: 1px solid #111; padding-top: 2px; font-weight: 700; font-size: 10px;">Authorized Signatory</div>
              <div style="font-size: 8.5px; color: #555;">For ${config.title}</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 250);
          }
        </script>
      </body>
    </html>
  `;
}
