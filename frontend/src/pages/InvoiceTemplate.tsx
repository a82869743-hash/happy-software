import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { numberToWords, fmtCurrency, getDivisionConfig, generateUPIQrCode, type DivisionConfig } from '../utils/invoiceFormat';

export default function InvoiceTemplate() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
  const logoUrl = `${apiBase}/uploads/happy-logo.png`;

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await api.get(`/job-cards/${id}`);
        const data = res.data;
        setJob(data);

        const svcNames = (data.services || []).map((s: any) => s.service_name || s.name || '').join(' ');
        const combinedService = `${data.service_type || ''} ${svcNames}`.trim();
        const config = getDivisionConfig(data.company, data.is_quick_job, data.job_no, combinedService);
        const subTotal = (data.services && data.services.length > 0)
          ? data.services.reduce((s: number, it: any) => s + (parseFloat(it.amount || (it.rate * (it.qty || 1))) || 0), 0)
          : parseFloat(data.final_amount || 0);
        const total = parseFloat(data.final_amount || subTotal || 0);

        const advancePaid = (data.advance_payments || []).reduce((s: number, ap: any) => s + (parseFloat(ap.amount) || 0), 0);
        const isPaid = data.status === 'delivered' || data.status === 'invoiced' || data.payment_status === 'paid';
        const received = advancePaid > 0 ? advancePaid : (isPaid ? total : parseFloat(data.paid_amount || 0));
        const balance = Math.max(0, total - received);
        const qrAmount = balance > 0 ? balance : total;

        const invNo = data.invoice_no || data.invoice?.invoice_no || data.non_gst_invoice_no || data.job_no;
        const qr = await generateUPIQrCode(config, qrAmount, invNo);
        setQrDataUrl(qr);
      } catch (err) {
        console.error('Failed to load invoice data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <p style={{ fontSize: 14, color: '#666' }}>Loading invoice preview...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div style={{ padding: 60, textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <p style={{ fontSize: 16, color: '#dc2626', fontWeight: 'bold' }}>Job Card record not found.</p>
        <button
          onClick={() => window.close()}
          style={{ marginTop: 12, padding: '8px 16px', background: '#E04E1D', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
    );
  }

  const svcNames = (job.services || []).map((s: any) => s.service_name || s.name || '').join(' ');
  const combinedService = `${job.service_type || ''} ${svcNames}`.trim();
  const divisionConfig: DivisionConfig = getDivisionConfig(job.company, job.is_quick_job, job.job_no, combinedService);

  const servicesList: any[] = (job.services && job.services.length > 0)
    ? job.services
    : [{
        service_name: job.service_type || job.job_category || 'Car Care & Service',
        hsn_sac: '',
        qty: 1,
        unit: 'Pcs',
        rate: parseFloat(job.final_amount || 0),
        amount: parseFloat(job.final_amount || 0),
      }];

  const totalQty = servicesList.reduce((sum: number, it: any) => sum + (parseFloat(it.qty) || 1), 0);
  const subTotal = servicesList.reduce((sum: number, it: any) => sum + (parseFloat(it.amount !== undefined ? it.amount : (it.rate * (it.qty || 1))) || 0), 0);
  const total = parseFloat(job.final_amount || subTotal || 0);

  const advancePaid = (job.advance_payments || []).reduce((s: number, ap: any) => s + (parseFloat(ap.amount) || 0), 0);
  const isPaid = job.status === 'delivered' || job.status === 'invoiced' || job.payment_status === 'paid';
  const received = advancePaid > 0 ? advancePaid : (isPaid ? total : parseFloat(job.paid_amount || 0));
  const balance = Math.max(0, total - received);

  const invNo = job.invoice_no || job.invoice?.invoice_no || job.non_gst_invoice_no || job.job_no;
  const invDate = new Date(job.job_date || job.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');

  const customerName = job.cust_name || job.customer_name || job.owner_name || 'Counter Customer';
  const customerAddress = job.address || [job.address_line, job.colony_street, job.city, job.state, job.pincode].filter(Boolean).join(', ');
  const carName = job.car_name || [job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ') || '—';
  const regNo = job.reg_no || '—';

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px 10px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* --- Action Buttons (Hidden on Print) --- */}
      <div className="no-print" style={{ maxWidth: 820, margin: '0 auto 16px auto', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          onClick={() => window.close()}
          style={{ padding: '8px 18px', background: '#fff', border: '1px solid #ccc', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          ✕ Close
        </button>
        <button
          onClick={() => window.print()}
          style={{ padding: '8px 22px', background: '#E04E1D', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {/* --- RETAIL INVOICE CONTAINER --- */}
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        {/* Title above box */}
        <h2 style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, margin: '0 0 8px 0', color: '#111', letterSpacing: 0.5 }}>
          Retail Invoice
        </h2>

        {/* Outer border box */}
        <div style={{ border: '1.5px solid #222', background: '#fff', color: '#000', fontSize: 11 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1.5px solid #222' }}>
            {/* Logo */}
            <div style={{ width: 95, height: 75, background: '#000', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
              <img
                src={logoUrl}
                alt="HAPPY Logo"
                style={{ maxWidth: 85, maxHeight: 67, objectFit: 'contain' }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            {/* Business info */}
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ margin: '0 0 3px 0', fontSize: 19, fontWeight: 900, fontFamily: 'serif, "Times New Roman", Arial', letterSpacing: 0.5, color: '#111' }}>
                {divisionConfig.title}
              </h1>
              {divisionConfig.addressLines.map((line, idx) => (
                <p key={idx} style={{ margin: 0, fontSize: 10, lineHeight: 1.35, color: '#222' }}>{line}</p>
              ))}
              <p style={{ margin: 0, fontSize: 10, lineHeight: 1.35, color: '#222' }}>{divisionConfig.contactLine}</p>
              <p style={{ margin: 0, fontSize: 10, lineHeight: 1.35, color: '#222' }}>{divisionConfig.stateLine}</p>
            </div>
          </div>

          {/* Bill To & Invoice Details Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {/* Left: Bill To */}
            <div style={{ borderRight: '1.5px solid #222', borderBottom: '1.5px solid #222' }}>
              <div style={{ background: '#E04E1D', color: '#fff', fontWeight: 700, fontSize: 11, padding: '3px 10px' }}>
                Bill To
              </div>
              <div style={{ padding: '8px 10px', minHeight: 75, fontSize: 10.5, lineHeight: 1.4 }}>
                <p style={{ margin: '0 0 2px 0', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase' }}>
                  {customerName}
                </p>
                {customerAddress ? (
                  <p style={{ margin: '0 0 2px 0', color: '#222', textTransform: 'uppercase' }}>
                    {customerAddress}
                  </p>
                ) : null}
                {(job.cust_mobile || job.mobile_no) && (
                  <p style={{ margin: 0, color: '#333' }}>
                    Phone: {job.cust_mobile || job.mobile_no}
                  </p>
                )}
                {job.gstin && (
                  <p style={{ margin: 0, color: '#333' }}>
                    GSTIN: {job.gstin}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Invoice Details */}
            <div style={{ borderBottom: '1.5px solid #222' }}>
              <div style={{ background: '#E04E1D', color: '#fff', fontWeight: 700, fontSize: 11, padding: '3px 10px' }}>
                Invoice Details
              </div>
              <div style={{ padding: '8px 10px', minHeight: 75, fontSize: 10.5, lineHeight: 1.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#222' }}>Invoice No.:</span>
                  <span style={{ fontWeight: 'bold' }}>{invNo}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#222' }}>Date:</span>
                  <span>{invDate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#222' }}>Car Name:</span>
                  <span style={{ fontWeight: 'bold' }}>{carName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#222' }}>Reg No.:</span>
                  <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{regNo}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#E04E1D', color: '#fff', fontSize: 10.5, fontWeight: 700 }}>
                <th style={{ padding: '4px 6px', textAlign: 'center', width: 35, borderRight: '1px solid #ff8860' }}>#</th>
                <th style={{ padding: '4px 8px', borderRight: '1px solid #ff8860' }}>Item name</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', width: 75, borderRight: '1px solid #ff8860' }}>HSN/ SAC</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', width: 60, borderRight: '1px solid #ff8860' }}>Quantity</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', width: 50, borderRight: '1px solid #ff8860' }}>Unit</th>
                <th style={{ padding: '4px 8px', textAlign: 'right', width: 90, borderRight: '1px solid #ff8860' }}>Price/ Unit</th>
                <th style={{ padding: '4px 8px', textAlign: 'right', width: 100 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {servicesList.map((svc, idx) => {
                const sQty = parseFloat(svc.qty) || 1;
                const sRate = parseFloat(svc.rate !== undefined ? svc.rate : (svc.amount / sQty)) || 0;
                const sAmt = parseFloat(svc.amount !== undefined ? svc.amount : (sRate * sQty)) || 0;
                return (
                  <tr key={idx} style={{ fontSize: 10.5, minHeight: 24 }}>
                    <td style={{ padding: '6px 6px', textAlign: 'center', borderRight: '1.5px solid #222', verticalAlign: 'top' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '6px 8px', borderRight: '1.5px solid #222', fontWeight: 600, verticalAlign: 'top' }}>
                      {svc.service_name || svc.item_name || svc.product_name || 'Car Service'}
                    </td>
                    <td style={{ padding: '6px 6px', textAlign: 'center', borderRight: '1.5px solid #222', verticalAlign: 'top' }}>
                      {svc.hsn_sac || '—'}
                    </td>
                    <td style={{ padding: '6px 6px', textAlign: 'center', borderRight: '1.5px solid #222', verticalAlign: 'top' }}>
                      {sQty}
                    </td>
                    <td style={{ padding: '6px 6px', textAlign: 'center', borderRight: '1.5px solid #222', verticalAlign: 'top' }}>
                      {svc.unit || 'Pcs'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1.5px solid #222', verticalAlign: 'top' }}>
                      {fmtCurrency(sRate)}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, verticalAlign: 'top' }}>
                      {fmtCurrency(sAmt)}
                    </td>
                  </tr>
                );
              })}

              {/* Spacer empty row if few items to give authentic bill height */}
              {servicesList.length < 5 && (
                <tr style={{ height: Math.max(30, (5 - servicesList.length) * 26) }}>
                  <td style={{ borderRight: '1.5px solid #222' }}></td>
                  <td style={{ borderRight: '1.5px solid #222' }}></td>
                  <td style={{ borderRight: '1.5px solid #222' }}></td>
                  <td style={{ borderRight: '1.5px solid #222' }}></td>
                  <td style={{ borderRight: '1.5px solid #222' }}></td>
                  <td style={{ borderRight: '1.5px solid #222' }}></td>
                  <td></td>
                </tr>
              )}
            </tbody>
            <tfoot>
              {/* Table Total Row */}
              <tr style={{ borderTop: '1.5px solid #222', borderBottom: '1.5px solid #222', fontWeight: 700, fontSize: 11 }}>
                <td style={{ padding: '5px 6px', borderRight: '1.5px solid #222' }}></td>
                <td style={{ padding: '5px 8px', borderRight: '1.5px solid #222' }}>Total</td>
                <td style={{ padding: '5px 6px', borderRight: '1.5px solid #222' }}></td>
                <td style={{ padding: '5px 6px', textAlign: 'center', borderRight: '1.5px solid #222' }}>{totalQty}</td>
                <td style={{ padding: '5px 6px', borderRight: '1.5px solid #222' }}></td>
                <td style={{ padding: '5px 8px', borderRight: '1.5px solid #222' }}></td>
                <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmtCurrency(subTotal)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Amount In Words & Amounts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {/* Left: Invoice Amount In Words */}
            <div style={{ borderRight: '1.5px solid #222', borderBottom: '1.5px solid #222' }}>
              <div style={{ background: '#E04E1D', color: '#fff', fontWeight: 700, fontSize: 11, padding: '3px 10px' }}>
                Invoice Amount In Words
              </div>
              <div style={{ padding: '12px 10px', minHeight: 85, fontSize: 11, color: '#111', fontStyle: 'italic' }}>
                {numberToWords(Math.round(total))}
              </div>
            </div>

            {/* Right: Amounts breakdown */}
            <div style={{ borderBottom: '1.5px solid #222' }}>
              <div style={{ background: '#E04E1D', color: '#fff', fontWeight: 700, fontSize: 11, padding: '3px 10px' }}>
                Amounts
              </div>
              <div style={{ padding: 0, fontSize: 10.5 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                      <td style={{ padding: '4px 10px', color: '#333' }}>Sub Total</td>
                      <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(subTotal)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                      <td style={{ padding: '4px 10px', fontWeight: 700 }}>Total</td>
                      <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtCurrency(total)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                      <td style={{ padding: '4px 10px', color: '#333' }}>Received</td>
                      <td style={{ padding: '4px 10px', textAlign: 'right' }}>{fmtCurrency(received)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '5px 10px', fontWeight: 700, color: '#111' }}>Balance</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#111' }}>{fmtCurrency(balance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bank Details & Terms Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {/* Left: Bank Details with Dynamic QR */}
            <div style={{ borderRight: '1.5px solid #222' }}>
              <div style={{ background: '#E04E1D', color: '#fff', fontWeight: 700, fontSize: 11, padding: '3px 10px' }}>
                Bank Details
              </div>
              <div style={{ padding: '10px', display: 'flex', gap: 12, alignItems: 'center' }}>
                {/* Dynamic QR */}
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="UPI QR Code"
                      style={{ width: 85, height: 85, display: 'block', border: '1px solid #ccc' }}
                    />
                  ) : (
                    <div style={{ width: 85, height: 85, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>
                      Generating QR...
                    </div>
                  )}
                  {/* UPI Badge */}
                  <div style={{ marginTop: 3, border: '1px solid #059669', borderRadius: 2, padding: '1px 3px', fontSize: 7.5, fontWeight: 800, color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <span style={{ background: '#047857', color: '#fff', padding: '0 2px', borderRadius: 1, fontSize: 6.5 }}>UPI</span>
                    <span>SCAN TO PAY</span>
                  </div>
                </div>

                {/* Account details */}
                <div style={{ fontSize: 9.5, lineHeight: 1.45, color: '#111' }}>
                  <p style={{ margin: '0 0 2px 0' }}>
                    <strong>Name:</strong> {divisionConfig.bankName}
                  </p>
                  <p style={{ margin: '0 0 2px 0' }}>
                    <strong>Account No.:</strong> {divisionConfig.accountNo}
                  </p>
                  <p style={{ margin: '0 0 2px 0' }}>
                    <strong>IFSC code:</strong> {divisionConfig.ifsc}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Account Holder's Name:</strong> {divisionConfig.accountHolder}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Terms and conditions */}
            <div>
              <div style={{ background: '#E04E1D', color: '#fff', fontWeight: 700, fontSize: 11, padding: '3px 10px' }}>
                Terms and conditions
              </div>
              <div style={{ padding: '10px 12px', fontSize: 9, lineHeight: 1.45, color: '#222' }}>
                <p style={{ margin: '0 0 3px 0' }}>1) Please do not left anything in car companies not responsible for any loss or damage.</p>
                <p style={{ margin: '0 0 3px 0' }}>2) Please take the car on the same day.</p>
                <p style={{ margin: '0 0 3px 0' }}>3) On the event loss of job card car would be delivered only after sufficient verifications.</p>
                <p style={{ margin: 0 }}>4) Company is not responsible for any technical and mechanical faults.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Print CSS --- */}
      <style>{`
        @media print {
          body {
            background: #fff !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>
    </div>
  );
}
