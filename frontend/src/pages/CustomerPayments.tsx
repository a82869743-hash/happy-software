import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import AnimatedPage from '../components/shared/AnimatedPage';
import { showToast } from '../components/shared/Toast';
import { numberToWordsRupees } from '../utils/numberToWords';
import { useKillSwitchLock } from '../hooks/useKillSwitchLock';
import { getDivisionConfig, generateUPIQrCode, numberToWords, fmtCurrency } from '../utils/invoiceFormat';
interface Payment {
  id: number;
  job_card_id?: number | null;
  estimate_id?: number | null;
  staff_id?: number | null;
  amount: number;
  payment_mode: string;
  transaction_id: string | null;
  payment_date: string;
  remarks: string | null;
  created_by_name: string | null;
  staff_name?: string | null;
  job_no: string;
  estimate_no?: string;
  invoice_no?: string;
  reg_no: string;
  car_name: string;
  owner_name: string;
  company?: string;
  service_type?: string;
  services_json?: string;
  is_quick_job?: number | boolean;
  record_source?: string;
  accessory_sale_id?: number;
}

const MODES = [
  { value: 'cash', label: 'Cash', icon: 'payments' },
  { value: 'upi', label: 'UPI', icon: 'qr_code_2' },
  { value: 'card', label: 'Card', icon: 'credit_card' },
  { value: 'bank_transfer', label: 'Bank', icon: 'account_balance' },
];

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function PaymentFormModal({ prefill, onClose, onSaved }: { prefill?: any; onClose: () => void; onSaved: () => void }) {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    job_card_id: prefill?.job_card_id || '',
    estimate_id: prefill?.estimate_id || '',
    staff_id: prefill?.staff_id || '',
    amount: prefill?.amount || '',
    payment_mode: 'cash',
    transaction_id: '',
    payment_date: new Date().toISOString().slice(0, 10),
    remarks: '',
  });
  const [targetType, setTargetType] = useState<'job_card' | 'estimate'>(prefill?.targetType || 'job_card');
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [settleAsDiscount, setSettleAsDiscount] = useState(false);
  const [staffList, setStaffList] = useState<Array<{ id: number; name: string; role?: string }>>([]);

  useEffect(() => {
    api.get('/staff-ledger/tabs')
      .then(r => {
        const tabs = r.data?.data || [];
        const staffMembers = tabs.filter((t: any) => t.id !== null).map((t: any) => ({
          id: t.id,
          name: t.name,
          role: t.role
        }));
        setStaffList(staffMembers);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const estId = searchParams.get('estimate_id');
    const estNo = searchParams.get('estimate_no');
    if (estId && estNo) {
      setTargetType('estimate');
      setForm(f => ({ ...f, estimate_id: estId }));
      setSelectedJobLabel(`${estNo}`);
      setCarSearch(estNo);
    }
  }, [searchParams]);

  const [carSearch, setCarSearch] = useState(prefill?.carSearch || '');
  const [carSuggestions, setCarSuggestions] = useState<any[]>([]);
  const [showCarDropdown, setShowCarDropdown] = useState(false);
  const [selectedJobLabel, setSelectedJobLabel] = useState(prefill?.selectedJobLabel || '');

  const [allTargetList, setAllTargetList] = useState<any[]>([]);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>(prefill?.customerName || '');

  useEffect(() => {
    if (prefill?.customerName) {
      setSelectedCustomerName(prefill.customerName);
    }
  }, [prefill]);

  useEffect(() => {
    const endpoint = targetType === 'job_card' ? '/job-cards' : '/estimate-jobs';
    api.get(endpoint, { params: { limit: 200 } })
      .then(r => setAllTargetList(r.data.data || []))
      .catch(() => setAllTargetList([]));
  }, [targetType]);

  const customerOptions = Array.from(
    allTargetList.reduce((map: Map<string, any>, item: any) => {
      const name = (item.owner_name || item.customer_name || '').trim();
      if (name) {
        if (!map.has(name)) {
          map.set(name, { name, items: [] });
        }
        map.get(name).items.push(item);
      }
      return map;
    }, new Map<string, any>()).values()
  );

  const handleCarSearch = async (val: string, forceShowAll = false) => {
    setCarSearch(val);
    setForm(f => ({ ...f, job_card_id: '', estimate_id: '' }));
    setSelectedJobLabel('');
    setSummary(null);
    if (!forceShowAll && (!val || val.length < 2)) {
      setCarSuggestions([]);
      setShowCarDropdown(false);
      return;
    }
    try {
      if (targetType === 'job_card') {
        const res = await api.get('/job-cards', { params: { search: val || undefined, limit: 20 } });
        setCarSuggestions(res.data.data || []);
      } else {
        const res = await api.get('/estimate-jobs', { params: { search: val || undefined, limit: 20 } });
        setCarSuggestions(res.data.data || []);
      }
      setShowCarDropdown(true);
    } catch {
      setCarSuggestions([]);
      setShowCarDropdown(false);
    }
  };

  const selectCarJob = (item: any) => {
    if (targetType === 'job_card') {
      setForm(f => ({ ...f, job_card_id: String(item.id), estimate_id: '' }));
      setSelectedJobLabel(`${item.job_no} — ${item.reg_no} (${item.owner_name || ''})`);
      setCarSearch(item.reg_no || item.job_no);
    } else {
      if (item.job_card_id) {
        setForm(f => ({ ...f, job_card_id: String(item.job_card_id), estimate_id: '' }));
        setSelectedJobLabel(`${item.estimate_no || item.job_no} — ${item.reg_no} (${item.customer_name || item.owner_name || ''})`);
        setCarSearch(item.reg_no || item.estimate_no || item.job_no);
      } else {
        setForm(f => ({ ...f, estimate_id: String(item.id), job_card_id: '' }));
        setSelectedJobLabel(`${item.estimate_no} — ${item.reg_no} (${item.customer_name || ''})`);
        setCarSearch(item.reg_no || item.estimate_no);
      }
    }
    setShowCarDropdown(false);
    setCarSuggestions([]);
  };

  useEffect(() => {
    if (form.job_card_id && parseInt(form.job_card_id) > 0) {
      api.get(`/customer-payments/summary/${form.job_card_id}`).then(r => setSummary(r.data)).catch(() => setSummary(null));
    } else if (form.estimate_id && parseInt(form.estimate_id) > 0) {
      api.get(`/customer-payments/summary/estimate/${form.estimate_id}`).then(r => setSummary(r.data)).catch(() => setSummary(null));
    }
  }, [form.job_card_id, form.estimate_id]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (saving) return;
    const hasSelection = form.job_card_id || form.estimate_id;
    if (!hasSelection || !form.amount || !form.payment_mode) {
      showToast('Selection, amount and mode required', 'error'); return;
    }
    setSaving(true);
    try {
      const payload: any = {
        amount: parseFloat(form.amount),
        payment_mode: form.payment_mode,
        transaction_id: form.transaction_id,
        payment_date: form.payment_date,
        remarks: form.remarks
      };
      if (form.job_card_id) {
        payload.job_card_id = parseInt(form.job_card_id);
      }
      if (form.estimate_id) {
        payload.estimate_id = parseInt(form.estimate_id);
      }
      if (form.staff_id) {
        payload.staff_id = parseInt(form.staff_id);
      }
      await api.post('/customer-payments', payload);

      if (settleAsDiscount && summary) {
        const discountAmt = parseFloat((summary.outstanding - parseFloat(form.amount)).toFixed(2));
        if (discountAmt > 0) {
          const discountPayload = {
            ...payload,
            amount: discountAmt,
            payment_mode: 'discount',
            transaction_id: '',
            remarks: form.remarks ? `${form.remarks} - Settlement Discount` : 'Settlement Discount'
          };
          await api.post('/customer-payments', discountPayload);
        }
      }

      showToast('Payment recorded', 'success'); onSaved(); onClose();
    } catch { showToast('Failed to record payment', 'error'); }
    finally { setSaving(false); }
  };

  const cls = 'w-full px-3 py-2.5 bg-surface border border-gray-200 rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';
  const lbl = 'block text-[10px] font-bold uppercase tracking-widest text-on-surface-muted mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} className="relative bg-surface-card rounded-2xl shadow-2xl w-[95vw] sm:w-full max-w-md z-10">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center"><span className="material-symbols-outlined text-emerald-600 text-xl">payments</span></div>
            <div><h2 className="font-headline font-extrabold text-on-surface text-base">Record Payment</h2><p className="text-[11px] text-on-surface-muted">Against Detailing Studio Order / Bill</p></div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><span className="material-symbols-outlined text-on-surface-muted">close</span></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Target Type Selector */}
          <div>
            <label className={lbl}>Record Payment Against</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetType('job_card');
                  setForm(f => ({ ...f, job_card_id: '', estimate_id: '' }));
                  setCarSearch('');
                  setSelectedJobLabel('');
                  setSummary(null);
                  setTimeout(() => {
                    const res = api.get('/job-cards', { params: { limit: 8 } });
                    res.then(r => {
                      setCarSuggestions(r.data.data || []);
                      setShowCarDropdown(true);
                    }).catch(() => {});
                  }, 50);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider border-2 transition-all ${
                  targetType === 'job_card' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Detailing Studio / Workshop Order
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetType('estimate');
                  setForm(f => ({ ...f, job_card_id: '', estimate_id: '' }));
                  setCarSearch('');
                  setSelectedJobLabel('');
                  setSummary(null);
                  setTimeout(() => {
                    const res = api.get('/estimate-jobs', { params: { limit: 8 } });
                    res.then(r => {
                      setCarSuggestions(r.data.data || []);
                      setShowCarDropdown(true);
                    }).catch(() => {});
                  }, 50);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider border-2 transition-all ${
                  targetType === 'estimate' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Direct Workshop Bill
              </button>
            </div>
          </div>
          {/* Multi-Vehicle Customer Select Dropdown */}
          <div className="space-y-1">
            <label className={lbl}>Filter by Customer / Multi-Car Owner</label>
            <select
              className={cls}
              value={selectedCustomerName}
              onChange={e => {
                const name = e.target.value;
                setSelectedCustomerName(name);
                setForm(f => ({ ...f, job_card_id: '', estimate_id: '' }));
                setSelectedJobLabel('');
                setSummary(null);
                if (name) {
                  const filtered = allTargetList.filter(item => (item.owner_name || item.customer_name || '').trim() === name);
                  setCarSuggestions(filtered);
                  setShowCarDropdown(true);
                } else {
                  setCarSuggestions([]);
                  setShowCarDropdown(false);
                }
              }}
            >
              <option value="">-- All Customers / Fleet Owners --</option>
              {customerOptions.map((c: any) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.items.length} {c.items.length === 1 ? 'Vehicle' : 'Vehicles / Jobs'})
                </option>
              ))}
            </select>
          </div>

          {/* If a customer is selected from dropdown, show direct car pick dropdown */}
          {selectedCustomerName && (
            <div className="space-y-1 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-900 mb-1">
                Select Car Brought by {selectedCustomerName} ({allTargetList.filter(item => (item.owner_name || item.customer_name || '').trim() === selectedCustomerName).length} Vehicles)
              </label>
              <select
                className={cls}
                value={form.job_card_id || form.estimate_id}
                onChange={e => {
                  const selectedId = e.target.value;
                  const filtered = allTargetList.filter(item => (item.owner_name || item.customer_name || '').trim() === selectedCustomerName);
                  const item = filtered.find((c: any) => String(c.id) === selectedId);
                  if (item) selectCarJob(item);
                }}
              >
                <option value="">-- Pick one of {selectedCustomerName}'s vehicles --</option>
                {allTargetList
                  .filter(item => (item.owner_name || item.customer_name || '').trim() === selectedCustomerName)
                  .map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.reg_no || 'No Reg'} ({item.car_name || 'Car'}) — {targetType === 'job_card' ? item.job_no : item.estimate_no}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="relative">
            <label className={lbl}>
              {targetType === 'job_card' ? 'Search Car Number / Job No / Customer Name *' : 'Search Car Number / Order No / Customer Name *'}
            </label>
            <input
              type="text"
              className={cls}
              value={carSearch}
              onChange={e => handleCarSearch(e.target.value)}
              onFocus={() => handleCarSearch(carSearch, true)}
              onBlur={() => setTimeout(() => setShowCarDropdown(false), 200)}
              placeholder={targetType === 'job_card' ? "Type car reg, job no, or customer name..." : "Type car reg, order no, or customer name..."}
              autoComplete="off"
            />
            {showCarDropdown && carSuggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
                <div className="px-3 py-1.5 bg-slate-50 border-b border-gray-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Select Car / Customer Job ({carSuggestions.length} Found)</span>
                  <span className="text-amber-700 font-semibold">Multi-Vehicle Customer Ready</span>
                </div>
                {carSuggestions.map((item: any) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectCarJob(item)}
                    className="w-full text-left px-4 py-3 hover:bg-amber-50/80 flex items-center justify-between border-b border-gray-50 last:border-b-0 transition-colors"
                  >
                    <div>
                      <div className="font-extrabold text-sm text-on-surface flex items-center gap-2">
                        <span className="text-slate-900">{item.reg_no || 'N/A'}</span>
                        <span className="text-xs text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          {item.owner_name || item.customer_name || 'Customer'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-medium flex items-center gap-2">
                        <span>{targetType === 'job_card' ? item.job_no : item.estimate_no}</span>
                        <span>•</span>
                        <span>{item.car_name || 'Vehicle'}</span>
                        {item.mobile_no && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{item.mobile_no}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      targetType === 'job_card'
                        ? (item.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : item.status === 'in_progress' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-amber-100 text-amber-800 border border-amber-200')
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {targetType === 'job_card' ? item.status : 'Estimate'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedJobLabel && (
              <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg w-fit">
                <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                <span className="text-[11px] font-bold text-emerald-700">{selectedJobLabel}</span>
              </div>
            )}
          </div>
          
          {summary && (
            <div className="bg-amber-50/80 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-on-surface-muted">Total Bill</span><span className="font-bold">₹{summary.total_bill?.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-on-surface-muted">Paid</span><span className="font-bold text-emerald-600">₹{summary.total_paid?.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between border-t border-amber-200/50 pt-2"><span className="font-bold text-on-surface">Outstanding</span><span className={`font-bold ${summary.outstanding > 0 ? 'text-red-500' : 'text-emerald-600'}`}>₹{summary.outstanding?.toLocaleString('en-IN')}</span></div>
              {summary.outstanding > 0 && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, amount: String(summary.outstanding) }))}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">done_all</span>
                    Settle Full Amount (₹{summary.outstanding})
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={lbl}>Amount ₹ *</label><input type="number" step="0.01" className={cls} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required /></div>
            <div><label className={lbl}>Date</label><input type="date" className={cls} value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} /></div>
          </div>

          {summary && parseFloat(form.amount) > 0 && parseFloat(form.amount) < summary.outstanding && (
            <div className="flex items-center gap-2 mt-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              <input 
                type="checkbox" 
                id="settleAsDiscount" 
                checked={settleAsDiscount} 
                onChange={e => setSettleAsDiscount(e.target.checked)} 
                className="w-4 h-4 text-primary rounded focus:ring-0 cursor-pointer" 
              />
              <label htmlFor="settleAsDiscount" className="text-xs font-bold text-amber-800 cursor-pointer select-none">
                Settle remaining ₹{(summary.outstanding - parseFloat(form.amount)).toLocaleString('en-IN')} as discount
              </label>
            </div>
          )}

          <div>
            <label className={lbl}>Payment Mode *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MODES.map(m => (
                <button type="button" key={m.value} onClick={() => setForm(f => ({ ...f, payment_mode: m.value }))}
                  className={`p-3 rounded-xl text-center border-2 transition-all ${form.payment_mode === m.value ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="material-symbols-outlined text-xl block mb-1">{m.icon}</span>
                  <span className="text-[10px] font-bold">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={lbl}>RECEIVED BY STAFF (REGISTERED STAFF ACCOUNT)</label>
            <select
              className={cls}
              value={form.staff_id}
              onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
            >
              <option value="">-- Select Registered Staff (Optional) --</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.role ? `(${s.role})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div><label className={lbl}>Transaction ID</label><input className={cls} value={form.transaction_id} onChange={e => setForm(f => ({ ...f, transaction_id: e.target.value }))} placeholder="UPI ref / card last 4" /></div>
          <div><label className={lbl}>Remarks</label><textarea className={cls + ' resize-none'} rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
        </form>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-sm py-2.5 px-5">Cancel</button>
          <button onClick={() => handleSubmit()} disabled={saving} className="btn-primary text-sm py-2.5 px-6 disabled:opacity-60">{saving ? 'Saving...' : 'Record Payment'}</button>
        </div>
      </motion.div>
    </div>
  );
}

function BulkClearModal({
  onClose,
  onCleared,
  sepCount,
  sepAmount,
  totalPendingCount,
  totalPendingAmount,
  selectedIds,
  selectedAmount
}: {
  onClose: () => void;
  onCleared: () => void;
  sepCount: number;
  sepAmount: number;
  totalPendingCount: number;
  totalPendingAmount: number;
  selectedIds: number[];
  selectedAmount: number;
}) {
  const [target, setTarget] = useState<'sep2026' | 'all' | 'selected'>(
    selectedIds.length > 0 ? 'selected' : (sepCount > 0 ? 'sep2026' : 'all')
  );
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('Cleared pending balance from Excel working sheet');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const note = remarks.trim() || 'Cleared pending balance from Excel working sheet';
      if (target === 'sep2026') {
        const res = await api.post('/customer-payments/clear-from-excel-sheet', {
          sheet_name: 'SEP 2026',
          payment_mode: paymentMode,
          payment_date: paymentDate
        });
        showToast(res.data.message || 'September 2026 pending balances settled successfully!', 'success');
      } else if (target === 'selected') {
        const res = await api.post('/customer-payments/bulk-clear-pending', {
          job_card_ids: selectedIds,
          payment_mode: paymentMode,
          payment_date: paymentDate,
          remarks: note
        });
        showToast(res.data.message || `Cleared ${res.data.cleared_count} selected bills`, 'success');
      } else {
        const res = await api.post('/customer-payments/bulk-clear-pending', {
          payment_mode: paymentMode,
          payment_date: paymentDate,
          remarks: note
        });
        showToast(res.data.message || `Cleared all ${res.data.cleared_count} pending bills`, 'success');
      }
      onCleared();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to clear pending balances', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">price_check</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-900 font-headline">Settle / Clear Pending Balances</h2>
              <p className="text-xs text-stone-500">Reconcile outstanding balances into customer payments & cash ledger</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
              Select Settlement Target:
            </label>
            <div className="space-y-2">
              {sepCount > 0 && (
                <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  target === 'sep2026' ? 'border-amber-500 bg-amber-50/50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="clear_target"
                    checked={target === 'sep2026'}
                    onChange={() => setTarget('sep2026')}
                    className="mt-1 text-amber-500 focus:ring-0"
                  />
                  <div>
                    <div className="text-sm font-bold text-stone-900">September 2026 Working Sheet Dues</div>
                    <div className="text-xs text-stone-600 mt-0.5">
                      {sepCount} pending bills • Total <span className="font-bold text-rose-600">₹{sepAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </label>
              )}

              {selectedIds.length > 0 && (
                <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  target === 'selected' ? 'border-amber-500 bg-amber-50/50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="clear_target"
                    checked={target === 'selected'}
                    onChange={() => setTarget('selected')}
                    className="mt-1 text-amber-500 focus:ring-0"
                  />
                  <div>
                    <div className="text-sm font-bold text-stone-900">Selected Bills Only</div>
                    <div className="text-xs text-stone-600 mt-0.5">
                      {selectedIds.length} bills selected • Total <span className="font-bold text-rose-600">₹{selectedAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </label>
              )}

              <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                target === 'all' ? 'border-amber-500 bg-amber-50/50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="clear_target"
                  checked={target === 'all'}
                  onChange={() => setTarget('all')}
                  className="mt-1 text-amber-500 focus:ring-0"
                />
                <div>
                  <div className="text-sm font-bold text-stone-900">All Outstanding Pending Bills</div>
                  <div className="text-xs text-stone-600 mt-0.5">
                    {totalPendingCount} pending bills • Total <span className="font-bold text-rose-600">₹{totalPendingAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Settlement Mode
              </label>
              <select
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI / Online</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Settlement Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Remarks / Note
            </label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500/20"
              placeholder="e.g. Cleared pending balance from Excel working sheet"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-sm font-bold hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm shadow-md flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                  <span>Settling...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  <span>Confirm & Settle</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function printConsolidatedBillSheet({
  clientName,
  phone,
  vehicles = [],
  documents = [],
  totalBilled,
  totalPaid,
  totalPending,
  paymentMode = 'Cash',
  paymentDate,
  receiptNo,
  isSettled = true
}: any) {
  const win = window.open('', '_blank');
  if (!win) return;

  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const serverUrl = baseUrl.replace(/\/api\/?$/, '');
  const primaryLogoUrl = `${window.location.origin}/happy-logo.png`;
  const fallbackLogoUrl = `${serverUrl}/uploads/happy-logo.png`;

  const billNo = receiptNo || `HCW-CSL-${Date.now().toString().slice(-6)}`;
  const dateStr = paymentDate
    ? new Date(paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const amountToWord = numberToWordsRupees(totalPending);

  const uniqueVehiclesCount = new Set(
    documents.map((doc: any) => (doc.reg_no || '').trim().toUpperCase()).filter(Boolean)
  ).size || (vehicles && vehicles.length) || 1;

  const rowsHtml = documents
    .map((doc: any, idx: number) => {
      const dDate =
        doc.job_date || doc.doc_date
          ? new Date(doc.job_date || doc.doc_date).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })
          : '—';
      const veh = doc.reg_no
        ? `${doc.reg_no}${doc.car_name ? ` · ${doc.car_name}` : ''}`
        : doc.car_name || 'Vehicle';
      const sType = doc.service_type || doc.type || 'Car Wash / Detailing';
      const bAmt = parseFloat(String(doc.total_billed || 0));
      const pAmt = parseFloat(String(doc.total_paid || 0));
      const dueAmt = parseFloat(String(doc.balance !== undefined ? doc.balance : bAmt - pAmt));

      return `
      <tr>
        <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td style="white-space: nowrap; color: #334155;">${dDate}</td>
        <td style="font-family: monospace; font-weight: 800; color: #0f172a;">${doc.doc_no || doc.job_no || '—'}</td>
        <td style="font-weight: 700; color: #0f172a;">${veh}</td>
        <td style="color: #1e293b; font-weight: 600;">${sType}</td>
        <td style="text-align: right; font-weight: 600; color: #334155;">₹${bAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align: right; font-weight: 600; color: #059669;">₹${pAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align: right; font-weight: 800; color: #0f172a;">₹${dueAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align: center;">
          <span style="display: inline-block; font-size: 8.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; ${
            isSettled
              ? 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;'
              : 'background: #fff1f2; color: #be123c; border: 1px solid #fecdd3;'
          }">
            ${isSettled ? 'PAID' : 'DUE'}
          </span>
        </td>
      </tr>
    `;
    })
    .join('');

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Consolidated Statement Bill - ${clientName} - ${billNo}</title>
        <style>
          @page { size: A4 portrait; margin: 6mm; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; font-size: 10px; line-height: 1.3; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { page-break-inside: avoid; }
          .summary-sec, .footer-sec, .bottom-section { page-break-inside: avoid; }
          @media print {
            body { padding: 0; }
            .sheet-box { border: 1.5px solid #0f172a !important; box-shadow: none !important; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
          }
          .sheet-box { border: 1.5px solid #0f172a; border-radius: 6px; padding: 12px 16px; max-width: 800px; margin: 0 auto; box-sizing: border-box; }
          .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 8px; }
          .logo-box { width: 110px; vertical-align: top; }
          .logo-box img { max-height: 48px; width: auto; object-fit: contain; }
          .comp-box { vertical-align: top; padding-left: 12px; }
          .comp-name { font-size: 18px; font-weight: 900; letter-spacing: 0.5px; color: #0f172a; margin: 0 0 2px 0; }
          .comp-desc { font-size: 9px; color: #475569; margin: 0; line-height: 1.3; }
          .meta-box { width: 250px; vertical-align: top; text-align: right; }
          .bill-badge { display: inline-block; background: #0f172a; color: #fff; font-size: 9.5px; font-weight: 900; letter-spacing: 0.8px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; margin-bottom: 4px; }
          .meta-row { font-size: 10px; margin: 2px 0; }
          .meta-label { color: #64748b; font-weight: 600; }
          .meta-val { color: #0f172a; font-weight: 800; font-family: monospace; }

          .client-bar { background: #f8fafc; border: 1.2px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
          .c-name { font-size: 12px; font-weight: 900; color: #0f172a; }
          .c-phone { font-size: 10px; color: #475569; font-weight: 600; margin-top: 1px; }
          .c-veh { font-size: 11px; color: #0f172a; font-weight: 800; text-align: right; }

          .tbl { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          .tbl th { background: #0f172a; color: #fff; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 6px; text-align: left; }
          .tbl td { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; font-size: 9.5px; vertical-align: middle; }
          .tbl tbody tr:nth-child(even) { background: #f8fafc; }

          .summary-sec { display: flex; justify-content: space-between; align-items: flex-start; padding-top: 6px; border-top: 1.5px solid #0f172a; margin-top: 6px; }
          .words-sec { flex: 1; padding-right: 15px; }
          .words-lbl { font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
          .words-val { font-size: 10px; font-weight: 800; color: #0f172a; font-style: italic; margin-top: 2px; }
          .status-stamp { margin-top: 6px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 4px; font-weight: 900; font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase; ${
            isSettled
              ? 'background: #ecfdf5; color: #047857; border: 1.2px solid #059669;'
              : 'background: #fff1f2; color: #be123c; border: 1.2px solid #e11d48;'
          } }

          .totals-sec { width: 260px; background: #f8fafc; border: 1.2px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; }
          .t-row { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; }
          .t-final { border-top: 1.2px solid #0f172a; padding-top: 4px; margin-top: 4px; font-size: 13px; font-weight: 900; color: #0f172a; }

          .footer-sec { margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: flex-end; }
          .note-text { font-size: 8.5px; color: #64748b; max-width: 460px; line-height: 1.3; }
          .sign-area { text-align: center; width: 160px; }
          .sign-line { border-bottom: 1.2px solid #0f172a; height: 26px; margin-bottom: 3px; }
          .sign-lbl { font-size: 9px; font-weight: 800; color: #0f172a; }
        </style>
      </head>
      <body>
        <div class="sheet-box">
          <div>
            <!-- Header Table -->
            <table class="header-table">
              <tr>
                <td class="logo-box">
                  <img src="${primaryLogoUrl}" alt="Happy Car Wash Logo" onError="if(this.src!=='${fallbackLogoUrl}'){this.src='${fallbackLogoUrl}';}else{this.style.display='none';this.nextElementSibling.style.display='block';}" />
                  <div style="display:none;">
                    <svg width="100" height="34" viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 30L40 10L30 30L60 10L45 50L10 30Z" fill="#0284C7"/>
                      <text x="70" y="40" font-family="Arial" font-size="32" font-weight="900" fill="#0F172A">HAPPY</text>
                    </svg>
                  </div>
                </td>
                <td class="comp-box">
                  <h1 class="comp-name">Happy Car Wash & Detailing Studio</h1>
                  <p class="comp-desc">
                    8/9 GIDC - Vadsar Main Road Mohangiri, opp. Uma Co Op Bank Ltd, near Bank Of Baroda, Makarpura, Vadodara, Gujarat 390010<br/>
                    Phone: <strong>+91 99986 25511</strong> | Complete Auto Care & Fleet Services
                  </p>
                </td>
                <td class="meta-box">
                  <div class="bill-badge">${isSettled ? 'CONSOLIDATED SETTLEMENT BILL' : 'CONSOLIDATED STATEMENT BILL'}</div>
                  <div class="meta-row"><span class="meta-label">Bill / Stmt No:</span> <span class="meta-val">${billNo}</span></div>
                  <div class="meta-row"><span class="meta-label">Date:</span> <span class="meta-val">${dateStr}</span></div>
                  <div class="meta-row"><span class="meta-label">Payment Mode:</span> <span class="meta-val">${paymentMode.toUpperCase()}</span></div>
                </td>
              </tr>
            </table>

            <!-- Client & Fleet Account Bar -->
            <div class="client-bar">
              <div>
                <div class="c-name">Billed To: ${clientName}</div>
                <div class="c-phone">Phone: ${phone || '—'}</div>
              </div>
              <div class="c-veh">
                Total Vehicles: <strong>${uniqueVehiclesCount}</strong> &nbsp;•&nbsp; Total Jobs: <strong>${documents.length}</strong>
              </div>
            </div>

            <!-- Crisp Items Table -->
            <table class="tbl">
              <thead>
                <tr>
                  <th style="width: 26px; text-align: center;">#</th>
                  <th style="width: 75px;">Date</th>
                  <th style="width: 85px;">Doc / Job No</th>
                  <th style="width: 140px;">Vehicle (Reg & Model)</th>
                  <th>Service / Description</th>
                  <th style="width: 75px; text-align: right;">Billed ₹</th>
                  <th style="width: 70px; text-align: right;">Paid ₹</th>
                  <th style="width: 75px; text-align: right;">${isSettled ? 'Settled ₹' : 'Due ₹'}</th>
                  <th style="width: 55px; text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Bottom Section: Summary & Signatures -->
          <div>
            <div class="summary-sec">
              <div class="words-sec">
                <div class="words-lbl">Amount in Words:</div>
                <div class="words-val">${amountToWord || 'Zero Rupees'}</div>
                <div class="status-stamp">
                  ${isSettled ? '✓ Paid & Settled in Full' : '⏳ Pending Statement of Dues'}
                </div>
              </div>
              <div class="totals-sec">
                <div class="t-row"><span style="color:#64748b;">Total Billed Gross:</span> <span style="font-weight:700;">₹${totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                ${totalPaid > 0 ? `<div class="t-row"><span style="color:#64748b;">Previously Paid:</span> <span style="color:#059669; font-weight:700;">₹${totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>` : ''}
                <div class="t-row"><span style="color:#64748b;">${isSettled ? 'Settled in Full:' : 'Net Pending Due:'}</span> <span style="font-weight:800; color:#0f172a;">₹${totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div class="t-row t-final">
                  <span>${isSettled ? 'Net Balance Due:' : 'Total Payable:'}</span>
                  <span style="${isSettled ? 'color:#059669;' : 'color:#dc2626;'}">${isSettled ? '₹0.00 (PAID)' : '₹' + totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div class="footer-sec">
              <div class="note-text">
                This is a computer-generated consolidated tax statement / bill of all jobs & vehicles cleared for the above customer. All services inspected and delivered satisfactorily. Thank you for choosing Happy Car Wash!
              </div>
              <div class="sign-area">
                <div class="sign-line"></div>
                <div class="sign-lbl">Authorized Signatory</div>
              </div>
            </div>
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `);
  win.document.close();
}

function ConsolidatedSettlementModal({
  client,
  onClose,
  onSettled
}: {
  client: any;
  onClose: () => void;
  onSettled: () => void;
}) {
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState(`Consolidated settlement for ${client.clientName}`);
  const [saving, setSaving] = useState(false);

  const handleSettleAndPrint = async () => {
    try {
      setSaving(true);
      const jobCardIds = client.documents.filter((d: any) => d.job_card_id).map((d: any) => d.job_card_id);
      const estimateIds = client.documents.filter((d: any) => d.estimate_id).map((d: any) => d.estimate_id);

      const res = await api.post('/customer-payments/bulk-clear-pending', {
        job_card_ids: jobCardIds,
        estimate_ids: estimateIds,
        customer_name: client.clientName,
        payment_mode: paymentMode,
        payment_date: paymentDate,
        remarks: remarks.trim() || `Consolidated settlement for ${client.clientName}`
      });

      showToast(
        res.data.message ||
          `Cleared ${res.data.cleared_count} bills totaling ₹${client.totalPending.toLocaleString('en-IN')}`,
        'success'
      );

      // Print Consolidated Bill Sheet
      printConsolidatedBillSheet({
        clientName: client.clientName,
        phone: client.phone,
        vehicles: client.vehicles,
        documents: client.documents,
        totalBilled: client.totalBilled,
        totalPaid: client.totalPaid + client.totalPending,
        totalPending: client.totalPending,
        paymentMode: paymentMode,
        paymentDate: paymentDate,
        receiptNo: `HCW-CSL-${Date.now().toString().slice(-6)}`,
        isSettled: true
      });

      onSettled();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to settle consolidated balance', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintStatementOnly = () => {
    printConsolidatedBillSheet({
      clientName: client.clientName,
      phone: client.phone,
      vehicles: client.vehicles,
      documents: client.documents,
      totalBilled: client.totalBilled,
      totalPaid: client.totalPaid,
      totalPending: client.totalPending,
      paymentMode: paymentMode,
      paymentDate: paymentDate,
      receiptNo: `HCW-STMT-${Date.now().toString().slice(-6)}`,
      isSettled: false
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-stone-950 font-black text-sm flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-900 font-headline">
                Consolidated Settlement: {client.clientName}
              </h2>
              <p className="text-xs text-stone-500">
                Settle all {client.documents.length} pending bills across {client.vehicles.length} vehicle(s) in a single go
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Summary Dues Banner */}
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider">
              Total Outstanding Across All Vehicles
            </div>
            <div className="text-2xl font-black text-rose-600 font-headline">
              ₹{client.totalPending.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-stone-600 mt-0.5">
              Phone: <span className="font-mono font-bold text-stone-800">{client.phone || '—'}</span> &nbsp;•&nbsp; Total Billed: ₹{client.totalBilled.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="px-2.5 py-1 bg-stone-900 text-amber-400 text-xs font-black uppercase tracking-wider rounded-lg">
              {client.documents.length} Unpaid Jobs
            </span>
            <span className="text-[11px] text-stone-500 font-semibold">
              {client.vehicles.map((v: any) => v.reg_no).join(', ')}
            </span>
          </div>
        </div>

        {/* Itemized Table Preview */}
        <div className="max-h-48 overflow-y-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-100 sticky top-0 text-[10px] uppercase font-black text-stone-600 tracking-wider">
              <tr>
                <th className="p-2">#</th>
                <th className="p-2">Doc No</th>
                <th className="p-2">Vehicle</th>
                <th className="p-2">Service</th>
                <th className="p-2 text-right">Billed</th>
                <th className="p-2 text-right">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {client.documents.map((d: any, i: number) => (
                <tr key={i} className="hover:bg-amber-50/40">
                  <td className="p-2 text-stone-400 font-bold">{i + 1}</td>
                  <td className="p-2 font-mono font-bold text-stone-900">{d.doc_no || d.job_no}</td>
                  <td className="p-2 font-bold text-stone-800">{d.reg_no} <span className="text-stone-400 font-normal">({d.car_name || 'Car'})</span></td>
                  <td className="p-2 text-stone-600 font-medium">{d.service_type || d.type || 'Wash'}</td>
                  <td className="p-2 text-right font-medium text-stone-500">₹{parseFloat(String(d.total_billed || 0)).toLocaleString('en-IN')}</td>
                  <td className="p-2 text-right font-black text-rose-600">₹{parseFloat(String(d.balance || (d.total_billed - d.total_paid))).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Payment Mode
            </label>
            <select
              value={paymentMode}
              onChange={e => setPaymentMode(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI / Online QR</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Settlement Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500/20"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
            Remarks / Reference
          </label>
          <input
            type="text"
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500/20"
            placeholder="e.g. Settle all vehicles in single go"
          />
        </div>

        {/* Footer CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={handlePrintStatementOnly}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Print statement bill without marking paid"
          >
            <span className="material-symbols-outlined text-base">print</span>
            Print Statement Only (Unsettled)
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSettleAndPrint}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-stone-950 hover:bg-stone-900 text-amber-400 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span>Clearing All...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>Confirm, Settle All & Print Single Bill</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

interface HappyPaymentBillModalProps {
  paymentId: number;
  onClose: () => void;
  onPaymentUpdated: (updatedPayment: any) => void;
}

function HappyPaymentBillModal({ paymentId, onClose, onPaymentUpdated }: HappyPaymentBillModalProps) {
  const [loading, setLoading] = useState(true);
  const [billData, setBillData] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staffList, setStaffList] = useState<Array<{ id: number; name: string }>>([]);

  const [editForm, setEditForm] = useState({
    amount: '',
    payment_mode: 'cash',
    payment_date: '',
    transaction_id: '',
    staff_id: '',
    remarks: ''
  });

  const [editCustomer, setEditCustomer] = useState({
    owner_name: '',
    mobile_no: '',
    address: '',
    customer_gstin: '',
    reg_no: '',
    car_name: ''
  });

  interface BillEditableService {
    id: string | number;
    service_name: string;
    hsn_sac: string;
    qty: number;
    rate: number;
    tax_pct: number;
    tax_amount: number;
    amount: number;
    description?: string;
  }

  const [editServices, setEditServices] = useState<BillEditableService[]>([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      api.get(`/customer-payments/${paymentId}`),
      api.get('/staff-ledger/tabs').catch(() => ({ data: { data: [] } }))
    ])
      .then(([payRes, staffRes]) => {
        if (!isMounted) return;
        const pData = payRes.data?.data;
        const sList = (staffRes.data?.data || [])
          .filter((t: any) => t.id !== null)
          .map((t: any) => ({ id: t.id, name: t.name }));
        setStaffList(sList);

        if (pData) {
          setBillData(pData);
          setServices(payRes.data?.services || []);
          setEditForm({
            amount: String(pData.amount || ''),
            payment_mode: pData.payment_mode || 'cash',
            payment_date: pData.payment_date ? String(pData.payment_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
            transaction_id: pData.transaction_id || '',
            staff_id: pData.staff_id ? String(pData.staff_id) : '',
            remarks: pData.remarks || ''
          });
          setEditCustomer({
            owner_name: pData.owner_name || '',
            mobile_no: pData.mobile_no || '',
            address: pData.address || '',
            customer_gstin: pData.customer_gstin || '',
            reg_no: pData.reg_no || '',
            car_name: (pData.record_source === 'product_sale' && pData.car_name === pData.product_name) ? '' : (pData.car_name || pData.vehicle_model || '')
          });

          const rawSvcs = payRes.data?.services || [];
          if (rawSvcs.length > 0) {
            setEditServices(rawSvcs.map((s: any, idx: number) => {
              const q = parseFloat(s.qty || 1) || 1;
              const r = parseFloat(s.rate !== undefined ? s.rate : (s.amount || 0)) || 0;
              const tp = parseFloat(s.tax_pct || 0) || 0;
              const amt = parseFloat((q * r).toFixed(2));
              const taxAmt = parseFloat(s.tax_amount !== undefined ? s.tax_amount : (amt * tp / 100)) || 0;
              return {
                id: s.id || `svc-${idx}`,
                service_name: s.service_name || s.name || '',
                hsn_sac: s.hsn_sac || '998714',
                qty: q,
                rate: r,
                tax_pct: tp,
                tax_amount: taxAmt,
                amount: amt,
                description: s.description || ''
              };
            }));
          } else {
            const billAmt = parseFloat(pData.total_billed || pData.amount || 0) || 0;
            const isWashOverride = /delux|dlx|teflon|taflon/i.test(`${pData.service_type || ''} ${pData.remarks || ''} ${pData.services_json || ''}`);
            const isDet = !isWashOverride && (pData.company === 'Detailing Studio' || /coat|coting|ceram|ciram|ppf|polish|detail|rubb|buff|studio|interior|dry\s*clean|deep\s*clean|graphene|glass|headlight|spa/i.test(`${pData.service_type || ''} ${pData.remarks || ''}`));
            const fallbackSvc = pData.service_type || (isWashOverride ? `Car Wash Service (${pData.job_no || 'Walk-in'})` : isDet ? `Detailing Service (${pData.job_no || 'Walk-in'})` : pData.company === 'Accessories' ? 'Car Accessory Sale' : `Car Wash Service (${pData.job_no || 'Walk-in'})`);
            setEditServices([{
              id: 'svc-0',
              service_name: fallbackSvc,
              hsn_sac: '998714',
              qty: 1,
              rate: billAmt,
              tax_pct: 0,
              tax_amount: 0,
              amount: billAmt,
              description: ''
            }]);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load bill details:', err);
        showToast('Failed to load bill details', 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [paymentId]);

  const serverUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const divisionConfig = useMemo(() => {
    const servicesNames = editServices?.map(s => s.service_name).join(' ') || '';
    const combinedService = `${billData?.service_type || ''} ${servicesNames} ${billData?.remarks || ''}`.trim();
    const isWash = /delux|dlx|teflon|taflon/i.test(combinedService);
    const targetComp = isWash ? 'Car Wash' : billData?.company;
    const targetQuick = isWash ? 1 : billData?.is_quick_job;
    return getDivisionConfig(targetComp, targetQuick, billData?.job_no || billData?.estimate_no, combinedService);
  }, [billData, editServices]);

  useEffect(() => {
    if (billData) {
      const amountVal = parseFloat(String(billData.amount)) || 0;
      const billRef = billData.job_no || billData.estimate_no || `HCW-BILL-${String(billData.id).padStart(4, '0')}`;
      generateUPIQrCode(divisionConfig, amountVal, `Bill ${billRef}`)
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('Failed to generate UPI QR:', err));
    }
  }, [billData, divisionConfig]);

  const handlePrint = async () => {
    if (!billData) return;
    const win = window.open('', '_blank');
    if (!win) return;

    const amountVal = parseFloat(String(billData.amount)) || 0;
    const billNo = billData.job_no || billData.estimate_no || `HCW-BILL-${String(billData.id).padStart(4, '0')}`;
    const dateStr = fmtDate(billData.payment_date);

    let activeQr = qrDataUrl;
    if (!activeQr) {
      try {
        activeQr = await generateUPIQrCode(divisionConfig, amountVal, `Bill ${billNo}`);
      } catch {
        activeQr = '';
      }
    }

    const customerName = billData.owner_name || 'Customer';
    const customerAddress = billData.address ? `${billData.address}${billData.city ? ', ' + billData.city : ''}` : '';
    const customerMobile = billData.mobile_no || '';
    const rawCarName = [billData.car_name, billData.vehicle_model].filter(Boolean).join(' ');
    const isAccProduct = billData.record_source === 'product_sale' && (!billData.car_name || rawCarName === billData.product_name);
    const carName = isAccProduct ? '—' : (rawCarName || '—');
    const regNo = billData.reg_no || '—';

    const servicesList = (services && services.length > 0)
      ? services.map((s: any) => ({
          name: s.service_name || s.name || 'Automotive Service',
          hsn_sac: s.hsn_sac || '998714',
          qty: parseFloat(s.qty) || 1,
          unit: s.unit || 'Pcs',
          rate: parseFloat(s.rate !== undefined ? s.rate : (s.amount || 0)) || 0,
          amount: (parseFloat(s.amount !== undefined ? s.amount : 0) || 0) + (parseFloat(s.tax_amount || 0) || 0)
        }))
      : [{
          name: billData.service_type || `${divisionConfig.title} Service`,
          hsn_sac: '998714',
          qty: 1,
          unit: 'Pcs',
          rate: parseFloat(String(billData.amount || 0)) || 0,
          amount: parseFloat(String(billData.amount || 0)) || 0
        }];

    const totalQty = servicesList.reduce((acc: number, it: any) => acc + (parseFloat(it.qty) || 1), 0);
    const subTotal = servicesList.reduce((acc: number, it: any) => acc + (parseFloat(it.amount) || 0), 0);
    const totalBilled = parseFloat(String(billData.total_billed || billData.amount || subTotal)) || subTotal;
    const paidAmount = parseFloat(String(billData.amount || 0)) || 0;
    const balanceDue = parseFloat(String(billData.balance_due || 0)) || 0;

    const itemsRowsHtml = servicesList.map((svc: any, idx: number) => `
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

    const emptyRowsCount = Math.max(0, 4 - servicesList.length);
    const spacerRowHtml = emptyRowsCount > 0 ? `
      <tr style="height: ${emptyRowsCount * 26}px;">
        <td style="border-right: 1.5px solid #222;"></td>
        <td style="border-right: 1.5px solid #222;"></td>
        <td style="border-right: 1.5px solid #222;"></td>
        <td style="border-right: 1.5px solid #222;"></td>
        <td style="border-right: 1.5px solid #222;"></td>
        <td style="border-right: 1.5px solid #222;"></td>
        <td></td>
      </tr>
    ` : '';

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${divisionConfig.title} - ${billNo}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm 12mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; margin: 0; padding: 12px; background: #fff; font-size: 11px; line-height: 1.4; }
            .invoice-box { background: #fff; border: 1.5px solid #222; max-width: 800px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            @media print {
              body { padding: 0; background: #fff; }
              .invoice-box { border: 1.5px solid #222; box-shadow: none; max-width: 100%; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <!-- Top title -->
            <div style="text-align: center; font-size: 11px; font-weight: 700; padding: 6px 0 2px 0; letter-spacing: 0.5px;">
              Retail Invoice
            </div>

            <!-- Header: Logo + Company Info -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 6px 14px 10px 14px; border-bottom: 1.5px solid #222;">
              <div style="width: 68px; height: 68px; background: #000; border: 1px solid #333; display: flex; align-items: center; justify-content: center;">
                <img src="/happy-logo.png" alt="Logo" style="max-width: 64px; max-height: 64px; object-fit: contain;" onerror="this.style.display='none';" />
              </div>
              <div style="text-align: right;">
                <h1 style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.5px; font-family: serif;">
                  ${divisionConfig.title}
                </h1>
                ${divisionConfig.addressLines.map((line: string) => `<p style="margin: 0; font-size: 10px; line-height: 1.35; color: #222;">${line}</p>`).join('')}
                <p style="margin: 0; font-size: 10px; line-height: 1.35; color: #222;">${divisionConfig.contactLine}</p>
                <p style="margin: 0; font-size: 10px; line-height: 1.35; color: #222;">${divisionConfig.stateLine}</p>
              </div>
            </div>

            <!-- Bill To & Invoice Details Bar -->
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
                  ${billData.customer_gstin ? `<p style="margin: 0; color: #333;">GSTIN: ${billData.customer_gstin}</p>` : ''}
                </div>
              </div>

              <!-- Right: Invoice Details -->
              <div style="border-bottom: 1.5px solid #222;">
                <div style="background: #E04E1D; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 10px;">
                  Invoice Details
                </div>
                <div style="padding: 8px 10px; min-height: 75px; font-size: 10.5px; line-height: 1.5;">
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #222;">Invoice No.:</span>
                    <span style="font-weight: bold;">${billNo}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #222;">Date:</span>
                    <span>${dateStr}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #222;">Car Name:</span>
                    <span style="font-weight: bold;">${carName}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #222;">Reg No.:</span>
                    <span style="font-weight: bold; font-family: monospace;">${regNo}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Items Table -->
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background: #E04E1D; color: #fff; font-size: 10.5px; font-weight: 700;">
                  <th style="padding: 4px 6px; text-align: center; width: 35px; border-right: 1px solid #ff8860;">#</th>
                  <th style="padding: 4px 8px; border-right: 1px solid #ff8860;">Item name</th>
                  <th style="padding: 4px 6px; text-align: center; width: 75px; border-right: 1px solid #ff8860;">HSN/ SAC</th>
                  <th style="padding: 4px 6px; text-align: center; width: 60px; border-right: 1px solid #ff8860;">Quantity</th>
                  <th style="padding: 4px 6px; text-align: center; width: 50px; border-right: 1px solid #ff8860;">Unit</th>
                  <th style="padding: 4px 8px; text-align: right; width: 90px; border-right: 1px solid #ff8860;">Price/ Unit</th>
                  <th style="padding: 4px 8px; text-align: right; width: 100px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRowsHtml}
                ${spacerRowHtml}
              </tbody>
              <tfoot>
                <tr style="border-top: 1.5px solid #222; border-bottom: 1.5px solid #222; font-weight: 700; font-size: 11px;">
                  <td style="padding: 5px 6px; border-right: 1.5px solid #222;"></td>
                  <td style="padding: 5px 8px; border-right: 1.5px solid #222;">Total</td>
                  <td style="padding: 5px 6px; border-right: 1.5px solid #222;"></td>
                  <td style="padding: 5px 6px; text-align: center; border-right: 1.5px solid #222;">${totalQty}</td>
                  <td style="padding: 5px 6px; border-right: 1.5px solid #222;"></td>
                  <td style="padding: 5px 8px; border-right: 1.5px solid #222;"></td>
                  <td style="padding: 5px 8px; text-align: right;">${fmtCurrency(subTotal)}</td>
                </tr>
              </tfoot>
            </table>

            <!-- Amount in words & Amounts breakdown -->
            <div style="display: grid; grid-template-columns: 1fr 1fr;">
              <!-- Left: Invoice Amount In Words -->
              <div style="border-right: 1.5px solid #222; border-bottom: 1.5px solid #222;">
                <div style="background: #E04E1D; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 10px;">
                  Invoice Amount In Words
                </div>
                <div style="padding: 10px; min-height: 85px; font-size: 11px; color: #111;">
                  <div style="font-style: italic; font-weight: 600;">${numberToWords(Math.round(totalBilled))}</div>
                  <div style="margin-top: 8px; font-size: 9.5px; color: #555;">
                    <strong>Payment Mode:</strong> <span style="text-transform: uppercase; font-weight: bold; color: #000;">${billData.payment_mode || 'Cash'}</span>
                    ${billData.transaction_id ? ` &nbsp;•&nbsp; <strong>Ref/Txn:</strong> <span style="font-family: monospace;">${billData.transaction_id}</span>` : ''}
                  </div>
                  ${billData.remarks ? `<div style="margin-top: 3px; font-size: 9.5px; color: #555;"><strong>Remarks:</strong> ${billData.remarks}</div>` : ''}
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
                        <td style="padding: 4px 10px; color: #333;">Sub Total</td>
                        <td style="padding: 4px 10px; text-align: right; font-weight: 600;">${fmtCurrency(subTotal)}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e5e5;">
                        <td style="padding: 4px 10px; font-weight: 700;">Total</td>
                        <td style="padding: 4px 10px; text-align: right; font-weight: 700;">${fmtCurrency(totalBilled)}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e5e5e5;">
                        <td style="padding: 4px 10px; color: #333;">Received</td>
                        <td style="padding: 4px 10px; text-align: right; font-weight: 700; color: #047857;">${fmtCurrency(paidAmount)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 10px; font-weight: 700; color: #111;">Balance</td>
                        <td style="padding: 5px 10px; text-align: right; font-weight: 700; color: ${balanceDue > 0 ? '#b91c1c' : '#047857'};">${fmtCurrency(balanceDue)}${balanceDue <= 0 ? ' (Settled)' : ''}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Bank Details & Terms section -->
            <div style="display: grid; grid-template-columns: 1fr 1fr;">
              <!-- Left: Bank Details with Dynamic QR -->
              <div style="border-right: 1.5px solid #222;">
                <div style="background: #E04E1D; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 10px;">
                  Bank Details
                </div>
                <div style="padding: 10px; display: flex; gap: 12px; align-items: center;">
                  <div style="text-align: center; flex-shrink: 0;">
                    ${activeQr ? `<img src="${activeQr}" alt="UPI QR Code" style="width: 85px; height: 85px; display: block; border: 1px solid #ccc;" />` : ''}
                    <div style="margin-top: 3px; border: 1px solid #059669; border-radius: 2px; padding: 1px 3px; font-size: 7.5px; font-weight: 800; color: #047857; display: flex; align-items: center; justify-content: center; gap: 2px;">
                      <span style="background: #047857; color: #fff; padding: 0 2px; border-radius: 1px; font-size: 6.5px;">UPI</span>
                      <span>SCAN TO PAY</span>
                    </div>
                  </div>
                  <div style="font-size: 9.5px; line-height: 1.45; color: #111;">
                    <p style="margin: 0 0 2px 0;"><strong>Name:</strong> ${divisionConfig.bankName}</p>
                    <p style="margin: 0 0 2px 0;"><strong>Account No.:</strong> ${divisionConfig.accountNo}</p>
                    <p style="margin: 0 0 2px 0;"><strong>IFSC code:</strong> ${divisionConfig.ifsc}</p>
                    <p style="margin: 0;"><strong>Account Holder's Name:</strong> ${divisionConfig.accountHolder}</p>
                  </div>
                </div>
              </div>

              <!-- Right: Terms and conditions -->
              <div>
                <div style="background: #E04E1D; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 10px;">
                  Terms and conditions
                </div>
                <div style="padding: 10px 12px; font-size: 9px; line-height: 1.45; color: #222;">
                  <p style="margin: 0 0 3px 0;">1) Please do not left anything in car companies not responsible for any loss or damage.</p>
                  <p style="margin: 0 0 3px 0;">2) Please take the car on the same day.</p>
                  <p style="margin: 0 0 3px 0;">3) On the event loss of job card car would be delivered only after sufficient verifications.</p>
                  <p style="margin: 0;">4) Company is not responsible for any technical and mechanical faults.</p>
                </div>
              </div>
            </div>

            <!-- Footer Signature -->
            <div style="display: flex; justify-content: flex-end; padding: 12px 16px 8px 16px; border-top: 1.5px solid #222;">
              <div style="text-align: center; min-width: 170px;">
                <div style="height: 30px;"></div>
                <div style="border-top: 1px solid #111; padding-top: 2px; font-weight: 700; font-size: 10px;">Authorized Signatory</div>
                <div style="font-size: 8.5px; color: #555;">For ${divisionConfig.title}</div>
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
    `);
    win.document.close();
  };

  const handleServiceChange = (index: number, field: keyof BillEditableService, val: any) => {
    setEditServices(prev => {
      const updated = [...prev];
      const cur = { ...updated[index], [field]: val };
      if (field === 'qty' || field === 'rate' || field === 'tax_pct') {
        const q = field === 'qty' ? (parseFloat(val) || 0) : cur.qty;
        const r = field === 'rate' ? (parseFloat(val) || 0) : cur.rate;
        const tp = field === 'tax_pct' ? (parseFloat(val) || 0) : cur.tax_pct;
        const lineAmt = parseFloat((q * r).toFixed(2));
        const lineTax = parseFloat((lineAmt * tp / 100).toFixed(2));
        cur.qty = q;
        cur.rate = r;
        cur.tax_pct = tp;
        cur.amount = lineAmt;
        cur.tax_amount = lineTax;
      }
      updated[index] = cur;
      return updated;
    });
  };

  const handleAddService = () => {
    setEditServices(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        service_name: '',
        hsn_sac: '998714',
        qty: 1,
        rate: 0,
        tax_pct: 0,
        tax_amount: 0,
        amount: 0,
        description: ''
      }
    ]);
  };

  const handleRemoveService = (index: number) => {
    setEditServices(prev => {
      if (prev.length <= 1) {
        showToast('At least one item is required on the bill', 'warning');
        return prev;
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const computedSubtotal = editServices.reduce((sum, s) => sum + (s.qty * s.rate), 0);
  const computedTaxTotal = editServices.reduce((sum, s) => sum + (parseFloat(String(s.tax_amount)) || 0), 0);
  const computedGrandTotal = parseFloat((computedSubtotal + computedTaxTotal).toFixed(2));

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.amount || parseFloat(editForm.amount) <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }
    const hasEmptyName = editServices.some(s => !s.service_name.trim());
    if (hasEmptyName) {
      showToast('Please fill in service/product names for all items', 'error');
      return;
    }

    try {
      setSaving(true);
      const res = await api.put(`/customer-payments/${paymentId}`, {
        amount: parseFloat(editForm.amount),
        payment_mode: editForm.payment_mode,
        payment_date: editForm.payment_date,
        transaction_id: editForm.transaction_id,
        staff_id: editForm.staff_id ? parseInt(editForm.staff_id) : null,
        remarks: editForm.remarks,
        owner_name: editCustomer.owner_name.trim() || 'Customer',
        mobile_no: editCustomer.mobile_no.trim(),
        address: editCustomer.address.trim(),
        customer_gstin: editCustomer.customer_gstin.trim(),
        reg_no: editCustomer.reg_no.toUpperCase().trim(),
        car_name: editCustomer.car_name.trim(),
        services: editServices
      });
      showToast('Whole payment bill & services updated successfully!', 'success');
      const updated = res.data?.data || {};
      const assignedStaff = staffList.find(s => String(s.id) === String(editForm.staff_id));
      const freshServices = (res.data?.services && res.data.services.length > 0)
        ? res.data.services
        : editServices;
      const newBillData = {
        ...billData,
        ...updated,
        owner_name: editCustomer.owner_name.trim() || updated.owner_name || billData?.owner_name,
        mobile_no: editCustomer.mobile_no.trim() || updated.mobile_no || billData?.mobile_no,
        address: editCustomer.address.trim() || updated.address || billData?.address,
        customer_gstin: editCustomer.customer_gstin.trim() || updated.customer_gstin || billData?.customer_gstin,
        reg_no: editCustomer.reg_no.toUpperCase().trim() || updated.reg_no || billData?.reg_no,
        car_name: editCustomer.car_name.trim() || updated.car_name || billData?.car_name,
        amount: parseFloat(editForm.amount),
        payment_mode: editForm.payment_mode,
        payment_date: editForm.payment_date,
        transaction_id: editForm.transaction_id,
        remarks: editForm.remarks,
        staff_name: assignedStaff?.name || updated.staff_name || billData?.staff_name,
        total_billed: computedGrandTotal,
        service_type: editServices[0]?.service_name || billData?.service_type
      };
      setBillData(newBillData);
      setServices(freshServices);
      setIsEditing(false);
      onPaymentUpdated(newBillData);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update payment bill', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl shadow-2xl border border-red-200/80 max-w-4xl w-full overflow-hidden my-auto flex flex-col max-h-[94vh]"
      >
        {/* Top Control Bar */}
        <div className="bg-stone-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">receipt_long</span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-bold text-sm tracking-wide text-white">
                  Payment Bill & Invoice
                </h3>
                {billData && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    #HCW-BILL-{String(billData.id).padStart(4, '0')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400">
                Official {divisionConfig.title} Customer Bill
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Print this invoice bill"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  <span>Print Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  disabled={loading}
                  className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-red-400 border border-red-500/30 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Edit whole bill details"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  <span>Edit Whole Bill</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                <span>View Bill</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition-all ml-1 cursor-pointer"
              title="Close modal"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 bg-slate-50/50">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-semibold text-stone-600">Loading invoice bill...</p>
            </div>
          ) : isEditing ? (
            /* Complete Whole Bill Edit Form */
            <form onSubmit={handleSaveEdit} className="bg-white rounded-xl border border-stone-200 p-5 sm:p-6 shadow-sm space-y-6">
              <div className="border-b border-stone-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-headline font-black text-base text-stone-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-600 text-xl">edit_document</span>
                    <span>Edit Entire Bill & Invoice #HCW-BILL-{String(billData?.id).padStart(4, '0')}</span>
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Modify customer persona, vehicle information, services line items, and payment settlement.
                  </p>
                </div>
                {billData?.job_card_id && (
                  <button
                    type="button"
                    onClick={() => window.open(`/job-cards/${billData.job_card_id}`, '_blank')}
                    className="text-xs text-red-700 hover:text-red-800 font-bold flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 cursor-pointer self-start sm:self-auto"
                  >
                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                    Order #{billData.job_no}
                  </button>
                )}
              </div>

              {/* 1. Customer & Vehicle Persona */}
              <div className="bg-stone-50/70 rounded-xl p-4 border border-stone-200/80 space-y-3">
                <h5 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-200/60 pb-2">
                  <span className="material-symbols-outlined text-red-600 text-base">person</span>
                  <span>Customer Persona & Vehicle Information</span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Customer / Persona Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={editCustomer.owner_name}
                      onChange={e => setEditCustomer({ ...editCustomer, owner_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-stone-900 text-xs font-bold bg-white"
                      placeholder="e.g. Ashishbhai Patel"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={editCustomer.mobile_no}
                      onChange={e => setEditCustomer({ ...editCustomer, mobile_no: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-stone-900 text-xs font-mono bg-white"
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Vehicle Reg. Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={editCustomer.reg_no}
                      onChange={e => setEditCustomer({ ...editCustomer, reg_no: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-stone-900 text-xs font-mono font-bold uppercase bg-white"
                      placeholder="e.g. GJ06RG0552"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Vehicle / Model Name
                    </label>
                    <input
                      type="text"
                      value={editCustomer.car_name}
                      onChange={e => setEditCustomer({ ...editCustomer, car_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-stone-900 text-xs font-semibold bg-white"
                      placeholder="e.g. Creta, Swift, Fortuner"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Customer Address
                    </label>
                    <input
                      type="text"
                      value={editCustomer.address}
                      onChange={e => setEditCustomer({ ...editCustomer, address: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-stone-900 text-xs bg-white"
                      placeholder="e.g. Makarpura, Vadodara"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Interactive Services / Line Items Editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <h5 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-red-600 text-base">format_list_bulleted</span>
                    <span>Billed Services & Products ({editServices.length} Items)</span>
                  </h5>
                  <button
                    type="button"
                    onClick={handleAddService}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span>Add Service / Item</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-red-50/70 border-b border-red-200/80 text-red-950 font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 text-center w-8">#</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Service / Item Name *</th>
                        <th className="py-2.5 px-2 w-20 text-center">HSN/SAC</th>
                        <th className="py-2.5 px-2 w-16 text-center">Qty</th>
                        <th className="py-2.5 px-2 w-24 text-right">Rate (₹)</th>
                        <th className="py-2.5 px-2 w-24 text-center">Tax %</th>
                        <th className="py-2.5 px-2 w-20 text-right">Tax (₹)</th>
                        <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                        <th className="py-2.5 px-2 w-10 text-center">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                      {editServices.map((svc, idx) => (
                        <tr key={svc.id || idx} className="hover:bg-stone-50/60">
                          <td className="py-2 px-3 text-center font-bold text-stone-400 text-[11px]">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              required
                              value={svc.service_name}
                              onChange={e => handleServiceChange(idx, 'service_name', e.target.value)}
                              placeholder="Service or Product name"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 focus:ring-1 focus:ring-red-500 focus:border-red-500 text-stone-900 text-xs font-semibold"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={svc.hsn_sac}
                              onChange={e => handleServiceChange(idx, 'hsn_sac', e.target.value)}
                              placeholder="998714"
                              className="w-full px-1.5 py-1.5 rounded-lg border border-stone-300 text-center font-mono text-[11px]"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={svc.qty}
                              onChange={e => handleServiceChange(idx, 'qty', e.target.value)}
                              className="w-full px-1.5 py-1.5 rounded-lg border border-stone-300 text-center font-bold text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={svc.rate}
                              onChange={e => handleServiceChange(idx, 'rate', e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-stone-300 text-right font-bold text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={svc.tax_pct}
                              onChange={e => handleServiceChange(idx, 'tax_pct', e.target.value)}
                              className="w-full px-1 py-1.5 rounded-lg border border-stone-300 text-xs bg-white cursor-pointer"
                            >
                              <option value="0">0% (Nil)</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-stone-600 font-semibold">
                            ₹{parseFloat(String(svc.tax_amount || 0)).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-stone-900">
                            ₹{(parseFloat(String(svc.amount || 0)) + parseFloat(String(svc.tax_amount || 0))).toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveService(idx)}
                              className="text-stone-400 hover:text-red-600 transition-colors cursor-pointer p-1"
                              title="Delete row"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Subtotal & Sync Paid Button */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-red-50/60 p-3 rounded-xl border border-red-200/70">
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, amount: String(computedGrandTotal) }))}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">sync_alt</span>
                    <span>Set Paid Amount = Total Billed (₹{computedGrandTotal.toLocaleString('en-IN')})</span>
                  </button>

                  <div className="flex items-center gap-4 text-xs font-semibold text-stone-700">
                    <div>
                      <span className="text-stone-500">Subtotal:</span>{' '}
                      <span className="font-mono font-bold text-stone-900">₹{computedSubtotal.toFixed(2)}</span>
                    </div>
                    {computedTaxTotal > 0 && (
                      <div>
                        <span className="text-stone-500">Tax:</span>{' '}
                        <span className="font-mono font-bold text-red-700">₹{computedTaxTotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="text-sm font-black text-red-950 bg-white px-2.5 py-1 rounded-md border border-red-300">
                      Total: ₹{computedGrandTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Payment & Settlement Details */}
              <div className="border-t border-stone-100 pt-4 space-y-3">
                <h5 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-red-600 text-base">payments</span>
                  <span>Payment Settlement Details</span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Amount Paid (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editForm.amount}
                      onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-stone-900 text-sm font-black bg-white"
                      placeholder="Enter amount in ₹"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Payment Mode *
                    </label>
                    <select
                      value={editForm.payment_mode}
                      onChange={e => setEditForm({ ...editForm, payment_mode: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-stone-900 text-sm font-semibold capitalize cursor-pointer bg-white"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="discount">Discount / Write-off</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={editForm.payment_date}
                      onChange={e => setEditForm({ ...editForm, payment_date: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-stone-900 text-sm font-semibold cursor-pointer bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Staff / Received By
                    </label>
                    <select
                      value={editForm.staff_id}
                      onChange={e => setEditForm({ ...editForm, staff_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-stone-900 text-sm font-semibold cursor-pointer bg-white"
                    >
                      <option value="">Select Staff Member (Optional)</option>
                      {staffList.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Transaction / Reference ID
                    </label>
                    <input
                      type="text"
                      value={editForm.transaction_id}
                      onChange={e => setEditForm({ ...editForm, transaction_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-stone-900 text-sm font-mono bg-white"
                      placeholder="e.g. UPI Ref / Bank Txn / Cheque No"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Remarks / Notes
                    </label>
                    <input
                      type="text"
                      value={editForm.remarks}
                      onChange={e => setEditForm({ ...editForm, remarks: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-stone-900 text-sm bg-white"
                      placeholder="e.g. Settle balance, advance, etc."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 text-sm font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-black shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Whole Bill...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">save</span>
                      <span>Save All Bill Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Retail Invoice layout matching InvoiceTemplate */
            <div className="bg-stone-100 p-2 sm:p-4 rounded-xl">
              <h2 className="text-center text-sm font-bold mb-2 text-stone-900 tracking-wide">
                Retail Invoice
              </h2>

              <div className="border-[1.5px] border-stone-900 bg-white text-black text-[11px] shadow-sm font-sans">
                {/* Header: Logo + Business Info */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 sm:px-4 sm:py-3 border-b-[1.5px] border-stone-900 gap-3">
                  {/* Logo */}
                  <div className="w-[85px] h-[67px] bg-black rounded p-1 flex items-center justify-center shrink-0">
                    <img
                      src={`${serverUrl}/uploads/happy-logo.png`}
                      alt="HAPPY Logo"
                      className="max-w-[77px] max-h-[59px] object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/happy-logo.png';
                      }}
                    />
                  </div>

                  {/* Business info */}
                  <div className="text-left sm:text-right">
                    <h1 className="text-lg font-black font-serif tracking-wide text-stone-900">
                      {divisionConfig.title}
                    </h1>
                    {divisionConfig.addressLines.map((line: string, idx: number) => (
                      <p key={idx} className="text-[10px] leading-tight text-stone-800 m-0">
                        {line}
                      </p>
                    ))}
                    <p className="text-[10px] leading-tight text-stone-800 m-0">
                      {divisionConfig.contactLine}
                    </p>
                    <p className="text-[10px] leading-tight text-stone-800 m-0">
                      {divisionConfig.stateLine}
                    </p>
                  </div>
                </div>

                {/* Bill To & Invoice Details Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x-[1.5px] divide-stone-900 border-b-[1.5px] border-stone-900">
                  {/* Left: Bill To */}
                  <div>
                    <div className="bg-[#E04E1D] text-white font-bold text-[11px] px-2.5 py-1">
                      Bill To
                    </div>
                    <div className="p-2.5 min-h-[75px] text-[10.5px] leading-snug">
                      <p className="font-bold text-[11px] uppercase text-stone-900">
                        {billData?.owner_name || 'Customer'}
                      </p>
                      {billData?.address && (
                        <p className="text-stone-800 uppercase mt-0.5">
                          {billData.address}{billData.city ? ', ' + billData.city : ''}
                        </p>
                      )}
                      {billData?.mobile_no && (
                        <p className="text-stone-700 mt-0.5">
                          Phone: <strong className="font-mono text-stone-900">{billData.mobile_no}</strong>
                        </p>
                      )}
                      {billData?.customer_gstin && (
                        <p className="text-stone-700 mt-0.5">
                          GSTIN: <span className="font-mono">{billData.customer_gstin}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Invoice Details */}
                  <div>
                    <div className="bg-[#E04E1D] text-white font-bold text-[11px] px-2.5 py-1">
                      Invoice Details
                    </div>
                    <div className="p-2.5 min-h-[75px] text-[10.5px] leading-snug space-y-1">
                      <div className="flex justify-between">
                        <span className="text-stone-600">Invoice No.:</span>
                        <span className="font-bold text-stone-900 font-mono">
                          {billData?.job_no || billData?.estimate_no || `#HCW-BILL-${String(billData?.id).padStart(4, '0')}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">Date:</span>
                        <span className="font-semibold text-stone-800">{fmtDate(billData?.payment_date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">Car Name:</span>
                        <span className="font-bold text-stone-900">
                          {(() => {
                            const raw = [billData?.car_name, billData?.vehicle_model].filter(Boolean).join(' ');
                            if (!raw) return '—';
                            if (billData?.record_source === 'product_sale' && (raw === billData?.product_name || !billData?.car_name)) return '—';
                            return raw;
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-600">Reg No.:</span>
                        <span className="font-mono font-bold text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-300">
                          {billData?.reg_no || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[10.5px]">
                    <thead>
                      <tr className="bg-[#E04E1D] text-white font-bold text-[10.5px]">
                        <th className="py-1 px-1.5 text-center w-9 border-r border-[#ff8860]">#</th>
                        <th className="py-1 px-2 border-r border-[#ff8860]">Item name</th>
                        <th className="py-1 px-1.5 text-center w-20 border-r border-[#ff8860]">HSN/ SAC</th>
                        <th className="py-1 px-1.5 text-center w-16 border-r border-[#ff8860]">Quantity</th>
                        <th className="py-1 px-1.5 text-center w-14 border-r border-[#ff8860]">Unit</th>
                        <th className="py-1 px-2 text-right w-24 border-r border-[#ff8860]">Price/ Unit</th>
                        <th className="py-1 px-2 text-right w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services && services.length > 0 ? (
                        services.map((s: any, idx: number) => {
                          const sQty = parseFloat(s.qty) || 1;
                          const sRate = parseFloat(s.rate !== undefined ? s.rate : (s.amount / sQty)) || 0;
                          const sAmt = (parseFloat(s.amount !== undefined ? s.amount : (sRate * sQty)) || 0) + (parseFloat(s.tax_amount || 0) || 0);
                          return (
                            <tr key={s.id || idx} className="hover:bg-amber-50/30 transition-colors">
                              <td className="py-1.5 px-1.5 text-center border-r-[1.5px] border-stone-900 text-stone-600 align-top">{idx + 1}</td>
                              <td className="py-1.5 px-2 border-r-[1.5px] border-stone-900 font-semibold text-stone-900 align-top">
                                {s.service_name || s.name || 'Automotive Service'}
                                {s.description && <span className="text-[9.5px] text-stone-500 block font-normal">{s.description}</span>}
                              </td>
                              <td className="py-1.5 px-1.5 text-center border-r-[1.5px] border-stone-900 font-mono text-stone-700 align-top">{s.hsn_sac || '—'}</td>
                              <td className="py-1.5 px-1.5 text-center border-r-[1.5px] border-stone-900 font-semibold text-stone-800 align-top">{sQty}</td>
                              <td className="py-1.5 px-1.5 text-center border-r-[1.5px] border-stone-900 text-stone-600 align-top">{s.unit || 'Pcs'}</td>
                              <td className="py-1.5 px-2 text-right border-r-[1.5px] border-stone-900 font-mono text-stone-800 align-top">{fmtCurrency(sRate)}</td>
                              <td className="py-1.5 px-2 text-right font-mono font-bold text-stone-900 align-top">{fmtCurrency(sAmt)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="py-2 px-1.5 text-center border-r-[1.5px] border-stone-900 text-stone-600">1</td>
                          <td className="py-2 px-2 border-r-[1.5px] border-stone-900 font-semibold text-stone-900">
                            {billData?.service_type || 'Vehicle Detailing, Car Wash & Maintenance Service'}
                          </td>
                          <td className="py-2 px-1.5 text-center border-r-[1.5px] border-stone-900 font-mono text-stone-700">998714</td>
                          <td className="py-2 px-1.5 text-center border-r-[1.5px] border-stone-900 font-semibold text-stone-800">1</td>
                          <td className="py-2 px-1.5 text-center border-r-[1.5px] border-stone-900 text-stone-600">Pcs</td>
                          <td className="py-2 px-2 text-right border-r-[1.5px] border-stone-900 font-mono text-stone-800">
                            {fmtCurrency(billData?.amount || 0)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-stone-900">
                            {fmtCurrency(billData?.amount || 0)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-[1.5px] border-b-[1.5px] border-stone-900 font-bold text-[11px] bg-stone-50">
                        <td className="py-1.5 px-1.5 border-r-[1.5px] border-stone-900"></td>
                        <td className="py-1.5 px-2 border-r-[1.5px] border-stone-900">Total</td>
                        <td className="py-1.5 px-1.5 border-r-[1.5px] border-stone-900"></td>
                        <td className="py-1.5 px-1.5 text-center border-r-[1.5px] border-stone-900">
                          {(services && services.length > 0)
                            ? services.reduce((acc: number, s: any) => acc + (parseFloat(s.qty) || 1), 0)
                            : 1}
                        </td>
                        <td className="py-1.5 px-1.5 border-r-[1.5px] border-stone-900"></td>
                        <td className="py-1.5 px-2 border-r-[1.5px] border-stone-900"></td>
                        <td className="py-1.5 px-2 text-right font-mono font-black text-stone-950">
                          {fmtCurrency(
                            (services && services.length > 0)
                              ? services.reduce((acc: number, s: any) => acc + (parseFloat(s.amount !== undefined ? s.amount : (s.rate * (s.qty || 1))) || 0) + (parseFloat(s.tax_amount || 0) || 0), 0)
                              : (billData?.total_billed || billData?.amount || 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Amount In Words & Amounts Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x-[1.5px] divide-stone-900 border-b-[1.5px] border-stone-900">
                  {/* Left: Invoice Amount In Words */}
                  <div>
                    <div className="bg-[#E04E1D] text-white font-bold text-[11px] px-2.5 py-1">
                      Invoice Amount In Words
                    </div>
                    <div className="p-2.5 min-h-[85px] text-[11px] text-stone-900 flex flex-col justify-between">
                      <p className="italic font-medium leading-snug">
                        {numberToWords(Math.round(parseFloat(String(billData?.total_billed || billData?.amount || 0))))}
                      </p>
                      <div className="text-[10px] text-stone-600 pt-2 border-t border-stone-200 mt-2 space-y-0.5">
                        <p>
                          <strong>Payment Mode:</strong> <span className="font-bold uppercase text-stone-900">{billData?.payment_mode}</span>
                          {billData?.transaction_id && (
                            <> • <strong>Ref / Txn ID:</strong> <span className="font-mono font-bold text-stone-900">{billData.transaction_id}</span></>
                          )}
                        </p>
                        {billData?.remarks && (
                          <p><strong>Remarks:</strong> {billData.remarks}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amounts */}
                  <div>
                    <div className="bg-[#E04E1D] text-white font-bold text-[11px] px-2.5 py-1">
                      Amounts
                    </div>
                    <div className="text-[10.5px]">
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr className="border-b border-stone-200">
                            <td className="py-1 px-2.5 text-stone-600">Sub Total</td>
                            <td className="py-1 px-2.5 text-right font-mono font-semibold">
                              {fmtCurrency(
                                (services && services.length > 0)
                                  ? services.reduce((acc: number, s: any) => acc + (parseFloat(s.amount !== undefined ? s.amount : (s.rate * (s.qty || 1))) || 0), 0)
                                  : (billData?.total_billed || billData?.amount || 0)
                              )}
                            </td>
                          </tr>
                          <tr className="border-b border-stone-200">
                            <td className="py-1 px-2.5 font-bold text-stone-900">Total Billed</td>
                            <td className="py-1 px-2.5 text-right font-mono font-bold text-stone-900">
                              {fmtCurrency(parseFloat(String(billData?.total_billed || billData?.amount || 0)))}
                            </td>
                          </tr>
                          <tr className="border-b border-stone-200 bg-emerald-50/60">
                            <td className="py-1 px-2.5 font-bold text-emerald-900">Paid in this Bill</td>
                            <td className="py-1 px-2.5 text-right font-mono font-bold text-emerald-900">
                              {fmtCurrency(parseFloat(String(billData?.amount || 0)))}
                            </td>
                          </tr>
                          <tr className="border-b border-stone-200">
                            <td className="py-1 px-2.5 text-stone-600">Total Paid to Date</td>
                            <td className="py-1 px-2.5 text-right font-mono font-semibold text-emerald-800">
                              {fmtCurrency(parseFloat(String(billData?.total_paid || billData?.amount || 0)))}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 px-2.5 font-bold text-stone-900">Balance Due</td>
                            <td className={`py-1.5 px-2.5 text-right font-mono font-black ${parseFloat(String(billData?.balance_due || 0)) > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                              {fmtCurrency(parseFloat(String(billData?.balance_due || 0)))}
                              {parseFloat(String(billData?.balance_due || 0)) <= 0 && ' (Settled)'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Bank Details & Terms Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x-[1.5px] divide-stone-900">
                  {/* Left: Bank Details with Dynamic QR */}
                  <div>
                    <div className="bg-[#E04E1D] text-white font-bold text-[11px] px-2.5 py-1">
                      Bank Details
                    </div>
                    <div className="p-2.5 flex items-center gap-3">
                      {/* Dynamic QR */}
                      <div className="text-center shrink-0">
                        {qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt="UPI QR Code"
                            className="w-[85px] h-[85px] block border border-stone-300 rounded shadow-sm"
                          />
                        ) : (
                          <div className="w-[85px] h-[85px] bg-stone-100 border border-stone-300 flex items-center justify-center text-[9px] text-stone-400">
                            Generating...
                          </div>
                        )}
                        <div className="mt-1 border border-emerald-600 rounded px-1 py-0.5 text-[7.5px] font-extrabold text-emerald-800 flex items-center justify-center gap-1 bg-emerald-50">
                          <span className="bg-emerald-700 text-white px-1 rounded-[1px] text-[6.5px]">UPI</span>
                          <span>SCAN TO PAY</span>
                        </div>
                      </div>

                      {/* Account details */}
                      <div className="text-[9.5px] leading-relaxed text-stone-900 space-y-0.5">
                        <p className="m-0"><strong>Name:</strong> {divisionConfig.bankName}</p>
                        <p className="m-0"><strong>Account No.:</strong> <span className="font-mono font-bold">{divisionConfig.accountNo}</span></p>
                        <p className="m-0"><strong>IFSC code:</strong> <span className="font-mono font-bold">{divisionConfig.ifsc}</span></p>
                        <p className="m-0"><strong>Account Holder's Name:</strong> {divisionConfig.accountHolder}</p>
                        <p className="m-0 text-emerald-700 font-semibold pt-0.5">
                          UPI ID: <span className="font-mono font-bold">{divisionConfig.upiId}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Terms and conditions */}
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="bg-[#E04E1D] text-white font-bold text-[11px] px-2.5 py-1">
                        Terms and conditions
                      </div>
                      <div className="p-2.5 text-[9px] leading-relaxed text-stone-700 space-y-0.5">
                        <p className="m-0">1) Please do not left anything in car companies not responsible for any loss or damage.</p>
                        <p className="m-0">2) Please take the car on the same day.</p>
                        <p className="m-0">3) On the event loss of job card car would be delivered only after sufficient verifications.</p>
                        <p className="m-0">4) Company is not responsible for any technical and mechanical faults.</p>
                      </div>
                    </div>

                    <div className="p-2.5 text-right border-t border-stone-200 mt-2">
                      <div className="font-bold text-[10px] text-stone-900">Authorized Signatory</div>
                      <div className="text-[8.5px] text-stone-500">For {divisionConfig.title}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function CustomerPayments({ defaultView }: { defaultView?: 'history' | 'outstanding' }) {
  const { isLocked } = useKillSwitchLock('customer_payments');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'all' | 'payments' | 'estimate_payments'>('all');
  
  const isPendingRoute = location.pathname === '/payment-pending';
  const isHistoryRoute = location.pathname === '/customer-payments';
  const paramView = searchParams.get('view');
  
  const resolveView = (): 'history' | 'outstanding' => {
    if (paramView === 'outstanding') return 'outstanding';
    if (paramView === 'history') return 'history';
    if (isPendingRoute) return 'outstanding';
    if (isHistoryRoute) return 'history';
    if (defaultView) return defaultView;
    return 'history';
  };

  const [viewMode, setViewMode] = useState<'history' | 'outstanding'>(resolveView);
  const [pendingLayout, setPendingLayout] = useState<'client_wise' | 'list'>('client_wise');
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [expandedVehicles, setExpandedVehicles] = useState<Record<string, boolean>>({});
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [duesSummary, setDuesSummary] = useState<{
    total_count: number;
    gst_count: number;
    estimate_count: number;
    total_outstanding: number;
    gst_outstanding: number;
    estimate_outstanding: number;
  } | null>(null);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [outstandingList, setOutstandingList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [prefill, setPrefill] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [pendingMonthFilter, setPendingMonthFilter] = useState('all');
  const [showBulkClearModal, setShowBulkClearModal] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [consolidatedModalClient, setConsolidatedModalClient] = useState<any>(null);
  const [selectedBillPaymentId, setSelectedBillPaymentId] = useState<number | null>(null);
  const [showBillModal, setShowBillModal] = useState(false);

  useEffect(() => {
    setViewMode(resolveView());
  }, [location.pathname, searchParams, defaultView]);

  const activeData = viewMode === 'history' ? payments : outstandingList;

  const isItemWash = (item: any) => {
    const comp = (item.company || '').toLowerCase();
    const jobNo = (item.job_no || item.doc_no || '').toUpperCase();
    const svc = `${item.service_type || ''} ${item.remarks || ''} ${item.services_json || ''}`.toLowerCase();
    return Boolean(
      item.is_quick_job === 1 ||
      item.is_quick_job === true ||
      comp === 'car wash' ||
      comp === 'happy car wash' ||
      jobNo.startsWith('CW-') ||
      jobNo.startsWith('WASH-') ||
      /delux|dlx|teflon|taflon|wash/i.test(svc)
    );
  };

  const isItemAcc = (item: any) => {
    const comp = (item.company || '').toLowerCase();
    const jobNo = (item.job_no || item.doc_no || '').toUpperCase();
    return Boolean(
      item.record_source === 'product_sale' ||
      Boolean(item.accessory_sale_id) ||
      comp.includes('accessories') ||
      comp.includes('product') ||
      jobNo.startsWith('ACC-') ||
      jobNo.startsWith('PROD-')
    );
  };

  const isItemDetailing = (item: any) => !isItemWash(item) && !isItemAcc(item);

  const customerMap = activeData.reduce((map: Map<string, { count: number; vehicles: Set<string> }>, item: any) => {
    const name = (item.owner_name || item.customer_name || '').trim();
    const reg = (item.reg_no || '').trim();
    if (name) {
      if (!map.has(name)) {
        map.set(name, { count: 0, vehicles: new Set<string>() });
      }
      const entry = map.get(name)!;
      entry.count += 1;
      if (reg) entry.vehicles.add(reg);
    }
    return map;
  }, new Map<string, { count: number; vehicles: Set<string> }>());

  const customerOptions = Array.from(customerMap.entries()).map(([name, meta]) => ({
    name,
    count: meta.count,
    vehicles: Array.from(meta.vehicles)
  })).sort((a, b) => a.name.localeCompare(b.name));

  const vehicleMap = activeData.reduce((map: Map<string, { carName: string; ownerName: string; count: number }>, item: any) => {
    const reg = (item.reg_no || '').trim();
    const owner = (item.owner_name || item.customer_name || '').trim();
    const car = (item.car_name || '').trim();
    if (reg) {
      if (!map.has(reg)) {
        map.set(reg, { carName: car, ownerName: owner, count: 0 });
      }
      map.get(reg)!.count += 1;
    }
    return map;
  }, new Map<string, { carName: string; ownerName: string; count: number }>());

  const vehicleOptions = Array.from(vehicleMap.entries()).map(([reg, meta]) => ({
    reg_no: reg,
    car_name: meta.carName,
    owner_name: meta.ownerName,
    count: meta.count
  })).sort((a, b) => a.reg_no.localeCompare(b.reg_no));

  const filteredPayments = payments.filter(p => {
    const comp = (p.company || 'Detailing Studio').trim();
    if (filterCompany !== 'all') {
      if (filterCompany === 'Car Wash' && !isItemWash(p)) return false;
      if (filterCompany === 'Detailing Studio' && !isItemDetailing(p)) return false;
      if ((filterCompany === 'Accessories' || filterCompany === 'Accessories & Products') && !isItemAcc(p)) return false;
      if (filterCompany === 'services' && isItemAcc(p)) return false;
    }
    const name = (p.owner_name || '').trim();
    const reg = (p.reg_no || '').trim();
    if (filterCustomer && name.toLowerCase() !== filterCustomer.toLowerCase()) return false;
    if (filterVehicle && reg.toUpperCase() !== filterVehicle.toUpperCase()) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      if (!name.toLowerCase().includes(q) && !reg.toLowerCase().includes(q) && !(p.car_name || '').toLowerCase().includes(q) && !(p.job_no || p.estimate_no || p.invoice_no || '').toLowerCase().includes(q) && !(p.transaction_id || '').toLowerCase().includes(q) && !(p.staff_name || '').toLowerCase().includes(q) && !(p.payment_mode || '').toLowerCase().includes(q) && !comp.toLowerCase().includes(q) && !(p.service_type || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredOutstanding = outstandingList.filter(o => {
    const name = (o.owner_name || o.customer_name || '').trim();
    const reg = (o.reg_no || '').trim();
    const comp = (o.company || 'Detailing Studio').trim();
    if (filterCompany !== 'all') {
      if (filterCompany === 'Car Wash' && !isItemWash(o)) return false;
      if (filterCompany === 'Detailing Studio' && !isItemDetailing(o)) return false;
      if ((filterCompany === 'Accessories' || filterCompany === 'Accessories & Products') && !isItemAcc(o)) return false;
      if (filterCompany === 'services' && isItemAcc(o)) return false;
    }
    if (filterCustomer && name.toLowerCase() !== filterCustomer.toLowerCase()) return false;
    if (filterVehicle && reg.toUpperCase() !== filterVehicle.toUpperCase()) return false;
    if (pendingMonthFilter !== 'all') {
      const d = o.doc_date ? String(o.doc_date).slice(0, 7) : '';
      if (d !== pendingMonthFilter) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      if (!name.toLowerCase().includes(q) && !reg.toLowerCase().includes(q) && !(o.car_name || '').toLowerCase().includes(q) && !(o.doc_no || '').toLowerCase().includes(q) && !(o.type || '').toLowerCase().includes(q) && !comp.toLowerCase().includes(q) && !(o.mobile_no || '').includes(q)) return false;
    }
    return true;
  });

  interface ClientPendingGroup {
    clientName: string;
    phone: string;
    totalBilled: number;
    totalPaid: number;
    totalPending: number;
    vehicles: Array<{ reg_no: string; car_name: string }>;
    companies: string[];
    documents: any[];
  }

  const clientGroups: ClientPendingGroup[] = Array.from(
    filteredOutstanding.reduce((map: Map<string, ClientPendingGroup>, item: any) => {
      const name = (item.owner_name || item.customer_name || 'Walk-in Customer').trim();
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          clientName: name,
          phone: item.mobile_no || '',
          totalBilled: 0,
          totalPaid: 0,
          totalPending: 0,
          vehicles: [],
          companies: [],
          documents: []
        });
      }
      const grp = map.get(key)!;
      if (!grp.phone && item.mobile_no) {
        grp.phone = item.mobile_no;
      }
      const billed = parseFloat(String(item.total_billed || 0));
      const paid = parseFloat(String(item.total_paid || 0));
      const bal = billed - paid;
      grp.totalBilled += billed;
      grp.totalPaid += paid;
      grp.totalPending += bal;

      const reg = (item.reg_no || '').trim();
      const car = (item.car_name || '').trim();
      if (reg && !grp.vehicles.some(v => v.reg_no === reg)) {
        grp.vehicles.push({ reg_no: reg, car_name: car });
      }
      const comp = (item.company || 'Detailing Studio').trim();
      if (comp && !grp.companies.includes(comp)) {
        grp.companies.push(comp);
      }

      grp.documents.push({
        ...item,
        balance: bal
      });
      return map;
    }, new Map<string, ClientPendingGroup>()).values()
  ).sort((a, b) => b.totalPending - a.totalPending);

  const toggleClient = (clientName: string) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientName]: !prev[clientName]
    }));
  };

  const areAllExpanded = clientGroups.length > 0 && clientGroups.every(g => expandedClients[g.clientName]);
  const toggleExpandAll = () => {
    if (areAllExpanded) {
      setExpandedClients({});
    } else {
      const all: Record<string, boolean> = {};
      clientGroups.forEach(g => { all[g.clientName] = true; });
      setExpandedClients(all);
    }
  };

  const handleRegisterPaymentForClient = (grp: ClientPendingGroup) => {
    const firstDoc = grp.documents[0];
    setPrefill({
      customerName: grp.clientName,
      job_card_id: firstDoc?.job_card_id ? String(firstDoc.job_card_id) : '',
      estimate_id: firstDoc?.estimate_id ? String(firstDoc.estimate_id) : '',
      amount: String(firstDoc?.balance || grp.totalPending),
      targetType: firstDoc?.job_card_id ? 'job_card' : 'estimate',
      carSearch: firstDoc?.reg_no || firstDoc?.doc_no || grp.clientName,
      selectedJobLabel: firstDoc ? `${firstDoc.doc_no} — ${firstDoc.reg_no} (${grp.clientName})` : grp.clientName
    });
    setShowForm(true);
  };

  const handlePaySpecificBill = (grp: ClientPendingGroup, doc: any) => {
    setPrefill({
      customerName: grp.clientName,
      job_card_id: doc.job_card_id ? String(doc.job_card_id) : '',
      estimate_id: doc.estimate_id ? String(doc.estimate_id) : '',
      amount: String(doc.balance),
      targetType: doc.job_card_id ? 'job_card' : 'estimate',
      carSearch: doc.reg_no || doc.doc_no,
      selectedJobLabel: `${doc.doc_no} — ${doc.reg_no} (${grp.clientName})`
    });
    setShowForm(true);
  };

  const handleViewInvoice = (doc: any) => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const tk = localStorage.getItem('gms_token') || '';
    if (doc.job_card_id) {
      window.open(`${baseUrl}/job-cards/${doc.job_card_id}/invoice-html?token=${tk}`, '_blank');
    } else if (doc.estimate_id) {
      window.open(`/estimate-jobs?search=${encodeURIComponent(doc.doc_no || '')}`, '_blank');
    }
  };

  const sep2026PendingItems = outstandingList.filter(o => {
    const d = o.doc_date ? String(o.doc_date).slice(0, 7) : '';
    return d === '2026-09';
  });
  const sep2026Count = sep2026PendingItems.length;
  const sep2026Amount = sep2026PendingItems.reduce((s, o) => s + (parseFloat(String(o.total_billed || 0)) - parseFloat(String(o.total_paid || 0))), 0);

  const selectedPendingItems = outstandingList.filter(o => o.job_card_id && selectedJobIds.includes(o.job_card_id));
  const selectedAmount = selectedPendingItems.reduce((s, o) => s + (parseFloat(String(o.total_billed || 0)) - parseFloat(String(o.total_paid || 0))), 0);

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterCustomer('');
    setFilterVehicle('');
    setFilterCompany('all');
    setPendingMonthFilter('all');
    setSelectedJobIds([]);
    setDateFrom('');
    setDateTo('');
  };

  useEffect(() => {
    const estId = searchParams.get('estimate_id');
    const estNo = searchParams.get('estimate_no');
    if (estId) {
      if (estNo) {
        setPrefill({
          estimate_id: estId,
          targetType: 'estimate',
          carSearch: estNo,
          selectedJobLabel: estNo,
          amount: ''
        });
      }
      setShowForm(true);
    }
  }, [searchParams]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (activeTab === 'estimate_payments') {
        params.estimate_only = 'true';
      } else if (activeTab === 'payments') {
        params.invoice_only = 'true';
      }
      const res = await api.get('/customer-payments', { params });
      setPayments(res.data.data || []);
    } catch { showToast('Failed to load payments', 'error'); }
    finally { setLoading(false); }
  };

  const fetchOutstanding = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (activeTab === 'estimate_payments') {
        params.estimate_only = 'true';
      } else if (activeTab === 'payments') {
        params.invoice_only = 'true';
      }
      const res = await api.get('/customer-payments/outstanding', { params });
      setOutstandingList(res.data.data || []);
      if (res.data.summary) {
        setDuesSummary(res.data.summary);
      }
    } catch { showToast('Failed to load outstanding balances', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (isLocked) return;
    if (viewMode === 'history') {
      fetchPayments();
    } else {
      fetchOutstanding();
    }
  }, [activeTab, viewMode, dateFrom, dateTo, isLocked]);

  const totalCollected = filteredPayments.reduce((s, p) => s + parseFloat(String(p.amount)), 0);
  const totalOutstandingAmount = filteredOutstanding.reduce((s, o) => s + (o.total_billed - o.total_paid), 0);

  if (isLocked) {
    return (
      <AnimatedPage className="pt-[88px] sm:pt-24 p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-on-surface font-headline">Customer Payments</h1>
            <p className="text-on-surface-muted text-sm mt-1">Invoice and payment collection ledger</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">payments</span>
          <h3 className="text-base font-bold text-gray-700 font-headline">No Payment Transactions Found</h3>
          <p className="text-xs text-gray-400 mt-1">There are no payment records available for the selected period.</p>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Tab Select Header */}
      <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-2xl w-fit border border-gray-200 shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-red-600 text-white shadow-md font-extrabold"
        >
          <span className="material-symbols-outlined text-base">
            {viewMode === 'history' ? 'receipt_long' : 'pending_actions'}
          </span>
          <span>{viewMode === 'history' ? 'Payment Bills' : 'Pending Bills'}</span>
          {viewMode === 'outstanding' && duesSummary && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white text-red-700">
              {duesSummary.total_count}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between sm:items-center items-start gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface">
            {viewMode === 'history'
              ? 'Customer Payment History & Bills'
              : 'Client-Wise Payment Pending'
            }
          </h1>
          <p className="text-sm text-on-surface-muted mt-0.5">
            {viewMode === 'history'
              ? `${filteredPayments.length} recorded payment${filteredPayments.length !== 1 ? 's' : ''} • Total Collected ₹${totalCollected.toLocaleString('en-IN')}`
              : `${clientGroups.length} client${clientGroups.length !== 1 ? 's' : ''} with dues • ${filteredOutstanding.length} unpaid bill${filteredOutstanding.length !== 1 ? 's' : ''} • Total Outstanding ₹${totalOutstandingAmount.toLocaleString('en-IN')}`
            }
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {viewMode === 'outstanding' && (
            <>
              <button
                type="button"
                onClick={() => setShowBulkClearModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-sm bg-stone-900 hover:bg-stone-800 text-amber-400 border border-stone-800 shadow-sm transition-all cursor-pointer"
                title="Settle pending bills in bulk or from September 2026 working sheet"
              >
                <span className="material-symbols-outlined text-lg">price_check</span>
                <span>Settle / Clear Balances</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/data-import')}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-sm bg-purple-700 hover:bg-purple-800 text-white shadow-sm transition-all cursor-pointer"
                title="Import Customer & Operations Excel Sheet (Detailing Studio, Wash, Accessories & Pending Payments)"
              >
                <span className="material-symbols-outlined text-lg">upload_file</span>
                <span>Import Excel</span>
              </button>
            </>
          )}

          <button
            onClick={() => {
              if (viewMode === 'history') {
                navigate('/payment-pending');
              } else {
                navigate('/customer-payments');
              }
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border ${
              viewMode === 'outstanding'
                ? 'bg-red-600 hover:bg-red-700 text-white border-red-700 shadow-sm'
                : 'bg-white hover:bg-gray-50 text-stone-800 border-gray-200'
            }`}
          >
            <span className="material-symbols-outlined text-xl">
              {viewMode === 'history' ? 'pending_actions' : 'history'}
            </span>
            {viewMode === 'history' ? 'View Payment Pending' : 'View Payment History'}
          </button>
          <button
            onClick={() => {
              setPrefill({
                targetType: 'job_card'
              });
              setShowForm(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-xl">add</span>Record Payment
          </button>
        </div>
      </div>

      {/* Unified Filter Toolbar for BOTH History and Outstanding View */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search Bar */}
          <div className="search-bar flex-1 min-w-[240px] max-w-md bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">search</span>
            <input
              type="text"
              placeholder="Search Customer, Mobile, Reg No, Model, Doc No..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none focus:outline-none text-sm text-on-surface placeholder:text-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-red-500 transition-colors">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            )}
          </div>

          {/* Month Filter Dropdown for Pending View */}
          {viewMode === 'outstanding' && (
            <select
              value={pendingMonthFilter}
              onChange={e => setPendingMonthFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary text-on-surface max-w-xs truncate"
            >
              <option value="all">All Months</option>
              <option value="2026-09">September 2026 ({sep2026Count} Pending)</option>
              <option value="2026-10">October 2026</option>
            </select>
          )}

          {/* Company / Division Filter Dropdown */}
          <select
            value={filterCompany}
            onChange={e => setFilterCompany(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary text-on-surface max-w-xs truncate"
          >
            <option value="all">All Divisions & Companies (Combined)</option>
            <option value="Car Wash">Car Wash Only</option>
            <option value="Detailing Studio">Detailing Studio Only</option>
            <option value="Accessories">Accessories & Products Only</option>
            <option value="services">Car Wash & Detailing (Exclude Products)</option>
          </select>

          {/* Customer Filter Dropdown */}
          {customerOptions.length > 0 && (
            <select
              value={filterCustomer}
              onChange={e => setFilterCustomer(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary text-on-surface max-w-xs truncate"
            >
              <option value="">All Customers ({customerOptions.length})</option>
              {customerOptions.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.count} {c.count === 1 ? 'entry' : 'entries'}{c.vehicles.length > 0 ? ` · ${c.vehicles.join(', ')}` : ''})
                </option>
              ))}
            </select>
          )}

          {/* Vehicle Filter Dropdown */}
          {vehicleOptions.length > 0 && (
            <select
              value={filterVehicle}
              onChange={e => setFilterVehicle(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary text-on-surface max-w-xs truncate"
            >
              <option value="">All Vehicles ({vehicleOptions.length})</option>
              {vehicleOptions.map(v => (
                <option key={v.reg_no} value={v.reg_no}>
                  {v.reg_no} {v.car_name ? `(${v.car_name})` : ''} — {v.owner_name || 'Unknown Owner'}
                </option>
              ))}
            </select>
          )}

          {/* Date Filters for History View */}
          {viewMode === 'history' && (
            <>
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-on-surface-muted">From:</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-on-surface-muted">To:</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
              </div>
            </>
          )}

          {/* Reset Filters */}
          {(searchQuery || filterCustomer || filterVehicle || filterCompany !== 'all' || pendingMonthFilter !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center gap-1 ml-auto"
            >
              <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
              Reset Filters
            </button>
          )}
        </div>
      </div>

          {viewMode === 'history' ? (
            <>
              {/* Stat Cards */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-4 gap-4">
                {MODES.map(m => {
                  const modeTotal = filteredPayments.filter(p => p.payment_mode === m.value).reduce((s, p) => s + parseFloat(String(p.amount)), 0);
                  const count = filteredPayments.filter(p => p.payment_mode === m.value).length;
                  return (
                    <div key={m.value} className="bg-white rounded-xl shadow-sm border-l-4 border-l-primary/30 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-on-surface-muted uppercase tracking-wider mb-1">{m.label} ({count})</p>
                          <h3 className="text-xl font-headline font-extrabold text-on-surface">₹{modeTotal.toLocaleString('en-IN')}</h3>
                        </div>
                        <span className="material-symbols-outlined text-2xl text-gray-300">{m.icon}</span>
                      </div>
                    </div>
                  );
                })}
              </motion.div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-16 text-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-on-surface-muted">Loading...</p></div>
                ) : filteredPayments.length === 0 ? (
                  <div className="p-20 text-center"><span className="material-symbols-outlined text-5xl text-gray-200 block mb-3">payments</span><p className="font-bold text-on-surface-muted">No payments found for selected filters</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table min-w-[800px]">
                      <thead><tr><th>Order / Bill Ref</th><th>Customer</th><th>Vehicle</th><th>Division</th><th>Amount</th><th>Mode</th><th>Date</th><th>Received By Staff</th><th>Ref ID</th><th>Actions</th></tr></thead>
                      <tbody>
                        {filteredPayments.map((p, i) => (
                          <motion.tr key={p.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="hover:bg-amber-50/30 transition-colors">
                            <td><span className="text-sm font-bold text-primary font-mono">{p.job_no || p.estimate_no || `#${p.id}`}</span></td>
                            <td><span className="text-sm font-bold text-on-surface">{p.owner_name || '—'}</span></td>
                            <td>
                              {p.reg_no && <span className="inline-block px-2 py-0.5 bg-amber-50 rounded text-[11px] font-bold font-mono text-amber-800">{p.reg_no}</span>}
                              {p.car_name && <span className="text-xs text-on-surface-muted ml-1">{p.car_name}</span>}
                            </td>
                            <td>
                              {(() => {
                                const isWash = isItemWash(p) || p.company === 'Car Wash' || /delux|dlx|teflon|taflon/i.test(`${p.service_type || ''} ${p.remarks || ''} ${p.services_json || ''}`);
                                const isAcc = isItemAcc(p) || p.company?.toLowerCase().includes('accessories') || p.company?.toLowerCase().includes('product') || p.record_source === 'product_sale';
                                const badgeComp = isWash ? 'Car Wash' : (isAcc ? 'Accessories' : (p.company || 'Detailing Studio'));
                                return (
                                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                                    badgeComp === 'Car Wash'
                                      ? 'bg-sky-50 text-sky-800 border-sky-200'
                                      : badgeComp === 'Accessories'
                                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}>
                                    {badgeComp}
                                  </span>
                                );
                              })()}
                            </td>
                            <td><span className="text-sm font-bold text-emerald-600">₹{parseFloat(String(p.amount)).toLocaleString('en-IN')}</span></td>
                            <td><span className="capitalize text-sm">{p.payment_mode?.replace('_', ' ')}</span></td>
                            <td><span className="text-sm text-on-surface">{fmtDate(p.payment_date)}</span></td>
                            <td>
                              {p.staff_name ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full text-xs font-bold border border-amber-200">
                                  <span className="material-symbols-outlined text-[13px]">person</span>
                                  {p.staff_name}
                                </span>
                              ) : (
                                <span className="text-xs text-on-surface-muted">—</span>
                              )}
                            </td>
                            <td><span className="text-xs text-on-surface-muted font-mono">{p.transaction_id || '—'}</span></td>
                            <td>
                              {p.record_source === 'product_sale' ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedBillPaymentId(p.id);
                                      setShowBillModal(true);
                                    }}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                    title="View, edit or print Accessories Payment Bill"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                                    <span>Bill</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      window.open(`/invoice/accessory/${p.accessory_sale_id || Math.abs(p.id)}`, '_blank');
                                    }}
                                    className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg text-xs flex items-center shadow-sm transition-all cursor-pointer"
                                    title="Open Full Invoice in New Tab"
                                  >
                                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBillPaymentId(p.id);
                                    setShowBillModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                  title="View, edit or print Happy Invoice / Bill"
                                >
                                  <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                                  <span>Bill</span>
                                </button>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Outstanding Balances View (Client-Wise Pending) */
            <div className="space-y-4">
              {/* Stat Cards for Outstanding View */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl shadow-sm border-l-4 border-l-rose-500 p-5 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-extrabold text-on-surface-muted uppercase tracking-wider mb-1">
                        {filterCustomer || filterVehicle || filterCompany !== 'all' || searchQuery ? 'Filtered Pending Balance' : 'Total Pending Balance'}
                      </p>
                      <h3 className="text-2xl font-headline font-black text-rose-600">
                        ₹{totalOutstandingAmount.toLocaleString('en-IN')}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">pending_actions</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border-l-4 border-l-amber-500 p-5 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-extrabold text-on-surface-muted uppercase tracking-wider mb-1">Clients with Pending Dues</p>
                      <h3 className="text-2xl font-headline font-black text-stone-900">
                        {clientGroups.length} <span className="text-xs text-stone-400 font-medium">client{clientGroups.length !== 1 ? 's' : ''}</span>
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">groups</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border-l-4 border-l-orange-500 p-5 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-extrabold text-on-surface-muted uppercase tracking-wider mb-1">Unpaid Bills & Invoices</p>
                      <h3 className="text-2xl font-headline font-black text-stone-900">
                        {filteredOutstanding.length} <span className="text-xs text-stone-400 font-medium">of {outstandingList.length} total</span>
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">receipt_long</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Layout Switcher Bar */}
              <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center bg-stone-100 p-1 rounded-xl">
                  <button
                    onClick={() => setPendingLayout('client_wise')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      pendingLayout === 'client_wise'
                        ? 'bg-white text-stone-900 shadow-sm font-extrabold'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">contacts</span>
                    Client-Wise Pending ({clientGroups.length})
                  </button>
                  <button
                    onClick={() => setPendingLayout('list')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      pendingLayout === 'list'
                        ? 'bg-white text-stone-900 shadow-sm font-extrabold'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">table_rows</span>
                    All Bills List ({filteredOutstanding.length})
                  </button>
                </div>

                {pendingLayout === 'client_wise' && clientGroups.length > 0 && (
                  <button
                    onClick={toggleExpandAll}
                    className="text-xs font-bold text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {areAllExpanded ? 'unfold_less' : 'unfold_more'}
                    </span>
                    {areAllExpanded ? 'Collapse All Clients' : 'Expand All Clients'}
                  </button>
                )}
              </div>

              {/* CLIENT-WISE VIEW */}
              {pendingLayout === 'client_wise' ? (
                loading ? (
                  <div className="p-16 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-on-surface-muted">Loading client balances...</p>
                  </div>
                ) : clientGroups.length === 0 ? (
                  <div className="p-20 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <span className="material-symbols-outlined text-5xl text-emerald-300 block mb-3">verified</span>
                    <h3 className="font-bold text-lg text-stone-800">All Client Accounts Settled!</h3>
                    <p className="font-medium text-xs text-on-surface-muted mt-1">No pending outstanding balances found matching selected filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clientGroups.map((grp, idx) => {
                      const isExpanded = !!expandedClients[grp.clientName];
                      return (
                        <motion.div
                          key={grp.clientName}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="bg-white rounded-2xl border border-gray-200 hover:border-amber-300 shadow-sm transition-all overflow-hidden"
                        >
                          {/* Client Header Bar */}
                          <div
                            onClick={() => toggleClient(grp.clientName)}
                            className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none hover:bg-amber-50/20 transition-colors"
                          >
                            <div className="flex items-start sm:items-center gap-4">
                              {/* Avatar circle */}
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-stone-950 font-black text-sm flex items-center justify-center shadow-sm shrink-0">
                                {grp.clientName.slice(0, 2).toUpperCase()}
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <h3 className="font-headline font-black text-lg text-stone-900 leading-tight">
                                    {grp.clientName}
                                  </h3>

                                  {grp.phone && (
                                    <a
                                      href={`tel:${grp.phone}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 text-xs font-bold transition-colors"
                                      title="Call Client"
                                    >
                                      <span className="material-symbols-outlined text-xs">call</span>
                                      <span className="font-mono">{grp.phone}</span>
                                    </a>
                                  )}

                                  {grp.companies.map(c => (
                                    <span
                                      key={c}
                                      className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                        c === 'Car Wash'
                                          ? 'bg-sky-50 text-sky-800 border-sky-200'
                                          : c.toLowerCase().includes('accessories') || c.toLowerCase().includes('product')
                                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                                          : 'bg-amber-50 text-amber-800 border-amber-200'
                                      }`}
                                    >
                                      {c}
                                    </span>
                                  ))}

                                  <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                                    {grp.documents.length} {grp.documents.length === 1 ? 'Bill Pending' : 'Bills Pending'}
                                  </span>
                                </div>

                                {/* Vehicles Pills */}
                                {grp.vehicles.length > 0 && (() => {
                                  const isVehExpanded = Boolean(expandedVehicles[grp.clientName] || expandedClients[grp.clientName]);
                                  const visibleVehicles = isVehExpanded ? grp.vehicles : grp.vehicles.slice(0, 3);
                                  const remainingVehiclesCount = grp.vehicles.length - 3;
                                  return (
                                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                      <span className="text-[11px] text-stone-400 font-semibold flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">directions_car</span>
                                        Vehicles ({grp.vehicles.length}):
                                      </span>
                                      {visibleVehicles.map(v => (
                                        <span
                                          key={v.reg_no}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-800 rounded-md text-[11px] font-mono font-bold"
                                        >
                                          <span>{v.reg_no}</span>
                                          {v.car_name && <span className="text-stone-500 font-sans font-medium text-[10px]">({v.car_name})</span>}
                                        </span>
                                      ))}
                                      {!isVehExpanded && remainingVehiclesCount > 0 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedVehicles(prev => ({ ...prev, [grp.clientName]: true }));
                                          }}
                                          className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                                          title="Click to view all vehicles"
                                        >
                                          +{remainingVehiclesCount} more
                                        </button>
                                      )}
                                      {isVehExpanded && grp.vehicles.length > 3 && !expandedClients[grp.clientName] && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedVehicles(prev => ({ ...prev, [grp.clientName]: false }));
                                          }}
                                          className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-md text-[10px] font-semibold transition-colors cursor-pointer"
                                          title="Collapse vehicles"
                                        >
                                          Show less
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}

                                <div className="text-xs text-stone-500 font-medium">
                                  Total Billed: <span className="font-bold text-stone-700">₹{grp.totalBilled.toLocaleString('en-IN')}</span>
                                  <span className="mx-2">•</span>
                                  Paid: <span className="font-bold text-emerald-600">₹{grp.totalPaid.toLocaleString('en-IN')}</span>
                                </div>
                              </div>
                            </div>

                            {/* Right Section: Pending Amount & CTAs */}
                            <div className="flex items-center gap-3 self-end md:self-center ml-auto">
                              <div className="text-right">
                                <div className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider">
                                  Pending Balance
                                </div>
                                <div className="text-2xl font-black text-rose-600 font-headline">
                                  ₹{grp.totalPending.toLocaleString('en-IN')}
                                </div>
                              </div>

                              {/* Settle All & Single Bill CTA */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConsolidatedModalClient(grp);
                                }}
                                className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Clear all payments for this person across all cars in a single go and generate single crisp bill sheet"
                              >
                                <span className="material-symbols-outlined text-base">task_alt</span>
                                Clear All & Single Bill
                              </button>

                              {/* Print Statement CTA */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  printConsolidatedBillSheet({
                                    clientName: grp.clientName,
                                    phone: grp.phone,
                                    vehicles: grp.vehicles,
                                    documents: grp.documents,
                                    totalBilled: grp.totalBilled,
                                    totalPaid: grp.totalPaid,
                                    totalPending: grp.totalPending,
                                    paymentMode: 'Pending Statement',
                                    paymentDate: new Date().toISOString().slice(0, 10),
                                    receiptNo: `HCW-STMT-${Date.now().toString().slice(-6)}`,
                                    isSettled: false
                                  });
                                }}
                                className="px-2.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                                title="Print single-sheet statement of all pending jobs"
                              >
                                <span className="material-symbols-outlined text-base">print</span>
                                Statement
                              </button>

                              {/* Quick Register Payment CTA */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRegisterPaymentForClient(grp);
                                }}
                                className="px-3.5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Register Payment for this Client"
                              >
                                <span className="material-symbols-outlined text-base">payments</span>
                                Register Payment
                              </button>

                              {/* Toggle Chevron */}
                              <div
                                className={`w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180 bg-amber-100 text-amber-900' : ''
                                }`}
                              >
                                <span className="material-symbols-outlined text-xl">expand_more</span>
                              </div>
                            </div>
                          </div>

                          {/* Accordion History: Full Unpaid Document History for this Client */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-t border-gray-100 bg-stone-50/60 p-4 sm:p-5"
                              >
                                <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm text-amber-600">receipt_long</span>
                                    Pending Document History ({grp.documents.length} Records)
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setConsolidatedModalClient(grp)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-lg flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                                      title="Clear all pending documents for this client in one click"
                                    >
                                      <span className="material-symbols-outlined text-sm">receipt_long</span>
                                      Clear All & Single Bill ({grp.documents.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => printConsolidatedBillSheet({
                                        clientName: grp.clientName,
                                        phone: grp.phone,
                                        vehicles: grp.vehicles,
                                        documents: grp.documents,
                                        totalBilled: grp.totalBilled,
                                        totalPaid: grp.totalPaid,
                                        totalPending: grp.totalPending,
                                        paymentMode: 'Pending Statement',
                                        paymentDate: new Date().toISOString().slice(0, 10),
                                        receiptNo: `HCW-STMT-${Date.now().toString().slice(-6)}`,
                                        isSettled: false
                                      })}
                                      className="px-2.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Print consolidated statement of dues"
                                    >
                                      <span className="material-symbols-outlined text-sm">print</span>
                                      Print Statement
                                    </button>
                                  </div>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                                  <table className="data-table min-w-[760px]">
                                    <thead>
                                      <tr>
                                        <th>Doc / Invoice</th>
                                        <th>Job No</th>
                                        <th>Date</th>
                                        <th>Vehicle</th>
                                        <th>Company</th>
                                        <th>Type</th>
                                        <th>Billed</th>
                                        <th>Paid</th>
                                        <th>Outstanding</th>
                                        <th className="text-right">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {grp.documents.map((doc) => (
                                        <tr key={doc.job_card_id ? `jc-${doc.job_card_id}` : `est-${doc.estimate_id}`} className="hover:bg-amber-50/40 transition-colors">
                                          <td>
                                            <span className="font-mono font-bold text-sm text-amber-950">
                                              {doc.invoice_no || doc.doc_no}
                                            </span>
                                          </td>
                                          <td>
                                            <span className="font-mono text-xs text-stone-500 font-medium">
                                              {doc.job_no}
                                            </span>
                                          </td>
                                          <td>
                                            <span className="text-xs text-stone-600 font-medium whitespace-nowrap">
                                              {fmtDate(doc.doc_date)}
                                            </span>
                                          </td>
                                          <td>
                                            <span className="font-mono font-bold text-xs text-stone-800 bg-stone-100 px-2 py-0.5 rounded">
                                              {doc.reg_no || '—'}
                                            </span>
                                            {doc.car_name && <span className="text-[11px] text-stone-500 block truncate max-w-[140px]">{doc.car_name}</span>}
                                          </td>
                                          <td>
                                            <span className="text-[11px] font-bold text-stone-700">
                                              {doc.company}
                                            </span>
                                          </td>
                                          <td>
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                                              Invoice
                                            </span>
                                          </td>
                                          <td><span className="font-semibold text-xs">₹{parseFloat(String(doc.total_billed)).toLocaleString('en-IN')}</span></td>
                                          <td><span className="font-semibold text-xs text-emerald-600">₹{parseFloat(String(doc.total_paid)).toLocaleString('en-IN')}</span></td>
                                          <td><span className="font-extrabold text-xs text-rose-600">₹{doc.balance.toLocaleString('en-IN')}</span></td>
                                          <td className="text-right">
                                            <div className="flex items-center justify-end gap-1.5 py-1">
                                              <button
                                                type="button"
                                                onClick={() => handlePaySpecificBill(grp, doc)}
                                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                              >
                                                <span className="material-symbols-outlined text-xs">payments</span>
                                                Pay Bill
                                              </button>

                                              {doc.job_card_id && (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={async () => {
                                                      try {
                                                        await api.patch('/customer-payments/approve-invoice', {
                                                          job_card_id: doc.job_card_id,
                                                          invoice_type: 'non_gst'
                                                        });
                                                        showToast('Payment status marked approved', 'success');
                                                        fetchOutstanding();
                                                      } catch {
                                                        showToast('Failed to approve payment status', 'error');
                                                      }
                                                    }}
                                                    className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                                    title="Mark as Approved / Settled"
                                                  >
                                                    <span className="material-symbols-outlined text-xs">check_circle</span>
                                                    Approve
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={() => handleViewInvoice(doc)}
                                                    className="p-1 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                                                    title="View Invoice"
                                                  >
                                                    <span className="material-symbols-outlined text-base">visibility</span>
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                )
              ) : (
                /* ALL BILLS FLAT TABLE VIEW */
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                  {filterCustomer && (() => {
                    const matchedGrp = clientGroups.find(g => g.clientName.toLowerCase() === filterCustomer.toLowerCase());
                    if (!matchedGrp) return null;
                    return (
                      <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-700 text-lg">person</span>
                          <div>
                            <span className="text-xs font-black text-emerald-950 font-headline mr-2">
                              {matchedGrp.clientName}
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-800">
                              {matchedGrp.documents.length} bills · {matchedGrp.vehicles.length} vehicle(s) · Outstanding: ₹{matchedGrp.totalPending.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConsolidatedModalClient(matchedGrp)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
                            title="Clear all pending payments for this person in a single go and generate single bill sheet"
                          >
                            <span className="material-symbols-outlined text-sm">task_alt</span>
                            Clear All & Single Bill
                          </button>
                          <button
                            type="button"
                            onClick={() => printConsolidatedBillSheet({
                              clientName: matchedGrp.clientName,
                              phone: matchedGrp.phone,
                              vehicles: matchedGrp.vehicles,
                              documents: matchedGrp.documents,
                              totalBilled: matchedGrp.totalBilled,
                              totalPaid: matchedGrp.totalPaid,
                              totalPending: matchedGrp.totalPending,
                              paymentMode: 'Pending Statement',
                              paymentDate: new Date().toISOString().slice(0, 10),
                              receiptNo: `HCW-STMT-${Date.now().toString().slice(-6)}`,
                              isSettled: false
                            })}
                            className="bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Print statement for this customer"
                          >
                            <span className="material-symbols-outlined text-sm">print</span>
                            Print Statement
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  {selectedJobIds.length > 0 && (
                    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-700">checklist</span>
                        <span className="text-xs font-bold text-amber-950">
                          {selectedJobIds.length} bills selected (Total Outstanding: ₹{selectedAmount.toLocaleString('en-IN')})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowBulkClearModal(true)}
                          className="bg-amber-500 hover:bg-amber-600 text-stone-950 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-sm"
                        >
                          <span className="material-symbols-outlined text-xs">done_all</span>
                          Settle Selected
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedJobIds([])}
                          className="text-stone-500 hover:text-stone-800 px-2 py-1 text-xs font-bold cursor-pointer"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>
                  )}

                  {loading ? (
                    <div className="p-16 text-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-on-surface-muted">Loading...</p></div>
                  ) : filteredOutstanding.length === 0 ? (
                    <div className="p-20 text-center"><span className="material-symbols-outlined text-5xl text-gray-200 block mb-3">pending_actions</span><p className="font-bold text-on-surface-muted">No pending outstanding payments found for selected filters</p></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table min-w-[800px]">
                        <thead>
                          <tr>
                            <th className="w-10 text-center">
                              <input
                                type="checkbox"
                                checked={filteredOutstanding.length > 0 && filteredOutstanding.filter(it => it.job_card_id).every(it => selectedJobIds.includes(it.job_card_id))}
                                onChange={e => {
                                  if (e.target.checked) {
                                    const ids = filteredOutstanding.filter(it => it.job_card_id).map(it => it.job_card_id);
                                    setSelectedJobIds(ids);
                                  } else {
                                    setSelectedJobIds([]);
                                  }
                                }}
                                className="rounded text-amber-500 focus:ring-0 cursor-pointer"
                              />
                            </th>
                            <th>Document No</th>
                            <th>Type</th>
                            <th>Company</th>
                            <th>Customer</th>
                            <th>Vehicle</th>
                            <th>Billed</th>
                            <th>Paid</th>
                            <th>Outstanding</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOutstanding.map((item, i) => {
                            const bal = item.total_billed - item.total_paid;
                            const isSelected = item.job_card_id ? selectedJobIds.includes(item.job_card_id) : false;
                            return (
                              <motion.tr key={item.job_card_id ? `jc-${item.job_card_id}` : `est-${item.estimate_id}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className={`transition-colors ${isSelected ? 'bg-amber-50/60' : 'hover:bg-amber-50/30'}`}>
                                <td className="text-center">
                                  {item.job_card_id ? (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          setSelectedJobIds(prev => [...prev, item.job_card_id]);
                                        } else {
                                          setSelectedJobIds(prev => prev.filter(id => id !== item.job_card_id));
                                        }
                                      }}
                                      className="rounded text-amber-500 focus:ring-0 cursor-pointer"
                                    />
                                  ) : null}
                                </td>
                                <td><span className="text-sm font-bold text-primary font-mono">{item.doc_no}</span></td>
                                <td>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                    Invoice
                                  </span>
                                </td>
                                <td>
                                  {(() => {
                                    const isWash = isItemWash(item) || item.company === 'Car Wash' || /delux|dlx|teflon|taflon/i.test(`${item.service_type || ''} ${item.remarks || ''} ${item.services_json || ''}`);
                                    const isAcc = isItemAcc(item) || item.company?.toLowerCase().includes('accessories') || item.company?.toLowerCase().includes('product') || item.record_source === 'product_sale';
                                    const badgeComp = isWash ? 'Car Wash' : (isAcc ? 'Accessories' : (item.company || 'Detailing Studio'));
                                    return (
                                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                                        badgeComp === 'Car Wash'
                                          ? 'bg-sky-50 text-sky-800 border-sky-200'
                                          : badgeComp === 'Accessories'
                                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                                          : 'bg-amber-50 text-amber-800 border-amber-200'
                                      }`}>
                                        {badgeComp}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td>
                                  <span className="text-sm font-bold text-on-surface block">{item.owner_name || '—'}</span>
                                  {item.mobile_no && <span className="text-[11px] text-stone-400 font-mono">{item.mobile_no}</span>}
                                </td>
                                <td>
                                  {item.reg_no && <span className="inline-block px-2 py-0.5 bg-amber-50 rounded text-[11px] font-bold font-mono text-amber-800">{item.reg_no}</span>}
                                  {item.car_name && <span className="text-xs text-on-surface-muted ml-1">{item.car_name}</span>}
                                </td>
                                <td><span className="text-sm font-medium">₹{parseFloat(String(item.total_billed)).toLocaleString('en-IN')}</span></td>
                                <td><span className="text-sm font-medium text-emerald-600">₹{parseFloat(String(item.total_paid)).toLocaleString('en-IN')}</span></td>
                                <td><span className="text-sm font-bold text-red-500">₹{bal.toLocaleString('en-IN')}</span></td>
                                <td className="flex items-center gap-2 py-3">
                                  <button
                                    onClick={() => {
                                      setPrefill({
                                        customerName: item.owner_name || item.customer_name || '',
                                        job_card_id: item.job_card_id ? String(item.job_card_id) : '',
                                        estimate_id: item.estimate_id ? String(item.estimate_id) : '',
                                        amount: String(bal),
                                        targetType: item.job_card_id ? 'job_card' : 'estimate',
                                        carSearch: item.reg_no || item.doc_no,
                                        selectedJobLabel: item.doc_no
                                      });
                                      setShowForm(true);
                                    }}
                                    className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-primary-hover transition-colors"
                                  >
                                    Pay Now
                                  </button>

                                  {item.job_card_id && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          await api.patch('/customer-payments/approve-invoice', {
                                            job_card_id: item.job_card_id,
                                            invoice_type: 'non_gst'
                                          });
                                          showToast('Payment status approved successfully', 'success');
                                          fetchOutstanding();
                                        } catch {
                                          showToast('Failed to approve payment status', 'error');
                                        }
                                      }}
                                      className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                    >
                                      <span className="material-symbols-outlined text-xs">check_circle</span>
                                      Approve
                                    </button>
                                  )}
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

      <AnimatePresence>
        {showForm && <PaymentFormModal prefill={prefill} onClose={() => { setShowForm(false); setPrefill(null); }} onSaved={() => { fetchPayments(); fetchOutstanding(); }} />}
        {showBulkClearModal && (
          <BulkClearModal
            onClose={() => setShowBulkClearModal(false)}
            onCleared={() => {
              setSelectedJobIds([]);
              fetchOutstanding();
              fetchPayments();
            }}
            sepCount={sep2026Count}
            sepAmount={sep2026Amount}
            totalPendingCount={filteredOutstanding.length}
            totalPendingAmount={totalOutstandingAmount}
            selectedIds={selectedJobIds}
            selectedAmount={selectedAmount}
          />
        )}
        {consolidatedModalClient && (
          <ConsolidatedSettlementModal
            client={consolidatedModalClient}
            onClose={() => setConsolidatedModalClient(null)}
            onSettled={() => {
              fetchOutstanding();
              fetchPayments();
            }}
          />
        )}
        {showBillModal && selectedBillPaymentId && (
          <HappyPaymentBillModal
            paymentId={selectedBillPaymentId}
            onClose={() => {
              setShowBillModal(false);
              setSelectedBillPaymentId(null);
            }}
            onPaymentUpdated={(updatedPayment) => {
              setPayments(prev => prev.map(p => p.id === updatedPayment.id ? { ...p, ...updatedPayment } : p));
              fetchPayments();
              fetchOutstanding();
            }}
          />
        )}
      </AnimatePresence>
    </AnimatedPage>
  );
}




