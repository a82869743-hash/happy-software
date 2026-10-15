import QRCode from 'qrcode';

export function numberToWords(n: number): string {
  if (n === 0) return 'Zero Rupees only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(num: number): string {
    if (num === 0) return '';
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + convertChunk(num % 100) : '');
  }

  const crores = Math.floor(n / 10000000);
  n %= 10000000;
  const lakhs = Math.floor(n / 100000);
  n %= 100000;
  const thousands = Math.floor(n / 1000);
  n %= 1000;
  const remaining = n;

  let str = '';
  if (crores > 0) str += convertChunk(crores) + ' Crore ';
  if (lakhs > 0) str += convertChunk(lakhs) + ' Lakh ';
  if (thousands > 0) str += convertChunk(thousands) + ' Thousand ';
  if (remaining > 0) str += convertChunk(remaining);

  return str.trim() + ' Rupees only';
}

export function fmtCurrency(val: number | string | undefined | null): string {
  const num = parseFloat(String(val || 0));
  return '₹ ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type DivisionType = 'car_wash' | 'accessories' | 'detailing';

export interface DivisionConfig {
  division: DivisionType;
  title: string;
  addressLines: string[];
  contactLine: string;
  stateLine: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  accountHolder: string;
  upiId: string;
  payeeName: string;
}

/**
 * Single source of truth for division detection across the application.
 * Precedence:
 * 1. Teflon Coating or Deluxe Wash (spelling tolerant: delux, dlx, teflon, taflon) -> ALWAYS 'car_wash'
 * 2. Accessories / Products (product_sale, accessory_sale_id, ACC-, PROD-) -> 'accessories'
 * 3. Detailing keywords or explicit Detailing Studio -> 'detailing'
 * 4. Quick Job / CW- / WASH- / wash keywords -> 'car_wash'
 * 5. Default -> 'detailing'
 */
export function resolveDivision(item: any): DivisionType {
  if (!item) return 'detailing';

  if (typeof item === 'string') {
    const s = item.toLowerCase().trim();
    if (s === 'car_wash' || s === 'wash' || s === 'car wash') return 'car_wash';
    if (s === 'accessories' || s === 'accessory' || s.includes('product')) return 'accessories';
    if (s === 'detailing' || s === 'detailing studio') return 'detailing';
  }

  const comp = String(item.company || '').toLowerCase().trim();
  const jNo = String(item.job_no || item.doc_no || item.estimate_no || item.invoice_no || '').toUpperCase().trim();
  const svc = String(
    item.service_type ||
    item.service_name ||
    item.services_json ||
    item.remarks ||
    item.type ||
    ''
  ).toLowerCase().trim();
  const isQuick = item.is_quick_job === 1 || item.is_quick_job === true || item.job_category === 'wash';

  // 1. Teflon Coating or Deluxe Wash check -> ALWAYS Car Wash (highest precedence)
  const isTeflonOrDeluxe = /delux|dlx|teflon|taflon/i.test(svc) || /delux|dlx|teflon|taflon/i.test(comp);
  if (isTeflonOrDeluxe) {
    return 'car_wash';
  }

  // 2. Accessories check
  const isAccessories =
    item.record_source === 'product_sale' ||
    Boolean(item.accessory_sale_id) ||
    comp === 'accessories' ||
    comp.includes('accessories') ||
    comp.includes('product') ||
    jNo.startsWith('ACC-') ||
    jNo.startsWith('PROD-');
  if (isAccessories) {
    return 'accessories';
  }

  // 3. Detailing keywords check (spelling-tolerant)
  const hasDetailingKeywords = /coat|coting|ceram|ciram|ppf|detail|rubb|buff|polish|paint|graph|interior|dry\s*clean|deep\s*clean|headlight|glass|spa|studio/.test(svc);

  // 4. Detailing Studio check (takes precedence over generic wash unless quick job without detailing keywords)
  const isDetailing =
    comp === 'detailing studio' ||
    comp === 'detailing' ||
    comp.includes('detailing') ||
    hasDetailingKeywords;
  if (isDetailing) {
    return 'detailing';
  }

  // 5. Explicit Car Wash check
  const isCarWash =
    comp === 'car wash' ||
    comp === 'happy car wash' ||
    (comp.includes('wash') && !comp.includes('detail')) ||
    (isQuick && !hasDetailingKeywords) ||
    jNo.startsWith('CW-') ||
    jNo.startsWith('WASH-') ||
    /wash/i.test(svc);
  if (isCarWash) {
    return 'car_wash';
  }

  // Default fallback
  return 'detailing';
}

export function getDivisionConfigByDivision(div: DivisionType): DivisionConfig {
  if (div === 'accessories') {
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

  if (div === 'car_wash') {
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

  // detailing
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

export function getDivisionConfig(
  companyOrItem?: any,
  isQuickJob?: boolean | number,
  jobNo?: string,
  serviceType?: string
): DivisionConfig {
  if (companyOrItem && typeof companyOrItem === 'object') {
    return getDivisionConfigByDivision(resolveDivision(companyOrItem));
  }
  const div = resolveDivision({
    company: companyOrItem,
    is_quick_job: isQuickJob,
    job_no: jobNo,
    service_type: serviceType
  });
  return getDivisionConfigByDivision(div);
}

export function generateStatementNumber(division: DivisionType, customSeq?: string | number): string {
  const prefixMap: Record<DivisionType, string> = {
    car_wash: 'HCW-CW-STMT',
    detailing: 'HCW-DT-STMT',
    accessories: 'HCW-AC-STMT'
  };
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = customSeq !== undefined ? String(customSeq) : Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefixMap[division]}-${ymd}-${seq}`;
}

export async function generateUPIQrCode(config: DivisionConfig, amount: number, note: string): Promise<string> {
  const am = Math.max(1, amount).toFixed(2);
  // Setting am pre-fills the bill amount; adding mam=1.00 signals to UPI apps (GPay, PhonePe, Paytm) that the amount field is editable with minimum Rs. 1.00
  const mcParam = config.division === 'detailing' ? '&mc=5521&mode=02' : '';
  const upiUrl = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.payeeName)}&am=${am}&mam=1.00&cu=INR&tn=${encodeURIComponent(note || 'Payment')}${mcParam}`;
  return QRCode.toDataURL(upiUrl, {
    margin: 1,
    width: 140,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
}
