import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { downloadExcel } from '../utils/download';
import AnimatedPage from '../components/shared/AnimatedPage';
import { showToast } from '../components/shared/Toast';
import { getLocalDateString } from '../utils/format';
import { useKillSwitchLock } from '../hooks/useKillSwitchLock';

interface SummaryData {
  company_breakdown?: {
    detailing_studio: number;
    car_wash: number;
    accessories: number;
    total: number;
  };
  income: {
    invoice_revenue: number;
    non_gst_invoice_revenue: number;
    estimate_revenue_only: number;
    product_sales_revenue: number;
    parts_sales_revenue: number;
    cash_in_other: number;
    total: number;
    total_accrual: number;
    total_cash_inflow: number;
  };
  expense: {
    staff_payments: number;
    parts_purchases: number;
    other_expenses: number;
    total: number;
  };
  net_balance: number;
  outstanding_receivable: number;
  net_profit_accrual: number;
  net_cash_flow: number;
}
interface Transaction {
  date: string;
  description: string;
  amount: number;
  type: string;
  reference: string;
  company?: string;
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

export default function Accounts() {
  const { isLocked } = useKillSwitchLock('accounts');
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCompany = (searchParams.get('company') && COMPANY_MAP[searchParams.get('company')!]) || 'Detailing Studio';

  const today = getLocalDateString();
  const firstDayOfMonth = getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(today);
  const [selectedCompany, setSelectedCompany] = useState<'Detailing Studio' | 'Car Wash' | 'Accessories'>(
    initialCompany === 'all' ? 'Detailing Studio' : initialCompany
  );

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<{
    amount: string;
    category: string;
    custom_category: string;
    payment_mode: string;
    description: string;
    date: string;
    company: string;
  }>({
    amount: '',
    category: 'Other',
    custom_category: '',
    payment_mode: 'cash',
    description: '',
    date: today,
    company: initialCompany === 'all' ? 'Detailing Studio' : initialCompany
  });
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    setForm(f => ({ ...f, company: selectedCompany }));
  }, [selectedCompany]);

  const handleExportExcel = async () => {
    try {
      const params: Record<string, string> = { from: fromDate, to: toDate, company: selectedCompany };
      const compSlug = `${selectedCompany.replace(/\s+/g, '_')}_`;
      await downloadExcel(api, '/exports/accounts', `Accounts_${compSlug}${fromDate}_to_${toDate}.xlsx`, params);
      showToast('Accounts exported successfully', 'success');
    } catch { /* handled by downloadExcel */ }
  };

  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [reservedCategories, setReservedCategories] = useState<string[]>([]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/accounts/categories');
      const custom: string[] = res.data.custom || [];
      const reserved: string[] = res.data.reserved || [];
      setReservedCategories(reserved);
      setCategoriesList(custom);
      setForm(f => ({
        ...f,
        category: custom.length > 0 ? (custom.includes(f.category) ? f.category : custom[0]) : 'Custom'
      }));
    } catch {
      // Fallback
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { from: fromDate, to: toDate, company: selectedCompany };
      const [sumRes, txRes] = await Promise.all([
        api.get('/accounts/summary', { params }),
        api.get('/accounts/transactions', { params }),
        fetchCategories()
      ]);
      setSummary(sumRes.data);
      setTransactions(txRes.data.data || []);
    } catch { showToast('Failed to load accounts summary', 'error'); }
    finally { setLoading(false); }
  }, [fromDate, toDate, selectedCompany, fetchCategories]);

  useEffect(() => {
    if (isLocked) return;
    fetchData();
  }, [fetchData, isLocked]);

  const handleCashEntry = async (type: 'in' | 'out') => {
    if (!form.amount || parseFloat(form.amount) <= 0 || !form.description.trim()) {
      showToast('Amount and description are required', 'error'); return;
    }

    let categoryName = form.category;
    if (form.category === 'Custom') {
      const customName = form.custom_category.trim();
      if (!customName) {
        showToast('Please enter custom category name', 'error'); return;
      }
      if (reservedCategories.some(r => r.toLowerCase() === customName.toLowerCase())) {
        showToast(`"${customName}" is a reserved system category name. Please use a different name.`, 'error');
        return;
      }
      try {
        await api.post('/accounts/categories', { category_name: customName });
        categoryName = customName;
      } catch (err: any) {
        showToast(err.response?.data?.error || 'Failed to save custom category', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      await api.post('/accounts/cash-ledger', {
        amount: parseFloat(form.amount),
        entry_type: type,
        category: categoryName,
        payment_mode: form.payment_mode,
        description: form.description.trim(),
        entry_date: form.date,
        company: form.company
      });
      showToast(`${type === 'in' ? 'Cash In (Income)' : 'Cash Out (Expense)'} recorded successfully`, 'success');
      setForm({ amount: '', category: categoryName, custom_category: '', payment_mode: 'cash', description: '', date: today, company: form.company });
      fetchData();
    } catch { showToast('Failed to record cash entry', 'error'); }
    finally { setSaving(false); }
  };

  const fmt = (n: any) => {
    const val = parseFloat(String(n ?? 0));
    if (isNaN(val)) return '₹0';
    return `₹${val.toLocaleString('en-IN')}`;
  };
  const fmtDate = (d: string) => {
    if (!d) return '—';
    const raw = new Date(d);
    return raw.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getTypeStyle = (type: string) => {
    if (['cash_out', 'salary'].includes(type)) return { label: 'Expense', bg: 'bg-red-50 text-red-700 border-red-200', txtClass: 'text-red-600', sign: '-' };
    if (type === 'invoice') return { label: 'Invoice', bg: 'bg-primary/5 text-primary border-primary/10', txtClass: 'text-primary', sign: '+' };
    if (type === 'estimate') return { label: 'Invoice', bg: 'bg-primary/5 text-primary border-primary/10', txtClass: 'text-primary', sign: '+' };
    return { label: 'Income', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', txtClass: 'text-emerald-600', sign: '+' };
  };

  const getCompanyBadge = (comp?: string) => {
    if (comp === 'Car Wash') {
      return { label: 'Car Wash', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'bolt' };
    }
    if (comp === 'Accessories') {
      return { label: 'Accessories', bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'shopping_bag' };
    }
    if (comp === 'Detailing Studio') {
      return { label: 'Detailing Studio', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'assignment' };
    }
    return { label: 'General', bg: 'bg-slate-50 text-slate-700 border-slate-200', icon: 'domain' };
  };

  if (isLocked) {
    return (
      <AnimatedPage className="pt-[88px] sm:pt-24 px-4 sm:px-8 pb-12 max-w-7xl mx-auto w-full space-y-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface">Accounts & Cash Ledger</h2>
            <p className="text-on-surface-variant font-medium mt-1">Financial Overview</p>
          </div>
        </header>
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">account_balance</span>
          <h3 className="text-base font-bold text-gray-700 font-headline">No Financial Records Found</h3>
          <p className="text-xs text-gray-400 mt-1">No accounting transactions or income records exist for the selected date range.</p>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 px-4 sm:px-8 pb-12 max-w-7xl mx-auto w-full space-y-8">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-sm">
              Company: {selectedCompany}
            </span>
          </div>
          <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface">
            {selectedCompany} — Accounts
          </h2>
          <p className="text-on-surface-variant font-medium mt-1">
            Dedicated Financial Overview, Revenue & Expense Ledger for {selectedCompany}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleExportExcel}
            className="bg-[#107c41] hover:bg-[#0b592e] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-700/20 active:scale-95 w-full sm:w-auto justify-center"
          >
            <span className="material-symbols-outlined text-sm font-bold">description</span>
            Export {selectedCompany}
          </button>
          <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-gray-100 shadow-sm w-full sm:w-auto">
            <span className="material-symbols-outlined text-primary text-sm">calendar_month</span>
            <input
              type="date"
              className="bg-transparent border-none text-xs font-bold text-primary focus:ring-0 outline-none cursor-pointer flex-1 sm:flex-initial"
              value={fromDate} onChange={e => setFromDate(e.target.value)}
            />
            <span className="text-on-surface-variant font-bold text-[10px] uppercase">TO</span>
            <input
              type="date"
              className="bg-transparent border-none text-xs font-bold text-primary focus:ring-0 outline-none cursor-pointer flex-1 sm:flex-initial"
              value={toDate} onChange={e => setToDate(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* --- COMPANY NAVIGATION TABS --- */}
      <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mx-2 flex items-center gap-1.5">
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
      <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
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
                Individual Company Page
              </span>
              <span className="text-xs font-bold opacity-60">
                {selectedCompany === 'Detailing Studio' ? 'Company 1' : selectedCompany === 'Car Wash' ? 'Company 2' : 'Company 3'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-headline font-black mt-0.5">
              {selectedCompany}
            </h3>
            <p className="text-xs opacity-75">
              {selectedCompany === 'Detailing Studio' && 'Showing dedicated records for Detailing Studio, Ceramic Coating, PPF & Treatments.'}
              {selectedCompany === 'Car Wash' && 'Showing dedicated records for Express Washes, Foam Wash & Cleaning Services.'}
              {selectedCompany === 'Accessories' && 'Showing dedicated records for Retail Product Counter Sales & Accessories.'}
            </p>
          </div>
        </div>
      </div>

      {/* CA Decision-Grade Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Net Operating Profit */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>monetization_on</span>
            </div>
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Accrual</span>
          </div>
          <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold">Net Profit (Accrual)</p>
          <h2 className="text-2xl font-headline font-extrabold text-emerald-600 mt-1">{summary ? fmt(summary.net_profit_accrual) : '₹...'}</h2>
          <p className="text-[10px] text-on-surface-muted mt-2">Billed Revenue minus Expenses</p>
        </div>

        {/* Net Cash Flow */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-700">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
            </div>
            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Cash Basis</span>
          </div>
          <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold">Net Cash Flow</p>
          <h2 className="text-2xl font-headline font-extrabold text-amber-700 mt-1">{summary ? fmt(summary.net_cash_flow) : '₹...'}</h2>
          <p className="text-[10px] text-on-surface-muted mt-2">Actual Cash Inflows minus Expenses</p>
        </div>

        {/* Outstanding Receivable */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>hourglass_empty</span>
            </div>
            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Receivables</span>
          </div>
          <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold">Accounts Receivable</p>
          <h2 className="text-2xl font-headline font-extrabold text-amber-600 mt-1">{summary ? fmt(summary.outstanding_receivable) : '₹...'}</h2>
          <p className="text-[10px] text-on-surface-muted mt-2">Pending customer collections</p>
        </div>

        {/* Total Expenses */}
        <div className="bg-[#1C1917] rounded-xl p-5 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-red-500/20 rounded-full blur-[60px]"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2.5 bg-white/20 rounded-xl text-white backdrop-blur-sm border border-white/10">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>trending_down</span>
              </div>
              <span className="text-[9px] font-bold text-red-300 bg-white/10 border border-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Outflows</span>
            </div>
            <p className="text-white/60 text-[10px] uppercase tracking-widest font-bold">Total Expenses</p>
            <h2 className="text-2xl font-headline font-extrabold text-white mt-1">{summary?.expense ? fmt(summary.expense.total) : '₹...'}</h2>
            <p className="text-[10px] text-white/50 mt-2">Salaries, Spares & Cash Out</p>
          </div>
        </div>
      </div>

      {/* P&L Statement Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {/* Income Columns */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold font-headline uppercase tracking-widest text-primary flex items-center gap-2 pb-2 border-b border-gray-100">
            <span className="material-symbols-outlined text-lg">trending_up</span>
            Revenue & Inflows Breakdown ({selectedCompany})
          </h3>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface-variant font-medium">Invoice Sales</span>
              <span className="font-bold text-on-surface">
                {summary?.income ? fmt((summary.income.invoice_revenue || 0) + (summary.income.non_gst_invoice_revenue || 0)) : '₹...'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface-variant font-medium">Product / Accessory Sales</span>
              <span className="font-bold text-on-surface">{summary?.income ? fmt(summary.income.product_sales_revenue) : '₹...'}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface-variant font-medium">Spare Parts Counter Sales</span>
              <span className="font-bold text-on-surface">{summary?.income ? fmt(summary.income.parts_sales_revenue) : '₹...'}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface-variant font-medium">Other Cash Inflows</span>
              <span className="font-bold text-on-surface">{summary?.income ? fmt(summary.income.cash_in_other) : '₹...'}</span>
            </div>
            <div className="pt-3 border-t border-dashed border-gray-200 space-y-1.5">
              <div className="flex justify-between items-center text-sm font-bold text-primary">
                <span>Total Accrual Revenue (Billed)</span>
                <span>{summary?.income ? fmt(summary.income.total_accrual) : '₹...'}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-emerald-600">
                <span>Total Cash Inflow (Collected)</span>
                <span>{summary?.income ? fmt(summary.income.total_cash_inflow) : '₹...'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Expense Columns */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold font-headline uppercase tracking-widest text-red-600 flex items-center gap-2 pb-2 border-b border-gray-100">
            <span className="material-symbols-outlined text-lg">trending_down</span>
            Expenses & Outflows Breakdown
          </h3>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface-variant font-medium">Staff Salaries Paid</span>
              <span className="font-bold text-on-surface">{summary?.expense ? fmt(summary.expense.staff_payments) : '₹...'}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface-variant font-medium">Parts Inventory Purchases</span>
              <span className="font-bold text-on-surface">{summary?.expense ? fmt(summary.expense.parts_purchases) : '₹...'}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface-variant font-medium">Other Operating Expenses</span>
              <span className="font-bold text-on-surface">{summary?.expense ? fmt(summary.expense.other_expenses) : '₹...'}</span>
            </div>
            <div className="pt-3 border-t border-dashed border-gray-200 space-y-1.5">
              <div className="flex justify-between items-center text-sm font-bold text-red-600 pt-6">
                <span>Total Operating Expenses</span>
                <span>{summary?.expense ? fmt(summary.expense.total) : '₹...'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Cash Entry Form */}
        <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <span className="material-symbols-outlined">add_card</span>
            </div>
            <h3 className="text-lg font-headline font-bold text-on-surface">New Transaction</h3>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Company / Vertical</label>
              <select value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer transition-all">
                <option value="Detailing Studio">Detailing Studio</option>
                <option value="Car Wash">Car Wash</option>
                <option value="Accessories">Accessories</option>
                <option value="General">General Workshop</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Payment Mode</label>
              <select value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer transition-all">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Amount (₹) *</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold transition-all">
                {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="Custom">+ Add New Custom Category...</option>
              </select>
            </div>
            {form.category === 'Custom' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Custom Category Name</label>
                <input type="text" value={form.custom_category} onChange={e => setForm({ ...form, custom_category: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Enter custom category" />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Description *</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder="Enter transaction details..." rows={3}></textarea>
            </div>
            <div className="pt-4 grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 border-t border-gray-100">
              <button onClick={() => handleCashEntry('in')} disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 disabled:opacity-50 active:scale-[0.98]" type="button">
                <span className="material-symbols-outlined text-base">arrow_downward</span> Cash In (Income)
              </button>
              <button onClick={() => handleCashEntry('out')} disabled={saving}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-md shadow-red-600/20 disabled:opacity-50 active:scale-[0.98]" type="button">
                <span className="material-symbols-outlined text-base">arrow_upward</span> Cash Out (Expense)
              </button>
            </div>
          </div>
        </div>

        {/* Financial Ledger */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
          <div className="px-6 py-5 flex justify-between items-center border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg text-slate-600">
                <span className="material-symbols-outlined">receipt_long</span>
              </div>
              <div>
                <h3 className="text-lg font-headline font-bold text-on-surface">Financial Ledger</h3>
                <p className="text-xs text-on-surface-variant font-medium">
                  {selectedCompany} Transactions
                </p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-gray-50/50">
                <tr className="border-b border-gray-100">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Description & Ref</th>
                  <th className="py-3 px-3 text-center">Company</th>
                  <th className="py-3 px-3 text-center">Type</th>
                  <th className="py-3 px-5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm font-medium text-on-surface-variant">Syncing ledger records...</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm font-medium text-on-surface-variant">No transactions found for {selectedCompany}.</td></tr>
                ) : (
                  transactions.slice(0, 25).map((t, i) => {
                    const style = getTypeStyle(t.type);
                    const compStyle = getCompanyBadge(t.company);
                    return (
                      <tr key={i} className="hover:bg-gray-50 transition-colors border-b border-gray-50 group">
                        <td className="px-5 py-3.5 text-xs font-bold text-on-surface-variant whitespace-nowrap">{fmtDate(t.date)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-on-surface truncate max-w-[260px]" title={t.description}>{t.description}</span>
                            <span className="text-[10px] font-mono text-on-surface-variant mt-0.5">{t.reference.toUpperCase()}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${compStyle.bg}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{compStyle.icon}</span>
                            {compStyle.label}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] uppercase tracking-widest font-bold border ${style.bg}`}>
                            {style.label}
                          </span>
                        </td>
                        <td className={`px-5 py-3.5 text-sm font-extrabold text-right whitespace-nowrap ${style.txtClass}`}>
                          {style.sign} {fmt(t.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && transactions.length > 0 && (
            <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center mt-auto">
              <p className="text-xs font-semibold text-on-surface-variant">Showing latest {Math.min(25, transactions.length)} of {transactions.length} records</p>
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}

