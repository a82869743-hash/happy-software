import { useState, useEffect } from 'react';
import api from '../api/axios';
import AnimatedPage from '../components/shared/AnimatedPage';
import { showToast } from '../components/shared/Toast';
import { formatCurrency } from '../utils/format';

interface StaffOption { id: number; full_name: string; monthly_salary: number; }
interface PaymentRecord {
  id: number; staff_name: string; staff_code: string; payment_date: string;
  payment_month: string; payment_type: string; payment_mode: string;
  paid_amount: number; calculated_salary: number; days_present: number; notes: string;
}
interface CalcResult {
  staff_name: string;
  monthly_salary: number;
  days_present: number;
  half_days: number;
  effective_days: number;
  total_days_in_month: number;
  calculated_salary: number;
  total_advance: number;
  net_salary: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const CURRENT_MONTH = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
const INITIAL_MONTH_NAME = new Date().toLocaleString('en-US', { month: 'long' });
const INITIAL_YEAR = new Date().getFullYear();
const YEARS_LIST = Array.from({ length: 6 }, (_, i) => INITIAL_YEAR - 3 + i);

export default function Salary() {
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [calc, setCalc] = useState<CalcResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [advanceDeducted, setAdvanceDeducted] = useState<string>('');

  const [filterStaff, setFilterStaff] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const [paymentMonthName, setPaymentMonthName] = useState(INITIAL_MONTH_NAME);
  const [paymentYear, setPaymentYear] = useState(INITIAL_YEAR);

  const [form, setForm] = useState({
    staff_id: '', payment_month: CURRENT_MONTH, paid_amount: '',
    payment_type: 'salary', payment_mode: 'cash', notes: ''
  });

  useEffect(() => {
    setForm(f => ({ ...f, payment_month: `${paymentMonthName} ${paymentYear}` }));
  }, [paymentMonthName, paymentYear]);

  useEffect(() => {
    api.get('/staff', { params: { is_active: 1 } }).then(r => setStaffList(r.data.data)).catch(() => {});
  }, []);

  const fetchPayments = async () => {
    setLoadingHistory(true);
    try {
      const params: Record<string, string> = {};
      if (filterStaff) params.staff_id = filterStaff;
      if (filterMonth) params.payment_month = filterMonth;
      const res = await api.get('/salary', { params });
      setPayments(res.data.data);
    } catch { /* ignore */ } finally { setLoadingHistory(false); }
  };

  useEffect(() => { fetchPayments(); }, [filterStaff, filterMonth]);

  const handleCalculate = async (overrideStaffId?: string, overrideMonth?: string) => {
    const targetStaffId = overrideStaffId || form.staff_id;
    const targetMonthStr = overrideMonth || form.payment_month;

    if (!targetStaffId || !targetMonthStr) {
      return;
    }
    setCalculating(true);
    try {
      const parts = targetMonthStr.match(/(\w+)\s+(\d{4})/);
      if (!parts) return;
      const monthNum = MONTH_NAMES.indexOf(parts[1]) + 1;
      if (monthNum === 0) return;
      const res = await api.get(`/salary/calculate/${targetStaffId}`, { params: { month: monthNum, year: parts[2] } });
      setCalc(res.data);
      const adv = res.data.total_advance || 0;
      setAdvanceDeducted(String(adv));
      const net = Math.max(0, (res.data.calculated_salary || 0) - adv);
      setForm(f => ({ ...f, paid_amount: String(net) }));
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Calculation failed', 'error');
    } finally { setCalculating(false); }
  };

  useEffect(() => {
    if (form.staff_id && form.payment_month) {
      handleCalculate(form.staff_id, form.payment_month);
    } else {
      setCalc(null);
      setAdvanceDeducted('');
    }
  }, [form.staff_id, form.payment_month]);

  const handleSubmit = async () => {
    if (!form.staff_id || form.paid_amount === '' || !form.payment_month) {
      showToast('Fill required fields', 'error'); return;
    }
    setSaving(true);
    try {
      await api.post('/salary', {
        staff_id: parseInt(form.staff_id),
        payment_date: new Date().toISOString().slice(0, 10),
        payment_month: form.payment_month,
        days_present: calc?.days_present || 0,
        calculated_salary: calc?.calculated_salary || 0,
        paid_amount: parseFloat(form.paid_amount),
        payment_type: form.payment_type,
        payment_mode: form.payment_mode,
        notes: form.notes,
        advance_deducted: parseFloat(advanceDeducted) || 0
      });
      showToast('Payment recorded', 'success');
      setForm({ staff_id: '', payment_month: CURRENT_MONTH, paid_amount: '', payment_type: 'salary', payment_mode: 'cash', notes: '' });
      setPaymentMonthName(INITIAL_MONTH_NAME);
      setPaymentYear(INITIAL_YEAR);
      setCalc(null);
      setAdvanceDeducted('');
      fetchPayments();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    } finally { setSaving(false); }
  };

  const fmt = (n: any) => formatCurrency(n, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const totalDisbursed = payments.reduce((sum, p) => sum + p.paid_amount, 0);

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 p-4 sm:p-8 space-y-8">
      {/* Page Header */}
      <header>
        <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface">Salary & Payments</h2>
        <p className="text-on-surface-variant font-medium mt-1">Process payroll and view payment history</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

        {/* Section 1: Process Payroll */}
        <div className="xl:col-span-4 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <h3 className="text-lg font-bold font-headline">Process Payroll</h3>
          </div>

          <div className="p-6 space-y-5">
            {/* Staff Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Select Staff</label>
              <select
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={form.staff_id} onChange={e => { setForm(f => ({ ...f, staff_id: e.target.value })); setCalc(null); }}
              >
                <option value="">Choose staff...</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name} (Base: {fmt(s.monthly_salary)})</option>)}
              </select>
            </div>

            {/* Payment Month */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Payment Month</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  value={paymentMonthName}
                  onChange={e => setPaymentMonthName(e.target.value)}
                >
                  {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  value={paymentYear}
                  onChange={e => setPaymentYear(parseInt(e.target.value))}
                >
                  {YEARS_LIST.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Calculate Button */}
            <button
              className="w-full bg-white border-2 border-primary/20 text-primary py-3 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary/5 transition-all active:scale-[0.98] disabled:opacity-50"
              onClick={() => handleCalculate()} disabled={calculating}
            >
              <span className="material-symbols-outlined text-sm">calculate</span>
              {calculating ? 'Syncing...' : 'Autofill via Attendance'}
            </button>

            {/* Calculation Result */}
            {calc && (
              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-3">
                <div className="grid grid-cols-3 gap-2 pb-2 border-b border-primary/10">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Month Days</span>
                    <span className="font-mono font-bold text-primary text-xs">{calc.total_days_in_month} Days</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Present/Half</span>
                    <span className="font-mono font-bold text-primary text-xs">{calc.days_present}P / {calc.half_days}H</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Effective</span>
                    <span className="font-mono font-bold text-primary text-xs">{calc.effective_days} Days</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-on-surface-variant font-medium">
                    <span>Base Salary:</span>
                    <span className="font-mono">{fmt(calc.monthly_salary)}</span>
                  </div>
                  <div className="flex justify-between text-on-surface font-semibold">
                    <span>Gross (Pro-rated):</span>
                    <span className="font-mono">{fmt(calc.calculated_salary)}</span>
                  </div>
                  
                  {calc.total_advance > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-dashed border-primary/20">
                      <div className="flex justify-between items-center text-amber-700 font-semibold text-xs">
                        <span>Total Advance Taken:</span>
                        <span className="font-mono font-bold">{fmt(calc.total_advance)}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <label className="text-[11px] font-bold text-red-600">Advance to Deduct (₹):</label>
                        <input
                          type="number"
                          min="0"
                          max={calc.total_advance}
                          className="w-28 bg-white border border-red-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-red-600 focus:outline-none focus:ring-1 focus:ring-red-400 text-right"
                          value={advanceDeducted}
                          onChange={e => {
                            const val = e.target.value;
                            setAdvanceDeducted(val);
                            const numAdv = parseFloat(val) || 0;
                            const net = Math.max(0, (calc.calculated_salary || 0) - numAdv);
                            setForm(f => ({ ...f, paid_amount: String(net) }));
                          }}
                          placeholder="Deduct amount"
                        />
                      </div>
                      <div className="flex justify-between items-center text-slate-600 font-medium text-[11px] pt-1">
                        <span>Remaining Advance:</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {fmt(Math.max(0, calc.total_advance - (parseFloat(advanceDeducted) || 0)))}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between text-primary font-bold text-sm pt-2 border-t border-dashed border-primary/20">
                    <span>Net Payable:</span>
                    <span className="font-mono">{fmt(Math.max(0, (calc.calculated_salary || 0) - (parseFloat(advanceDeducted) || 0)))}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Final Payout Amount */}
            <div className="space-y-2 border-t border-gray-100 pt-4">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Final Payout Amount (₹)</label>
              <input
                type="number"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={form.paid_amount} onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))} placeholder="Amount to process"
              />
            </div>

            {/* Type & Mode */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Type</label>
                <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
                  value={form.payment_type} onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))}>
                  <option value="salary">Full Salary</option>
                  <option value="advance">Advance</option>
                  <option value="bonus">Bonus</option>
                  <option value="deduction">Deduction</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Mode</label>
                <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs uppercase cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
                  value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}>
                  <option value="cash">Cash</option><option value="bank">Bank</option><option value="upi">UPI</option>
                </select>
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Remarks</label>
              <input className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm italic focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional clearance notes..."
              />
            </div>

