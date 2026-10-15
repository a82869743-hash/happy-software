import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { downloadExcel } from '../utils/download';
import AnimatedPage from '../components/shared/AnimatedPage';
import { getLocalDateString } from '../utils/format';
import { useKillSwitchLock } from '../hooks/useKillSwitchLock';

interface ReportData {
  date: string;
  company?: string;
  company_breakdown?: {
    detailing_studio: number;
    car_wash: number;
    accessories: number;
    total: number;
  };
  sections: {
    invoices: Array<{ invoice_no: string; job_no: string; reg_no: string; car_name: string; subtotal: number; gst_percent: number; gst_amount: number; total_amount: number; payment_mode: string; company?: string }>;
    estimates: Array<{ estimate_no: string; job_no: string; reg_no: string; car_name: string; subtotal: number; payment_mode: string; company?: string }>;
    products: Array<{ product_name: string; price: number; customer_name: string; payment_mode: string; company?: string }>;
    cashIn: Array<{ category: string; description: string; amount: number; company?: string }>;
    cashOut: Array<{ category: string; description: string; amount: number; company?: string }>;
    salaries: Array<{ full_name: string; payment_month: string; paid_amount: number; payment_mode: string; payment_type: string; company?: string }>;
    attendance: Array<{ full_name: string; status: string }>;
    customerPayments: Array<{ ref_no: string; customer_name: string; reg_no: string; payment_mode: string; remarks: string; amount: number; company?: string }>;
  };
  totals: { invoiceTotal: number; estimateTotal: number; productTotal: number; cashInTotal: number; cashOutTotal: number; salaryTotal: number; customerPaymentTotal: number; totalIncome: number; totalExpense: number };
  opening_balance: number;
  net_balance: number;
}

const COMPANY_MAP: Record<string, 'all' | 'Detailing Studio' | 'Car Wash' | 'Accessories'> = {
  'all': 'all',
  'detailing-studio': 'Detailing Studio',
  'car-wash': 'Car Wash',
  'accessories': 'Accessories',
  'Detailing Studio': 'Detailing Studio',
  'Car Wash': 'Car Wash',
  'Accessories': 'Accessories',
};

const COMPANY_TO_PARAM: Record<string, string> = {
  'all': 'all',
  'Detailing Studio': 'detailing-studio',
  'Car Wash': 'car-wash',
  'Accessories': 'accessories',
};

