import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import AnimatedPage from '../components/shared/AnimatedPage';
import { showToast } from '../components/shared/Toast';
import { formatCurrency } from '../utils/format';

interface Booking {
  id: number;
  booking_no: string;
  customer_name: string;
  mobile_no: string;
  car_number: string | null;
  car_name: string | null;
  booking_date: string;
  booking_time: string | null;
  concerns: string | null;
  advance_amount: number;
  advance_mode: string | null;
  booking_status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes: string | null;
  created_by_name: string | null;
}

const STATUS_OPTIONS = [
  { value: 'scheduled',  label: 'Scheduled',  color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'confirmed',  label: 'Confirmed',  color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'completed',  label: 'Completed',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'cancelled',  label: 'Cancelled',  color: 'bg-red-100 text-red-700 border-red-200' },
];

function statusStyle(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.color ?? 'bg-gray-100 text-gray-500';
}
function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(t: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${String(hr % 12 || 12).padStart(2, '0')}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

function BookingFormModal({ initial, onClose, onSaved }: { initial?: Booking | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    customer_name: initial?.customer_name ?? '',
    mobile_no: initial?.mobile_no ?? '',
    car_number: initial?.car_number ?? '',
    car_name: initial?.car_name ?? '',
    booking_date: initial?.booking_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    booking_time: initial?.booking_time?.slice(0, 5) ?? '',
    concerns: initial?.concerns ?? '',
    advance_amount: String(initial?.advance_amount ?? '0'),
    advance_mode: initial?.advance_mode ?? '',
    notes: initial?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeField, setActiveField] = useState<'customer_name' | 'mobile_no' | 'car_number' | null>(null);
  
  // To hold the loaded customer details (address, history)
  const [customerDetails, setCustomerDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Auto-fill customer history if editing or phone is pre-filled
  useEffect(() => {
    if (initial?.mobile_no) {
      const fetchInitialCustomerDetails = async () => {
        try {
          const res = await api.get('/customers/search-connected', { params: { q: initial.mobile_no } });
          const sug = res.data.data?.[0];
          if (sug?.customer_id) {
            const detailRes = await api.get(`/customers/${sug.customer_id}`);
            setCustomerDetails(detailRes.data);
          }
        } catch (err) {
          console.error('Failed to load initial customer details:', err);
        }
      };
      fetchInitialCustomerDetails();
    }
  }, [initial]);

  const handleAutocompleteSearch = async (val: string, field: 'customer_name' | 'mobile_no' | 'car_number') => {
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
    } catch (err) {
      console.error(err);
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = async (sug: any) => {
    setForm(prev => {
      const carName = sug.reg_no ? [sug.make, sug.model, sug.variant].filter(Boolean).join(' ') : prev.car_name;
      return {
        ...prev,
        customer_name: sug.customer_name || prev.customer_name,
        mobile_no: sug.customer_mobile || sug.mobile_no || prev.mobile_no,
        car_number: sug.reg_no || prev.car_number,
        car_name: carName || prev.car_name,
      };
    });
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveField(null);

    if (sug.customer_id) {
      setLoadingDetails(true);
      try {
        const res = await api.get(`/customers/${sug.customer_id}`);
        setCustomerDetails(res.data);
      } catch (err) {
        console.error('Failed to load customer details:', err);
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const renderSuggestions = (field: 'customer_name' | 'mobile_no' | 'car_number') => {
    if (!showSuggestions || activeField !== field || suggestions.length === 0) return null;
    return (
      <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
        {suggestions.map((sug, idx) => (
          <div
            key={idx}
            onMouseDown={() => handleSelectSuggestion(sug)}
            className="p-2.5 hover:bg-amber-50 cursor-pointer border-b border-gray-50 last:border-0 text-xs font-medium text-on-surface"
          >
            <div className="font-bold text-on-surface flex justify-between">
              <span>{sug.customer_name}</span>
              <span className="font-mono text-[10px] text-slate-400">{sug.customer_mobile || sug.mobile_no}</span>
            </div>
            {sug.reg_no && (
              <div className="text-[10px] text-slate-500 mt-0.5">
                🚗 {sug.reg_no} · {[sug.make, sug.model].filter(Boolean).join(' ')}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.mobile_no || !form.booking_date) {
      showToast('Mobile and date required', 'error'); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        customer_name: form.customer_name?.trim() || 'Customer',
        advance_amount: parseFloat(form.advance_amount) || 0
      };
      if (initial) {
        await api.put(`/service-bookings/${initial.id}`, payload);
        showToast('Booking updated', 'success');
      } else {
        await api.post('/service-bookings', payload);
        showToast('Booking created & WhatsApp sent', 'success');
      }
      onSaved(); onClose();
    } catch { showToast('Failed to save booking', 'error'); }
    finally { setSaving(false); }
  };

  const cls = 'w-full px-3 py-2.5 bg-surface border border-gray-200 rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';
  const lbl = 'block text-[10px] font-bold uppercase tracking-widest text-on-surface-muted mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} className="relative bg-surface-card rounded-2xl shadow-2xl w-[95vw] sm:w-full max-w-lg z-10">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">event_note</span>
            </div>
            <div>
              <h2 className="font-headline font-extrabold text-on-surface text-base">{initial ? 'Edit' : 'New'} Service Booking</h2>
              <p className="text-[11px] text-on-surface-muted">With WhatsApp Confirmation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <span className="material-symbols-outlined text-on-surface-muted">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2 relative">
              <label className={lbl}>Customer Name (Optional)</label>
              <input
                className={cls}
                value={form.customer_name}
                onChange={e => {
                  setForm(f => ({ ...f, customer_name: e.target.value }));
                  handleAutocompleteSearch(e.target.value, 'customer_name');
                }}
                onFocus={() => { if (form.customer_name) { setActiveField('customer_name'); setShowSuggestions(true); } }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                placeholder="Customer name"
              />
              {renderSuggestions('customer_name')}
            </div>
            <div className="relative">
              <label className={lbl}>Mobile *</label>
              <input
                className={cls}
                value={form.mobile_no}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setForm(f => ({ ...f, mobile_no: val }));
                  handleAutocompleteSearch(val, 'mobile_no');
                }}
                onFocus={() => { if (form.mobile_no) { setActiveField('mobile_no'); setShowSuggestions(true); } }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                maxLength={10}
                required
              />
              {renderSuggestions('mobile_no')}
            </div>
            <div className="relative">
              <label className={lbl}>Car Number</label>
              <input
                className={cls + ' uppercase font-mono'}
                value={form.car_number}
                onChange={e => {
                  setForm(f => ({ ...f, car_number: e.target.value.toUpperCase() }));
                  handleAutocompleteSearch(e.target.value, 'car_number');
                }}
                onFocus={() => { if (form.car_number) { setActiveField('car_number'); setShowSuggestions(true); } }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
              />
              {renderSuggestions('car_number')}
            </div>
            <div><label className={lbl}>Car Name</label><input className={cls} value={form.car_name} onChange={e => setForm(f => ({ ...f, car_name: e.target.value }))} /></div>
            
            {/* Customer Details & History Block */}
            {loadingDetails && (
              <div className="col-span-2 py-4 text-center text-xs text-on-surface-muted italic">
                Loading customer records...
              </div>
            )}
            {!loadingDetails && customerDetails && (
              <div className="col-span-2 p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[16px]">contact_page</span>
                  Customer History & Address
                </div>

                {/* Address block */}
                <div className="text-xs text-on-surface-muted">
                  <span className="font-bold text-[10px] uppercase text-slate-400 block mb-1">Full Address</span>
                  {[
                    customerDetails.address_line,
                    customerDetails.colony_street,
                    customerDetails.city,
                    customerDetails.state,
                    customerDetails.pincode
                  ].filter(Boolean).join(', ') || 'No address registered.'}
                </div>

                {/* Service/Job History block */}
                <div>
                  <span className="font-bold text-[10px] uppercase text-slate-400 block mb-1.5">Previous Service Cards</span>
                  {customerDetails.job_history?.length > 0 ? (
                    <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 pb-scroll-friendly">
                      {customerDetails.job_history.map((j: any) => (
                        <div key={j.id} className="flex justify-between items-center text-[11px] p-2 bg-white rounded-lg border border-slate-100">
                          <div>
                            <span className="font-bold text-primary font-mono">{j.job_no}</span>
                            <span className="text-on-surface-muted mx-1.5">·</span>
                            <span className="font-semibold text-on-surface">{j.car_name} ({j.reg_no})</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-700 font-mono">{formatCurrency(j.final_amount)}</span>
                            <span className="text-[9px] text-slate-400 block">{fmtDate(j.job_date)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-on-surface-muted italic">No previous service history found.</p>
                  )}
                </div>
              </div>
            )}

            <div><label className={lbl}>Booking Date *</label><input type="date" className={cls} value={form.booking_date} onChange={e => setForm(f => ({ ...f, booking_date: e.target.value }))} required /></div>
            <div><label className={lbl}>Booking Time</label><input type="time" className={cls} value={form.booking_time} onChange={e => setForm(f => ({ ...f, booking_time: e.target.value }))} /></div>
            <div><label className={lbl}>Advance ₹</label><input type="number" className={cls} value={form.advance_amount} onChange={e => setForm(f => ({ ...f, advance_amount: e.target.value }))} /></div>
            <div><label className={lbl}>Payment Mode</label>
              <select className={cls} value={form.advance_mode} onChange={e => setForm(f => ({ ...f, advance_mode: e.target.value }))}>
                <option value="">Select</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Concerns</label><textarea className={cls + ' resize-none'} rows={2} value={form.concerns} onChange={e => setForm(f => ({ ...f, concerns: e.target.value }))} /></div>
            <div className="col-span-2"><label className={lbl}>Notes</label><textarea className={cls + ' resize-none'} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
        </form>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-sm py-2.5 px-5">Cancel</button>
          <button onClick={() => handleSubmit()} disabled={saving} className="btn-primary text-sm py-2.5 px-6 disabled:opacity-60">{saving ? 'Saving…' : initial ? 'Update' : 'Create & Notify'}</button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ServiceBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;
      const res = await api.get('/service-bookings', { params });
      setBookings(res.data.data || []);
    } catch { showToast('Failed to load bookings', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBookings(); }, [statusFilter, search]);

  const updateStatus = async (id: number, s: string) => {
    try {
      await api.patch(`/service-bookings/${id}/status`, { booking_status: s });
      showToast(`Status → ${s}`, 'success'); fetchBookings();
    } catch { showToast('Failed to update', 'error'); }
  };

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 px-4 sm:px-8 pb-12 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface">Service Bookings</h1>
          <p className="text-sm text-on-surface-muted mt-0.5">{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setEditBooking(null); setShowForm(true); }} className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
          <span className="material-symbols-outlined text-xl">add</span>New Booking
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="search-bar flex-1 min-w-[220px] max-w-xs bg-white shadow-sm border border-gray-100">
          <span className="material-symbols-outlined text-primary text-xl">search</span>
          <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-on-surface placeholder-on-surface-muted/50" />
        </div>
        <div className="flex gap-2">
          {['all', ...STATUS_OPTIONS.map(o => o.value)].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${statusFilter === s ? 'bg-primary text-white shadow-sm' : 'bg-white border border-gray-200 text-on-surface-variant hover:bg-gray-50'}`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-on-surface-muted">Loading…</p></div>
        ) : bookings.length === 0 ? (
          <div className="p-20 text-center"><span className="material-symbols-outlined text-5xl text-gray-200 block mb-3">event_note</span><p className="font-bold text-on-surface-muted">No bookings</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[800px]">
              <thead><tr><th>Booking</th><th>Customer</th><th>Vehicle</th><th>Date & Time</th><th>Advance</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {bookings.map((b, i) => (
                  <motion.tr key={b.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="group hover:bg-amber-50/30 transition-colors">
                    <td><span className="text-sm font-bold text-primary font-mono">{b.booking_no}</span></td>
                    <td>
                      <p className="text-sm font-bold text-on-surface">{b.customer_name}</p>
                      <p className="text-[11px] text-on-surface-muted font-mono">{b.mobile_no}</p>
                    </td>
                    <td>
                      {b.car_number && <span className="inline-block px-2.5 py-1 bg-amber-50 rounded-lg text-[11px] font-bold font-mono text-amber-800 border border-amber-200/50">{b.car_number}</span>}
                      {b.car_name && <p className="text-xs text-on-surface-muted mt-0.5">{b.car_name}</p>}
                    </td>
                    <td>
                      <p className="text-sm font-semibold text-on-surface">{fmtDate(b.booking_date)}</p>
                      {b.booking_time && <p className="text-[11px] text-on-surface-muted font-mono">{fmtTime(b.booking_time)}</p>}
                    </td>
                    <td>
                      {b.advance_amount > 0 ? (
                        <span className="text-sm font-bold text-emerald-600">{formatCurrency(b.advance_amount)}</span>
                      ) : <span className="text-on-surface-muted text-sm">—</span>}
                    </td>
                    <td>
                      <select value={b.booking_status} onChange={e => updateStatus(b.id, e.target.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer outline-none transition-all ${statusStyle(b.booking_status)}`}>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditBooking(b); setShowForm(true); }} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Edit">
                          <span className="material-symbols-outlined text-base text-on-surface-variant">edit</span>
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && <BookingFormModal initial={editBooking} onClose={() => { setShowForm(false); setEditBooking(null); }} onSaved={fetchBookings} />}
      </AnimatePresence>
    </AnimatedPage>
  );
}

