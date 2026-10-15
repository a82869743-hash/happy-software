import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useKillSwitchLock } from '../hooks/useKillSwitchLock';
import SuggestInput, { recordFieldSuggestions } from '../components/shared/SuggestInput';

interface EstService { id?: number; service_name: string; item_type: string; part_code?: string; qty: number; rate: number; amount: number; hsn_sac?: string; }
interface Estimate {
  id: number; estimate_no: string; estimate_type: 'gst_estimate' | 'non_gst_estimate';
  customer_name: string; mobile_no: string; reg_no: string; car_name: string;
  vehicle_make: string; vehicle_model: string; subtotal: number; gst_percentage: number;
  gst_amount: number; total_amount: number; payment_mode: string; notes: string;
  is_archived: number; archived_at: string; created_at: string; services: EstService[];
  converted_job_card_id?: number; converted_at?: string; job_card_id?: number;
}
interface Stats { total: number; gst: number; non_gst: number; archived: number; converted: number; conversion_rate: number; }

const FILTERS = [
  { key: 'all', label: 'All Active', icon: 'list_alt' },
  { key: 'gst', label: 'GST', icon: 'receipt' },
  { key: 'non_gst', label: 'Non-GST', icon: 'receipt_long' },
  { key: 'converted', label: 'Converted', icon: 'swap_horiz' },
  { key: 'archived', label: 'Archived', icon: 'archive' },
];

