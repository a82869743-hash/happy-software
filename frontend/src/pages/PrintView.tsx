import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { formatCurrency, formatNumber } from '../utils/format';
import { getDivisionConfig, generateUPIQrCode } from '../utils/invoiceFormat';

interface PrintJob {
  id: number;
  job_no: string;
  reg_no: string;
  car_name: string;
  owner_name: string;
  mobile_no: string;
  service_type: string;
  odometer: string;
  service_advisor: string;
  job_date: string;
  status: string;
  vehicle_make: string;
  vehicle_model: string;
  fuel_level: string;
  cust_email?: string;
  vehicle_color?: string;
  vehicle_year?: string;
  variant?: string;
  assigned_staff_name?: string;
  concerns?: { id: number; concern_text: string; is_completed: number }[];
  estimated_delivery?: string;
  address_line?: string;
  fuel_type?: string;
  vin?: string;
  insurance_company?: string;
  company_name?: string;
  policy_number?: string;
  insurance_claim_no?: string;
  claim_type?: string;
  gstin?: string;
  customer_type?: string;
  alt_mobile?: string;
  colony_street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  company?: string;
  is_quick_job?: number;
  invoice?: {
    id: number;
    invoice_no: string;
    subtotal: number;
    gst_percent: number;
    gst_amount: number;
    total_amount: number;
    payment_mode: string;
  } | null;
  estimate?: {
    id: number;
    estimate_no: string;
    subtotal: number;
    payment_mode: string;
  } | null;
}

interface MediaItem {
  id: number;
  file_path: string;
  stage: string;
  caption: string | null;
}

interface PrintService {
  id: number;
  service_name: string;
  item_type: string;
  qty: number;
  rate: number;
  amount: number;
  hsn_sac: string | null;
  tax_pct: number;
  tax_amount: number;
  is_selected: number;
  job_category?: string;
  package_name?: string | null;
  part_code?: string | null;
  discount_pct?: number;
  description?: string;
}

interface PrintTotals {
  parts_excl_tax: number;
  labour_excl_tax: number;
  tax_total: number;
  grand_total: number;
  is_non_gst?: boolean;
}

const TITLES: Record<string, string> = {
  estimate: 'INVOICE',
  proforma: 'PROFORMA INVOICE',
  tax_invoice: 'INVOICE',
  work_order: 'WORK ORDER',
  gate_pass: 'GATE PASS',
  job_card_share: 'JOB CARD',
  full_job_card: 'JOB CARD',
};

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

