import React from 'react';

export interface DocumentPrintData {
  job: any;
  services: any[];
  businessInfo: {
    name: string;
    gstin: string;
    phone: string;
    email: string;
    address: string;
  };
  printType: string; // 'tax_invoice' | 'proforma' | 'estimate' | 'work_order' | 'gate_pass'
}

function numberToWords(n: number): string {
  if (n <= 0 || isNaN(n)) return 'Zero';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const num = Math.round(n);
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + numberToWords(num % 100) : '');
  if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
  if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
  return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
}

function fmt(val: number | string): string {
  const n = parseFloat(String(val)) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const DocumentPrintTemplate: React.FC<DocumentPrintData> = ({
  job,
  services,
  businessInfo,
  printType,
}) => {
  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
  const logoUrl = `${apiBase}/uploads/happy-logo.png`;

  const selectedServices = services.filter((s: any) => s.is_selected === 1 || s.is_selected === undefined);

  // Check if non-GST bill
  const isNonGst = selectedServices.length > 0 && selectedServices.every((s: any) => parseFloat(s.tax_pct || 0) === 0 && parseFloat(s.tax_amount || 0) === 0);

  // Calculate totals
  const partsExclTax = selectedServices
    .filter((s: any) => (s.item_type || '').toLowerCase() === 'part')
    .reduce((sum: number, s: any) => sum + (parseFloat(s.amount) || 0), 0);

  const labourExclTax = selectedServices
    .filter((s: any) => (s.item_type || '').toLowerCase() !== 'part')
    .reduce((sum: number, s: any) => sum + (parseFloat(s.amount) || 0), 0);

  const taxTotal = isNonGst
    ? 0
    : selectedServices.reduce((sum: number, s: any) => sum + (parseFloat(s.tax_amount) || 0), 0);

  const grandTotal = partsExclTax + labourExclTax + taxTotal;

  const advancePayments = job.advance_payments || [];
  const totalAdvance = advancePayments.reduce((sum: number, ap: any) => sum + (parseFloat(ap.amount) || 0), 0);
  const balanceDue = grandTotal - totalAdvance;

  const wordsAmount = totalAdvance > 0 
    ? (balanceDue >= 0 ? balanceDue : Math.abs(balanceDue)) 
    : grandTotal;
  const amountSuffix = (totalAdvance > 0 && balanceDue < 0) ? ' Rupees Refund / Credit Only' : ' Rupees Only';
  const amountInWords = numberToWords(Math.round(wordsAmount)) + amountSuffix;

  const invoiceDate = new Date(job.job_date || job.created_at || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const titles: Record<string, string> = {
    estimate: 'ESTIMATE',
    proforma: 'PROFORMA INVOICE',
    tax_invoice: 'TAX INVOICE',
    work_order: 'WORK ORDER',
    gate_pass: 'GATE PASS',
  };

  const docTitle = isNonGst && printType === 'tax_invoice'
    ? 'ESTIMATE'
    : (titles[printType] || 'PROFORMA INVOICE');

  const customerName = job.cust_name || job.customer_name || job.owner_name || 'Customer';
  const mobileNo = job.cust_mobile || job.mobile_no || '—';
  const customerEmail = job.cust_email || job.email || '';
  const addressParts = [job.address_line, job.colony_street, job.city, job.state, job.pincode].filter(Boolean);
  const fullAddress = job.address || addressParts.join(', ');

  const carName = job.car_name || [job.make || job.vehicle_make, job.model || job.vehicle_model].filter(Boolean).join(' ') || '—';

  const isCarWash = (job.company === 'Car Wash' || (job as any)?.is_quick_job === 1 || (job.job_no || '').startsWith('CW-'));
  const isAccessories = Boolean(job.company && (job.company.toLowerCase().includes('accessories') || job.company.toLowerCase().includes('product')));
  const divisionHeading = isCarWash ? 'HAPPY CAR WASH' : isAccessories ? 'HAPPY CAR WASH & ACCESSORIES' : 'HAPPY CAR DETAILING STUDIO';

  return (
    <div className="document-print-body" style={{
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
      maxWidth: 820,
      margin: '0 auto',
      padding: '20px 28px',
      color: '#111827',
      fontSize: 12,
      lineHeight: 1.5,
      background: '#fff',
    }}>
      {/* -- Brand Header -- */}
      <div style={{
        background: 'linear-gradient(135deg, #B91C1C 0%, #DC2626 100%)',
        color: '#fff',
        padding: '20px 28px',
        borderRadius: '12px 12px 0 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
          <img src={logoUrl} alt="HAPPY Logo" style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover' as const, background: '#000', padding: 2 }} onError={(e) => { (e.target as HTMLImageElement).src = '/happy-logo.png'; }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: 2 }}>
              {divisionHeading}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 10, opacity: 0.9, lineHeight: 1.4 }}>
              {businessInfo.address}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, opacity: 0.9, marginLeft: 16 }}>
          <p style={{ margin: 0 }}><strong>Phone:</strong> {businessInfo.phone}</p>
        </div>
      </div>

      {/* -- Document Title -- */}
      <div style={{
        background: '#FEF2F2',
        borderLeft: '4px solid #DC2626',
        padding: '12px 20px',
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#DC2626', letterSpacing: 2 }}>
          {docTitle}
        </h2>
        <div style={{ textAlign: 'right', fontSize: 11 }}>
          <p style={{ margin: 0 }}>
            <strong>{printType === 'estimate' || isNonGst ? 'Estimate No:' : 'Invoice No:'}</strong> {job.invoice?.invoice_no || job.estimate?.estimate_no || job.job_no}
          </p>
          <p style={{ margin: '2px 0 0', color: '#666' }}>
            <strong>Date:</strong> {invoiceDate}
          </p>
          <p style={{ margin: '2px 0 0', color: '#666' }}>
            <strong>Job Card No:</strong> {job.job_no}
          </p>
        </div>
      </div>

      {/* -- Customer & Vehicle Details -- */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        {/* Customer Block */}
        <div style={{
          flex: 1,
          background: '#FAFAFA',
          border: '1px solid #E5E7EB',
          borderRadius: 8,
          padding: '14px 16px',
        }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: '#6B7280', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
            BILL TO
          </p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>{customerName}</p>
          {job.company_name && (
            <p style={{ fontSize: 12, fontWeight: 700, color: '#4B5563', margin: '0 0 4px' }}>
              {job.company_name}
            </p>
          )}

          <p style={{ fontSize: 11, color: '#666', margin: '0 0 2px' }}>{mobileNo}</p>
          {job.alt_mobile && (
            <p style={{ fontSize: 11, color: '#666', margin: '0 0 2px' }}>{job.alt_mobile}</p>
          )}
          {customerEmail && (
            <p style={{ fontSize: 11, color: '#666', margin: '0 0 2px' }}>✉️ {customerEmail}</p>
          )}
          {fullAddress && (
            <p style={{ fontSize: 11, color: '#666', margin: 0, whiteSpace: 'pre-wrap' }}>
              {fullAddress}
            </p>
          )}
        </div>

        {/* Vehicle Block */}
        <div style={{
          flex: 1,
          background: '#FAFAFA',
          border: '1px solid #E5E7EB',
          borderRadius: 8,
          padding: '14px 16px',
        }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: '#6B7280', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
            VEHICLE DETAILS
          </p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 2px' }}>{carName}</p>
          <p style={{ fontSize: 11, color: '#666', margin: 0 }}>
            Reg: <strong style={{ fontFamily: 'monospace', color: '#DC2626' }}>{job.reg_no}</strong>
          </p>
          {job.fuel_type && (
            <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>Fuel: {job.fuel_type}</p>
          )}
          {job.service_advisor && (
            <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>Advisor: {job.service_advisor}</p>
          )}
        </div>
      </div>

      {/* -- Services Line-Items Table -- */}
      <div style={{ marginBottom: 20, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              {(
                isNonGst
                  ? ['#', 'Description', 'Type', 'Qty', 'Unit Rate ₹', 'Amount ₹']
                  : ['#', 'Description', 'Type', 'HSN/SAC', 'Qty', 'Unit Rate ₹', 'Tax%', 'Tax ₹', 'Amount ₹']
              ).map((h, i) => (
                <th key={i} style={{
                  padding: '8px 10px',
                  fontWeight: 700,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: '#DC2626',
                  background: '#FEF2F2',
                  borderBottom: '2px solid #DC2626',
                  textAlign: (isNonGst ? i >= 3 : i >= 4) ? 'right' : (isNonGst ? i === 2 : i === 2 || i === 3) ? 'center' : 'left',
                  width: i === 0 ? '4%' : i === 1 ? (isNonGst ? '40%' : '28%') : undefined,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              const colCount = isNonGst ? 6 : 9;
              let globalIdx = 1;

              const renderItemRow = (s: any) => {
                const rowIdx = globalIdx++;
                const isPartItem = (s.item_type || '').toLowerCase() === 'part';
                const qtyVal = parseFloat(String(s.qty)) || 1;
                const lineTaxableAmt = parseFloat(String(s.amount)) || 0;
                const fullTaxAmt = parseFloat(String(s.tax_amount)) || 0;
                const lineFull = lineTaxableAmt + fullTaxAmt;

                const baseUnitRate = isNonGst ? (qtyVal > 0 ? lineFull / qtyVal : (parseFloat(String(s.rate)) || 0)) : (qtyVal > 0 ? lineTaxableAmt / qtyVal : (parseFloat(String(s.rate)) || 0));
                const taxPct = isNonGst ? 0 : (parseFloat(String(s.tax_pct)) || 0);
                const taxAmt = isNonGst ? 0 : (parseFloat(String(s.tax_amount)) || 0);
                const lineTotal = isNonGst ? lineFull : (lineTaxableAmt + taxAmt);

                return (
                  <tr key={s.id || rowIdx} style={{ background: rowIdx % 2 === 0 ? '#FAFAFA' : '#fff' }}>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'center', color: '#999' }}>{rowIdx}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f0f0f0', fontWeight: 600 }}>{s.service_name}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: isPartItem ? '#FEF3C7' : '#DBEAFE',
                        color: isPartItem ? '#92400E' : '#1E40AF',
                        textTransform: 'uppercase',
                      }}>
                        {(() => {
                          const isLabourOnly = (s.service_name || '').toLowerCase().includes('labour') || (s.description || '').toLowerCase().includes('labour') || (s.job_category || s.category || '').toLowerCase() === 'labour';
                          return (s.description && s.description !== 'Labour' && s.description !== 'Part')
                            ? s.description
                            : (isLabourOnly ? 'Labour' : (s.job_category || s.category || s.service_type || s.service_name || (isPartItem ? 'Part' : 'Service')));
                        })()}
                      </span>
                    </td>
                    {!isNonGst && <td style={{ padding: '7px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'center', fontFamily: 'monospace', fontSize: 10 }}>{s.hsn_sac || '—'}</td>}
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{qtyVal}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(baseUnitRate)}</td>
                    {!isNonGst && <td style={{ padding: '7px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{taxPct}%</td>}
                    {!isNonGst && <td style={{ padding: '7px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(taxAmt)}</td>}
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                      {fmt(lineTotal)}
                    </td>
                  </tr>
                );
              };

              const parts = selectedServices.filter((s: any) => (s.item_type || '').toLowerCase() === 'part');
              const labours = selectedServices.filter((s: any) => (s.item_type || '').toLowerCase() !== 'part');

              const calcSubtotals = (rows: any[]) => {
                let taxableVal = 0, gstTotal = 0, discTotal = 0;
                rows.forEach((s: any) => {
                  const lineAmt = parseFloat(String(s.amount)) || 0;
                  const fullTaxAmt = parseFloat(String(s.tax_amount)) || 0;
                  const taxAmt = isNonGst ? 0 : fullTaxAmt;
                  const qty = parseFloat(String(s.qty)) || 1;
                  const rate = parseFloat(String(s.rate)) || 0;
                  const discPct = parseFloat(String(s.discount_pct)) || 0;
                  taxableVal += isNonGst ? (lineAmt + fullTaxAmt) : lineAmt;
                  gstTotal += taxAmt;
                  discTotal += (discPct > 0 ? (qty * rate * discPct / 100) : 0);
                });
                return { taxableVal, gstTotal, discTotal, subtotal: taxableVal + gstTotal };
              };

              const pTot = calcSubtotals(parts);
              const lTot = calcSubtotals(labours);

              return (
                <>
                  {parts.length > 0 && (
                    <>
                      <tr key="parts-hdr" style={{ background: '#FEF2F2' }}>
                        <td colSpan={colCount} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 800, color: '#991B1B', textTransform: 'uppercase', borderBottom: '2px solid #DC2626' }}>
                          ™¸  Spare Parts
                        </td>
                      </tr>
                      {parts.map((s: any) => renderItemRow(s))}
                      {!isNonGst && (
                        <tr key="parts-taxable" style={{ background: '#fff' }}>
                          <td colSpan={colCount - 1} style={{ padding: '4px 10px', textAlign: 'right', fontSize: 9, color: '#991B1B' }}>Parts Taxable Value</td>
                          <td style={{ padding: '4px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#991B1B', fontSize: 9.5 }}>{fmt(pTot.taxableVal)}</td>
                        </tr>
                      )}
                      {!isNonGst && (
                        <tr key="parts-gst" style={{ background: '#fff' }}>
                          <td colSpan={colCount - 1} style={{ padding: '4px 10px', textAlign: 'right', fontSize: 9, color: '#991B1B' }}>Parts GST Total</td>
                          <td style={{ padding: '4px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#991B1B', fontSize: 9.5 }}>{fmt(pTot.gstTotal)}</td>
                        </tr>
                      )}
                      {pTot.discTotal > 0 && (
                        <tr key="parts-disc" style={{ background: '#fff' }}>
                          <td colSpan={colCount - 1} style={{ padding: '4px 10px', textAlign: 'right', fontSize: 9, color: '#991B1B' }}>Parts Discount Total</td>
                          <td style={{ padding: '4px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#991B1B', fontSize: 9.5 }}>{fmt(pTot.discTotal)}</td>
                        </tr>
                      )}
                      <tr key="parts-sub" style={{ background: '#fff' }}>
                        <td colSpan={colCount - 1} style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 800, fontSize: 10, color: '#991B1B' }}>Parts Subtotal {isNonGst ? '' : '(Incl. GST)'}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#991B1B', borderBottom: '2px solid #DC2626' }}>{fmt(pTot.subtotal)}</td>
                      </tr>
                    </>
                  )}

                  {labours.length > 0 && (
                    <>
                      <tr key="labour-hdr" style={{ background: '#EFF6FF' }}>
                        <td colSpan={colCount} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', borderBottom: '2px solid #3B82F6' }}>
                          SERVICES
                        </td>
                      </tr>
                      {labours.map((s: any) => renderItemRow(s))}
                      {!isNonGst && (
                        <tr key="labour-taxable" style={{ background: '#fff' }}>
                          <td colSpan={colCount - 1} style={{ padding: '4px 10px', textAlign: 'right', fontSize: 9, color: '#1E40AF' }}>Services Taxable Value</td>
                          <td style={{ padding: '4px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#1E40AF', fontSize: 9.5 }}>{fmt(lTot.taxableVal)}</td>
                        </tr>
                      )}
                      {!isNonGst && (
                        <tr key="labour-gst" style={{ background: '#fff' }}>
                          <td colSpan={colCount - 1} style={{ padding: '4px 10px', textAlign: 'right', fontSize: 9, color: '#1E40AF' }}>Services GST Total</td>
                          <td style={{ padding: '4px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#1E40AF', fontSize: 9.5 }}>{fmt(lTot.gstTotal)}</td>
                        </tr>
                      )}
                      {lTot.discTotal > 0 && (
                        <tr key="labour-disc" style={{ background: '#fff' }}>
                          <td colSpan={colCount - 1} style={{ padding: '4px 10px', textAlign: 'right', fontSize: 9, color: '#1E40AF' }}>Services Discount Total</td>
                          <td style={{ padding: '4px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#1E40AF', fontSize: 9.5 }}>{fmt(lTot.discTotal)}</td>
                        </tr>
                      )}
                      <tr key="labour-sub" style={{ background: '#fff' }}>
                        <td colSpan={colCount - 1} style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 800, fontSize: 10, color: '#1E40AF' }}>Services Subtotal {isNonGst ? '' : '(Incl. GST)'}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#1E40AF', borderBottom: '2px solid #3B82F6' }}>{fmt(lTot.subtotal)}</td>
                      </tr>
                    </>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* -- Totals Section (A.2 fix) -- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
        <div style={{ flex: 1, fontSize: 11, color: '#4B5563' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700 }}>Amount in Words:</p>
          <p style={{ margin: 0, fontStyle: 'italic', color: '#DC2626', fontWeight: 600 }}>{amountInWords}</p>
          {totalAdvance > 0 && (
            <p style={{ margin: '8px 0 0', fontSize: 10, color: '#059669', fontWeight: 600 }}>
              ✓ Advance Paid: ₹ {fmt(totalAdvance)}
            </p>
          )}
        </div>

        <div style={{ width: 280 }}>
          <table style={{ width: '100%', fontSize: 11 }}>
            <tbody>
              <tr>
                <td style={{ padding: '3px 0', color: '#666' }}>Parts Subtotal:</td>
                <td style={{ padding: '3px 0', textAlign: 'right', fontFamily: 'monospace' }}>₹ {fmt(partsExclTax)}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 0', color: '#666' }}>Services Subtotal:</td>
                <td style={{ padding: '3px 0', textAlign: 'right', fontFamily: 'monospace' }}>₹ {fmt(labourExclTax)}</td>
              </tr>
              {!isNonGst && (
                <tr>
                  <td style={{ padding: '3px 0', color: '#666' }}>Total Tax (GST):</td>
                  <td style={{ padding: '3px 0', textAlign: 'right', fontFamily: 'monospace', color: '#DC2626' }}>₹ {fmt(taxTotal)}</td>
                </tr>
              )}
              <tr style={{ borderTop: '2px solid #DC2626', fontWeight: 800, fontSize: 13, color: '#DC2626' }}>
                <td style={{ padding: '6px 0' }}>Grand Total:</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace' }}>₹ {fmt(grandTotal)}</td>
              </tr>
              {totalAdvance > 0 && (
                <tr style={{ fontWeight: 700, fontSize: 12, color: balanceDue <= 0 ? '#059669' : '#DC2626' }}>
                  <td style={{ padding: '4px 0' }}>Balance Due:</td>
                  <td style={{ padding: '4px 0', textAlign: 'right', fontFamily: 'monospace' }}>₹ {fmt(balanceDue)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};