export default function EstimateJobs() {
  const { isLocked, lockAllModules } = useKillSwitchLock('estimate_jobs');
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.username === 'admin' || user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'service_advisor' || true;

  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, gst: 0, non_gst: 0, archived: 0, converted: 0, conversion_rate: 0 });
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  // Create form state
  const [form, setForm] = useState({ estimate_type: 'non_gst_estimate' as string, customer_name: '', mobile_no: '', reg_no: '', car_name: '', vehicle_make: '', vehicle_model: '', vehicle_variant: '', notes: '', payment_mode: 'cash', gst_percentage: '18', company_name: '', gstin: '' });
  const [formServices, setFormServices] = useState<EstService[]>([{ service_name: '', item_type: 'labour', qty: 1, rate: 0, amount: 0 }]);
  const [saving, setSaving] = useState(false);

  // Vehicle autocomplete state
  const [makeQuery, setMakeQuery] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [makeSuggestions, setMakeSuggestions] = useState<string[]>([]);
  const [modelSuggestions, setModelSuggestions] = useState<{model: string; fuel_types: string[]; variants?: string[]}[]>([]);
  const [showMakeDrop, setShowMakeDrop] = useState(false);
  const [showModelDrop, setShowModelDrop] = useState(false);
  const [availableVariants, setAvailableVariants] = useState<string[]>([]);
  const makeTimer = useRef<any>(null);
  const modelTimer = useRef<any>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [estRes, statsRes] = await Promise.all([
        api.get('/estimate-jobs', { params: { filter: filter === 'all' ? undefined : filter, search: search || undefined } }),
        api.get('/estimate-jobs/stats')
      ]);
      setEstimates(estRes.data.data || []);
      setStats(statsRes.data);
    } catch { showToast('Failed to load estimates', 'error'); }
    setLoading(false);
  }, [filter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Make autocomplete ───
  useEffect(() => {
    clearTimeout(makeTimer.current);
    if (makeQuery.length < 1) { setMakeSuggestions([]); return; }
    makeTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/vehicle-master/makes', { params: { q: makeQuery } });
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setMakeSuggestions(list);
        if (list.length > 0) setShowMakeDrop(true);
      } catch { /* silent */ }
    }, 200);
    return () => clearTimeout(makeTimer.current);
  }, [makeQuery]);

  // ─── Model autocomplete ───
  useEffect(() => {
    clearTimeout(modelTimer.current);
    if (!form.vehicle_make && modelQuery.length < 1) { setModelSuggestions([]); return; }
    modelTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/vehicle-master/models', {
          params: { make: form.vehicle_make || undefined, q: modelQuery || undefined }
        });
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setModelSuggestions(list);
        if (list.length > 0) setShowModelDrop(true);
      } catch { /* silent */ }
    }, 200);
    return () => clearTimeout(modelTimer.current);
  }, [modelQuery, form.vehicle_make]);

  const selectMake = (make: string) => {
    setMakeQuery(make);
    setShowMakeDrop(false);
    setModelQuery('');
    setForm(f => ({ ...f, vehicle_make: make, vehicle_model: '', vehicle_variant: '' }));
    setAvailableVariants([]);
    setTimeout(() => modelInputRef.current?.focus(), 50);
  };

  const selectModel = (item: {model: string; fuel_types: string[]; variants?: string[]}) => {
    setModelQuery(item.model);
    setShowModelDrop(false);
    setAvailableVariants(item.variants && item.variants.length > 0 ? item.variants : []);
    setForm(f => ({ ...f, vehicle_model: item.model, vehicle_variant: '' }));
  };

  const handleCreate = async () => {
    if (formServices.length === 0 || !formServices[0].service_name) {
      showToast('At least one service is required', 'error'); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        customer_name: form.customer_name?.trim() || 'Customer',
        gst_percentage: parseFloat(form.gst_percentage),
        services: formServices.map(s => ({ ...s, amount: parseFloat(String(s.amount)) || 0, rate: parseFloat(String(s.rate)) || 0 }))
      };
      const res = await api.post('/estimate-jobs', payload);
      recordFieldSuggestions({
        client_name: form.customer_name,
        mobile_no: form.mobile_no,
        reg_no: form.reg_no,
        car_name: form.car_name,
        company_name: form.company_name,
        gstin: form.gstin,
        ...formServices.reduce((acc, s) => ({ ...acc, service_name: s.service_name }), {})
      });
      showToast(`Estimate ${res.data.estimate_no} created — ₹${res.data.total_amount}`);
      setShowCreate(false);
      setForm({ estimate_type: 'non_gst_estimate', customer_name: '', mobile_no: '', reg_no: '', car_name: '', vehicle_make: '', vehicle_model: '', vehicle_variant: '', notes: '', payment_mode: 'cash', gst_percentage: '18', company_name: '', gstin: '' });
      setFormServices([{ service_name: '', item_type: 'labour', qty: 1, rate: 0, amount: 0 }]);
      setMakeQuery(''); setModelQuery(''); setAvailableVariants([]);
      fetchData();
    } catch (err: any) { showToast(err?.response?.data?.error || 'Failed to create', 'error'); }
    setSaving(false);
  };

  const handleArchive = async (id: number) => {
    if (!confirm('Archive this estimate? It will be moved to the archive.')) return;
    try { await api.post(`/estimate-jobs/${id}/archive`); showToast('Archived'); fetchData(); }
    catch { showToast('Archive failed', 'error'); }
  };
  const handleDeleteEstimate = async (id: number, estNo: string) => {
    if (!confirm(`Are you sure you want to delete estimate "${estNo}"?`)) return;
    try {
      await api.delete(`/estimate-jobs/${id}`);
      showToast(`Estimate ${estNo} deleted successfully`, 'success');
      fetchData();
    } catch {
      showToast('Delete failed', 'error');
    }
  };
  const handleRestore = async (id: number) => {
    try { await api.post(`/estimate-jobs/${id}/restore`); showToast('Restored'); fetchData(); }
    catch { showToast('Restore failed', 'error'); }
  };
  const handleConvert = async (id: number) => {
    if (!confirm('Convert this estimate to a Job Card?')) return;
    try {
      const res = await api.post(`/estimate-jobs/${id}/convert`);
      showToast(`Converted → ${res.data.job_no}`);
      fetchData();
    } catch (err: any) { showToast(err?.response?.data?.error || 'Conversion failed', 'error'); }
  };
  const handleBulkArchive = async () => {
    if (!confirm('Activate Killswitch? This will lock Estimates, Cash Ledger, Daily Report, Customer Payments, Accounts, and Staff Ledger until unlocked with 200 clicks on each module.')) return;
    try {
      await api.post('/estimate-jobs/bulk-archive');
      lockAllModules();
      showToast('Killswitch activated — financial modules locked until 200 clicks', 'warning');
      fetchData();
    } catch {
      lockAllModules();
      showToast('Killswitch activated — financial modules locked', 'warning');
    }
  };

  // Saved Estimate Line Items Modal state & handlers
  const [viewItemsEstimate, setViewItemsEstimate] = useState<any | null>(null);
  const [estimateItems, setEstimateItems] = useState<any[]>([]);

  const handleOpenItemsModal = async (est: any) => {
    setViewItemsEstimate(est);
    try {
      const res = await api.get(`/estimate-jobs/${est.id}`);
      setEstimateItems(res.data.services || []);
    } catch {
      setEstimateItems(est.services || []);
    }
  };

  const handleDeleteSavedLineItem = async (itemId: number) => {
    if (!viewItemsEstimate) return;
    try {
      await api.delete(`/estimate-jobs/${viewItemsEstimate.id}/items/${itemId}`);
      showToast('Line item deleted successfully', 'success');
      const res = await api.get(`/estimate-jobs/${viewItemsEstimate.id}`);
      setEstimateItems(res.data.services || []);
      fetchData();
    } catch {
      showToast('Failed to delete line item', 'error');
    }
  };

  const addService = () => setFormServices([...formServices, { service_name: '', item_type: 'labour', qty: 1, rate: 0, amount: 0 }]);
  const removeService = (i: number) => setFormServices(formServices.filter((_, idx) => idx !== i));
  const updateService = (i: number, field: string, val: any) => {
    const updated = [...formServices];
    (updated[i] as any)[field] = val;
    if (field === 'rate' || field === 'qty') updated[i].amount = (parseFloat(String(updated[i].rate)) || 0) * (parseInt(String(updated[i].qty)) || 1);
    setFormServices(updated);
  };

  const subtotal = formServices.reduce((s, svc) => s + (parseFloat(String(svc.amount)) || 0), 0);
  const gstAmt = form.estimate_type === 'gst_estimate' ? subtotal * (parseFloat(form.gst_percentage) || 18) / 100 : 0;
  const grandTotal = subtotal + gstAmt;

  if (isLocked) {
    return (
      <div className="pt-[88px] sm:pt-6 p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-on-surface font-headline flex items-center gap-3">
              <span className="material-symbols-outlined text-accent text-3xl">description</span>
              Estimate Jobs
            </h1>
            <p className="text-on-surface-muted text-sm mt-1">GST & Non-GST estimation management</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">description</span>
          <h3 className="text-base font-bold text-gray-700 font-headline">No Active Estimates Found</h3>
          <p className="text-xs text-gray-400 mt-1">No estimates exist in the system for this filter selection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[88px] sm:pt-6 p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-[9999] px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-bold ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-on-surface font-headline flex items-center gap-3">
            <span className="material-symbols-outlined text-accent text-3xl">description</span>
            Estimate Jobs
          </h1>
          <p className="text-on-surface-muted text-sm mt-1">GST & Non-GST estimation management</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button onClick={handleBulkArchive} className="px-4 py-2.5 bg-amber-500/10 text-amber-600 rounded-xl text-sm font-bold hover:bg-amber-500/20 transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">cleaning_services</span> Clear Page
            </button>
          )}
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm py-2.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">add_circle</span> New Estimate
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: 'calculate', color: 'from-amber-500 to-amber-600' },
          { label: 'GST', value: stats.gst, icon: 'receipt', color: 'from-emerald-500 to-emerald-600' },
          { label: 'Non-GST', value: stats.non_gst, icon: 'receipt_long', color: 'from-violet-500 to-violet-600' },
          { label: 'Converted', value: stats.converted, icon: 'swap_horiz', color: 'from-emerald-500 to-emerald-600' },
          { label: 'Archived', value: stats.archived, icon: 'archive', color: 'from-amber-500 to-amber-600' },
          { label: 'Conv. Rate', value: `${stats.conversion_rate}%`, icon: 'trending_up', color: 'from-pink-500 to-rose-600' },
        ].map((c) => (
          <motion.div key={c.label} whileHover={{ y: -2 }} className="bg-surface-card rounded-2xl p-4 border border-gray-100 shadow-card">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-3`}>
              <span className="material-symbols-outlined text-white text-lg">{c.icon}</span>
            </div>
            <p className="text-2xl font-extrabold text-on-surface">{c.value}</p>
            <p className="text-xs text-on-surface-muted font-medium mt-0.5">{c.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filter === f.key ? 'bg-white text-accent shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <span className="material-symbols-outlined text-sm">{f.icon}</span>{f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
          <input type="text" placeholder="Search estimates..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm w-[280px] focus:ring-2 focus:ring-accent/20 focus:border-accent" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-card rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="inline-block w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
        ) : estimates.length === 0 ? (
          <div className="p-12 text-center text-on-surface-muted">
            <span className="material-symbols-outlined text-5xl mb-3 block opacity-30">description</span>
            <p className="font-bold">No estimates found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  {['Estimate #', 'Type', 'Customer', 'Vehicle', 'Subtotal', 'GST', 'Total', 'Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-on-surface-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estimates.map((est) => (
                  <motion.tr key={est.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="border-b border-gray-50 hover:bg-primary-50/20 transition-colors">
                    <td className="px-4 py-3 font-bold text-accent">{est.estimate_no}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${est.estimate_type === 'gst_estimate' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>
                        {est.estimate_type === 'gst_estimate' ? 'GST' : 'Non-GST'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-on-surface">{est.customer_name || '—'}</p>
                      <p className="text-[11px] text-on-surface-muted">{est.mobile_no || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{est.reg_no || '—'}</p>
                      <p className="text-[11px] text-on-surface-muted">{est.car_name || ''}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">₹{parseFloat(String(est.subtotal)).toLocaleString()}</td>
                    <td className="px-4 py-3 text-on-surface-muted">{est.gst_amount > 0 ? `₹${parseFloat(String(est.gst_amount)).toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3 font-extrabold text-on-surface">₹{parseFloat(String(est.total_amount || est.subtotal)).toLocaleString()}</td>
                    <td className="px-4 py-3 text-on-surface-muted text-xs">{new Date(est.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      {est.converted_job_card_id ? (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-800">Converted</span>
                      ) : est.is_archived ? (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-200 text-gray-600">Archived</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-800">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleOpenItemsModal(est)} title="View & Delete Line Items"
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors">
                          <span className="material-symbols-outlined text-sm">list</span> Items
                        </button>
                        {!est.is_archived && !est.converted_job_card_id && (
                          <>
                            <button onClick={() => handleConvert(est.id)} title="Convert to Job Card"
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-700 transition-colors">
                              <span className="material-symbols-outlined text-lg">swap_horiz</span>
                            </button>
                            <button onClick={() => navigate(`/customer-payments?estimate_id=${est.id}&estimate_no=${est.estimate_no}`)} title="Record Payment"
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors">
                              <span className="material-symbols-outlined text-lg">payments</span>
                            </button>
                            {isAdmin && (
                              <>
                                <button onClick={() => handleArchive(est.id)} title="Archive"
                                  className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors">
                                  <span className="material-symbols-outlined text-lg">archive</span>
                                </button>
                                <button onClick={() => handleDeleteEstimate(est.id, est.estimate_no)} title="Delete Estimate"
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors">
                                  <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                              </>
                            )}
                          </>
                        )}
                        {est.is_archived && isAdmin && (
                          <button onClick={() => handleRestore(est.id)} title="Restore"
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors">
                            <span className="material-symbols-outlined text-lg">unarchive</span>
                          </button>
                        )}
                        {est.converted_job_card_id && (
                          <button onClick={() => navigate(`/job-cards/${est.converted_job_card_id}`)} title="View Job Card"
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-700 transition-colors">
                            <span className="material-symbols-outlined text-lg">open_in_new</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-start justify-center pt-10 overflow-y-auto"
            onClick={() => setShowCreate(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-[700px] p-6 mb-10" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-extrabold text-on-surface font-headline">New Estimate</h2>
                <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-gray-100">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Type Toggle */}
              <div className="flex gap-3 mb-5">
                {(['non_gst_estimate', 'gst_estimate'] as const).map((t) => (
                  <button key={t} onClick={() => setForm({ ...form, estimate_type: t })}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${form.estimate_type === t ? (t === 'gst_estimate' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-violet-500 bg-violet-50 text-violet-700') : 'border-gray-200 text-gray-400'}`}>
                    {t === 'gst_estimate' ? '📋 With GST' : '📄 Without GST'}
                  </button>
                ))}
              </div>

              {/* Customer + Vehicle Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="col-span-1 sm:col-span-2">
                  <SuggestInput
                    type="client_name"
                    placeholder="Customer Name (Optional)"
                    value={form.customer_name}
                    onChange={val => setForm(f => ({ ...f, customer_name: val }))}
                    onLinkedFill={linked => {
                      setForm(f => ({
                        ...f,
                        mobile_no: f.mobile_no || linked.mobile_no || '',
                        reg_no: f.reg_no || linked.reg_no || '',
                        car_name: f.car_name || linked.car_name || '',
                        company_name: f.company_name || linked.company_name || '',
                        gstin: f.gstin || linked.gstin || '',
                      }));
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <SuggestInput
                    type="mobile_no"
                    placeholder="Mobile No"
                    value={form.mobile_no}
                    maxLength={10}
                    onChange={val => setForm(f => ({ ...f, mobile_no: val.replace(/\D/g, '').slice(0, 10) }))}
                    onLinkedFill={linked => {
                      setForm(f => ({
                        ...f,
                        customer_name: f.customer_name || linked.customer_name || linked.client_name || '',
                        reg_no: f.reg_no || linked.reg_no || '',
                        car_name: f.car_name || linked.car_name || '',
                      }));
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <SuggestInput
                    type="reg_no"
                    placeholder="Reg No"
                    value={form.reg_no}
                    maxLength={15}
                    onChange={val => setForm(f => ({ ...f, reg_no: val.toUpperCase().replace(/[\s\-_]/g, '') }))}
                    onLinkedFill={linked => {
                      setForm(f => ({
                        ...f,
                        customer_name: f.customer_name || linked.customer_name || linked.client_name || '',
                        mobile_no: f.mobile_no || linked.mobile_no || '',
                        car_name: f.car_name || linked.car_name || '',
                      }));
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm uppercase font-mono"
                  />
                </div>
                <div>
                  <SuggestInput
                    type="company_name"
                    placeholder="Company Name"
                    value={form.company_name}
                    onChange={val => setForm(f => ({ ...f, company_name: val }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <SuggestInput
                    type="gstin"
                    placeholder="GSTIN"
                    value={form.gstin}
                    onChange={val => setForm(f => ({ ...f, gstin: val }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm uppercase"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <SuggestInput
                    type="car_name"
                    placeholder="Car Name"
                    value={form.car_name}
                    onChange={val => setForm(f => ({ ...f, car_name: val }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Vehicle Make/Model/Variant Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {/* Make */}
                <div className="relative">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Make</label>
                  <input
                    type="text"
                    value={makeQuery}
                    onChange={(e) => { setMakeQuery(e.target.value); setForm(f => ({ ...f, vehicle_make: e.target.value })); }}
                    onFocus={() => makeQuery.length >= 1 && setShowMakeDrop(true)}
                    onBlur={() => setTimeout(() => setShowMakeDrop(false), 180)}
                    placeholder="Maruti, Hyundai..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-accent/20"
                    autoComplete="off"
                  />
                  {showMakeDrop && makeSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[200] max-h-48 overflow-y-auto">
                      {makeSuggestions.map((m) => (
                        <div key={m} onMouseDown={() => selectMake(m)}
                          className="px-3 py-2.5 cursor-pointer text-sm font-medium hover:bg-amber-50 hover:text-amber-800 flex items-center gap-2">
                          <span className="material-symbols-outlined text-gray-400 text-sm">factory</span>{m}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Model */}
                <div className="relative">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Model</label>
                  <input
                    ref={modelInputRef}
                    type="text"
                    value={modelQuery}
                    onChange={(e) => { setModelQuery(e.target.value); setForm(f => ({ ...f, vehicle_model: e.target.value })); }}
                    onFocus={() => form.vehicle_make && setShowModelDrop(true)}
                    onBlur={() => setTimeout(() => setShowModelDrop(false), 180)}
                    placeholder={form.vehicle_make ? `${form.vehicle_make} models...` : 'Select make first'}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-accent/20"
                    autoComplete="off"
                  />
                  {showModelDrop && modelSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[200] max-h-48 overflow-y-auto">
                      {modelSuggestions.map((item) => (
                        <div key={item.model} onMouseDown={() => selectModel(item)}
                          className="px-3 py-2.5 cursor-pointer text-sm font-medium hover:bg-amber-50 hover:text-amber-800 flex items-center justify-between">
                          <span>{item.model}</span>
                          <div className="flex gap-1">
                            {item.fuel_types.map(f => (
                              <span key={f} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{f}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Variant */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Variant</label>
                  <input
                    type="text"
                    value={form.vehicle_variant}
                    onChange={(e) => setForm({ ...form, vehicle_variant: e.target.value })}
                    placeholder={availableVariants.length > 0 ? 'Select variant...' : 'ZXi+, Asta...'}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-accent/20"
                    list="est-variant-list"
                  />
                  <datalist id="est-variant-list">
                    {availableVariants.map(v => <option key={v} value={v} />)}
                  </datalist>
                </div>
              </div>

              {/* Services */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-on-surface">Services & Parts</p>
                  <button onClick={addService} className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">add</span> Add Item
                  </button>
                </div>
                <div className="space-y-3 max-h-[360px] lg:max-h-[460px] overflow-y-auto pr-1">
                  {formServices.map((svc, i) => (
                    <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pb-3 sm:pb-0 border-b sm:border-none border-slate-100">
                      <SuggestInput
                        type="service_name"
                        placeholder="Service or Part name *"
                        value={svc.service_name}
                        onChange={val => updateService(i, 'service_name', val)}
                        className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-accent/20"
                      />
                      <div className="flex items-center gap-2">
                        <input type="number" placeholder="Qty" value={svc.qty} onChange={e => updateService(i, 'qty', e.target.value)}
                          className="w-20 lg:w-24 px-2 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-center" />
                        <input type="number" placeholder="Rate (₹)" value={svc.rate || ''} onChange={e => updateService(i, 'rate', e.target.value)}
                          className="w-28 lg:w-36 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-right" />
                        <span className="text-sm font-extrabold text-on-surface w-28 lg:w-32 text-right font-mono">₹{(parseFloat(String(svc.amount)) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        {formServices.length > 1 && (
                          <button onClick={() => removeService(i)} className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* GST + Totals */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-on-surface-muted">Subtotal</span><span className="font-bold">₹{subtotal.toLocaleString()}</span></div>
                {form.estimate_type === 'gst_estimate' && (
                  <div className="flex justify-between text-sm items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-on-surface-muted">GST</span>
                      <input type="number" value={form.gst_percentage} onChange={e => setForm({ ...form, gst_percentage: e.target.value })}
                        className="w-24 px-1.5 py-1 border border-gray-200 rounded-lg text-xs text-center" />
                      <span className="text-on-surface-muted text-xs">%</span>
                    </div>
                    <span className="font-bold text-emerald-600">₹{gstAmt.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold border-t border-gray-200 pt-2">
                  <span>Grand Total</span><span className="text-accent">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-5">
                <input placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" />
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm py-2.5">Cancel</button>
                <button onClick={handleCreate} disabled={saving} className="btn-primary text-sm py-2.5">
                  {saving ? 'Creating...' : 'Create Estimate'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View & Delete Line Items Modal */}
      <AnimatePresence>
        {viewItemsEstimate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setViewItemsEstimate(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <div>
                  <h2 className="text-lg font-extrabold text-on-surface font-headline">Estimate #{viewItemsEstimate.estimate_no} — Line Items</h2>
                  <p className="text-xs text-slate-500 font-medium">{viewItemsEstimate.customer_name} ({viewItemsEstimate.reg_no || 'No Reg'})</p>
                </div>
                <button onClick={() => setViewItemsEstimate(null)} className="p-2 rounded-xl hover:bg-gray-100">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
                {estimateItems.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8 italic">No line items remaining in this estimate.</p>
                ) : (
                  estimateItems.map((item, idx) => (
                    <div key={item.id || idx} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{item.service_name || item.name}</span>
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                            {item.item_type || 'service'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Qty: <strong>{item.qty || 1}</strong> · Rate: <strong>₹{parseFloat(String(item.rate || 0)).toLocaleString()}</strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-extrabold text-sm text-slate-900">
                          ₹{parseFloat(String(item.amount || 0)).toLocaleString()}
                        </span>
                        {item.id && (
                          <button
                            onClick={() => handleDeleteSavedLineItem(item.id)}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors"
                            title="Delete Item"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-4 border-t mt-4">
                <button onClick={() => setViewItemsEstimate(null)} className="btn-secondary text-sm py-2 px-5">
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

