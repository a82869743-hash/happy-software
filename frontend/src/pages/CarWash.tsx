import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import AnimatedPage from '../components/shared/AnimatedPage';
import { showToast } from '../components/shared/Toast';
import { formatCurrency, getLocalDateString } from '../utils/format';

interface QuickService {
  id: number;
  service_name: string;
  default_rate: number;
  sort_order: number;
}

interface SelectedService {
  service_name: string;
  rate: number;
  qty: number;
  amount: number;
}

interface CarWashJob {
  id: number;
  job_no: string;
  reg_no: string;
  car_name: string;
  owner_name: string;
  mobile_no: string;
  address?: string;
  odometer?: number;
  status: string;
  job_date: string;
  created_at: string;
  final_amount: number;
  calculated_total?: number;
  billing_type: 'gst' | 'non_gst';
  invoice_no?: string;
  payment_mode?: string;
  services?: SelectedService[];
}

export default function CarWash() {
  const navigate = useNavigate();
  const { id: urlParamId } = useParams<{ id?: string }>();

  const [quickServices, setQuickServices] = useState<QuickService[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [customService, setCustomService] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [saveCustomService, setSaveCustomService] = useState(false);
    const [paymentMode, setPaymentMode] = useState<string>('cash');

  // Form fields
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [regNo, setRegNo] = useState('');
  const [carName, setCarName] = useState('');
  const [odometer, setOdometer] = useState('');
  const [jobDate, setJobDate] = useState(getLocalDateString());

  // Edit mode tracking
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [editingJobNo, setEditingJobNo] = useState<string>('');

  // Recent jobs list state
  const [recentJobs, setRecentJobs] = useState<CarWashJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'all' | 'custom'>('all');
  const [customFilterDate, setCustomFilterDate] = useState(getLocalDateString());

  // Auto-fill suggestions state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeField, setActiveField] = useState<'regNo' | 'ownerName' | 'mobile' | null>(null);

  // Fetch preset services
  useEffect(() => {
    api.get('/quick-job-cards/quick-services')
      .then(res => {
        const raw = res.data.data || [];
        const unique: QuickService[] = [];
        const seen = new Set<string>();
        for (const item of raw) {
          if (!seen.has(item.service_name)) {
            seen.add(item.service_name);
            unique.push(item);
          }
        }
        setQuickServices(unique);
      })
      .catch(() => {});
  }, []);

  // Fetch recent car wash jobs
  const fetchRecentJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const params: any = {};
      if (dateFilter === 'today') {
        params.date = getLocalDateString();
      } else if (dateFilter === 'custom') {
        params.date = customFilterDate;
      }
      if (searchTerm.trim()) {
        params.q = searchTerm.trim();
      }
      const res = await api.get('/quick-job-cards', { params });
      setRecentJobs(res.data.data || []);
    } catch {
      setRecentJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, [dateFilter, customFilterDate, searchTerm]);

  useEffect(() => {
    fetchRecentJobs();
  }, [fetchRecentJobs]);

  // Load a job into form for editing
  const loadJobForEdit = useCallback((job: CarWashJob) => {
    setEditingJobId(job.id);
    setEditingJobNo(job.job_no);
    setOwnerName(job.owner_name || '');
    setMobile(job.mobile_no || '');
    setAddress(job.address || '');
    setRegNo(job.reg_no || '');
    setCarName(job.car_name || '');
    setOdometer(job.odometer ? String(job.odometer) : '');
    const jDate = job.job_date ? String(job.job_date).slice(0, 10) : getLocalDateString();
    setJobDate(jDate);
        setPaymentMode(job.payment_mode || 'cash');

    if (Array.isArray(job.services) && job.services.length > 0) {
      setSelectedServices(job.services.map((s: any) => ({
        service_name: s.service_name,
        rate: parseFloat(s.rate !== undefined ? s.rate : s.amount) || 0,
        qty: parseFloat(s.qty || 1) || 1,
        amount: parseFloat(s.amount !== undefined ? s.amount : s.rate) || 0
      })));
    } else {
      setSelectedServices([]);
    }

    setCustomService('');
    setCustomRate('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Check URL parameter for :id edit
  useEffect(() => {
    if (urlParamId) {
      const jobId = parseInt(urlParamId, 10);
      if (!isNaN(jobId)) {
        api.get(`/quick-job-cards/${jobId}`)
          .then(res => {
            if (res.data?.data) {
              const job = { ...res.data.data, services: res.data.services };
              loadJobForEdit(job);
            }
          })
          .catch(() => {
            showToast('Failed to load requested car wash job', 'error');
          });
      }
    }
  }, [urlParamId, loadJobForEdit]);

  const handleCancelEdit = () => {
    setEditingJobId(null);
    setEditingJobNo('');
    setOwnerName('');
    setMobile('');
    setAddress('');
    setRegNo('');
    setCarName('');
    setOdometer('');
    setJobDate(getLocalDateString());
    setSelectedServices([]);
    setCustomService('');
    setCustomRate('');
        setPaymentMode('cash');
    if (urlParamId) {
      navigate('/car-wash');
    }
  };

  const handleSearch = async (val: string, field: 'regNo' | 'ownerName' | 'mobile') => {
    setActiveField(field);
    if (!val || val.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await api.get('/customers/search-connected', { params: { q: val } });
      setSuggestions(res.data.data || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (sug: any) => {
    setOwnerName(sug.customer_name || '');
    setMobile(sug.customer_mobile || sug.mobile_no || '');
    if (sug.address_line) setAddress(sug.address_line);
    if (sug.reg_no) setRegNo(sug.reg_no);
    if (sug.make || sug.model) {
      setCarName([sug.make, sug.model, sug.variant].filter(Boolean).join(' '));
    } else if (sug.car_name) {
      setCarName(sug.car_name);
    }
    if (sug.odometer) setOdometer(String(sug.odometer));
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveField(null);
  };

  const renderSuggestions = (field: 'regNo' | 'ownerName' | 'mobile') => {
    if (!showSuggestions || activeField !== field || suggestions.length === 0) return null;
    return (
      <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
        {suggestions.map((sug, idx) => (
          <div
            key={idx}
            onMouseDown={() => handleSelectSuggestion(sug)}
            className="p-2.5 hover:bg-amber-50 cursor-pointer border-b border-gray-50 last:border-0 text-xs font-medium text-slate-700 transition-colors"
          >
            <div className="font-bold text-slate-800 flex justify-between">
              <span>{sug.customer_name}</span>
              <span className="font-mono text-[10px] text-slate-400">{sug.customer_mobile || sug.mobile_no}</span>
            </div>
            {sug.reg_no && (
              <div className="text-[10px] text-slate-500 mt-0.5">
                🚗 {sug.reg_no} · {[sug.make, sug.model].filter(Boolean).join(' ')}
              </div>
            )}
            {sug.address_line && (
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                📍 {sug.address_line}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const toggleService = (svc: QuickService) => {
    const exists = selectedServices.find(s => s.service_name === svc.service_name);
    if (exists) {
      setSelectedServices(prev => prev.filter(s => s.service_name !== svc.service_name));
    } else {
      setSelectedServices(prev => [...prev, {
        service_name: svc.service_name,
        rate: svc.default_rate || 0,
        qty: 1,
        amount: svc.default_rate || 0
      }]);
    }
  };

  const updateServiceRate = (name: string, newRate: number) => {
    setSelectedServices(prev => prev.map(s => {
      if (s.service_name === name) {
        return { ...s, rate: newRate, amount: newRate * s.qty };
      }
      return s;
    }));
  };

  const isSelected = (name: string) => selectedServices.some(s => s.service_name === name);

  const subtotal = selectedServices.reduce((sum, s) => sum + (parseFloat(String(s.amount)) || 0), 0)
    + (customService.trim() ? parseFloat(customRate) || 0 : 0);
    const total = subtotal;

  const handleSubmit = async () => {
    if (!mobile.trim() || !regNo.trim() || !carName.trim()) {
      showToast('Please fill all required fields (Mobile, Reg. No, Car Name)', 'error');
      return;
    }
    if (selectedServices.length === 0 && !customService.trim()) {
      showToast('Please select at least one wash service', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        reg_no: regNo.toUpperCase().trim(),
        owner_name: ownerName.trim() || 'Customer',
        mobile: mobile.trim(),
        address: address.trim(),
        car_name: carName.trim(),
        odometer: odometer.trim(),
        job_date: jobDate,
        billing_type: 'non_gst',
        payment_mode: paymentMode,
        services: selectedServices.map(s => ({
          ...s,
          tax_pct: 0
        })),
        custom_service: customService.trim(),
        custom_service_rate: customRate,
        save_custom_service: saveCustomService
      };

      if (editingJobId) {
        // UPDATE existing Car Wash job card
        await api.put(`/quick-job-cards/${editingJobId}`, payload);
        showToast(`Car Wash order #${editingJobNo} updated successfully!`, 'success');
        handleCancelEdit();
        fetchRecentJobs();
      } else {
        // CREATE new Car Wash job card
        const res = await api.post('/quick-job-cards', payload);
        showToast(`Car Wash order ${res.data.job_no} created successfully!`, 'success');
        handleCancelEdit();
        fetchRecentJobs();
      }
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to save job card', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJob = async (job: CarWashJob) => {
    if (!window.confirm(`Are you sure you want to delete Car Wash Order #${job.job_no} (${job.owner_name} - ₹${job.calculated_total || job.final_amount})?`)) {
      return;
    }
    try {
      await api.delete(`/quick-job-cards/${job.id}`);
      showToast(`Car Wash job card #${job.job_no} deleted successfully`, 'success');
      if (editingJobId === job.id) handleCancelEdit();
      fetchRecentJobs();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete job card', 'error');
    }
  };

  const inputCls = "w-full bg-slate-50 border border-stone-200/80 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 py-3 px-4 font-medium text-sm text-slate-800 placeholder:text-slate-400 transition-all";

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 px-4 sm:px-8 pb-16 max-w-6xl mx-auto space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/job-cards')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-amber-800 transition-colors mb-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Detailing Studio
          </button>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-extrabold text-slate-900 font-headline tracking-tight">
              🚗 Car Wash
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-200/80">
              Car Wash Center
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Fast express washes, foam wash, interior cleaning, and synchronized billing.
          </p>
        </div>

        {editingJobId && (
          <div className="flex items-center gap-2">
            <span className="bg-amber-100 text-amber-900 font-bold px-3 py-1 rounded-xl text-xs flex items-center gap-1 border border-amber-300">
              <span className="material-symbols-outlined text-sm">edit</span>
              <span>Editing Job #{editingJobNo}</span>
            </span>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-3 py-1 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Cancel Edit
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Form + Billing Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Form (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* ═══ Top Payment Option: Cash vs Credit ═══ */}
          <div className="bg-white rounded-2xl border border-amber-200/80 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-gradient-to-b from-amber-500 to-amber-600 rounded-full" />
                <div>
                  <h3 className="font-headline font-bold text-base text-stone-900">Payment Option</h3>
                  <p className="text-xs text-stone-500">Choose settlement mode for this Car Wash order</p>
                </div>
              </div>
              <span className={`text-[11px] font-extrabold uppercase px-3 py-1 rounded-full border self-start sm:self-auto ${
                paymentMode === 'credit'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-amber-500/15 text-amber-900 border-amber-400/50'
              }`}>
                {paymentMode === 'credit' ? '● Goes to Payment Pending' : '● Cash Paid'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Cash Option */}
              <button
                type="button"
                onClick={() => setPaymentMode('cash')}
                className={`p-4 rounded-xl border-2 text-left flex items-start gap-3.5 transition-all cursor-pointer ${
                  paymentMode !== 'credit'
                    ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-1 ring-amber-500/30'
                    : 'border-stone-200 bg-stone-50/40 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  paymentMode !== 'credit' ? 'bg-amber-500 text-stone-950 font-black shadow-sm' : 'bg-stone-200 text-stone-500'
                }`}>
                  <span className="material-symbols-outlined text-2xl">payments</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-headline font-extrabold text-sm text-stone-900">Cash</span>
                    {paymentMode !== 'credit' && (
                      <span className="material-symbols-outlined text-amber-600 text-lg">check_circle</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 mt-0.5 leading-snug">Order is marked as Cash Paid upon creation</p>
                </div>
              </button>

              {/* Credit Option */}
              <button
                type="button"
                onClick={() => setPaymentMode('credit')}
                className={`p-4 rounded-xl border-2 text-left flex items-start gap-3.5 transition-all cursor-pointer ${
                  paymentMode === 'credit'
                    ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-1 ring-amber-500/30'
                    : 'border-stone-200 bg-stone-50/40 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  paymentMode === 'credit' ? 'bg-amber-500 text-stone-950 font-black shadow-sm' : 'bg-stone-200 text-stone-500'
                }`}>
                  <span className="material-symbols-outlined text-2xl">pending_actions</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-headline font-extrabold text-sm text-stone-900">Credit</span>
                    {paymentMode === 'credit' && (
                      <span className="material-symbols-outlined text-amber-600 text-lg">check_circle</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 mt-0.5 leading-snug">Goes directly to Payment Pending register</p>
                </div>
              </button>
            </div>
          </div>

          {/* Customer & Vehicle Information */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-lg">person</span>
                {editingJobId ? `Edit Details: Job #${editingJobNo}` : 'Customer & Vehicle Details'}
              </h2>
              {editingJobId && (
                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  In Edit Mode
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. Owner Name */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Customer / Owner Name <span className="text-slate-400 font-normal text-[10px] lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => {
                    setOwnerName(e.target.value);
                    handleSearch(e.target.value, 'ownerName');
                  }}
                  onFocus={() => { if (ownerName) setShowSuggestions(true); setActiveField('ownerName'); }}
                  onBlur={() => { setTimeout(() => { setShowSuggestions(false); }, 200); }}
                  placeholder="Customer name"
                  className={inputCls}
                />
                {renderSuggestions('ownerName')}
              </div>

              {/* 2. Mobile */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setMobile(val);
                    handleSearch(val, 'mobile');
                  }}
                  onFocus={() => { if (mobile) setShowSuggestions(true); setActiveField('mobile'); }}
                  onBlur={() => { setTimeout(() => { setShowSuggestions(false); }, 200); }}
                  placeholder="9876543210"
                  maxLength={10}
                  className={inputCls}
                />
                {renderSuggestions('mobile')}
              </div>

              {/* 3. Address */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Address / Area
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Address / Area / Landmark..."
                  className={inputCls}
                />
              </div>

              {/* 4. Reg. No */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Registration No <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={regNo}
                  maxLength={10}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
                    setRegNo(val);
                    handleSearch(val, 'regNo');
                  }}
                  onFocus={() => { if (regNo) setShowSuggestions(true); setActiveField('regNo'); }}
                  onBlur={() => { setTimeout(() => { setShowSuggestions(false); }, 200); }}
                  placeholder="GJ06XX0000"
                  className={inputCls}
                />
                {renderSuggestions('regNo')}
              </div>

              {/* 5. Car Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Car Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={carName}
                  onChange={(e) => setCarName(e.target.value)}
                  placeholder="Swift Dzire, Creta, Fortuner..."
                  className={inputCls}
                />
              </div>

              {/* Job / Wash Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Wash Date
                </label>
                <input
                  type="date"
                  value={jobDate}
                  onChange={(e) => setJobDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Quick Services Selection */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-lg">local_car_wash</span>
                Select Wash Services
              </h2>
              <span className="text-xs text-slate-500 font-semibold">
                {selectedServices.length} Selected
              </span>
            </div>

            {quickServices.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                <p className="text-xs font-semibold text-slate-600">No preset wash services yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Type below and click "+ Add Preset" to create your wash services manually, or add custom services below.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {quickServices.map(svc => {
                  const active = isSelected(svc.service_name);
                  return (
                    <div key={svc.id} className="inline-flex items-center gap-1 bg-slate-50 rounded-xl border border-slate-200 p-0.5">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => toggleService(svc)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          active
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-extrabold shadow-sm'
                            : 'text-stone-700 hover:text-amber-900 hover:bg-amber-50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {active ? 'check_circle' : 'add_circle'}
                        </span>
                        {svc.service_name}
                      </motion.button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Delete preset service "${svc.service_name}"?`)) {
                            try {
                              await api.delete(`/quick-job-cards/quick-services/${svc.id}`);
                              setQuickServices(prev => prev.filter(s => s.id !== svc.id));
                              setSelectedServices(prev => prev.filter(s => s.service_name !== svc.service_name));
                              showToast(`Deleted preset "${svc.service_name}"`, 'info');
                            } catch {
                              showToast('Failed to delete preset', 'error');
                            }
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer mr-1"
                        title={`Delete ${svc.service_name} preset`}
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Save new preset service */}
            <div className="flex gap-2 pt-2 items-center max-w-md">
              <input
                type="text"
                placeholder="Add new wash service preset name..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('btn-add-preset')?.click();
                  }
                }}
                className="flex-grow bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-amber-500"
              />
              <button
                id="btn-add-preset"
                type="button"
                onClick={async () => {
                  if (!newPresetName.trim()) return;
                  try {
                    await api.post('/quick-job-cards/quick-services', { service_name: newPresetName.trim() });
                    showToast(`Saved "${newPresetName.trim()}" to presets`, 'success');
                    setNewPresetName('');
                    const res = await api.get('/quick-job-cards/quick-services');
                    const raw = res.data.data || [];
                    const unique: QuickService[] = [];
                    const seen = new Set<string>();
                    for (const item of raw) {
                      if (!seen.has(item.service_name)) {
                        seen.add(item.service_name);
                        unique.push(item);
                      }
                    }
                    setQuickServices(unique);
                  } catch {
                    showToast('Failed to save preset', 'error');
                  }
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 text-xs font-extrabold rounded-lg shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                + Add Preset
              </button>
            </div>

            {/* Custom service */}
            <div className="pt-3 border-t border-gray-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Custom Service (Optional)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8">
                  <input
                    type="text"
                    placeholder="e.g. Engine Degreasing, Headlight Restoration..."
                    value={customService}
                    onChange={(e) => setCustomService(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-4">
                  <input
                    type="number"
                    placeholder="Rate ₹"
                    value={customRate}
                    onChange={(e) => setCustomRate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              {customService.trim() && (
                <label className="flex items-center gap-2 mt-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveCustomService}
                    onChange={(e) => setSaveCustomService(e.target.checked)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Save this custom service as a preset button for future jobs</span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Right: Summary & Billing (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5 sticky top-28">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-3">
              <span className="material-symbols-outlined text-amber-600 text-lg">receipt_long</span>
              {editingJobId ? `Job #${editingJobNo} Summary` : 'Job Card Summary'}
            </h3>

            {/* Selected Services list with rates */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {selectedServices.length === 0 && !customService.trim() ? (
                <p className="text-xs text-slate-400 italic py-3 text-center">
                  No services selected yet. Click any quick service button to add.
                </p>
              ) : (
                <>
                  {selectedServices.map(svc => (
                    <div key={svc.service_name} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        {svc.service_name}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-medium">₹</span>
                        <input
                          type="number"
                          value={svc.rate || ''}
                          onChange={(e) => updateServiceRate(svc.service_name, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-16 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-right font-bold text-slate-800 text-xs focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  ))}
                  {customService.trim() && (
                    <div className="flex items-center justify-between text-xs bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 text-amber-950 font-semibold">
                      <span className="font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        {customService}
                      </span>
                      <span className="font-bold">₹{parseFloat(customRate) || 0}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Payment Settlement Status */}
            <div className="pt-3 border-t border-gray-100">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Payment Option
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('cash')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMode !== 'credit'
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">payments</span>
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('credit')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMode === 'credit'
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">pending_actions</span>
                  Credit
                </button>
              </div>
            </div>

            {/* Total Breakdown */}
            <div className="bg-slate-50 p-3.5 rounded-xl space-y-1.5 text-xs border border-slate-100">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total</span>
                <span className="font-mono text-amber-800 font-extrabold">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-extrabold uppercase tracking-wider text-xs rounded-xl shadow-button hover:shadow-button-hover active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">
                  {editingJobId ? 'save' : 'local_car_wash'}
                </span>
                <span>
                  {saving
                    ? 'Saving Changes...'
                    : editingJobId
                    ? `Save Job #${editingJobNo} Changes`
                    : 'Create Car Wash Order'}
                </span>
              </button>

              {editingJobId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel Edit / Create New
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Car Wash Orders Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 font-headline flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">history</span>
              <span>Recent Car Wash Orders ({recentJobs.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click &quot;Edit&quot; on any job card to load and modify services, vehicle, customer, or totals.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-base">search</span>
              <input
                type="text"
                placeholder="Search job, reg, customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 w-52 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            {/* Date Pills */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setDateFilter('today')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  dateFilter === 'today' ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  dateFilter === 'all' ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('custom')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  dateFilter === 'custom' ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Custom
              </button>
            </div>

            {dateFilter === 'custom' && (
              <input
                type="date"
                value={customFilterDate}
                onChange={(e) => setCustomFilterDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              />
            )}
          </div>
        </div>

        {/* Jobs List / Table */}
        {loadingJobs ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-semibold">Loading car wash jobs...</p>
          </div>
        ) : recentJobs.length === 0 ? (
          <div className="py-12 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">local_car_wash</span>
            <p className="text-sm font-bold text-slate-700">No Car Wash jobs found</p>
            <p className="text-xs text-slate-400 mt-1">Create a new express wash job using the form above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3">Order #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Customer & Phone</th>
                  <th className="py-3 px-3">Vehicle</th>
                  <th className="py-3 px-3">Wash Services</th>
                  <th className="py-3 px-3 text-right">Total Amount</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                <AnimatePresence>
                  {recentJobs.map(job => {
                    const isCurrentEdit = editingJobId === job.id;
                    const jobAmt = parseFloat(String(job.calculated_total || job.final_amount || 0));
                    return (
                      <motion.tr
                        key={job.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`hover:bg-amber-50/40 transition-colors ${
                          isCurrentEdit ? 'bg-amber-50/70 border-l-4 border-amber-500' : ''
                        }`}
                      >
                        {/* Job No */}
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          <span className="text-amber-800 font-black">#{job.job_no}</span>
                          {job.invoice_no && (
                            <span className="block text-[10px] text-slate-400 font-mono font-normal">
                              Inv: {job.invoice_no}
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">
                          {job.job_date ? String(job.job_date).slice(0, 10) : String(job.created_at).slice(0, 10)}
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{job.owner_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{job.mobile_no}</div>
                        </td>

                        {/* Vehicle */}
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded inline-block text-[11px]">
                            {job.reg_no}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{job.car_name}</div>
                        </td>

                        {/* Services */}
                        <td className="py-3 px-3 max-w-[220px]">
                          <div className="flex flex-wrap gap-1">
                            {job.services && job.services.length > 0 ? (
                              job.services.map((s, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-semibold truncate max-w-[150px]"
                                  title={s.service_name}
                                >
                                  {s.service_name}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">Car Wash</span>
                            )}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 text-sm">
                          {formatCurrency(jobAmt)}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => loadJobForEdit(job)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Edit this car wash job card"
                            >
                              <span className="material-symbols-outlined text-xs">edit</span>
                              <span>Edit</span>
                            </button>

                            {/* Print Button */}
                            <button
                              type="button"
                              onClick={() => window.open(`/invoice/${job.id}`, '_blank')}
                              className="p-1 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                              title="Print Invoice / Bill"
                            >
                              <span className="material-symbols-outlined text-base">print</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteJob(job)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Delete job card"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