            {/* Submit */}
            <button
              className="w-full bg-primary hover:bg-primary/90 text-white py-3.5 rounded-xl text-sm font-bold flex items-center gap-2 justify-center transition-all shadow-md shadow-primary/20 active:scale-[0.98] disabled:opacity-50"
              onClick={handleSubmit} disabled={saving}
            >
              <span className="material-symbols-outlined text-lg">verified</span>
              {saving ? 'Processing...' : 'Issue Payment'}
            </button>
          </div>
        </div>

        {/* Section 2: Payment History Ledger */}
        <div className="xl:col-span-8 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[600px] overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg text-slate-600">
                <span className="material-symbols-outlined">article</span>
              </div>
              <h3 className="text-lg font-bold font-headline">Payment History</h3>
            </div>
            <div className="flex gap-3 bg-gray-50 p-1.5 rounded-xl border border-gray-100 w-full sm:w-auto">
              <select className="bg-transparent border-none text-xs font-bold font-label uppercase text-primary focus:ring-0 outline-none cursor-pointer p-1.5 flex-1 sm:flex-initial"
                value={filterStaff} onChange={e => setFilterStaff(e.target.value)}>
                <option value="">All Staff</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              <input className="bg-transparent border-none border-l border-gray-200 pl-3 w-full sm:w-32 text-xs font-bold font-label text-primary focus:ring-0 outline-none p-1.5"
                placeholder="Filter Month.." value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              />
            </div>
          </div>

