import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import Modal from '../components/shared/Modal';
import AnimatedPage from '../components/shared/AnimatedPage';
import { showToast } from '../components/shared/Toast';
import { formatCurrency } from '../utils/format';

interface Part {
  id: number; part_code: string; part_name: string; category: string; unit: string;
  buying_price: number; selling_price: number; stock_qty: number; low_stock_alert: number; is_low: number;
  hsn_sac?: string;
}
interface JobOption { id: number; job_no: string; reg_no: string; }

const emptyForm = { part_name: '', category: 'General', unit: 'pc', buying_price: '', selling_price: '', stock_qty: '', low_stock_alert: '5', hsn_sac: '8708' };
const CATEGORIES = ['General', 'Ceramics', 'Detailing', 'Polish', 'PPF', 'Wash', 'Tools', 'Accessories'];

export default function Parts() {
  const [parts, setParts] = useState<Part[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  
  // Modals for Inventory Management
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; data: typeof emptyForm; id?: number } | null>(null);
  const [restockModal, setRestockModal] = useState<{ part: Part; adjustment: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Quick POS State
  const [posForm, setPosForm] = useState({
    part_id: '',
    custom_part_name: '',
    custom_price: '',
    quantity: '1',
    payment_mode: 'UPI',
    customer_name: '',
    job_card_id: ''
  });
  const [posSaving, setPosSaving] = useState(false);

  const fetchParts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/parts');
      setParts(res.data.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api.get('/job-cards', { params: { status: 'active' } });
      setJobs(res.data.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { 
    fetchParts(); 
    fetchJobs();
  }, [fetchParts, fetchJobs]);

  const getFilteredAndSortedParts = () => {
    let list = parts.filter(p => {
      const matchesSearch = p.part_name.toLowerCase().includes(search.toLowerCase()) || p.part_code.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    if (sortBy === 'rate_asc') {
      list.sort((a, b) => a.selling_price - b.selling_price);
    } else if (sortBy === 'rate_desc') {
      list.sort((a, b) => b.selling_price - a.selling_price);
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.part_name.localeCompare(b.part_name));
    }
    return list;
  };

  const filtered = getFilteredAndSortedParts();

  // Inventory Management Handlers
  const handleSave = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api.post('/parts', modal.data);
        showToast('Part added', 'success');
      } else {
        await api.put(`/parts/${modal.id}`, modal.data);
        showToast('Part updated', 'success');
      }
      setModal(null); fetchParts();
    } catch (err: any) { showToast(err.response?.data?.error || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleRestock = async () => {
    if (!restockModal || !restockModal.adjustment) return;
    setSaving(true);
    try {
      const res = await api.patch(`/parts/${restockModal.part.id}/stock`, { adjustment: parseFloat(restockModal.adjustment) });
      showToast(`Stock updated → ${res.data.new_stock}`, 'success');
      setRestockModal(null); fetchParts();
    } catch (err: any) { showToast(err.response?.data?.error || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  // Quick POS Handlers
  const isCustomPart = posForm.part_id === 'custom';
  const selectedPosPart = parts.find(p => p.id === parseInt(posForm.part_id));
  const posTotalAmount = isCustomPart
    ? ((parseFloat(posForm.custom_price) || 0) * (parseFloat(posForm.quantity) || 0))
    : (selectedPosPart ? (selectedPosPart.selling_price * (parseFloat(posForm.quantity) || 0)) : 0);

  const handlePosSubmit = async () => {
    if (!posForm.part_id) {
      showToast('Please select a part or choose Add Custom Item', 'warning');
      return;
    }

    let targetPartId = parseInt(posForm.part_id);
    let unitPrice = 0;

    setPosSaving(true);

    if (isCustomPart) {
      if (!posForm.custom_part_name.trim()) {
        showToast('Please enter a Manual Part Name', 'warning');
        setPosSaving(false);
        return;
      }
      if (!posForm.custom_price || parseFloat(posForm.custom_price) <= 0) {
        showToast('Please enter a valid Selling Price', 'warning');
        setPosSaving(false);
        return;
      }

      try {
        // Auto-create custom part in inventory master
        const createRes = await api.post('/parts', {
          part_name: posForm.custom_part_name.trim(),
          category: 'General',
          unit: 'pc',
          buying_price: parseFloat(posForm.custom_price),
          selling_price: parseFloat(posForm.custom_price),
          stock_qty: parseFloat(posForm.quantity) || 1,
          low_stock_alert: 5,
          hsn_sac: '8708'
        });
        targetPartId = createRes.data.id;
        unitPrice = parseFloat(posForm.custom_price);
      } catch (err: any) {
        showToast(err.response?.data?.error || 'Failed to create custom item', 'error');
        setPosSaving(false);
        return;
      }
    } else {
      if (!selectedPosPart) {
        showToast('Invalid part selected', 'error');
        setPosSaving(false);
        return;
      }
      unitPrice = selectedPosPart.selling_price;
      
      // Auto-restock if stock is currently insufficient for sales
      if (selectedPosPart.stock_qty < parseFloat(posForm.quantity)) {
        try {
          const needed = parseFloat(posForm.quantity) - selectedPosPart.stock_qty;
          await api.patch(`/parts/${selectedPosPart.id}/stock`, { adjustment: needed });
        } catch { /* proceed */ }
      }
    }

    if (!posForm.quantity || parseFloat(posForm.quantity) <= 0) {
      showToast('Please enter a valid quantity', 'warning');
      setPosSaving(false);
      return;
    }

    try {
      await api.post('/parts-sales', {
        part_id: targetPartId,
        quantity: parseFloat(posForm.quantity),
        unit_price: unitPrice,
        customer_name: posForm.customer_name,
        payment_mode: posForm.payment_mode.toLowerCase(),
        job_card_id: posForm.job_card_id ? parseInt(posForm.job_card_id) : null
      });
      showToast('Quick POS Sale recorded successfully!', 'success');
      setPosForm({
        part_id: '',
        custom_part_name: '',
        custom_price: '',
        quantity: '1',
        payment_mode: 'UPI',
        customer_name: '',
        job_card_id: ''
      });
      fetchParts(); // Refresh stock
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to record sale', 'error');
    } finally {
      setPosSaving(false);
    }
  };

  const fmt = (n: number) => formatCurrency(n);
  
  // Dashboard Metrics
  const lowStockCount = parts.filter(p => p.is_low).length;
  const totalStockValue = parts.reduce((acc, p) => acc + (p.stock_qty * p.buying_price), 0);

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 p-4 sm:p-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 w-full">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface font-headline">Parts & Sales Inventory</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant font-label">STOCK MASTER & POS</span>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setModal({ mode: 'add', data: { ...emptyForm } })}
            className="btn-primary w-full sm:w-auto justify-center"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Add New Part
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card-solid p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-muted mb-2 font-label">Total SKUs</p>
          <div className="flex items-baseline justify-between">
            <h3 className="text-3xl font-black text-primary font-headline">{parts.length}</h3>
            <span className="text-[10px] font-bold text-primary bg-primary-50 px-2 py-0.5 rounded-full font-label border border-primary/20">IN STOCK</span>
          </div>
        </div>
        <div className={`glass-card-solid p-6 border-l-4 ${lowStockCount > 0 ? 'border-l-warning' : 'border-l-gray-100'}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-muted mb-2 font-label">Low Stock Alert</p>
          <div className="flex items-baseline justify-between">
            <h3 className="text-3xl font-black text-warning-dark font-headline">{lowStockCount} <span className="text-sm font-medium text-warning-dark/60">Items</span></h3>
            {lowStockCount > 0 && <span className="material-symbols-outlined text-warning animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>}
          </div>
        </div>
        <div className="glass-card-solid p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-muted mb-2 font-label">Total Stock Value <span>(Cost)</span></p>
          <div className="flex items-baseline justify-between">
            <h3 className="text-3xl font-black text-primary font-headline">{fmt(totalStockValue)}</h3>
            <span className="material-symbols-outlined text-primary/30">inventory_2</span>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        {/* Left: Parts Master Table (70%) */}
        <div className="lg:col-span-7 glass-card-solid overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center items-start gap-4 bg-surface/50 backdrop-blur-md">
            <h4 className="font-bold font-headline text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">list_alt</span>
              Parts Inventory Master
            </h4>
            <div className="flex flex-wrap items-center gap-3 relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2 px-3 font-semibold text-xs cursor-pointer text-slate-700 text-on-surface"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2 px-3 font-semibold text-xs cursor-pointer text-slate-700 text-on-surface"
              >
                <option value="name">Sort by Name</option>
                <option value="rate_asc">Rate: Low to High</option>
                <option value="rate_desc">Rate: High to Low</option>
              </select>
              <div className="search-bar w-48 sm:w-64">
                <span className="material-symbols-outlined text-on-surface-muted text-sm">search</span>
                <input 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-on-surface placeholder:text-on-surface-muted font-medium"
                  placeholder="Search code or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[750px]">
              <thead>
                <tr>
                  <th>ID / Code</th>
                  <th>Part Details</th>
                  <th>Stock Level</th>
                  <th>Price (Cost / MRP)</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-variant">Loading inventory...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-variant">No parts found.</td></tr>
                ) : (
                  filtered.map((p) => {
                    const stockPct = Math.min(100, Math.max(0, (p.stock_qty / (p.low_stock_alert * 3)) * 100));
                    return (
                      <tr key={p.id} className="hover:bg-primary-50/20 transition-colors group">
                        <td className="px-6 py-4 font-mono text-xs text-primary/60 font-bold">
                          {p.part_code}
                          {p.hsn_sac && <div className="text-[10px] text-slate-400 font-semibold mt-0.5">HSN: {p.hsn_sac}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className="font-bold text-on-surface">{p.part_name}</span>
                            <span className="px-2 py-0.5 rounded-full border border-gray-200 bg-surface text-[10px] font-bold text-on-surface-muted w-max uppercase tracking-wider">{p.category}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`font-bold font-headline ${p.is_low ? 'text-error-dark' : 'text-primary'}`}>{p.stock_qty}</span>
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden shrink-0">
                              <div className={`h-full ${p.is_low ? 'bg-error-dark' : 'bg-success'}`} style={{ width: `${stockPct}%` }}></div>
                            </div>
                            {p.is_low ? <span className="text-[9px] font-bold text-error-dark uppercase bg-error-light px-1.5 py-0.5 rounded border border-error/20 tracking-widest">LOW</span> : null}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs text-on-surface-muted">Cost: {fmt(p.buying_price)}</span>
                            <span className="font-bold text-primary text-sm">MRP: {fmt(p.selling_price)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setRestockModal({ part: p, adjustment: '' })}
                              className="btn-ghost w-8 h-8 p-0 flex items-center justify-center rounded-lg"
                              title="Restock"
                            >
                              <span className="material-symbols-outlined text-[18px]">inventory</span>
                            </button>
                            <button 
                              onClick={() => setModal({
                                mode: 'edit', id: p.id,
                                data: { part_name: p.part_name, category: p.category, unit: p.unit, buying_price: String(p.buying_price), selling_price: String(p.selling_price), stock_qty: String(p.stock_qty), low_stock_alert: String(p.low_stock_alert), hsn_sac: p.hsn_sac || '8708' }
                              })}
                              className="btn-ghost w-8 h-8 p-0 flex items-center justify-center rounded-lg"
                              title="Edit Part"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-auto px-6 py-4 bg-gray-50/50 border-t border-gray-100 text-xs text-on-surface-muted font-medium">
            Showing {filtered.length} parts
          </div>
        </div>

        {/* Right: Quick POS (30%) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="premium-card bg-gradient-to-br from-primary to-primary-light border-0 text-white p-6 relative overflow-hidden group">
            {/* Technical Texture Overlays */}
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/20 rounded-full opacity-50 blur-3xl"></div>
            
            <h4 className="relative font-headline text-lg font-extrabold uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary-light">bolt</span>
              Quick POS
            </h4>
            
            <div className="relative space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/80 font-label">
                    Select Part <span className="text-secondary-light">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setModal({ mode: 'add', data: { ...emptyForm } })}
                    className="text-[10px] font-bold text-amber-200 hover:text-white underline"
                  >
                    + Add New SKU
                  </button>
                </div>
                <select 
                  value={posForm.part_id}
                  onChange={(e) => setPosForm({ ...posForm, part_id: e.target.value })}
                  className="w-full bg-slate-900/90 text-white border border-white/30 rounded-xl py-2.5 px-3 text-xs font-semibold focus:ring-2 focus:ring-amber-400 transition-all cursor-pointer"
                >
                  <option value="" className="text-gray-900 bg-white">Choose part...</option>
                  <option value="custom" className="text-amber-900 bg-amber-100 font-bold">+ Add Custom / Manual Item...</option>
                  {parts.map(p => (
                    <option key={p.id} value={p.id} className="text-gray-900 bg-white">
                      {p.part_name} ({p.part_code}) - {fmt(p.selling_price)} {p.stock_qty <= 0 ? '(0 Stock)' : `(${p.stock_qty} in stock)`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom / Manual Item Fields if 'custom' is chosen */}
              {isCustomPart && (
                <div className="p-3.5 bg-white/10 rounded-xl border border-amber-300/40 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-amber-200 mb-1 font-label">
                      Manual Part / Item Name *
                    </label>
                    <input
                      type="text"
                      value={posForm.custom_part_name}
                      onChange={(e) => setPosForm({ ...posForm, custom_part_name: e.target.value })}
                      placeholder="e.g. Engine Oil Filter 5W30"
                      className="w-full bg-white/20 border border-white/30 text-white rounded-lg py-2 px-3 text-xs placeholder:text-white/50 focus:ring-1 focus:ring-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-amber-200 mb-1 font-label">
                      Selling Price (₹) *
                    </label>
                    <input
                      type="number"
                      value={posForm.custom_price}
                      onChange={(e) => setPosForm({ ...posForm, custom_price: e.target.value })}
                      placeholder="e.g. 450"
                      className="w-full bg-white/20 border border-white/30 text-white rounded-lg py-2 px-3 text-xs placeholder:text-white/50 focus:ring-1 focus:ring-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/80 mb-1.5 font-label">Quantity</label>
                  <input 
                    type="number" 
                    value={posForm.quantity}
                    onChange={(e) => setPosForm({ ...posForm, quantity: e.target.value })}
                    min="0.01"
                    step="any"
                    className="w-full bg-white/10 border border-white/20 text-white rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-white placeholder:text-white/50" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/80 mb-1.5 font-label">Payment Mode</label>
                  <select 
                    value={posForm.payment_mode}
                    onChange={(e) => setPosForm({ ...posForm, payment_mode: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 text-white rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-white appearance-none cursor-pointer"
                  >
                    <option value="UPI" className="text-gray-900">UPI</option>
                    <option value="Cash" className="text-gray-900">Cash</option>
                    <option value="Card" className="text-gray-900">Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/80 mb-1.5 font-label">Link to Detailing Studio Order</label>
                <select 
                  value={posForm.job_card_id}
                  onChange={(e) => setPosForm({ ...posForm, job_card_id: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-white transition-all appearance-none cursor-pointer"
                >
                  <option value="" className="text-gray-900">None (Counter Sale)</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id} className="text-gray-900">{j.job_no} ({j.reg_no})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/80 mb-1.5 font-label">Customer Name</label>
                <input 
                  type="text" 
                  value={posForm.customer_name}
                  onChange={(e) => setPosForm({ ...posForm, customer_name: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-white placeholder:text-white/50" 
                  placeholder="Optional for walk-ins" 
                />
              </div>

              <div className="pt-4 border-t border-white/20 mt-6">
                <div className="flex justify-between items-end mb-6">
                  <span className="text-xs font-medium text-white/80 font-label uppercase tracking-widest">Total Amount</span>
                  <span className="text-3xl font-black text-white font-headline">{fmt(posTotalAmount)}</span>
                </div>
                <button 
                  type="button" 
                  onClick={handlePosSubmit}
                  disabled={posSaving}
                  className="w-full py-4 bg-white text-primary font-black uppercase tracking-widest text-sm rounded-xl shadow-[0_10px_20px_-5px_rgba(255,255,255,0.3)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
                >
                  {posSaving ? 'Processing...' : 'Record Sale'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Part Management Modal */}
      {modal && (
        <Modal title={modal.mode === 'add' ? 'Add Inventory Part' : 'Edit Part Details'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Part Name <span className="text-error">*</span></label>
                <input value={modal.data.part_name} onChange={e => setModal({ ...modal, data: { ...modal.data, part_name: e.target.value } })} className="input-field" />
              </div>
              <div>
                <label className="input-label">Category</label>
                <select value={modal.data.category} onChange={e => setModal({ ...modal, data: { ...modal.data, category: e.target.value } })} className="input-field appearance-none cursor-pointer">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="input-label">Buy Price (₹)</label>
                <input type="number" value={modal.data.buying_price} onChange={e => setModal({ ...modal, data: { ...modal.data, buying_price: e.target.value } })} className="input-field" />
              </div>
              <div>
                <label className="input-label">Rate / MRP (₹) <span className="text-error">*</span></label>
                <input type="number" value={modal.data.selling_price} onChange={e => setModal({ ...modal, data: { ...modal.data, selling_price: e.target.value } })} className="input-field" />
              </div>
              <div>
                <label className="input-label">Unit Type</label>
                <select value={modal.data.unit} onChange={e => setModal({ ...modal, data: { ...modal.data, unit: e.target.value } })} className="input-field appearance-none cursor-pointer">
                  <option value="pc">Piece (pc)</option>
                  <option value="ltr">Litre (ltr)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="input-label">Initial Stock</label>
                <input type="number" step="any" value={modal.data.stock_qty} onChange={e => setModal({ ...modal, data: { ...modal.data, stock_qty: e.target.value } })} className="input-field" disabled={modal.mode === 'edit'} />
              </div>
              <div>
                <label className="input-label">Low Alert At</label>
                <input type="number" step="any" value={modal.data.low_stock_alert} onChange={e => setModal({ ...modal, data: { ...modal.data, low_stock_alert: e.target.value } })} className="input-field" />
              </div>
              <div>
                <label className="input-label">HSN/SAC Code</label>
                <input type="text" value={modal.data.hsn_sac} onChange={e => setModal({ ...modal, data: { ...modal.data, hsn_sac: e.target.value } })} className="input-field" placeholder="e.g. 8708" />
              </div>
            </div>
          </div>
          <div className="mt-8 flex justify-end">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Processing...' : modal.mode === 'add' ? 'Confirm Addition' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* Restock Modal */}
      {restockModal && (
        <Modal title={`Process Restock - ${restockModal.part.part_code}`} onClose={() => setRestockModal(null)} maxWidth="max-w-md">
          <div className="bg-surface rounded-xl p-4 mb-6 flex justify-between items-center border border-gray-100">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-muted">Item</p>
              <p className="font-bold text-on-surface font-headline text-lg">{restockModal.part.part_name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-muted">Current Stock</p>
              <p className="font-bold text-primary font-headline text-2xl">{restockModal.part.stock_qty}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="input-label">New Units Added</label>
              <input type="number" step="any" value={restockModal.adjustment} onChange={e => setRestockModal({ ...restockModal, adjustment: e.target.value })} placeholder="Enter positive value..." autoFocus className="input-field py-3 text-lg" />
            </div>
          </div>
          <div className="mt-8 flex justify-end">
            <button onClick={handleRestock} disabled={saving} className="btn-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
              {saving ? 'Updating Ledger...' : 'Update Stock Ledger'}
            </button>
          </div>
        </Modal>
      )}
    </AnimatedPage>
  );
}

