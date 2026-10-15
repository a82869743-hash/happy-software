import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { formatCurrency, formatNumber } from '../utils/format';
import { getDivisionConfig, generateUPIQrCode } from '../utils/invoiceFormat';

/**
 * PublicDocView — Public-facing document viewer (no auth required)
 * URL: /view/:token?type=estimate|invoice|job_card
 * 
 * Renders the EXACT same invoice/estimate layout as PrintView.tsx
 * but fetches data via the public API (no login required).
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function numberToWords(n: number): string {
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

function fmt(val: number | string): string {
  return parseFloat(String(val)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TITLES: Record<string, string> = {
  estimate: 'INVOICE',
  proforma: 'PROFORMA INVOICE',
  tax_invoice: 'TAX INVOICE',
  job_card: 'JOB CARD',
};

export default function PublicDocView() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const docType = searchParams.get('type') || 'job_card';
  const apiBaseUrl = API_BASE.replace('/api', '');

  const [job, setJob] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [recommendedPresets, setRecommendedPresets] = useState<any[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const [res, recRes] = await Promise.all([
          axios.get(`${API_BASE}/public/document/${token}`, {
            params: { type: docType }
          }),
          axios.get(`${API_BASE}/service-catalog/recommended-services`).catch(() => ({ data: { data: [] } }))
        ]);
        setJob(res.data.job);
        setBusiness(res.data.business);
        setRecommendedPresets(recRes.data?.data || []);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Document not found');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchDoc();
  }, [token, docType]);

  useEffect(() => {
    if (job) {
      const vehicleMake = job.vehicle_make || job.make || '';
      const vehicleModel = job.vehicle_model || job.model || '';
      const carModel = [vehicleMake, vehicleModel].filter(Boolean).join(' ') || job.car_name || '';
      const regNo = job.reg_no || job.registration_no || '';

      let invNo = '';
      if (job.invoice) invNo = job.invoice.invoice_no;
      else if (job.non_gst_invoice) invNo = job.non_gst_invoice.invoice_no;
      else if (job.estimate) invNo = job.estimate.estimate_no;
      else invNo = job.job_no || '';

      let prefix = 'Invoice';
      if (docType === 'estimate' || job.completion_type === 'estimate') prefix = 'Invoice';
      else if (docType === 'proforma') prefix = 'Proforma';
      else if (docType === 'job_card') prefix = 'Job Card';

      const parts = [prefix];
      if (carModel) parts.push(carModel);
      if (regNo) parts.push(regNo);
      if (prefix === 'Invoice' && invNo) parts.push(invNo);

      document.title = parts.join(' - ');
    }
  }, [job, docType]);

  useEffect(() => {
    if (job) {
      const svcNames = (job.services || []).map((s: any) => s.service_name || s.name || '').join(' ');
      const combinedService = `${job.service_type || ''} ${svcNames}`.trim();
      const config = getDivisionConfig(job.company, job.is_quick_job, job.job_no, combinedService);
      const totalAmt = parseFloat(String(job.invoice?.total_amount || job.total_amount || 0));
      const advTotal = (job.advance_payments || []).reduce((s: number, a: any) => s + (parseFloat(a.amount) || 0), 0);
      const balanceAmt = Math.max(0, totalAmt - advTotal);
      const amountForQr = balanceAmt > 0 ? balanceAmt : totalAmt;
      const invNo = job.invoice?.invoice_no || job.non_gst_invoice?.invoice_no || job.job_no || 'Bill';
      generateUPIQrCode(config, amountForQr, invNo)
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('Failed to generate UPI QR in PublicDocView:', err));
    }
  }, [job]);

  if (loading) {
    return (
      <div style={{ fontFamily: "'Inter', Arial, sans-serif", display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid #e2e8f0', borderTopColor: '#D97706', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>Loading document...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div style={{ fontFamily: "'Inter', Arial, sans-serif", display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Document Not Found</h2>
          <p style={{ color: '#64748b', fontSize: 14 }}>{error || 'This link may have expired or is invalid.'}</p>
        </div>
      </div>
    );
  }

  const biz = business || {};

  const printType = docType === 'invoice'
    ? (job.completion_type === 'estimate' ? 'estimate' : 'tax_invoice')
    : docType === 'estimate'
      ? 'estimate'
      : docType === 'job_card'
        ? 'job_card'
        : 'proforma';

  // Build services list — add job_category as a service if it exists (only for GST tax invoices)
  let printServices = [...(job.services || [])];
  if (printType === 'tax_invoice' && job.job_category && parseFloat(job.job_category_amount || 0) > 0) {
    const currentIsNonGst = printServices.length > 0 && printServices.every((s: any) => parseFloat(s.tax_pct || 0) === 0 && parseFloat(s.tax_amount || 0) === 0);
    const categoryAmount = parseFloat(job.job_category_amount || 0);
    const taxPct = currentIsNonGst ? 0 : (job.job_category_gst_pct !== null && job.job_category_gst_pct !== undefined ? parseFloat(job.job_category_gst_pct) : 18);
    const taxAmount = currentIsNonGst ? 0 : categoryAmount * (taxPct / 100);
    printServices.push({
      id: -999, service_name: job.job_category, item_type: 'labour',
      qty: 1, rate: categoryAmount, amount: categoryAmount,
      hsn_sac: '998714', tax_pct: taxPct, tax_amount: taxAmount, is_selected: 1,
    });
  }

  // Sort Parts on top, Labour below
  printServices.sort((a: any, b: any) => {
    if (a.item_type === 'part' && b.item_type !== 'part') return -1;
    if (a.item_type !== 'part' && b.item_type === 'part') return 1;
    return 0;
  });

  // Compute totals
  const isNonGst = true;
  const svcNames = (job?.services || []).map((s: any) => s.service_name || s.name || '').join(' ');
  const combinedService = `${job?.service_type || ''} ${svcNames}`.trim();
  const divisionConfig = getDivisionConfig(job?.company, job?.is_quick_job, job?.job_no, combinedService);
  const divisionHeading = divisionConfig.title;

  // Tax groups
  const taxGroups: { [key: number]: { taxable: number; tax: number } } = {};
  printServices.forEach((s: any) => {
    if (isNonGst) return;
    const rate = parseFloat(s.tax_pct !== undefined && s.tax_pct !== null && s.tax_pct !== '' ? s.tax_pct : 18);
    const taxableAmt = parseFloat(s.amount || 0);
    const taxAmt = parseFloat(s.tax_amount || 0);
    if (!taxGroups[rate]) taxGroups[rate] = { taxable: 0, tax: 0 };
    taxGroups[rate].taxable += taxableAmt;
    taxGroups[rate].tax += taxAmt;
  });

  // Vehicle formatted name
  const vehicleMake = job.vehicle_make || job.make || '';
  const vehicleModel = job.vehicle_model || job.model || '';
  const vehicleVariant = job.variant || '';
  const vehicleYear = job.vehicle_year || job.year || '';
  const vehicleName = [vehicleMake, vehicleModel, vehicleVariant, vehicleYear ? `(${vehicleYear})` : ''].filter(Boolean).join(' ') || job.car_name || '—';

  // Format Date helper
  const formatDateLabel = (d: string | null | undefined) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Concerns padding
  const maxConcerns = 8;
  const concernLines = Array.from({ length: maxConcerns }).map((_, idx) => {
    return {
      num: idx + 1,
      text: job.concerns && job.concerns[idx] ? job.concerns[idx].concern_text : ''
    };
  });

  // Recommended services checkbox matching logic
  const serviceNamesLower = printServices.map((s: any) => (s.service_name || '').toLowerCase());
  const hasSvc = (keywords: string[]) => serviceNamesLower.some((name: string) => keywords.some((k: string) => name.includes(k)));

  const recommendedServices = recommendedPresets.length > 0
    ? recommendedPresets.map(rec => ({
        label: rec.name,
        detail: rec.period || '',
        checked: hasSvc([rec.name.toLowerCase()])
      }))
    : [
        { label: 'Engine Oil & Filter Change', detail: '10,000 km / 1 yr', checked: hasSvc(['engine oil', 'oil filter', 'oil change']) },
        { label: 'Air Filter Replacement', detail: '20,000 km / 2 yrs', checked: hasSvc(['air filter']) },
        { label: 'Cabin Filter (A/C)', detail: '15,000 km / 1 yr', checked: hasSvc(['cabin', 'ac filter', 'a/c filter']) },
        { label: 'Coolant Flushing', detail: '50,000 km / 3 yrs', checked: hasSvc(['coolant']) },
        { label: 'Brake Fluid Change', detail: '40,000 km / 2 yrs', checked: hasSvc(['brake fluid', 'brake oil']) },
        { label: 'Transmission / Gear Oil', detail: '60,000 km / 4 yrs', checked: hasSvc(['transmission', 'gear oil', 'gearbox']) },
        { label: 'Spark Plugs Replacement', detail: '30,000 km / 2 yrs', checked: hasSvc(['spark plug', 'sparkplug']) },
        { label: 'Wheel Alignment & Balancing', detail: '10,000 km / 6 mo', checked: hasSvc(['alignment', 'balancing']) },
      ];

  // Estimate / Task List padding
  const maxEstimateRows = Math.max(6, printServices.length);
  const estimateRows = Array.from({ length: maxEstimateRows }).map((_, idx) => {
    const s = printServices[idx];
    return {
      num: idx + 1,
      category: s ? (s.job_category || 'General') : '',
      type: s ? ((s.service_name || '').includes(' & ') ? 'Part & Labour' : (s.item_type === 'part' ? 'Part' : 'Labour')) : '',
      description: s ? s.service_name : '',
      amount: s ? parseFloat(String(s.amount)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
    };
  });
  const estimateTotal = printServices.reduce((sum: number, s: any) => sum + (parseFloat(String(s.amount)) || 0), 0);

  if (printType === 'job_card') {
    return (
      <>
        {/* Download bar — only visible on screen */}
        <div className="no-print" style={{ background: '#138496', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ color: 'white', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{divisionHeading} — WORK ORDER</span>
          </div>
          <button
            onClick={() => window.print()}
            style={{
              background: '#fff', color: '#138496', border: 'none', padding: '8px 20px',
              borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            Download / Print
          </button>
        </div>

        <div
          className="print-page-container"
          style={{
            fontFamily: "'Outfit', 'Inter', Arial, sans-serif",
            padding: '20px',
            maxWidth: '800px',
            margin: '0 auto',
            color: '#1e293b',
            fontSize: '11px',
            lineHeight: '1.4',
            background: '#ffffff',
            boxSizing: 'border-box'
          }}
        >
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '5px', width: '100%', justifyContent: 'center', position: 'relative' }}>
              <img 
                src={`${apiBaseUrl}/uploads/happy-logo.png`} 
                alt="HAPPY Logo" 
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
                style={{ height: '55px', objectFit: 'contain', position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)' }}
              />
              <div style={{ textAlign: 'center' }}>
                <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 900, color: '#138496', letterSpacing: '1px', lineHeight: '1.1' }}>
                  {divisionHeading}
                </h1>
                <span style={{ fontSize: '9px', color: '#64748b', fontWeight: '500' }}>
                  {divisionConfig.addressLines.join(', ')}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '15px', fontSize: '9.5px', color: '#475569', fontWeight: '600', borderTop: '1px solid #e2e8f0', width: '100%', justifyContent: 'center', paddingTop: '4px' }}>
              <span><strong>Phone:</strong> {biz.business_phone || '99986 25511'}</span>

            </div>
          </div>

          {/* Document Title */}
          <div style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: '800', fontSize: '13px', textTransform: 'uppercase', marginBottom: '10px', backgroundColor: '#f8fafc', color: '#1e293b', letterSpacing: '1.5px' }}>
            Job Card
          </div>

          {/* Customer & Vehicle Info Grid */}
          <div style={{ display: 'flex', border: '2.5px solid #000', width: '100%', boxSizing: 'border-box', marginBottom: '15px' }}>
            {/* Left box: Owner info */}
            <div style={{ width: '50%', borderRight: '1.5px solid #000', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px', boxSizing: 'border-box' }}>
              <div style={{ fontWeight: '800', fontSize: '9.5px', textTransform: 'uppercase', color: '#138496', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px', marginBottom: '4px' }}>
                Customer Details
              </div>
              <div><strong>Name:</strong> {job.owner_name || job.cust_name || '—'}</div>
              <div><strong>Mobile:</strong> {job.mobile_no || job.cust_mobile || '—'}</div>
              {job.alt_mobile && <div><strong>Alt Mobile:</strong> {job.alt_mobile}</div>}

              {(job.address_line || job.colony_street || job.city || job.state || job.pincode) && (
                <div>
                  <strong>Address:</strong> {[job.address_line, job.colony_street, job.city, job.state, job.pincode].filter(Boolean).join(', ')}
                </div>
              )}
            </div>

            {/* Right box: Vehicle info */}
            <div style={{ width: '50%', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px', boxSizing: 'border-box' }}>
              <div style={{ fontWeight: '800', fontSize: '9.5px', textTransform: 'uppercase', color: '#138496', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px', marginBottom: '4px' }}>
                Vehicle Details
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                <div><strong>Reg No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '11.5px', color: '#138496' }}>{job.reg_no}</span></div>
                <div><strong>Chassis:</strong> {job.chassis_no || '—'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                <div><strong>Model:</strong> {vehicleName}</div>
                <div><strong>Engine:</strong> {job.engine_no || '—'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                <div><strong>Color:</strong> {job.vehicle_color || '—'}</div>
                <div><strong>Year:</strong> {job.vehicle_year || job.year || '—'}</div>
              </div>
            </div>
          </div>

          {/* Job Parameters */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '15px', fontSize: '10.5px' }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000', padding: '6px 8px', width: '25%' }}><strong>Order No:</strong> {job.job_no}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', width: '25%' }}><strong>Date:</strong> {formatDateLabel(job.job_date || job.created_at)}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', width: '25%' }}><strong>Advisor:</strong> {job.service_advisor || '—'}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', width: '25%' }}><strong>Service Type:</strong> {job.service_type || 'General'}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '6px 8px' }}><strong>Fuel Level:</strong> {job.fuel_level || '—'}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px' }}><strong>Spare Wheel:</strong> {job.spare_wheel ? 'Yes' : 'No'}</td>
                <td colSpan={2} style={{ border: '1px solid #000', padding: '6px 8px' }}><strong>Pointers:</strong> {job.pointers || '—'}</td>
              </tr>
            </tbody>
          </table>

          {/* Checklist & Concerns */}
          <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
            {/* Left Panel: Customer Concerns */}
            <div style={{ width: '55%' }}>
              <div style={{ backgroundColor: '#138496', color: 'white', padding: '4px 10px', fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px', width: 'fit-content' }}>
                Customer Concerns / Demands
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', fontSize: '10.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ border: '1px solid #000', padding: '5px 8px', width: '12%', textAlign: 'center' }}>SL</th>
                    <th style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'left' }}>Description of Work / Concern</th>
                  </tr>
                </thead>
                <tbody>
                  {concernLines.map((line) => (
                    <tr key={line.num} style={{ height: '22px' }}>
                      <td style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'center', color: '#64748b' }}>{line.num}</td>
                      <td style={{ border: '1px solid #000', padding: '3px 8px' }}>{line.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Right Panel: Standard Recommended Checklist */}
            <div style={{ width: '45%' }}>
              <div style={{ backgroundColor: '#138496', color: 'white', padding: '4px 10px', fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px', width: 'fit-content' }}>
                Service Catalog Checks
              </div>
              <div style={{ border: '2px solid #000', padding: '8px 12px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '6.5px', minHeight: '202px', backgroundColor: '#ffffff' }}>
                {recommendedServices.map((svc, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', fontSize: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '3.5px' }}>
                    <input type="checkbox" checked={svc.checked} readOnly style={{ margin: '0 6px 0 0' }} />
                    <span style={{ fontWeight: '600', color: '#334155' }}>{svc.label}</span>
                    <span style={{ flexGrow: 1 }}></span>
                    <span style={{ fontWeight: '700', color: '#138496', fontSize: '9px' }}>{svc.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Estimate / Task List Table */}
          <div style={{ marginBottom: '15px' }}>
            <div style={{ backgroundColor: '#138496', color: 'white', padding: '4px 10px', fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px', width: 'fit-content' }}>
              Job Description
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', fontSize: '10.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#138496', color: 'white' }}>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', width: '8%', textAlign: 'center' }}>SL No.</th>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', width: '18%', textAlign: 'left' }}>Category</th>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', width: '50%', textAlign: 'left' }}>Job / Part Description</th>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', width: '24%', textAlign: 'right' }}>Amount ₹</th>
                </tr>
              </thead>
              <tbody>
                {estimateRows.map((row, idx) => (
                  <tr key={idx} style={{ height: '23px' }}>
                    <td style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'center' }}>{row.num}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 8px' }}>{row.category}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 8px' }}>{row.description}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {row.amount ? `₹ ${row.amount}` : ''}
                    </td>
                  </tr>
                ))}
                <tr style={{ height: '26px', backgroundColor: '#f0f9ff' }}>
                  <td colSpan={3} style={{ border: '1px solid #000', padding: '4px 10px', textAlign: 'right', fontWeight: '800', color: '#138496' }}>
                    Total Amount
                  </td>
                  <td style={{ border: '1px solid #000', padding: '4px 10px', textAlign: 'right', fontWeight: '900', color: '#138496', fontFamily: 'monospace' }}>
                    {fmt(estimateTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Terms & Conditions */}
          <div style={{ marginTop: '15px' }}>
            <div style={{ fontWeight: '800', fontSize: '10.5px', color: '#138496', textTransform: 'uppercase', marginBottom: '5px' }}>
              Terms & Conditions
            </div>
            <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '8px 12px', fontSize: '9.5px', color: '#0369a1', marginBottom: '8px' }}>
              This is a system-generated job card. All work descriptions, parts and amounts above have been discussed with and acknowledged by the customer. No physical signature is required.
            </div>
          </div>

          {/* Footer */}
          <div style={{ backgroundColor: '#138496', color: 'white', padding: '6px 12px', textAlign: 'center', fontSize: '9.5px', fontWeight: '700', borderRadius: '4px', marginTop: '15px' }}>
            8/9 GIDC - Vadsar Main Road Mohangiri, opp. Uma Co Op Bank Ltd, near Bank Of Baroda, Makarpura, Vadodara, Gujarat 390010 | Ph: 99986 25511 | contact@happycarwash.com
          </div>
        </div>
      </>
    );
  }

  const parts = printServices.filter((s: any) => (s.item_type || '').toLowerCase() === 'part');
  const labours = printServices.filter((s: any) => (s.item_type || '').toLowerCase() !== 'part');


  const partsTaxable = isNonGst
    ? parts.reduce((sum: number, s: any) => sum + (parseFloat(String(s.amount)) || 0) + (parseFloat(String(s.tax_amount)) || 0), 0)
    : parts.reduce((sum: number, s: any) => sum + (parseFloat(String(s.amount)) || 0), 0);
  const partsGst = isNonGst ? 0 : parts.reduce((sum: number, s: any) => sum + (parseFloat(String(s.tax_amount)) || 0), 0);
  const partsDiscount = parts.reduce((sum: number, s: any) => {
    const amt = parseFloat(String(s.amount)) || 0;
    const discPct = parseFloat(String(s.discount_pct)) || 0;
    if (discPct <= 0 || discPct >= 100) return sum;
    return sum + (amt / (1 - discPct / 100) - amt);
  }, 0);
  const partsTotal = partsTaxable + partsGst;
  const partsRoundOff = Math.round(partsTotal);

  const laboursTaxable = isNonGst
    ? labours.reduce((sum: number, s: any) => sum + (parseFloat(String(s.amount)) || 0) + (parseFloat(String(s.tax_amount)) || 0), 0)
    : labours.reduce((sum: number, s: any) => sum + (parseFloat(String(s.amount)) || 0), 0);
  const laboursGst = isNonGst ? 0 : labours.reduce((sum: number, s: any) => sum + (parseFloat(String(s.tax_amount)) || 0), 0);
  const laboursDiscount = labours.reduce((sum: number, s: any) => {
    const amt = parseFloat(String(s.amount)) || 0;
    const discPct = parseFloat(String(s.discount_pct)) || 0;
    if (discPct <= 0 || discPct >= 100) return sum;
    return sum + (amt / (1 - discPct / 100) - amt);
  }, 0);
  const laboursTotal = laboursTaxable + laboursGst;
  const laboursRoundOff = Math.round(laboursTotal);
  const invoiceGrandTotal = partsRoundOff + laboursRoundOff;

  const advPayments = job.advance_payments || [];
  const totalAdvFull = advPayments.reduce((s: number, ap: any) => s + (parseFloat(ap.amount) || 0), 0);
  const docBalanceDue = invoiceGrandTotal - totalAdvFull;

  return (
    <>
      {/* Download bar — only visible on screen */}
      <div className="no-print" style={{ background: '#D97706', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ color: 'white', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{biz.business_name || 'Happy Car Wash'} — {TITLES[printType] || 'DOCUMENT'}</span>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            background: '#fff', color: '#D97706', border: 'none', padding: '8px 20px',
            borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          Download / Print
        </button>
      </div>

      <div
        className="print-page-container"
        style={{
          fontFamily: "'Outfit', 'Inter', Arial, sans-serif",
          padding: '20px',
          maxWidth: '800px',
          margin: '0 auto',
          color: '#1e293b',
          fontSize: '11px',
          lineHeight: '1.4',
          background: '#ffffff',
          boxSizing: 'border-box'
        }}
      >
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

        {/* -- Header -- */}
        <div style={{ display: 'flex', border: '1.5px solid #000', width: '100%', boxSizing: 'border-box', marginBottom: '15px' }}>
          {/* Left panel: Company details & customer details */}
          <div style={{ width: '50%', borderRight: '1.5px solid #000', padding: '12px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <img
                  src={`${apiBaseUrl}/uploads/happy-logo.png`}
                  alt="HAPPY Logo"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                  style={{ height: '50px', objectFit: 'contain' }}
                />
                <span style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-1.5px', color: '#000', fontFamily: "'Outfit', sans-serif" }}>{divisionHeading}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#000', lineHeight: '1.4' }}>
                <strong style={{ fontSize: '11px' }}>{divisionHeading}</strong><br />
                {divisionConfig.addressLines.map((l, i) => <span key={i}>{l}<br /></span>)}
                <strong>Contact:</strong> {divisionConfig.contactLine}
              </div>
            </div>
            
            <div style={{ borderTop: '1px solid #000', paddingTop: '8px', marginTop: '12px', fontSize: '10px', lineHeight: '1.4' }}>
              {job.company_name && (
                <>
                  <strong>Company Name:</strong> {job.company_name}<br />
                </>
              )}

              <strong>Customer Name:</strong> {job.cust_name || job.customer_name || job.owner_name || '—'}<br />
              <strong>Mobile No:</strong> {job.cust_mobile || job.mobile_no || ''}
              {job.alt_mobile && (
                <>
                  <br /><strong>Alt Mobile:</strong> {job.alt_mobile}
                </>
              )}

              {(job.address || job.address_line || job.colony_street || job.city || job.state || job.pincode) && (
                <>
                  <br /><strong>Address:</strong> {job.address || [job.address_line, job.colony_street, job.city, job.state, job.pincode].filter(Boolean).join(', ')}
                </>
              )}
            </div>
          </div>
 
          {/* Right panel: Invoice details & vehicle parameters */}
          <div style={{ width: '50%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1.5px solid #000', textAlign: 'center', fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {printType === 'proforma' ? 'Proforma Invoice' : 'Invoice'}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '10px', borderBottom: '1px solid #000', boxSizing: 'border-box' }}>
              <div style={{ borderRight: '1px solid #000', padding: '5px 8px' }}>
                <strong>Invoice No:</strong> {
                  printType === 'proforma' 
                    ? (job.invoice?.invoice_no || `PRO-${job.id}`) 
                    : (job.invoice?.invoice_no || job.non_gst_invoice?.invoice_no || job.estimate?.estimate_no || `INV-${job.id}`)
                }
              </div>
              <div style={{ padding: '5px 8px' }}>
                <strong>Date:</strong> {formatDateLabel(job.job_date || job.created_at)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '10px', borderBottom: '1px solid #000', boxSizing: 'border-box' }}>
              <div style={{ borderRight: '1px solid #000', padding: '5px 8px' }}>
                <strong>Order No:</strong> {job.job_no} ({formatDateLabel(job.job_date || job.created_at)})
              </div>
              <div style={{ padding: '5px 8px' }}>
                <strong>Vehicle No:</strong> {job.reg_no}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '10px', borderBottom: '1px solid #000', boxSizing: 'border-box' }}>
              <div style={{ borderRight: '1px solid #000', padding: '5px 8px' }}>
                <strong>Advisor Name:</strong> {job.service_advisor || '—'}
              </div>
              <div style={{ padding: '5px 8px' }}>
                <strong>Service Type:</strong> {job.service_type || 'Running Repair'}
              </div>
            </div>
            
            <div style={{ padding: '8px 12px', fontSize: '10px', lineHeight: '1.4', flexGrow: 1 }}>
              <strong>Vehicle:</strong> {vehicleName.toUpperCase()}<br />
              <strong>Color:</strong> {job.vehicle_color || '—'}<br />
              <strong>Fuel:</strong> {job.fuel_type || '—'}<br />
              <strong>PH:</strong> {job.mobile_no || job.cust_mobile || ''}
            </div>
          </div>
        </div>

        {/* -- Services & Parts Table -- */}
        {printServices.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '10px' }}>
              <thead>
                <tr style={{ backgroundColor: '#ffffff', borderBottom: '1.5px solid #000', fontWeight: 'bold' }}>
                  <th style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', width: '5%' }}>#</th>
                  <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left', width: '40%' }}>Description / Item Name</th>
                  <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'center', width: '15%' }}>Type</th>
                  <th style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'center', width: '10%' }}>Quantity</th>
                  <th style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', width: '15%' }}>Unit Price (₹)</th>
                  <th style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', width: '15%' }}>Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let globalIdx = 0;

                  const renderRow = (s: any) => {
                    globalIdx++;
                    const rowIdx = globalIdx;
                    const unitPrice = parseFloat(String(s.rate)) || 0;
                    const qty = parseFloat(String(s.qty)) || 1;
                    const rawAmount = parseFloat(String(s.amount)) || 0;
                    const rawTaxAmt = parseFloat(String(s.tax_amount)) || 0;

                    const lineFullAmount = rawAmount + rawTaxAmt;
                    const total = lineFullAmount;
                    const displayUnitPrice = qty > 0 ? lineFullAmount / qty : (unitPrice || lineFullAmount);

                    return (
                      <tr key={s.id || `svc-${rowIdx}`}>
                        <td style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center' }}>{rowIdx}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 8px', fontWeight: '600' }}>{s.service_name}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center', textTransform: 'capitalize', fontWeight: 'bold', color: s.item_type === 'part' ? '#D97706' : '#F59E0B' }}>
                          {(() => {
                            const isLabourOnly = (s.service_name || '').toLowerCase().includes('labour') || (s.description || '').toLowerCase().includes('labour') || (s.job_category || s.category || '').toLowerCase() === 'labour';
                            return (s.description && s.description !== 'Labour' && s.description !== 'Part')
                              ? s.description
                              : (isLabourOnly ? 'Labour' : (s.job_category || s.category || s.service_type || s.service_name || (s.item_type === 'part' ? 'Part' : 'Service')));
                          })()}
                        </td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'center', fontFamily: 'monospace' }}>{qty.toFixed(2)}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(displayUnitPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{formatNumber(total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  };

                  return (
                    <>
                      {parts.length > 0 && (
                        <>
                          <tr key="parts-hdr" style={{ background: '#FEF9C3' }}>
                            <td colSpan={6} style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 800, color: '#92400E', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '2px solid #F59E0B', border: '1px solid #000' }}>
                              Spare Parts
                            </td>
                          </tr>
                          {parts.map((s: any) => renderRow(s))}
                          <tr key="parts-disc" style={{ background: 'none' }}>
                            <td colSpan={5} style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'right', fontSize: '8.5px', color: '#92400E' }}>Parts Discount Total</td>
                            <td style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#92400E', fontSize: '9px' }}>{formatNumber(partsDiscount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                          <tr key="parts-sub" style={{ background: 'none' }}>
                            <td colSpan={5} style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontWeight: 800, fontSize: '9px', color: '#92400E' }}>Parts Subtotal</td>
                            <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#92400E', fontSize: '9.5px', borderBottom: '2px solid #F59E0B' }}>{formatNumber(partsTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        </>
                      )}
                      {labours.length > 0 && (
                        <>
                          <tr key="labour-hdr" style={{ background: '#EFF6FF' }}>
                            <td colSpan={6} style={{ padding: '6px 8px', fontSize: '9px', fontWeight: 800, color: '#1E40AF', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '2px solid #3B82F6', border: '1px solid #000' }}>
                              Services
                            </td>
                          </tr>
                          {labours.map((s: any) => renderRow(s))}
                          <tr key="labour-disc" style={{ background: 'none' }}>
                            <td colSpan={5} style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'right', fontSize: '8.5px', color: '#1E40AF' }}>Services Discount Total</td>
                            <td style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#1E40AF', fontSize: '9px' }}>{formatNumber(laboursDiscount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                          <tr key="labour-sub" style={{ background: 'none' }}>
                            <td colSpan={5} style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontWeight: 800, fontSize: '9px', color: '#1E40AF' }}>Services Subtotal</td>
                            <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#1E40AF', fontSize: '9.5px', borderBottom: '2px solid #3B82F6' }}>{formatNumber(laboursTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        </>
                      )}
                    </>
                  );
                })()}

                {/* Overall Totals rows at the bottom of the table */}
                {parts.length > 0 && (
                  <tr style={{ height: '23px' }}>
                    <td colSpan={4} style={{ border: 'none', borderRight: '1px solid #000' }}></td>
                    <td style={{ border: '1px solid #000', borderLeft: '1.5px solid #000', padding: '4px 8px', fontWeight: 'bold', fontSize: '9.5px' }}>Parts Subtotal</td>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '9.5px' }}>
                      ₹ {formatNumber(partsTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                {labours.length > 0 && (
                  <tr style={{ height: '23px' }}>
                    <td colSpan={4} style={{ border: 'none', borderRight: '1px solid #000' }}></td>
                    <td style={{ border: '1px solid #000', borderLeft: '1.5px solid #000', padding: '4px 8px', fontWeight: 'bold', fontSize: '9.5px' }}>Services Subtotal</td>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '9.5px' }}>
                      ₹ {formatNumber(laboursTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                {(partsDiscount + laboursDiscount) > 0 && (
                  <tr style={{ height: '23px' }}>
                    <td colSpan={4} style={{ border: 'none', borderRight: '1px solid #000' }}></td>
                    <td style={{ border: '1px solid #000', borderLeft: '1.5px solid #000', padding: '4px 8px', fontWeight: 'bold', fontSize: '9.5px' }}>Discount Total</td>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '9.5px' }}>
                      ₹ {formatNumber(partsDiscount + laboursDiscount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                <tr style={{ height: '23px', backgroundColor: '#fdfdfd' }}>
                  <td colSpan={4} style={{ border: 'none', borderRight: '1px solid #000' }}></td>
                  <td style={{ border: '1.5px solid #000', padding: '4px 8px', fontWeight: '900', fontSize: '10px' }}>Grand Total (Rounded)</td>
                  <td style={{ border: '1.5px solid #000', padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '900', fontSize: '10px' }}>
                    ₹ {formatNumber(invoiceGrandTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* -- Invoice Grand Total & Advances & Payment QR -- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', pageBreakInside: 'avoid', marginTop: '10px' }}>
          {/* Division Dynamic UPI QR Payment Details */}
          <div style={{
            width: '46%',
            border: '1.5px solid #222',
            borderRadius: '4px',
            padding: '8px 10px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            boxSizing: 'border-box',
            backgroundColor: '#fff'
          }}>
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="UPI Payment QR"
                  style={{
                    width: '95px',
                    height: '95px',
                    borderRadius: '2px',
                    border: '1px solid #ccc',
                    display: 'block'
                  }}
                />
              ) : (
                <div style={{ width: '95px', height: '95px', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>
                  Generating QR...
                </div>
              )}
              <div style={{ marginTop: '3px', border: '1px solid #059669', borderRadius: '2px', padding: '1px 3px', fontSize: '7.5px', fontWeight: 800, color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                <span style={{ background: '#047857', color: '#fff', padding: '0 2px', borderRadius: '1px', fontSize: '6.5px' }}>UPI</span>
                <span>SCAN TO PAY</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, fontSize: '9.5px', lineHeight: 1.45, color: '#111' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#111', marginBottom: '2px' }}>
                {divisionHeading}
              </div>
              <p style={{ margin: '0 0 2px 0' }}><strong>Name:</strong> {divisionConfig.bankName}</p>
              <p style={{ margin: '0 0 2px 0' }}><strong>Account No.:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{divisionConfig.accountNo}</span></p>
              <p style={{ margin: '0 0 2px 0' }}><strong>IFSC:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{divisionConfig.ifsc}</span></p>
              <p style={{ margin: '0 0 2px 0' }}><strong>Holder:</strong> {divisionConfig.accountHolder}</p>
              <div style={{ background: '#f8fafc', border: '1px dashed #666', borderRadius: '3px', padding: '2px 5px', marginTop: '3px' }}>
                <span style={{ fontSize: '7.5px', color: '#555', display: 'block' }}>UPI ID:</span>
                <span style={{ fontSize: '9.5px', fontWeight: 'bold', fontFamily: 'monospace', color: '#000', wordBreak: 'break-all' }}>
                  {divisionConfig.upiId}
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Totals Table */}
          <table style={{ width: '50%', marginLeft: 0, borderCollapse: 'collapse', fontSize: '11px' }}>
            <tbody>
              <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold' }}>
                <td style={{ padding: '6px 8px' }}>Invoice Total (rounded)</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px' }}>{formatCurrency(invoiceGrandTotal)}</td>
              </tr>
              {totalAdvFull > 0 && (
                <>
                  {advPayments.map((ap: any, idx: number) => (
                    <tr key={ap.id || idx}>
                      <td style={{ padding: '4px 8px', color: '#059669', fontSize: '10px' }}>
                        Advance Paid ({ap.payment_type || 'cash'})
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#059669' }}>
                        -{formatCurrency(ap.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1.5px solid #059669', fontWeight: 'bold' }}>
                    <td style={{ padding: '6px 8px', color: '#059669' }}>Balance Due</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#059669', fontSize: '13px' }}>
                      {formatCurrency(docBalanceDue > 0 ? docBalanceDue : 0)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* -- CGST / SGST Tax Breakdown Table -- */}
        {!isNonGst && (partsGst + laboursGst) > 0 && Object.keys(taxGroups).length > 0 && (
          <div style={{ marginTop: 16, pageBreakInside: 'avoid', display: 'flex', justifyContent: 'flex-end' }}>
            <table className="tax-table" style={{ width: '50%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: 10, marginBottom: 12 }}>
              <thead>
                <tr style={{ backgroundColor: '#ffffff', borderBottom: '1.5px solid #000', fontWeight: 'bold' }}>
                  <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left' }}>Taxable Value (₹)</th>
                  <th colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>CGST</th>
                  <th colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>SGST</th>
                </tr>
                <tr style={{ backgroundColor: '#ffffff', borderBottom: '1.5px solid #000', fontWeight: 'bold' }}>
                  <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>%</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>Amt (₹)</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>%</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>Amt (₹)</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(taxGroups).map((rateStr) => {
                  const rate = parseFloat(rateStr);
                  const group = taxGroups[rate];
                  const cgstRate = rate / 2;
                  const sgstRate = rate / 2;
                  const cgstAmt = group.tax / 2;
                  const sgstAmt = group.tax / 2;

                  return (
                    <tr key={rateStr}>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', fontFamily: 'monospace' }}>
                        {formatCurrency(group.taxable).replace('₹', '')}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{cgstRate}%</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {formatCurrency(cgstAmt).replace('₹', '')}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{sgstRate}%</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {formatCurrency(sgstAmt).replace('₹', '')}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 'bold', backgroundColor: '#ffffff', borderTop: '1.5px solid #000' }}>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', fontFamily: 'monospace' }}>
                    {formatCurrency(Object.values(taxGroups).reduce((sum, g) => sum + g.taxable, 0)).replace('₹', '')}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}></td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {formatCurrency(Object.values(taxGroups).reduce((sum, g) => sum + g.tax / 2, 0)).replace('₹', '')}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}></td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {formatCurrency(Object.values(taxGroups).reduce((sum, g) => sum + g.tax / 2, 0)).replace('₹', '')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* -- Amount in Words -- */}
        <div style={{
          marginTop: '15px',
          padding: '8px 12px',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          fontSize: '10.5px',
          fontWeight: 'bold',
          color: '#1e293b',
          width: '50%',
          marginLeft: 'auto',
          boxSizing: 'border-box',
          textAlign: 'right',
          pageBreakInside: 'avoid'
        }}>
          <strong>Amount in Words:</strong>{' '}
          <span style={{ textTransform: 'uppercase' }}>{numberToWords(invoiceGrandTotal)} RUPEES ONLY</span>
        </div>

        {/* -- Terms & Conditions -- */}
        <div style={{ marginTop: '20px', pageBreakInside: 'avoid' }}>
          <div style={{ fontWeight: '800', fontSize: '10.5px', color: '#000', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>
            Terms & Conditions
          </div>
          <ul style={{ fontSize: '8.5px', lineHeight: '1.4', color: '#475569', paddingLeft: '12px', margin: 0 }}>
            <li style={{ marginBottom: '3px' }}>All disputes are subject to Vadodara jurisdiction only.</li>
            <li style={{ marginBottom: '3px' }}>Goods once sold will not be taken back or exchanged.</li>
            <li style={{ marginBottom: '3px' }}>Interest @18% p.a. will be charged if payment is not made within due date.</li>
          </ul>
        </div>



        {/* -- Print CSS Overrides -- */}
        <style>{`
          @media print {
            @page { margin: 8mm 10mm; size: A4; }
            body { 
              display: block !important;
              print-color-adjust: exact !important;
              -webkit-print-color-adjust: exact !important;
              background: #fff !important;
              color: #000 !important;
            }
            .print-page-container {
              padding: 0 !important;
              margin: 0 auto !important;
              box-shadow: none !important;
              max-width: 100% !important;
            }
          }
          @media screen {
            body { background: #f1f5f9; }
            .print-page-container {
              box-shadow: 0 4px 20px rgba(0,0,0,0.08);
              border-radius: 8px;
              margin-top: 20px !important;
              margin-bottom: 20px !important;
              border: 1px solid #cbd5e1;
            }
          }
        `}</style>
      </div>
    </>
  );
}




