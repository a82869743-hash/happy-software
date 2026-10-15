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

export interface DivisionConfig {
  division: 'car_wash' | 'accessories' | 'detailing';
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

export function getDivisionConfig(company?: string, isQuickJob?: boolean | number, jobNo?: string, serviceType?: string): DivisionConfig {
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

  // 2. Teflon Coating or Deluxe Wash check -> ALWAYS Car Wash (Bank & UPI 9998625511@paytm)
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