export default function PrintView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const printType = searchParams.get('type') || 'proforma';

  const [job, setJob] = useState<PrintJob | null>(null);
  const [services, setServices] = useState<PrintService[]>([]);
  const [totals, setTotals] = useState<PrintTotals | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [businessInfo, setBusinessInfo] = useState({
    business_name: 'Happy Car Wash',
    business_address: 'Happy Car Wash, Opp YES Bank Next To Chocolate Room,, Gotri Vasna Road, Vadodara, Gujarat (GJ) - 390007.',
    business_phone: '99986 25511',
    business_email: 'contact@happycarwash.com',
    business_gstin: '00AAAAA0000A1Z5',
  });

  const [recommendedPresets, setRecommendedPresets] = useState<any[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobRes, settingsRes, recRes] = await Promise.all([
          api.get(`/job-cards/${id}`),
          api.get('/settings').catch(() => ({ data: { data: [] } })),
          api.get('/service-catalog/recommended-services').catch(() => ({ data: { data: [] } })),
        ]);
        const data = jobRes.data;
        setJob(data);
        setRecommendedPresets(recRes.data?.data || []);
        let svcList = data.services || [];
        if (printType === 'tax_invoice' && data.job_category && parseFloat(data.job_category_amount || 0) > 0) {
          const currentIsNonGst = svcList.length > 0 && svcList.every((s: any) => parseFloat(s.tax_pct || 0) === 0 && parseFloat(s.tax_amount || 0) === 0);
          const categoryAmount = parseFloat(data.job_category_amount || 0);
          const taxPct = currentIsNonGst ? 0 : (data.job_category_gst_pct !== null && data.job_category_gst_pct !== undefined ? parseFloat(data.job_category_gst_pct) : 18);
          const taxAmount = currentIsNonGst ? 0 : categoryAmount * (taxPct / 100);

          svcList = [
            ...svcList,
            {
              id: -999,
              service_name: data.job_category,
              item_type: 'labour',
              qty: 1,
              rate: categoryAmount,
              amount: categoryAmount,
              hsn_sac: '998714',
              tax_pct: taxPct,
              tax_amount: taxAmount,
              is_selected: 1,
              description: data.job_category_desc || '',
            } as any
          ];
        }

        // Group category-wise, with parts on top and labour below inside each category
        svcList.sort((a: any, b: any) => {
          const catA = (a.job_category || 'General').toLowerCase().trim();
          const catB = (b.job_category || 'General').toLowerCase().trim();
          if (catA !== catB) {
            if (catA === 'general') return 1;
            if (catB === 'general') return -1;
            return catA.localeCompare(catB);
          }
          if (a.item_type === 'part' && b.item_type !== 'part') return -1;
          if (a.item_type !== 'part' && b.item_type === 'part') return 1;
          return 0;
        });
        setServices(svcList);

        // Compute totals from services
        const isNonGstDoc = svcList.length > 0 && svcList.every((s: any) => parseFloat(s.tax_pct || 0) === 0);
        const partsExclTax = svcList.filter((s: any) => s.item_type === 'part').reduce((sum: number, s: any) => sum + parseFloat(s.amount || 0), 0);
        const labourExclTax = svcList.filter((s: any) => s.item_type !== 'part').reduce((sum: number, s: any) => sum + parseFloat(s.amount || 0), 0);
        const taxTotal = svcList.reduce((sum: number, s: any) => sum + parseFloat(s.tax_amount || 0), 0);
        setTotals({
          parts_excl_tax: partsExclTax,
          labour_excl_tax: labourExclTax,
          tax_total: taxTotal,
          grand_total: partsExclTax + labourExclTax + taxTotal,
          is_non_gst: isNonGstDoc,
        });

        // Fetch media/photos for job card share and full job card views
        if (printType === 'job_card_share' || printType === 'full_job_card') {
          try {
            const mediaRes = await api.get(`/job-cards/${id}/media`);
            setMediaItems(mediaRes.data.data || []);
          } catch {
            setMediaItems([]);
          }
        }

        // Parse settings from settings (API returns { data: { key: value } })
        const settings = settingsRes.data?.data || {};
        setBusinessInfo({
          business_name: settings.business_name || 'Happy Car Wash',
          business_address: settings.business_address || '8/9 GIDC - Vadsar Main Road Mohangiri, opp. Uma Co Op Bank Ltd, near Bank Of Baroda, Makarpura, Vadodara, Gujarat 390010',
          business_phone: settings.business_phone || '99986 25511',
          business_email: settings.business_email || 'contact@happycarwash.com',
          business_gstin: settings.business_gstin || '',
        });
      } catch (err) {
        console.error('Print data fetch failed:', err);
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (job) {
      const vehicleMake = job.vehicle_make || (job as any).make || '';
      const vehicleModel = job.vehicle_model || (job as any).model || '';
      const carModel = [vehicleMake, vehicleModel].filter(Boolean).join(' ') || job.car_name || '';
      const regNo = job.reg_no || (job as any).registration_no || '';

      let invNo = '';
      if (job.invoice) invNo = job.invoice.invoice_no;
      else if ((job as any).non_gst_invoice) invNo = (job as any).non_gst_invoice.invoice_no;
      else if (job.estimate) invNo = job.estimate.estimate_no;
      else invNo = job.job_no || '';

      let prefix = 'Invoice';
      if (printType === 'estimate') prefix = 'Invoice';
      else if (printType === 'proforma') prefix = 'Proforma';
      else if (printType === 'work_order' || printType === 'job_card_share' || printType === 'full_job_card') prefix = 'Job Card';
      else if (printType === 'gate_pass') prefix = 'Gate Pass';

      const parts = [prefix];
      if (carModel) parts.push(carModel);
      if (regNo) parts.push(regNo);
      if (prefix === 'Invoice' && invNo) parts.push(invNo);

      document.title = parts.join(' - ');
    }
  }, [job, printType]);

  useEffect(() => {
    if (job && totals) {
      const combinedService = `${job.service_type || ''} ${services?.map((s: any) => s.service_name).join(' ') || ''}`.trim();
      const config = getDivisionConfig(job.company, (job as any).is_quick_job, job.job_no, combinedService);
      const totalAmt = parseFloat(String(job.invoice?.total_amount || totals.grand_total || 0));
      const advTotal = (job as any).advance_payments ? (job as any).advance_payments.reduce((s: number, a: any) => s + (parseFloat(a.amount) || 0), 0) : 0;
      const balanceAmt = Math.max(0, totalAmt - advTotal);
      const amountForQr = balanceAmt > 0 ? balanceAmt : totalAmt;
      const invNo = job.invoice?.invoice_no || (job as any).non_gst_invoice?.invoice_no || job.job_no || 'Bill';
      generateUPIQrCode(config, amountForQr, invNo)
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('Failed to generate UPI QR in PrintView:', err));
    }
  }, [job, totals]);

  if (!job || !totals) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Inter, Arial, sans-serif' }}>
        <p style={{ fontSize: 14, color: '#888' }}>Loading print preview...</p>
      </div>
    );
  }

  const toolbar = (
    <div className="print-toolbar no-print" style={{
      background: 'rgba(30, 58, 138, 0.95)',
      backdropFilter: 'blur(8px)',
      padding: '12px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      borderRadius: '0 0 12px 12px',
      marginBottom: '16px',
      maxWidth: '800px',
      margin: '0 auto 16px auto',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ color: 'white', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>Print Document Preview ({TITLES[printType] || 'Invoice'})</span>
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => window.print()}
          style={{
            background: '#ffffff',
            color: '#DC2626',
            border: 'none',
            padding: '8px 18px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          Print / Save as PDF
        </button>
        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.close();
            }
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '8px 18px',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ✕ Close Preview
        </button>
      </div>
    </div>
  );

  // Include all services/parts registered on this job card
  const printServices = services;
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

  const isNonGst = true;
  const combinedService = `${job?.service_type || ''} ${services?.map((s: any) => s.service_name).join(' ') || ''}`.trim();
  const divisionConfig = getDivisionConfig(job?.company, (job as any)?.is_quick_job, job?.job_no, combinedService);
  const divisionHeading = divisionConfig.title;

  // Group services dynamically by tax rate
  const taxGroups: { [key: number]: { taxable: number; tax: number } } = {};
  printServices.forEach((s: any) => {
    if (isNonGst) return;
    const rate = parseFloat(s.tax_pct !== undefined && s.tax_pct !== null && s.tax_pct !== '' ? s.tax_pct : 18);
    const taxableAmt = parseFloat(s.amount || 0);
    const taxAmt = parseFloat(s.tax_amount || 0);
    if (!taxGroups[rate]) {
      taxGroups[rate] = { taxable: 0, tax: 0 };
    }
    taxGroups[rate].taxable += taxableAmt;
    taxGroups[rate].tax += taxAmt;
  });

  if (printType === 'full_job_card' || printType === 'job_card_share' || printType === 'work_order') {
    const isWorkOrder = printType === 'work_order';
    const beforeImages = mediaItems.filter((item) => item.stage === 'before');
    const afterImages = mediaItems.filter((item) => item.stage === 'after');
    const otherImages = mediaItems.filter((item) => item.stage !== 'before' && item.stage !== 'after');

    // Compute correct line totals for safety
    const partsTotal = printServices.filter((s) => s.item_type === 'part').reduce((sum, s) => sum + (parseFloat(String(s.amount)) || 0), 0);
    const labourTotal = printServices.filter((s) => s.item_type === 'labour').reduce((sum, s) => sum + (parseFloat(String(s.amount)) || 0), 0);

    const advPayments = (job as any).advance_payments || [];
    const totalAdvFull = advPayments.reduce((s: number, ap: any) => s + (parseFloat(ap.amount) || 0), 0);

    // Fuel level checkboxes matching
    const fuelLower = (job.fuel_level || '').toLowerCase();
    const fuelE = fuelLower.includes('e') || fuelLower.includes('empty') || fuelLower.includes('low') || fuelLower === '1/4' || fuelLower === '0' || fuelLower === '12.5%' || fuelLower === '25%';
    const fuelH = fuelLower.includes('h') || fuelLower.includes('half') || fuelLower.includes('medium') || fuelLower === '1/2' || fuelLower === '2/4' || fuelLower === '50%';
    const fuelF = fuelLower.includes('f') || fuelLower.includes('full') || fuelLower.includes('high') || fuelLower === '3/4' || fuelLower === '4/4' || fuelLower === '100%' || fuelLower === '75%';

    // Vehicle formatted name
    const vehicleMake = job.vehicle_make || (job as any).make || '';
    const vehicleModel = job.vehicle_model || (job as any).model || '';
    const vehicleVariant = (job as any).variant || '';
    const vehicleYear = (job as any).vehicle_year || (job as any).year || '';
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
    const serviceNamesLower = printServices.map(s => (s.service_name || '').toLowerCase());
    const hasSvc = (keywords: string[]) => serviceNamesLower.some(name => keywords.some(k => name.includes(k)));

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
    const maxEstimateRows = isWorkOrder ? Math.max(8, printServices.length) : Math.max(6, printServices.length);
    const estimateRows = Array.from({ length: maxEstimateRows }).map((_, idx) => {
      const s = printServices[idx];
      return {
        num: idx + 1,
        category: s ? (s.job_category || 'General') : '',
        type: s ? ((s.service_name || '').includes(' & ') ? 'Part & Labour' : (s.item_type === 'part' ? 'Part' : 'Labour')) : '',
        description: s ? s.service_name : '',
        amount: s ? formatNumber(s.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
      };
    });
    const estimateTotal = partsTotal + labourTotal;

    return (
      <>
        {toolbar}
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '5px', width: '100%', justifyContent: 'center', position: 'relative' }}>
            <img 
              src={`${baseUrl}/uploads/happy-logo.png`} 
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
              <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#475569', fontWeight: 500 }}>
                {divisionConfig.addressLines.join(', ')}
              </p>
            </div>
          </div>
          <div style={{ 
            width: '100%', 
            textAlign: 'center', 
            borderTop: '2px solid #138496', 
            borderBottom: '2px solid #138496', 
            padding: '4px 0', 
            margin: '10px 0',
            fontSize: '15px', 
            fontWeight: '800', 
            color: '#138496', 
            letterSpacing: '2px'
          }}>
            {isWorkOrder ? 'WORK ORDER' : 'JOB CARD'}
          </div>
          {isWorkOrder && (
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '-6px', marginBottom: '10px' }}>
              WORKSHOP COPY — FOR INTERNAL USE
            </div>
          )}
        </div>
                  {/* -- Upper Info Grid -- */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '15px', fontSize: '10.5px' }}>
          <tbody>
            <tr>
              {/* Left Column: Business Details */}
              <td rowSpan={3} style={{ width: '40%', border: '1px solid #000', padding: '8px 10px', verticalAlign: 'top', lineHeight: '1.4' }}>
                <div style={{ fontWeight: '800', fontSize: '12px', color: '#138496', marginBottom: '3px' }}>
                  {divisionHeading}
                </div>
                <div style={{ color: '#334155', fontSize: '9.5px' }}>
                  {divisionConfig.addressLines.map((l, i) => <span key={i}>{l}<br /></span>)}
                  <strong>Contact:</strong> {divisionConfig.contactLine}
                </div>
              </td>
              {/* Right Column, Row 1 */}
              <td style={{ width: '30%', border: '1px solid #000', padding: '5px 8px', verticalAlign: 'top' }}>
                <span style={{ fontSize: '9px', color: '#138496', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Order No:</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', fontFamily: 'monospace' }}>{job.job_no}</span>
              </td>
              <td style={{ width: '30%', border: '1px solid #000', padding: '5px 8px', verticalAlign: 'top' }}>
                <span style={{ fontSize: '9px', color: '#138496', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Date:</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{formatDateLabel(job.job_date)}</span>
              </td>
            </tr>
            <tr>
              {/* Right Column, Row 2 */}
              <td style={{ border: '1px solid #000', padding: '5px 8px', verticalAlign: 'top' }}>
                <span style={{ fontSize: '9px', color: '#138496', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Vehicle No:</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#138496', fontFamily: 'monospace' }}>{job.reg_no}</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '5px 8px', verticalAlign: 'top' }}>
                <span style={{ fontSize: '9px', color: '#138496', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Service Type:</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{job.service_type || 'Running Repair'}</span>
              </td>
            </tr>
            <tr>
              {/* Right Column, Row 3 */}
              <td style={{ border: '1px solid #000', padding: '5px 8px', verticalAlign: 'top' }}>
                {isWorkOrder ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: '8px', color: '#138496', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Advisor:</span>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#1e293b' }}>{job.service_advisor || '—'}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '8px', color: '#138496', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Mechanic:</span>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#1e293b' }}>{job.assigned_staff_name || '—'}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '9px', color: '#138496', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Advisor Name:</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{job.service_advisor || job.assigned_staff_name || '—'}</span>
                  </>
                )}
              </td>
              <td style={{ border: '1px solid #000', padding: '5px 8px', verticalAlign: 'top' }}>
                <span style={{ fontSize: '9px', color: '#138496', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Est. Delivery:</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>{formatDateLabel(job.estimated_delivery)}</span>
              </td>
            </tr>
            <tr>
              {/* Left Column, Row 4 (Customer Details) */}
              <td rowSpan={2} style={{ border: '1px solid #000', padding: '8px 10px', verticalAlign: 'top', lineHeight: '1.4' }}>
                <div style={{ fontSize: '10px', color: '#334155' }}>
                  {job.company_name && (
                    <>
                      <strong style={{ color: '#138496', fontSize: '9.5px', textTransform: 'uppercase' }}>Company Name:</strong> <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{job.company_name}</span><br />
                    </>
                  )}

                  <strong style={{ color: '#138496', fontSize: '9.5px', textTransform: 'uppercase' }}>Customer Name:</strong> <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{job.owner_name || 'Customer'}</span><br />
                  <strong style={{ color: '#138496', fontSize: '9.5px', textTransform: 'uppercase' }}>Mobile No:</strong> <span style={{ fontFamily: 'monospace' }}>{isWorkOrder && job.mobile_no ? `******${job.mobile_no.slice(-4)}` : job.mobile_no}</span><br />
                  {job.alt_mobile && (
                    <>
                      <strong style={{ color: '#138496', fontSize: '9.5px', textTransform: 'uppercase' }}>Alt Mobile:</strong> {job.alt_mobile}<br />
                    </>
                  )}

                  <strong style={{ color: '#138496', fontSize: '9.5px', textTransform: 'uppercase' }}>Address:</strong> {[job.address_line, job.colony_street, job.city, job.state, job.pincode].filter(Boolean).join(', ') || '—'}
                </div>
              </td>
              {/* Right Column, Row 4 (Vehicle Specs) */}
              <td colSpan={2} style={{ border: '1px solid #000', padding: '5px 8px', verticalAlign: 'top' }}>
                <div style={{ fontSize: '10.5px', marginBottom: '4px' }}>
                  <strong style={{ color: '#1e293b' }}>Vehicle:</strong> <span style={{ fontWeight: 800, textTransform: 'uppercase', color: '#0f172a' }}>{vehicleName}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 15px', fontSize: '9.5px', color: '#334155' }}>
                  <span><strong style={{ color: '#138496', textTransform: 'uppercase' }}>Color:</strong> <span style={{ fontWeight: 700 }}>{job.vehicle_color || '—'}</span></span>
                  <span><strong style={{ color: '#138496', textTransform: 'uppercase' }}>Fuel:</strong> <span style={{ fontWeight: 700 }}>{job.fuel_type || '—'}</span></span>
                  <span><strong style={{ color: '#138496', textTransform: 'uppercase' }}>VIN:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{job.vin || '—'}</span></span>
                </div>
              </td>
            </tr>
            <tr>
              {/* Right Column, Row 5 (Arrival, Advance, Fuel, Insurance) */}
              <td colSpan={2} style={{ border: '1px solid #000', padding: '5px 8px', verticalAlign: 'middle' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px', fontSize: '9.5px', color: '#334155' }}>
                  <span><strong style={{ color: '#138496', textTransform: 'uppercase' }}>Arrival Date:</strong> {formatDateLabel(job.job_date)}</span>
                  <span><strong style={{ color: '#138496', textTransform: 'uppercase' }}>Adv. Amount:</strong> {totalAdvFull > 0 ? formatCurrency(totalAdvFull) : '—'}</span>
                  {job.fuel_type?.toLowerCase() === 'electric' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ color: '#138496', textTransform: 'uppercase' }}>EV Charge %:</strong>
                      <span style={{ fontWeight: 700 }}>{(job as any).charging_pct !== undefined ? `${(job as any).charging_pct}%` : '—'}</span>
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ color: '#138496', textTransform: 'uppercase' }}>Fuel Level:</strong>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <input type="checkbox" checked={fuelE} readOnly style={{ margin: 0, width: '11px', height: '11px' }} /> E
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <input type="checkbox" checked={fuelH} readOnly style={{ margin: 0, width: '11px', height: '11px' }} /> H
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <input type="checkbox" checked={fuelF} readOnly style={{ margin: 0, width: '11px', height: '11px' }} /> F
                      </span>
                    </span>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* -- Concerns & Recommended Services -- */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
          {/* Customer Concerns */}
          <div style={{ flex: 1 }}>
            <div style={{ 
              backgroundColor: '#138496', 
              color: 'white', 
              padding: '4px 28px 4px 10px', 
              fontWeight: '800', 
              fontSize: '10px', 
              textTransform: 'uppercase', 
              letterSpacing: '0.5px', 
              marginBottom: '8px', 
              width: 'fit-content', 
              clipPath: 'polygon(0 0, 92% 0, 100% 100%, 0% 100%)' 
            }}>
              Customer Concerns / Diagnosis
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {concernLines.map((c) => (
                <div key={c.num} style={{ borderBottom: '1px dotted #cbd5e1', paddingBottom: '2px', display: 'flex', alignItems: 'flex-end', minHeight: '20px' }}>
                  <span style={{ fontWeight: '700', color: '#138496', marginRight: '6px', minWidth: '15px', fontSize: '10px' }}>{c.num}.</span>
                  <span style={{ fontWeight: '500', color: '#1e293b', fontSize: '10.5px' }}>{c.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Services */}
          <div style={{ flex: 1 }}>
            <div style={{ 
              backgroundColor: '#138496', 
              color: 'white', 
              padding: '4px 28px 4px 10px', 
              fontWeight: '800', 
              fontSize: '10px', 
              textTransform: 'uppercase', 
              letterSpacing: '0.5px', 
              marginBottom: '8px', 
              width: 'fit-content', 
              clipPath: 'polygon(0 0, 92% 0, 100% 100%, 0% 100%)' 
            }}>
              Recommended Services
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {recommendedServices.map((svc, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px dotted #cbd5e1', padding: '3px 0', minHeight: '20px' }}>
                  <input type="checkbox" checked={svc.checked} readOnly style={{ margin: '0 6px 0 0', width: '11px', height: '11px', accentColor: '#138496' }} />
                  <span style={{ fontWeight: '600', color: '#334155', fontSize: '10px' }}>{svc.label}</span>
                  <span style={{ flexGrow: 1, borderBottom: '1px dotted #e2e8f0', margin: '0 6px', alignSelf: 'flex-end', marginBottom: '2px' }}></span>
                  <span style={{ fontWeight: '700', color: '#138496', fontFamily: 'monospace', whiteSpace: 'nowrap', fontSize: '9px' }}>{svc.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* -- Estimate / Task List Table -- */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ 
            backgroundColor: '#138496', 
            color: 'white', 
            padding: '4px 28px 4px 10px', 
            fontWeight: '800', 
            fontSize: '10px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px', 
            marginBottom: '8px', 
            width: 'fit-content', 
            clipPath: 'polygon(0 0, 92% 0, 100% 100%, 0% 100%)' 
          }}>
            {isWorkOrder ? 'Work Order — Task List' : 'Job Description'}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', fontSize: '10.5px' }}>
            {isWorkOrder ? (
              <thead>
                <tr style={{ backgroundColor: '#138496', color: 'white' }}>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', width: '8%', textAlign: 'center', fontWeight: '800' }}>SL</th>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', width: '22%', textAlign: 'left', fontWeight: '800' }}>Category</th>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', width: '15%', textAlign: 'center', fontWeight: '800' }}>Type</th>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', width: '47%', textAlign: 'left', fontWeight: '800' }}>Job / Part Description</th>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', width: '8%', textAlign: 'center', fontWeight: '800' }}>Done</th>
                </tr>
              </thead>
            ) : (
              <thead>
                <tr style={{ backgroundColor: '#138496', color: 'white' }}>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', width: '8%', textAlign: 'center', fontWeight: '800' }}>SL No.</th>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', width: '18%', textAlign: 'left', fontWeight: '800' }}>Category</th>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', width: '50%', textAlign: 'left', fontWeight: '800' }}>Job / Part Description</th>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', width: '24%', textAlign: 'right', fontWeight: '800' }}>Amount ₹</th>
                </tr>
              </thead>
            )}
            <tbody>
              {isWorkOrder ? (
                estimateRows.map((row, idx) => (
                  <tr key={idx} style={{ height: '23px' }}>
                    <td style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'center', color: '#64748b' }}>{row.num}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 8px', color: '#334155', fontWeight: '600' }}>{row.category}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'center', color: '#334155', fontWeight: '600' }}>{row.type}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 8px', color: '#1e293b', fontWeight: '600', whiteSpace: 'pre-wrap' }}>{row.description}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'center' }}>
                      {row.description ? <input type="checkbox" style={{ margin: 0, width: '11px', height: '11px' }} disabled /> : ''}
                    </td>
                  </tr>
                ))
              ) : (
                estimateRows.map((row, idx) => (
                  <tr key={idx} style={{ height: '23px' }}>
                    <td style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'center', color: '#64748b' }}>{row.num}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 8px', color: '#334155', fontWeight: '600' }}>{row.category}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 8px', color: '#1e293b', fontWeight: '600', whiteSpace: 'pre-wrap' }}>{row.description}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#0f172a' }}>
                      {row.amount ? `₹ ${row.amount}` : ''}
                    </td>
                  </tr>
                ))
              )}
              {!isWorkOrder && (
                <tr style={{ height: '26px', backgroundColor: '#f0f9ff' }}>
                  <td colSpan={3} style={{ border: '1px solid #000', padding: '4px 10px', textAlign: 'right', fontWeight: '800', color: '#138496', fontSize: '11px', textTransform: 'uppercase' }}>
                    Total Amount
                  </td>
                  <td style={{ border: '1px solid #000', padding: '4px 10px', textAlign: 'right', fontWeight: '900', color: '#138496', fontSize: '12px', fontFamily: 'monospace' }}>
                    {formatCurrency(estimateTotal)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

        </div>

        {/* -- Repair Instruction (Only for Work Order) -- */}
        {isWorkOrder && (
          <div style={{ marginTop: '15px', pageBreakInside: 'avoid' }}>
            <div style={{ fontWeight: '800', fontSize: '10.5px', color: '#138496', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>
              Repair Instruction
            </div>
            <div style={{ border: '1px solid #138496', borderRadius: '4px', minHeight: '65px', padding: '6px 10px', boxSizing: 'border-box' }}>
              <div style={{ borderBottom: '1px dotted #cbd5e1', height: '18px' }}></div>
              <div style={{ borderBottom: '1px dotted #cbd5e1', height: '18px' }}></div>
            </div>
          </div>
        )}

        {/* -- Terms & Conditions (Only for Job Card / Estimate) -- */}
        {!isWorkOrder && (
          <div style={{ marginTop: '15px', pageBreakInside: 'avoid' }}>
            <div style={{ fontWeight: '800', fontSize: '10.5px', color: '#138496', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>
              Terms & Conditions
            </div>
            <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '8px 12px', fontSize: '9.5px', lineHeight: '1.4', color: '#0369a1', marginBottom: '8px', fontWeight: '500' }}>
              This is a system-generated job card. All work descriptions, parts and amounts above have been discussed with and acknowledged by the customer. No physical signature is required.
            </div>
            <ul style={{ fontSize: '8.5px', lineHeight: '1.4', color: '#475569', paddingLeft: '12px', margin: 0 }}>
              <li style={{ marginBottom: '3px' }}>Customer accepts that the vehicle condition indicated is true and correct, and consents to the work being carried out using necessary parts and material.</li>
              <li style={{ marginBottom: '3px' }}>Customer agrees to pay for labour, spare parts and materials at the repairer's current rates. The repairer shall not be liable for loss / damage to the vehicle, its accessories or contents while garaged or driven in connection with the work.</li>
              <li style={{ marginBottom: '3px' }}>If delivery is not taken from Happy Car Wash, storage charges of Rs. 250/- per day will apply from the date of work completion till physical delivery.</li>
            </ul>
          </div>
        )}

        {/* -- Footer -- */}
        <div style={{ 
          backgroundColor: '#138496', 
          color: 'white', 
          padding: '6px 12px', 
          textAlign: 'center', 
          fontSize: '9.5px', 
          fontWeight: '700', 
          borderRadius: '4px', 
          marginTop: '15px', 
          clipPath: 'polygon(0 0, 98% 0, 100% 100%, 0% 100%)',
          letterSpacing: '0.2px'
        }}>
          8/9 GIDC - Vadsar Main Road Mohangiri, opp. Uma Co Op Bank Ltd, near Bank Of Baroda, Makarpura, Vadodara, Gujarat 390010 | Ph: 99986 25511 | contact@happycarwash.com
        </div>

        {/* -- Service Photos Checklist (Only if present and type allows) -- */}
        {mediaItems.length > 0 && (
          <div style={{ pageBreakBefore: 'always', paddingTop: '20px' }}>
            <div style={{ 
              backgroundColor: '#138496', 
              color: 'white', 
              padding: '4px 28px 4px 10px', 
              fontWeight: '800', 
              fontSize: '10px', 
              textTransform: 'uppercase', 
              letterSpacing: '0.5px', 
              marginBottom: '15px', 
              width: 'fit-content', 
              clipPath: 'polygon(0 0, 92% 0, 100% 100%, 0% 100%)' 
            }}>
              Service Media Checklist
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {beforeImages.length > 0 && (
                <div style={{ pageBreakInside: 'avoid' }}>
                  <h4 style={{ fontSize: '10px', fontWeight: 800, color: '#B45309', background: '#FEF3C7', padding: '4px 10px', borderRadius: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Before Service Photos
                  </h4>
                  <div className="print-media-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {beforeImages.map((item) => (
                      <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', background: '#f8fafc' }}>
                        <img
                          src={`${baseUrl}/${item.file_path}`}
                          alt={item.caption || 'Before service'}
                          style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }}
                        />
                        {item.caption && (
                          <div style={{ padding: '4px 6px', fontSize: '9px', color: '#475569', fontWeight: 500, textAlign: 'center', borderTop: '1px solid #e2e8f0' }}>
                            {item.caption}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {afterImages.length > 0 && (
                <div style={{ pageBreakInside: 'avoid' }}>
                  <h4 style={{ fontSize: '10px', fontWeight: 800, color: '#047857', background: '#D1FAE5', padding: '4px 10px', borderRadius: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    After Service Photos
                  </h4>
                  <div className="print-media-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {afterImages.map((item) => (
                      <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', background: '#f8fafc' }}>
                        <img
                          src={`${baseUrl}/${item.file_path}`}
                          alt={item.caption || 'After service'}
                          style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }}
                        />
                        {item.caption && (
                          <div style={{ padding: '4px 6px', fontSize: '9px', color: '#475569', fontWeight: 500, textAlign: 'center', borderTop: '1px solid #e2e8f0' }}>
                            {item.caption}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {otherImages.length > 0 && (
                <div style={{ pageBreakInside: 'avoid' }}>
                  <h4 style={{ fontSize: '10px', fontWeight: 800, color: '#475569', background: '#F1F5F9', padding: '4px 10px', borderRadius: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    General Service Photos
                  </h4>
                  <div className="print-media-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {otherImages.map((item) => (
                      <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', background: '#f8fafc' }}>
                        <img
                          src={`${baseUrl}/${item.file_path}`}
                          alt={item.caption || 'Service photo'}
                          style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }}
                        />
                        {item.caption && (
                          <div style={{ padding: '4px 6px', fontSize: '9px', color: '#475569', fontWeight: 500, textAlign: 'center', borderTop: '1px solid #e2e8f0' }}>
                            {item.caption}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -- Print CSS Overrides -- */}
        <style>{`
          @media print {
            @page { margin: 10mm; size: A4; }
            body { 
              display: block !important;
              print-color-adjust: exact !important;
              -webkit-print-color-adjust: exact !important;
              background: #fff !important;
              color: #1e293b !important;
            }
            .print-page-container {
              padding: 0 !important;
              margin: 0 auto !important;
              box-shadow: none !important;
              max-width: 100% !important;
            }
          }
          @media screen {
            body { background: #f8fafc; }
            .print-page-container {
              box-shadow: 0 4px 20px rgba(0,0,0,0.08);
              border-radius: 12px;
              margin-top: 30px !important;
              margin-bottom: 30px !important;
            }
          }
        `}</style>
      </div>
      </>
    );
  }

  if (printType === 'proforma' || printType === 'tax_invoice' || printType === 'estimate') {
    const parts = printServices.filter(s => s.item_type === 'part');
    const labours = printServices.filter(s => s.item_type === 'labour');


    const partsTaxable = isNonGst
      ? parts.reduce((sum, s) => sum + (parseFloat(String(s.amount)) || 0) + (parseFloat(String(s.tax_amount)) || 0), 0)
      : parts.reduce((sum, s) => sum + (parseFloat(String(s.amount)) || 0), 0);
    const partsGst = isNonGst ? 0 : parts.reduce((sum, s) => sum + (parseFloat(String(s.tax_amount)) || 0), 0);
    const partsDiscount = parts.reduce((sum: number, s: any) => {
      const amt = parseFloat(String(s.amount)) || 0;
      const discPct = parseFloat(String(s.discount_pct)) || 0;
      if (discPct <= 0 || discPct >= 100) return sum;
      return sum + (amt / (1 - discPct / 100) - amt);
    }, 0);
    const partsTotal = partsTaxable + partsGst;
    const partsRoundOff = Math.round(partsTotal);

    const laboursTaxable = isNonGst
      ? labours.reduce((sum, s) => sum + (parseFloat(String(s.amount)) || 0) + (parseFloat(String(s.tax_amount)) || 0), 0)
      : labours.reduce((sum, s) => sum + (parseFloat(String(s.amount)) || 0), 0);
    const laboursGst = isNonGst ? 0 : labours.reduce((sum, s) => sum + (parseFloat(String(s.tax_amount)) || 0), 0);
    const laboursDiscount = labours.reduce((sum: number, s: any) => {
      const amt = parseFloat(String(s.amount)) || 0;
      const discPct = parseFloat(String(s.discount_pct)) || 0;
      if (discPct <= 0 || discPct >= 100) return sum;
      return sum + (amt / (1 - discPct / 100) - amt);
    }, 0);
    const laboursTotal = laboursTaxable + laboursGst;
    const laboursRoundOff = Math.round(laboursTotal);
    const invoiceGrandTotal = partsRoundOff + laboursRoundOff;

    const advPayments = (job as any).advance_payments || [];
    const totalAdvFull = advPayments.reduce((s: number, ap: any) => s + (parseFloat(ap.amount) || 0), 0);
    const balanceDue = invoiceGrandTotal - totalAdvFull;

    const vehicleMake = job.vehicle_make || (job as any).make || '';
    const vehicleModel = job.vehicle_model || (job as any).model || '';
    const vehicleVariant = (job as any).variant || '';
    const vehicleYear = (job as any).vehicle_year || (job as any).year || '';
    const vehicleName = [vehicleMake, vehicleModel, vehicleVariant, vehicleYear ? `(${vehicleYear})` : ''].filter(Boolean).join(' ') || job.car_name || '—';

    const formatDateLabel = (d: string | null | undefined) => {
      if (!d) return '—';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
      <>
        {toolbar}
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
          <div style={{ width: '50%', borderRight: '1.5px solid #000', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <img
                  src={`${baseUrl}/uploads/happy-logo.png`}
                  alt="HAPPY Logo"
                  style={{ width: '50px', height: 'auto', borderRadius: '4px' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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

              <strong>Customer Name:</strong> {job.owner_name || 'Customer'}<br />
              <strong>Mobile No:</strong> {job.mobile_no}
              {job.alt_mobile && (
                <>
                  <br /><strong>Alt Mobile:</strong> {job.alt_mobile}
                </>
              )}

              {(job.address_line || job.colony_street || job.city || job.state || job.pincode) && (
                <>
                  <br /><strong>Address:</strong> {[job.address_line, job.colony_street, job.city, job.state, job.pincode].filter(Boolean).join(', ')}
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
                    : (job.invoice?.invoice_no || (job as any).non_gst_invoice?.invoice_no || job.estimate?.estimate_no || `INV-${job.id}`)
                }
              </div>
              <div style={{ padding: '5px 8px' }}>
                <strong>Date:</strong> {formatDateLabel(job.job_date)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '10px', borderBottom: '1px solid #000', boxSizing: 'border-box' }}>
              <div style={{ borderRight: '1px solid #000', padding: '5px 8px' }}>
                <strong>Order No:</strong> {job.job_no} ({formatDateLabel(job.job_date)})
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
              <strong>PH:</strong> {job.mobile_no}
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
                  const sorted = [...printServices].sort((a, b) => {
                    const typeA = (a.item_type || '').toLowerCase();
                    const typeB = (b.item_type || '').toLowerCase();
                    if (typeA === 'part' && typeB !== 'part') return -1;
                    if (typeA !== 'part' && typeB === 'part') return 1;
                    return 0;
                  });

                  const parts = sorted.filter((s: any) => (s.item_type || '').toLowerCase() === 'part');
                  const labours = sorted.filter((s: any) => (s.item_type || '').toLowerCase() !== 'part');
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
                      {formatCurrency(balanceDue > 0 ? balanceDue : 0)}
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

  return (
    <div
      className="print-page-container"
      style={{
        fontFamily: 'Inter, Arial, sans-serif',
        padding: '24px 32px',
        maxWidth: 820,
        margin: '0 auto',
        color: '#1a1a1a',
        fontSize: 13,
      }}
    >
      {/* -- Header -- */}
      <div
        className="print-header-flex"
        style={{
          textAlign: 'center',
          borderBottom: '3px solid #DC2626',
          paddingBottom: 12,
          marginBottom: 16,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#DC2626', letterSpacing: 1 }}>
          {divisionHeading}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#444', lineHeight: 1.4 }}>
          {businessInfo.business_address}
          <br />
          Contact: {businessInfo.business_phone}
        </p>
        <h2
          style={{
            margin: '10px 0 0',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 2,
            textDecoration: 'underline',
            textUnderlineOffset: 4,
            color: '#333',
          }}
        >
          {printType === 'proforma' ? 'PROFORMA INVOICE' : 'INVOICE'}
        </h2>
      </div>

      {/* -- Job Details -- */}
      <table className="print-details-table" style={{ width: '100%', marginBottom: 16, fontSize: 12 }}>
        <tbody>
          <tr>
            <td style={{ padding: '3px 0' }}>
              {job.job_no && (
                <>
                  <strong>Job No:</strong> {job.job_no}
                </>
              )}
            </td>
            <td style={{ padding: '3px 0' }}>
              <strong>Date:</strong>{' '}
              {new Date(job.job_date).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </td>
            <td style={{ padding: '3px 0' }}>
              <strong>Reg No:</strong> {job.reg_no}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '3px 0' }}>
              <strong>Customer:</strong> {job.owner_name || 'Customer'}
              {job.company_name && ` (${job.company_name})`}
            </td>
            <td style={{ padding: '3px 0' }}>
              <strong>Mobile:</strong> {job.mobile_no}
            </td>
            <td style={{ padding: '3px 0' }}>
              <strong>Vehicle:</strong> {job.car_name}
              {(job.vehicle_make || job.vehicle_model) &&
                ` (${[job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')})`}
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ padding: '3px 0' }}>
              <strong>Service Type:</strong> {job.service_type || 'General'}
            </td>
            <td style={{ padding: '3px 0' }}>
              <strong>Advisor:</strong> {job.service_advisor || '—'}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '3px 0' }}>
              {job.fuel_type?.toLowerCase() === 'electric' ? (
                <><strong>EV Charge %:</strong> {(job as any).charging_pct !== undefined ? `${(job as any).charging_pct}%` : '—'}</>
              ) : (
                <><strong>Fuel Level:</strong> {job.fuel_level || '—'}</>
              )}
            </td>
            <td style={{ padding: '3px 0' }}>
              <strong>Spare Wheel:</strong> {(job as any).spare_wheel ? 'Yes' : 'No'}
            </td>
            <td style={{ padding: '3px 0' }}>
              <strong>Pointers:</strong> {(job as any).pointers || '—'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* -- Services Table -- */}
      <div style={{ marginBottom: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table
          className="print-services-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            minWidth: 600,
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f0f4f8' }}>
              {(isNonGst
                ? ['#', 'Description', 'Type', 'Qty', 'Rate', 'Total ₹']
                : ['#', 'Description', 'Type', 'Qty', 'Rate', 'HSN/SAC', 'Tax%', 'Tax ₹', 'Total ₹']
              ).map(
                (h, i) => (
                  <th
                    key={i}
                    style={{
                      border: '1px solid #d0d5dd',
                      padding: '7px 6px',
                      fontWeight: 700,
                      fontSize: 11,
                      textAlign: (isNonGst ? i >= 3 : i >= 3) ? 'right' : i === 2 ? 'center' : 'left',
                      color: '#D97706',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {(() => {
              const sorted = [...printServices].sort((a, b) => {
                const typeA = (a.item_type || '').toLowerCase();
                const typeB = (b.item_type || '').toLowerCase();
                if (typeA === 'part' && typeB !== 'part') return -1;
                if (typeA !== 'part' && typeB === 'part') return 1;
                return 0;
              });
              const parts = sorted.filter((s: any) => (s.item_type || '').toLowerCase() === 'part');
              const labours = sorted.filter((s: any) => (s.item_type || '').toLowerCase() !== 'part');
              const colCount = isNonGst ? 6 : 9;
              let globalIdx = 0;

              const renderRow = (s: any) => {
                globalIdx++;
                const rowIdx = globalIdx;
                const isPartItem = (s.item_type || '').toLowerCase() === 'part';
                const qtyVal = parseFloat(String(s.qty)) || 1;
                const baseRate = parseFloat(String(s.rate)) || 0;
                const taxAmt = parseFloat(String(s.tax_amount)) || (baseRate * 0.18 * qtyVal);

                const displayRate = isPartItem
                  ? (qtyVal > 0 ? (parseFloat(String(s.amount || 0)) + taxAmt) / qtyVal : baseRate * 1.18)
                  : baseRate;
                const displayTotal = isPartItem
                  ? (parseFloat(String(s.amount || 0)) + taxAmt)
                  : parseFloat(String(s.amount || 0));

                return (
                  <tr key={s.id || `svc-${rowIdx}`}>
                    <td style={{ border: '1px solid #e0e0e0', padding: '5px 6px', textAlign: 'center' }}>{rowIdx}</td>
                    <td style={{ border: '1px solid #e0e0e0', padding: '5px 6px' }}>{s.service_name}</td>
                    <td style={{ border: '1px solid #e0e0e0', padding: '5px 6px', textAlign: 'center', textTransform: 'capitalize' }}>{s.item_type}</td>
                    <td style={{ border: '1px solid #e0e0e0', padding: '5px 6px', textAlign: 'right' }}>{s.qty}</td>
                    <td style={{ border: '1px solid #e0e0e0', padding: '5px 6px', textAlign: 'right' }}>{formatNumber(displayRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    {!isNonGst && <td style={{ border: '1px solid #e0e0e0', padding: '5px 6px', textAlign: 'center' }}>{s.hsn_sac || '—'}</td>}
                    {!isNonGst && <td style={{ border: '1px solid #e0e0e0', padding: '5px 6px', textAlign: 'right' }}>{s.tax_pct}%</td>}
                    {!isNonGst && <td style={{ border: '1px solid #e0e0e0', padding: '5px 6px', textAlign: 'right' }}>{formatNumber(s.tax_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>}
                    <td style={{ border: '1px solid #e0e0e0', padding: '5px 6px', textAlign: 'right', fontWeight: 600 }}>
                      {formatNumber(displayTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              };

              const partsDiscount = parts.reduce((sum: number, s: any) => {
                const amt = parseFloat(String(s.amount)) || 0;
                const discPct = parseFloat(String(s.discount_pct)) || 0;
                if (discPct <= 0 || discPct >= 100) return sum;
                return sum + (amt / (1 - discPct / 100) - amt);
              }, 0);
              const partsTotal = parts.reduce((sum: number, s: any) => sum + (parseFloat(String(s.amount || 0)) + parseFloat(String(s.tax_amount || (parseFloat(String(s.amount || 0)) * 0.18)))), 0);

              const laboursDiscount = labours.reduce((sum: number, s: any) => {
                const amt = parseFloat(String(s.amount)) || 0;
                const discPct = parseFloat(String(s.discount_pct)) || 0;
                if (discPct <= 0 || discPct >= 100) return sum;
                return sum + (amt / (1 - discPct / 100) - amt);
              }, 0);
              const laboursTotal = labours.reduce((sum: number, s: any) => sum + parseFloat(String(s.amount || 0)), 0);

              return (
                <>
                  {parts.length > 0 && (
                    <>
                      <tr key="parts-hdr" style={{ background: '#FEF2F2' }}>
                        <td colSpan={colCount} style={{ border: '1px solid #e0e0e0', padding: '6px 8px', fontSize: 10, fontWeight: 800, color: '#991B1B', letterSpacing: 1, textTransform: 'uppercase' as const, borderBottom: '2px solid #DC2626' }}>
                          ™¸  Spare Parts
                        </td>
                      </tr>
                      {parts.map((s: any) => renderRow(s))}
                      <tr key="parts-disc" style={{ background: 'none' }}>
                        <td colSpan={colCount - 1} style={{ border: '1px solid #e0e0e0', padding: '3px 8px', textAlign: 'right', fontSize: 10, color: '#991B1B' }}>Parts Discount Total</td>
                        <td style={{ border: '1px solid #e0e0e0', padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#991B1B' }}>{formatNumber(partsDiscount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                      <tr key="parts-sub" style={{ background: 'none' }}>
                        <td colSpan={colCount - 1} style={{ border: '1px solid #e0e0e0', padding: '4px 8px', textAlign: 'right', fontWeight: 800, fontSize: 10, color: '#991B1B' }}>Parts Subtotal</td>
                        <td style={{ border: '1px solid #e0e0e0', padding: '4px 8px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#991B1B', borderBottom: '2px solid #DC2626' }}>{formatNumber(partsTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </>
                  )}
                  {labours.length > 0 && (
                    <>
                      <tr key="labour-hdr" style={{ background: '#EFF6FF' }}>
                        <td colSpan={colCount} style={{ border: '1px solid #e0e0e0', padding: '6px 8px', fontSize: 10, fontWeight: 800, color: '#1E40AF', letterSpacing: 1, textTransform: 'uppercase' as const, borderBottom: '2px solid #3B82F6' }}>
                          Services
                        </td>
                      </tr>
                      {labours.map((s: any) => renderRow(s))}
                      <tr key="labour-disc" style={{ background: 'none' }}>
                        <td colSpan={colCount - 1} style={{ border: '1px solid #e0e0e0', padding: '3px 8px', textAlign: 'right', fontSize: 10, color: '#1E40AF' }}>Services Discount Total</td>
                        <td style={{ border: '1px solid #e0e0e0', padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#1E40AF' }}>{formatNumber(laboursDiscount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                      <tr key="labour-sub" style={{ background: 'none' }}>
                        <td colSpan={colCount - 1} style={{ border: '1px solid #e0e0e0', padding: '4px 8px', textAlign: 'right', fontWeight: 800, fontSize: 10, color: '#1E40AF' }}>Services Subtotal</td>
                        <td style={{ border: '1px solid #e0e0e0', padding: '4px 8px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#1E40AF', borderBottom: '2px solid #3B82F6' }}>{formatNumber(laboursTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </>
                  )}
                  {printServices.length === 0 && (
                    <tr>
                      <td colSpan={colCount} style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                        No services
                      </td>
                    </tr>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* -- Totals & Payment -- */}
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

        <table className="print-totals-table" style={{ width: '50%', marginLeft: 0, fontSize: 13 }}>
        <tbody>
          <tr>
            <td style={{ padding: '4px 8px', color: '#555' }}>{isNonGst ? 'Parts' : 'Parts (Excl. Tax)'}</td>
            <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
              {formatCurrency(totals.parts_excl_tax)}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '4px 8px', color: '#555' }}>{isNonGst ? 'Services' : 'Services (Excl. Tax)'}</td>
            <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
              {formatCurrency(totals.labour_excl_tax)}
            </td>
          </tr>
          {!isNonGst && (
            <tr>
              <td style={{ padding: '4px 8px', color: '#555' }}>Total Tax</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                {formatCurrency(totals.tax_total)}
              </td>
            </tr>
          )}
          <tr style={{ fontWeight: 700, borderTop: '2px solid #DC2626' }}>
            <td style={{ padding: '8px 8px 4px', color: '#DC2626' }}>Grand Total</td>
            <td
              style={{
                padding: '8px 8px 4px',
                textAlign: 'right',
                fontFamily: 'monospace',
                fontSize: 15,
                color: '#DC2626',
              }}
            >
              {formatCurrency(totals.grand_total)}
            </td>
          </tr>
          {((job as any).advance_payments || []).length > 0 && (() => {
            const advPays = (job as any).advance_payments || [];
            const totAdv = advPays.reduce((s: number, ap: any) => s + (parseFloat(ap.amount) || 0), 0);
            const bal = totals.grand_total - totAdv;
            return (
              <>
                {advPays.map((ap: any, idx: number) => (
                  <tr key={ap.id || idx}>
                    <td style={{ padding: '4px 8px', color: '#059669', fontSize: 11 }}>
                      Advance Paid
                      <span style={{ fontSize: 9, color: '#999', marginLeft: 4 }}>
                        ({ap.payment_type || 'cash'}{ap.payment_date ? ` · ${new Date(ap.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''})
                      </span>
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#059669', fontWeight: 600 }}>
                      -{formatCurrency(ap.amount)}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #059669' }}>
                  <td style={{ padding: '8px 8px 4px', fontWeight: 700, color: '#059669' }}>Balance Due</td>
                  <td style={{
                    padding: '8px 8px 4px',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#059669',
                  }}>
                    {formatCurrency(bal > 0 ? bal : 0)}
                  </td>
                </tr>
              </>
            );
          })()}
        </tbody>
      </table>
      </div>

      {/* -- CGST / SGST Tax Breakdown Table -- */}
      {!isNonGst && totals.tax_total > 0 && Object.keys(taxGroups).length > 0 && (
        <div style={{ marginTop: 16, pageBreakInside: 'avoid' }}>
          <table className="tax-table" style={{ width: '42%', marginLeft: 'auto', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: 10, marginBottom: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th rowSpan={2} style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'left' }}>Taxable Value</th>
                <th colSpan={2} style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'center' }}>CGST</th>
                <th colSpan={2} style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'center' }}>SGST</th>
              </tr>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'center' }}>%</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'right' }}>Amt</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'center' }}>%</th>
                <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'right' }}>Amt</th>
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
                  <tr key={rateStr} style={{ borderBottom: '1px solid #cbd5e1' }}>
                    <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontFamily: 'monospace' }}>
                      {formatCurrency(group.taxable)}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'center' }}>{cgstRate}%</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(cgstAmt)}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'center' }}>{sgstRate}%</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(sgstAmt)}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 'bold', background: '#f1f5f9' }}>
                <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontFamily: 'monospace' }}>
                  {formatCurrency(Object.values(taxGroups).reduce((sum, g) => sum + g.taxable, 0))}
                </td>
                <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatCurrency(Object.values(taxGroups).reduce((sum, g) => sum + g.tax / 2, 0))}
                </td>
                <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatCurrency(Object.values(taxGroups).reduce((sum, g) => sum + g.tax / 2, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}


      {/* -- Amount in Words -- */}
      <div style={{
        marginTop: 16,
        padding: '10px 14px',
        background: '#F0F9FF',
        border: '1px solid #BAE6FD',
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 'bold',
        color: '#1e293b',
        width: '42%',
        marginLeft: 'auto',
        boxSizing: 'border-box',
        textAlign: 'right'
      }}>
        <strong style={{ color: '#DC2626' }}>Amount in Words:</strong>{' '}
        <span style={{ textTransform: 'uppercase' }}>{numberToWords(Math.round(totals.grand_total))} RUPEES ONLY</span>
      </div>

      {/* -- Service Photos (only for job_card_share) -- */}
      {printType === 'job_card_share' && mediaItems.length > 0 && (
        <div style={{ marginTop: 20, pageBreakInside: 'avoid' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', borderBottom: '2px solid #e5e7eb', paddingBottom: 6, marginBottom: 12 }}>
            Service Photos
          </h3>
          <div className="print-media-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {mediaItems.map((item) => (
              <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <img
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${item.file_path}`}
                  alt={item.caption || `Service photo ${item.stage}`}
                  style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
                />
                <div style={{ padding: '4px 8px', fontSize: 10, color: '#666', textTransform: 'uppercase', fontWeight: 600, textAlign: 'center', background: '#f9fafb' }}>
                  {item.stage}{item.caption ? ` — ${item.caption}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* -- Print CSS -- */}
      <style>{`
        @media print {
          @page { margin: 15mm; }
          body { 
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            display: block !important;
          }
          nav, aside, header, footer, button, .no-print, .print-toolbar { display: none !important; }
        }
        @media screen {
          body { background: #f5f5f5; }
        }
        @media screen and (max-width: 820px) {
          .print-page-container {
            padding: 16px 12px !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .print-header-flex {
            text-align: left !important;
          }
          .print-details-table tbody tr {
            display: flex !important;
            flex-direction: column !important;
            margin-bottom: 8px !important;
          }
          .print-details-table tbody tr td {
            display: block !important;
            padding: 3px 0 !important;
            width: 100% !important;
          }
          .print-totals-table {
            width: 100% !important;
          }
          .print-media-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .print-media-grid img {
            height: auto !important;
            aspect-ratio: 16/9 !important;
          }
          .print-signatures-flex {
            flex-direction: column !important;
            gap: 24px !important;
            align-items: center !important;
          }
        }
      `}</style>
    </div>
  );
}