          {/* Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-4 bg-gray-50/50 border-b border-gray-100">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Records</span>
              <span className="text-xl font-extrabold font-headline text-primary">{payments.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total Disbursed</span>
              <span className="text-xl font-extrabold font-headline text-red-600">{fmt(totalDisbursed)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Active Staff</span>
              <span className="text-xl font-extrabold font-headline text-slate-600">{staffList.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left min-w-[700px]">
              <thead className="text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-gray-50/30">
                <tr className="border-b border-gray-100">
                  <th className="py-3 px-6">Processed</th>
                  <th className="py-3 px-6">Beneficiary</th>
                  <th className="py-3 px-6">Cycle</th>
                  <th className="py-3 px-6">Type & Ref</th>
                  <th className="py-3 px-6 text-right">Sum Disbursed</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loadingHistory ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm font-semibold text-on-surface-variant">Retrieving history...</td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm font-semibold text-on-surface-variant">No salary records found matching filters.</td></tr>
                ) : (
                  payments.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors border-b border-gray-50 group">
                      <td className="px-6 py-4 text-xs font-bold text-on-surface-variant">{fmtDate(p.payment_date)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {p.staff_name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-semibold text-on-surface block">{p.staff_name}</span>
                            <span className="text-[10px] text-on-surface-variant font-mono">{p.staff_code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-primary">{p.payment_month}</td>
                      <td className="px-6 py-4 text-xs">
                        <span className="uppercase font-bold tracking-wider text-primary mr-2 block">{p.payment_type}</span>
                        <span className="text-[10px] text-on-surface-variant uppercase">{p.payment_mode} • {p.notes || '-'}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-extrabold text-red-600 text-right">
                        - {fmt(p.paid_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AnimatedPage>
  );
}