export default function DailyReport() {
  const { isLocked } = useKillSwitchLock('daily_report');
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCompany = (searchParams.get('company') && COMPANY_MAP[searchParams.get('company')!]) || 'Detailing Studio';

  const [date, setDate] = useState(getLocalDateString());
  const [selectedCompany, setSelectedCompany] = useState<'Detailing Studio' | 'Car Wash' | 'Accessories'>(
    initialCompany === 'all' ? 'Detailing Studio' : initialCompany
  );
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const handleCompanyChange = (compKey: 'Detailing Studio' | 'Car Wash' | 'Accessories') => {
    setSelectedCompany(compKey);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('company', COMPANY_TO_PARAM[compKey] || compKey);
      return next;
    });
  };

  useEffect(() => {
    const compParam = searchParams.get('company');
    if (compParam && COMPANY_MAP[compParam] && COMPANY_MAP[compParam] !== 'all') {
      setSelectedCompany(COMPANY_MAP[compParam] as any);
    } else {
      setSelectedCompany('Detailing Studio');
    }
  }, [searchParams]);

  const [denominations, setDenominations] = useState<Record<number, number>>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0
  });

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try { 
      const params: Record<string, string> = { date, company: selectedCompany };
      const res = await api.get('/reports/daily', { params }); 
      setData(res.data); 
    } catch { 
      /* ignore */ 
    } finally { 
      setLoading(false); 
    }
  }, [date, selectedCompany]);

  useEffect(() => {
    if (isLocked) return;
    fetchReport();
  }, [fetchReport, isLocked]);

  const handleExportExcel = async () => {
    try {
      const params: Record<string, string> = { date, company: selectedCompany };
      const compSlug = `${selectedCompany.replace(/\s+/g, '_')}_`;
      await downloadExcel(api, '/exports/daily-report', `Daily_Report_${compSlug}${date}.xlsx`, params);
    } catch { /* handled by downloadExcel */ }
  };

  const displayDate = date.split('-').reverse().join('-'); // '2026-07-10' -> '10-07-2026'

  // 1. Credit Cash Inflows (mode = 'cash')
  const custCash = data?.sections?.customerPayments?.filter(cp => cp.payment_mode?.toLowerCase() === 'cash') || [];
  const prodCash = data?.sections?.products?.filter(p => p.payment_mode?.toLowerCase() === 'cash') || [];
  const manualCashIn = data?.sections?.cashIn || [];

  const creditCashList = [
    ...custCash.map(c => ({
      amount: c.amount,
      mode: 'CASH',
      desc: `${c.company ? `[${c.company}] ` : ''}${c.ref_no ? `${c.reg_no || ''} - ${c.customer_name || ''} (${c.ref_no})` : `${c.reg_no || ''} - ${c.customer_name || ''}`}`
    })),
    ...prodCash.map(p => ({
      amount: p.price,
      mode: 'CASH',
      desc: `[Accessories] ${p.product_name} - ${p.customer_name || ''}`
    })),
    ...manualCashIn.map(m => ({
      amount: m.amount,
      mode: 'CASH',
      desc: `${m.company && m.company !== 'General' ? `[${m.company}] ` : ''}${m.description || m.category}`
    }))
  ];
  const creditCashTotal = creditCashList.reduce((sum, item) => sum + Number(item.amount), 0);

  // Pad to 10 rows
  const paddedCreditCash = [...creditCashList];
  while (paddedCreditCash.length < 10) {
    paddedCreditCash.push({ amount: 0, mode: '', desc: '' });
  }

  // 2. Card cashless inflows (mode != 'cash')
  const custCard = data?.sections?.customerPayments?.filter(cp => cp.payment_mode?.toLowerCase() !== 'cash' && cp.payment_mode?.toLowerCase() !== 'discount') || [];
  const prodCard = data?.sections?.products?.filter(p => p.payment_mode?.toLowerCase() !== 'cash') || [];

  const cashlessList = [
    ...custCard.map(c => ({
      amount: c.amount,
      mode: c.payment_mode?.toUpperCase(),
      desc: `${c.company ? `[${c.company}] ` : ''}${c.ref_no ? `${c.reg_no || ''} - ${c.customer_name || ''} (${c.ref_no})` : `${c.reg_no || ''} - ${c.customer_name || ''}`}`
    })),
    ...prodCard.map(p => ({
      amount: p.price,
      mode: p.payment_mode?.toUpperCase(),
      desc: `[Accessories] ${p.product_name} - ${p.customer_name || ''}`
    }))
  ];
  const cashlessTotal = cashlessList.reduce((sum, item) => sum + Number(item.amount), 0);

  // Pad to 10 rows
  const paddedCashless = [...cashlessList];
  while (paddedCashless.length < 10) {
    paddedCashless.push({ amount: 0, mode: '', desc: '' });
  }

  // 3. Cash Expenses & Outflows (All expenses from cash_ledger)
  const manualCashOut = data?.sections?.cashOut || [];

  const cashOutList = manualCashOut.map(m => ({
    amount: m.amount,
    mode: 'CASH',
    desc: m.description || m.category,
    person: m.category
  }));
  const cashOutTotal = cashOutList.reduce((sum, item) => sum + Number(item.amount), 0);

  // Pad to 15 rows
  const paddedCashOut = [...cashOutList];
  while (paddedCashOut.length < 15) {
    paddedCashOut.push({ amount: 0, mode: '', desc: '', person: '' });
  }

  // 4. Online Outflows (paid online)
  const salaryOnline = data?.sections?.salaries?.filter(s => s.payment_mode?.toLowerCase() !== 'cash') || [];

  const onlineOutList = [
    ...salaryOnline.map(s => ({ amount: s.paid_amount, mode: s.payment_mode?.toUpperCase(), desc: `Salary: ${s.full_name} for ${s.payment_month}`, person: s.full_name }))
  ];
  const onlineOutTotal = onlineOutList.reduce((sum, item) => sum + Number(item.amount), 0);

  // Pad to 10 rows
  const paddedOnlineOut = [...onlineOutList];
  while (paddedOnlineOut.length < 10) {
    paddedOnlineOut.push({ amount: 0, mode: '', desc: '', person: '' });
  }

  // Opening & Closing Calculations
  const openingBalance = data?.opening_balance || 0;
  const totalCreditCash = openingBalance + creditCashTotal;
  const todayTotalCash = totalCreditCash - cashOutTotal;

  // Denominations Table
  const handleDenomChange = (denom: number, count: number) => {
    setDenominations(prev => ({
      ...prev,
      [denom]: Math.max(0, count)
    }));
  };

  const denomTotal = Object.entries(denominations).reduce(
    (sum, [denom, count]) => sum + Number(denom) * count,
    0
  );
  const denomNotes = Object.values(denominations).reduce((sum, count) => sum + count, 0);

  if (isLocked) {
    return (
      <AnimatedPage className="pt-20 sm:pt-24 p-4 sm:p-6 w-full max-w-[1440px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-on-surface font-headline">End-of-Day Financial Report</h1>
            <p className="text-on-surface-muted text-sm mt-1">Complete Workshop Closing Statement - Cash Drawer Audit</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">assessment</span>
          <h3 className="text-base font-bold text-gray-700 font-headline">No Daily Report Data</h3>
          <p className="text-xs text-gray-400 mt-1">No daily closing statement or transactions recorded for this date.</p>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="pt-20 sm:pt-24 p-4 sm:p-6 w-full max-w-[1440px] mx-auto space-y-6 print:pt-0 print:p-0 print:m-0 print:w-full print:max-w-none print:space-y-2">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape;
            margin: 3mm 4mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            zoom: 86% !important;
          }
          .no-print, header, nav, button, input[type="date"] {
            display: none !important;
          }
          .print-header-bar {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            border-bottom: 2px solid #334155 !important;
            padding-bottom: 4px !important;
            margin-bottom: 6px !important;
          }
          .report-grid {
            display: flex !important;
            flex-direction: row !important;
            gap: 6px !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            align-items: flex-start !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .report-col-left {
            width: 35.5% !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 6px !important;
            flex-shrink: 0 !important;
          }
          .report-col-mid {
            width: 38.5% !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 6px !important;
            flex-shrink: 0 !important;
          }
          .report-col-right {
            width: 25% !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 6px !important;
            flex-shrink: 0 !important;
          }
          .report-card {
            border: 1px solid #cbd5e1 !important;
            border-radius: 4px !important;
            overflow: hidden !important;
            background: #ffffff !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 8px !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 2px 3px !important;
            line-height: 1.2 !important;
            word-break: break-word !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .denom-input {
            border: none !important;
            outline: none !important;
            background: transparent !important;
            text-align: center !important;
            width: 100% !important;
            font-weight: bold !important;
            font-size: 8.5px !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      ` }} />

      {/* Print-Only Title Header */}
      <div className="hidden print-header-bar">
        <div>
          <h1 className="text-base font-black text-slate-800 uppercase tracking-wide">
            HAPPY CAR WASH — {selectedCompany.toUpperCase()} — END OF DAY FINANCIAL REPORT
          </h1>
          <p className="text-[10px] font-bold text-slate-500">
            {selectedCompany} Individual Closing Statement · Cash Audit
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-black text-slate-800">Date: {displayDate}</div>
        </div>
      </div>
      
      {/* Header */}
      <header className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-sm">
              Company: {selectedCompany}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 font-headline">
            {selectedCompany} — Daily Report
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Dedicated Daily Workshop Closing Statement & Cash Drawer Audit for {selectedCompany}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
            <span className="material-symbols-outlined text-primary text-sm">calendar_month</span>
            <input
              type="date"
              className="bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 cursor-pointer"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <button
            className="bg-[#107c41] hover:bg-[#0b592e] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-700/20 active:scale-95"
            onClick={handleExportExcel}
          >
            <span className="material-symbols-outlined text-sm font-bold">description</span>
            Export {selectedCompany}
          </button>
          <button
            className="bg-primary hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-primary/20 active:scale-95"
            onClick={() => window.print()}
          >
            <span className="material-symbols-outlined text-sm">print</span>
            Print PDF / Report
          </button>
        </div>
      </header>

      {/* --- COMPANY NAVIGATION TABS --- */}
      <div className="no-print flex flex-wrap gap-2 items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mx-2 flex items-center gap-1.5 font-sans">
          <span className="material-symbols-outlined text-base">domain</span> Company View:
        </span>
        {[
          { key: 'Detailing Studio', label: 'Detailing Studio', icon: 'assignment' },
          { key: 'Car Wash', label: 'Car Wash', icon: 'bolt' },
          { key: 'Accessories', label: 'Accessories', icon: 'shopping_bag' },
        ].map((c) => {
          const isActive = selectedCompany === c.key;
          return (
            <button
              key={c.key}
              onClick={() => handleCompanyChange(c.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer font-sans ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{c.icon}</span>
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Dedicated Individual Company Banner */}
      <div className={`no-print p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
        selectedCompany === 'Detailing Studio'
          ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-950'
          : selectedCompany === 'Car Wash'
          ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 text-blue-950'
          : 'bg-gradient-to-r from-purple-50 to-fuchsia-50 border-purple-200 text-purple-950'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm ${
            selectedCompany === 'Detailing Studio'
              ? 'bg-amber-600'
              : selectedCompany === 'Car Wash'
              ? 'bg-blue-600'
              : 'bg-purple-600'
          }`}>
            <span className="material-symbols-outlined text-2xl">
              {selectedCompany === 'Detailing Studio' ? 'assignment' : selectedCompany === 'Car Wash' ? 'bolt' : 'shopping_bag'}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/90 border border-current/20">
                Individual Company Report
              </span>
              <span className="text-xs font-bold opacity-60">
                {selectedCompany === 'Detailing Studio' ? 'Company 1' : selectedCompany === 'Car Wash' ? 'Company 2' : 'Company 3'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-headline font-black mt-0.5">
              {selectedCompany}
            </h3>
            <p className="text-xs opacity-75">
              {selectedCompany === 'Detailing Studio' && 'Showing dedicated daily collections, billing & cash drawer balance for Detailing Studio.'}
              {selectedCompany === 'Car Wash' && 'Showing dedicated daily collections, billing & cash drawer balance for Car Wash.'}
              {selectedCompany === 'Accessories' && 'Showing dedicated daily counter sales & cash drawer balance for Accessories.'}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center py-32 space-y-4 no-print">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-on-surface-variant animate-pulse">Compiling closing metrics...</span>
        </div>
      ) : data && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start font-mono text-[11px] leading-relaxed text-slate-800 report-grid">
          
          {/* LEFT COLUMN: Cash Collections & cashless Inflows */}
          <div className="xl:col-span-5 space-y-6 report-col-left">
            
            {/* 1. Today Credit Cash Table */}
            <div className="border border-slate-300 rounded overflow-hidden shadow-sm bg-white report-card">
              <table className="w-full border-collapse">
                <thead>
                  <tr
                    className="bg-[#4F81BD] text-white font-bold text-xs"
                    style={{ backgroundColor: '#4F81BD', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <th className="py-2 px-2 text-left border-b border-slate-300 w-24" style={{ backgroundColor: '#4F81BD', color: '#ffffff' }}>Date :</th>
                    <th className="py-2 px-2 text-left border-b border-slate-300 w-28 font-semibold" style={{ backgroundColor: '#4F81BD', color: '#ffffff' }}>{displayDate}</th>
                    <th className="py-2 px-2 text-center border-b border-slate-300" style={{ backgroundColor: '#4F81BD', color: '#ffffff' }}>Today Credit Cash</th>
                  </tr>
                  <tr
                    className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[10px]"
                    style={{ backgroundColor: '#f1f5f9', color: '#334155', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <th className="py-1 px-2 text-right border-r border-slate-300 w-20">Amount</th>
                    <th className="py-1 px-2 text-center border-r border-slate-300 w-24">Payment mode</th>
                    <th className="py-1 px-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {paddedCreditCash.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50/50">
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-bold">
                        {item.amount > 0 ? Number(item.amount).toFixed(0) : "0"}
                      </td>
                      <td className="py-1.5 px-2 text-center border-r border-slate-300 text-[10px] font-bold">
                        {item.mode || "—"}
                      </td>
                      <td className="py-1.5 px-2 text-left truncate max-w-[200px]" title={item.desc}>
                        {item.desc || "—"}
                      </td>
                    </tr>
                  ))}
                  <tr
                    className="bg-[#DCE6F1] font-extrabold text-slate-800 border-t border-slate-300"
                    style={{ backgroundColor: '#DCE6F1', color: '#1e293b', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <td className="py-1.5 px-2 text-right border-r border-slate-300 text-xs">
                      {creditCashTotal.toFixed(0)}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300"></td>
                    <td className="py-1.5 px-2 text-left text-xs uppercase tracking-wider">TOTAL</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 2. Today Card Swipe Table */}
            <div className="border border-slate-300 rounded overflow-hidden shadow-sm bg-white report-card">
              <table className="w-full border-collapse">
                <thead>
                  <tr
                    className="bg-[#E46C0A] text-white font-bold text-xs"
                    style={{ backgroundColor: '#E46C0A', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <th colSpan={3} className="py-2 px-2 text-center border-b border-slate-300" style={{ backgroundColor: '#E46C0A', color: '#ffffff' }}>
                      Today Card Swipe / G-pay / PhonePe
                    </th>
                  </tr>
                  <tr
                    className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[10px]"
                    style={{ backgroundColor: '#f1f5f9', color: '#334155', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <th className="py-1 px-2 text-right border-r border-slate-300 w-20">Amount</th>
                    <th className="py-1 px-2 text-center border-r border-slate-300 w-24">Payment mode</th>
                    <th className="py-1 px-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {paddedCashless.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50/50">
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-bold">
                        {item.amount > 0 ? Number(item.amount).toFixed(0) : "0"}
                      </td>
                      <td className="py-1.5 px-2 text-center border-r border-slate-300 text-[10px] font-bold">
                        {item.mode || "—"}
                      </td>
                      <td className="py-1.5 px-2 text-left truncate max-w-[200px]" title={item.desc}>
                        {item.desc || "—"}
                      </td>
                    </tr>
                  ))}
                  <tr
                    className="bg-[#FCD5B4] font-extrabold text-slate-800 border-t border-slate-300"
                    style={{ backgroundColor: '#FCD5B4', color: '#1e293b', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <td className="py-1.5 px-2 text-right border-r border-slate-300 text-xs">
                      {cashlessTotal.toFixed(0)}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300"></td>
                    <td className="py-1.5 px-2 text-left text-xs uppercase tracking-wider">TOTAL</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

          {/* MIDDLE COLUMN: Cash Expenses & Online Payouts */}
          <div className="xl:col-span-4 space-y-6 report-col-mid">
            
            {/* 3. Today Expenses and Cash Deposit Table */}
            <div className="border border-slate-300 rounded overflow-hidden shadow-sm bg-white report-card">
              <table className="w-full border-collapse">
                <thead>
                  <tr
                    className="bg-[#4F81BD] text-white font-bold text-xs"
                    style={{ backgroundColor: '#4F81BD', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <th colSpan={4} className="py-2 px-2 text-center border-b border-slate-300" style={{ backgroundColor: '#4F81BD', color: '#ffffff' }}>
                      Today Expances and Cash Deposit
                    </th>
                  </tr>
                  <tr
                    className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[10px]"
                    style={{ backgroundColor: '#f1f5f9', color: '#334155', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <th className="py-1 px-2 text-right border-r border-slate-300 w-16">Amount</th>
                    <th className="py-1 px-2 text-center border-r border-slate-300 w-20">Payment mode</th>
                    <th className="py-1 px-2 text-left border-r border-slate-300">Description</th>
                    <th className="py-1 px-2 text-left w-20">Person Name</th>
                  </tr>
                </thead>
                <tbody>
                  {paddedCashOut.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50/50">
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-bold">
                        {item.amount > 0 ? Number(item.amount).toFixed(0) : "0"}
                      </td>
                      <td className="py-1.5 px-2 text-center border-r border-slate-300 text-[10px] font-bold">
                        {item.mode || "—"}
                      </td>
                      <td className="py-1.5 px-2 text-left truncate max-w-[120px]" title={item.desc}>
                        {item.desc || "—"}
                      </td>
                      <td className="py-1.5 px-2 text-left truncate text-[10px]" title={item.person}>
                        {item.person || "—"}
                      </td>
                    </tr>
                  ))}
                  <tr
                    className="bg-[#DCE6F1] font-extrabold text-slate-800 border-t border-slate-300"
                    style={{ backgroundColor: '#DCE6F1', color: '#1e293b', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <td className="py-1.5 px-2 text-right border-r border-slate-300 text-xs">
                      {cashOutTotal.toFixed(0)}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300"></td>
                    <td className="py-1.5 px-2 text-left border-r border-slate-300 text-xs uppercase tracking-wider">TOTAL</td>
                    <td className="py-1.5 px-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 4. Today Online Payment Table */}
            <div className="border border-slate-300 rounded overflow-hidden shadow-sm bg-white report-card">
              <table className="w-full border-collapse">
                <thead>
                  <tr
                    className="bg-[#E46C0A] text-white font-bold text-xs"
                    style={{ backgroundColor: '#E46C0A', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <th colSpan={4} className="py-2 px-2 text-center border-b border-slate-300" style={{ backgroundColor: '#E46C0A', color: '#ffffff' }}>
                      Today Online Payment
                    </th>
                  </tr>
                  <tr
                    className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[10px]"
                    style={{ backgroundColor: '#f1f5f9', color: '#334155', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <th className="py-1 px-2 text-right border-r border-slate-300 w-16">Amount</th>
                    <th className="py-1 px-2 text-center border-r border-slate-300 w-20">Payment mode</th>
                    <th className="py-1 px-2 text-left border-r border-slate-300">Description</th>
                    <th className="py-1 px-2 text-left w-20">Person Name</th>
                  </tr>
                </thead>
                <tbody>
                  {paddedOnlineOut.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50/50">
                      <td className="py-1.5 px-2 text-right border-r border-slate-300 font-bold">
                        {item.amount > 0 ? Number(item.amount).toFixed(0) : "0"}
                      </td>
                      <td className="py-1.5 px-2 text-center border-r border-slate-300 text-[10px] font-bold">
                        {item.mode || "—"}
                      </td>
                      <td className="py-1.5 px-2 text-left truncate max-w-[120px]" title={item.desc}>
                        {item.desc || "—"}
                      </td>
                      <td className="py-1.5 px-2 text-left truncate text-[10px]" title={item.person}>
                        {item.person || "—"}
                      </td>
                    </tr>
                  ))}
                  <tr
                    className="bg-[#FCD5B4] font-extrabold text-slate-800 border-t border-slate-300"
                    style={{ backgroundColor: '#FCD5B4', color: '#1e293b', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <td className="py-1.5 px-2 text-right border-r border-slate-300 text-xs">
                      {onlineOutTotal.toFixed(0)}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300"></td>
                    <td className="py-1.5 px-2 text-left border-r border-slate-300 text-xs uppercase tracking-wider">TOTAL</td>
                    <td className="py-1.5 px-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

          {/* RIGHT COLUMN: Denominations Counter & Financial Summary */}
          <div className="xl:col-span-3 space-y-6 report-col-right">
            
            {/* 5. Denominations Calculator Table */}
            <div className="border border-slate-300 rounded overflow-hidden shadow-sm bg-white report-card">
              <table className="w-full border-collapse">
                <thead>
                  <tr
                    className="bg-slate-700 text-white font-bold text-center text-xs"
                    style={{ backgroundColor: '#334155', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <th colSpan={3} className="py-2 px-2 border-b border-slate-300" style={{ backgroundColor: '#334155', color: '#ffffff' }}>Denominations</th>
                  </tr>
                  <tr
                    className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[10px]"
                    style={{ backgroundColor: '#f1f5f9', color: '#334155', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <th className="py-1 px-2 text-center border-r border-slate-300 w-14">Note</th>
                    <th className="py-1 px-2 text-center border-r border-slate-300 w-14">Count</th>
                    <th className="py-1 px-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(denominations).map(Number).sort((a, b) => b - a).map((denom) => {
                    const count = denominations[denom];
                    const value = denom * count;
                    return (
                      <tr key={denom} className="border-b border-slate-200">
                        <td className="py-1.5 px-2 text-center border-r border-slate-300 font-bold">
                          {denom}
                        </td>
                        <td className="py-1 px-2 text-center border-r border-slate-300">
                          <input
                            type="number"
                            min="0"
                            className="denom-input w-16 px-1 py-0.5 border border-slate-200 rounded text-center text-[11px] font-mono focus:ring-1 focus:ring-primary focus:border-primary"
                            value={count || 0}
                            placeholder="0"
                            onChange={e => handleDenomChange(denom, parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-1.5 px-2 text-right font-bold font-mono">
                          {value > 0 ? value.toLocaleString('en-IN') : "0"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr
                    className="bg-slate-100 font-extrabold text-slate-800 border-t border-slate-300"
                    style={{ backgroundColor: '#f1f5f9', color: '#1e293b', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  >
                    <td className="py-1.5 px-2 text-center border-r border-slate-300 text-xs">TOTAL</td>
                    <td className="py-1.5 px-2 text-center border-r border-slate-300 font-mono text-xs">{denomNotes}</td>
                    <td className="py-1.5 px-2 text-right text-xs font-mono text-primary">₹{denomTotal.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 6. Closing Cash Summary Table */}
            <div className="border border-slate-300 rounded overflow-hidden shadow-sm bg-white report-card">
              <table className="w-full border-collapse text-[10px]">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 px-2.5 font-bold text-slate-600 border-r border-slate-200 bg-slate-50" style={{ backgroundColor: '#f8fafc', WebkitPrintColorAdjust: 'exact' }}>OPENING BALANCE</td>
                    <td className="py-2 px-2.5 text-right font-bold font-mono text-xs bg-white">
                      ₹{openingBalance.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 px-2.5 font-bold text-slate-600 border-r border-slate-200 bg-slate-50" style={{ backgroundColor: '#f8fafc', WebkitPrintColorAdjust: 'exact' }}>CREDIT CASH</td>
                    <td className="py-2 px-2.5 text-right font-bold font-mono text-xs bg-white text-emerald-600">
                      ₹{creditCashTotal.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200" style={{ backgroundColor: '#FEF3C7', color: '#78350F', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    <td className="py-2 px-2.5 font-extrabold border-r border-slate-200" style={{ color: '#78350F' }}>TOTAL CREDIT CASH</td>
                    <td className="py-2 px-2.5 text-right font-black font-mono text-xs" style={{ color: '#78350F' }}>
                      ₹{totalCreditCash.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 px-2.5 font-bold text-slate-600 border-r border-slate-200 bg-slate-50" style={{ backgroundColor: '#f8fafc', WebkitPrintColorAdjust: 'exact' }}>EXPANCES</td>
                    <td className="py-2 px-2.5 text-right font-bold font-mono text-xs bg-white text-red-600">
                      ₹{cashOutTotal.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200" style={{ backgroundColor: '#E0F2FE', color: '#075985', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    <td className="py-2 px-2.5 font-extrabold border-r border-slate-200" style={{ color: '#075985' }}>TODAY TOTAL CASH</td>
                    <td className="py-2 px-2.5 text-right font-black font-mono text-xs" style={{ color: '#075985' }}>
                      ₹{todayTotalCash.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {denomTotal > 0 && (
                    <tr
                      className={`border-t-2 font-bold ${denomTotal === todayTotalCash ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}
                      style={{
                        backgroundColor: denomTotal === todayTotalCash ? '#ecfdf5' : '#fef2f2',
                        color: denomTotal === todayTotalCash ? '#065f46' : '#991b1b',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact'
                      }}
                    >
                      <td className="py-2.5 px-2.5 border-r border-slate-200 uppercase text-[9px] tracking-wider">
                        {denomTotal === todayTotalCash ? "✓ MATCHED" : "✗ MISMATCH"}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-bold font-mono">
                        {denomTotal === todayTotalCash ? "Perfect" : `Diff: ₹${Math.abs(todayTotalCash - denomTotal).toLocaleString('en-IN')}`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}
    </AnimatedPage>
  );
}

