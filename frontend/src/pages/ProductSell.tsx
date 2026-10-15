import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import AnimatedPage from '../components/shared/AnimatedPage';
import { showToast } from '../components/shared/Toast';
import { formatCurrency, getLocalDateString } from '../utils/format';
import SuggestInput, { recordFieldSuggestions } from '../components/shared/SuggestInput';

interface BillItem {
  id: string;
  product_name: string;
  price: string;
  qty: string;
}

interface ProductSale {
  id: number;
  invoice_no?: string | null;
  product_name: string;
  price: number;
  qty?: number;
  customer_name: string | null;
  customer_mobile?: string | null;
  customer_address?: string | null;
  payment_mode: string;
  sale_date: string;
  items?: Array<{ product_name: string; price: number; qty: number; total?: number; rate?: number }>;
  car_name?: string | null;
  vehicle_no?: string | null;
}

const COMMON_ACCESSORIES = [
  'Air Freshener',
  'Dashboard Polish',
  'Microfiber Cloth',
  'Tyre Shiner',
  'Car Perfume',
  'Glass Cleaner',
  'Neck Pillow',
  'Seat Cover Set',
  '7D Foot Mats',
  'Body Cover'
];

const emptyForm = {
  customer_name: '',
  customer_mobile: '',
  customer_address: '',
  car_name: '',
  vehicle_no: '',
  payment_mode: 'cash',
  sale_date: getLocalDateString(),
  items: [
    { id: '1', product_name: '', price: '', qty: '1' }
  ]
};

export default function ProductSell() {
  const [form, setForm] = useState(emptyForm);
  const [sales, setSales] = useState<ProductSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSale, setEditingSale] = useState<ProductSale | null>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'all' | 'custom'>('today');
  const [customFilterDate, setCustomFilterDate] = useState(getLocalDateString());

  const today = getLocalDateString();

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (dateFilter === 'today') {
        params.date = today;
      } else if (dateFilter === 'custom') {
        params.date = customFilterDate;
      }
      const res = await api.get('/product-sales', { params });
      setSales(res.data.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [dateFilter, customFilterDate, today]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const calculateBillTotal = (items: BillItem[]) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((acc, it) => {
      const q = parseInt(it.qty) || 1;
      const p = parseFloat(it.price) || 0;
      return acc + (q * p);
    }, 0);
  };

  const handleQuickPick = (acc: string) => {
    setForm(prev => {
      const items = [...prev.items];
      const last = items[items.length - 1];
      if (last && !last.product_name.trim()) {
        items[items.length - 1] = { ...last, product_name: acc };
        return { ...prev, items };
      }
      return {
        ...prev,
        items: [
          ...items,
          { id: Date.now().toString() + Math.random().toString(36).slice(2, 5), product_name: acc, price: '', qty: '1' }
        ]
      };
    });
  };

  const handleAddItem = () => {
    setForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { id: Date.now().toString() + Math.random().toString(36).slice(2, 5), product_name: '', price: '', qty: '1' }
      ]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setForm(prev => {
      if (prev.items.length <= 1) {
        return {
          ...prev,
          items: [{ id: Date.now().toString(), product_name: '', price: '', qty: '1' }]
        };
      }
      return {
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      };
    });
  };

  const handleItemChange = (index: number, field: keyof BillItem, value: string) => {
    setForm(prev => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const handleStartEdit = (sale: ProductSale) => {
    setEditingSale(sale);
    const rawDate = sale.sale_date;
    let dateStr = today;
    try {
      if (rawDate) {
        if (typeof rawDate === 'string') {
          dateStr = rawDate.slice(0, 10);
        } else {
          dateStr = new Date(rawDate).toISOString().slice(0, 10);
        }
      }
    } catch {
      dateStr = today;
    }

    const parsedItems: BillItem[] = Array.isArray(sale.items) && sale.items.length > 0
      ? sale.items.map((it, idx) => ({
          id: String(idx + 1),
          product_name: it.product_name || '',
          price: String(it.price || it.rate || (it.total && it.qty ? it.total / it.qty : '')),
          qty: String(it.qty || 1)
        }))
      : [{
          id: '1',
          product_name: sale.product_name || '',
          price: String(sale.qty && sale.qty > 1 ? (sale.price / sale.qty) : sale.price),
          qty: String(sale.qty || 1)
        }];

    setForm({
      customer_name: sale.customer_name || '',
      customer_mobile: sale.customer_mobile || '',
      customer_address: sale.customer_address || '',
      car_name: sale.car_name || '',
      vehicle_no: sale.vehicle_no || '',
      payment_mode: sale.payment_mode || 'cash',
      sale_date: dateStr,
      items: parsedItems
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingSale(null);
    setForm(emptyForm);
  };

  const handleDelete = async (sale: ProductSale) => {
    const invNo = sale.invoice_no || `ACC-${String(sale.id).padStart(4, '0')}`;
    if (!window.confirm(`Are you sure you want to delete Invoice #${invNo} (${sale.product_name} - ₹${sale.price})?`)) {
      return;
    }
    try {
      await api.delete(`/product-sales/${sale.id}`);
      showToast(`Invoice #${invNo} deleted successfully`, 'success');
      if (editingSale?.id === sale.id) handleCancelEdit();
      fetchSales();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete sale', 'error');
    }
  };

  const handleSubmit = async () => {
    const validItems = form.items.filter(it => it.product_name.trim());
    if (validItems.length === 0) {
      showToast('Add at least one product or accessory to this bill', 'error');
      return;
    }
    const hasInvalidPrice = validItems.some(it => !it.price || parseFloat(it.price) <= 0);
    if (hasInvalidPrice) {
      showToast('Enter valid rates/prices for all items in the bill', 'error');
      return;
    }

    setSaving(true);
    try {
      const preparedItems = validItems.map(it => {
        const q = parseInt(it.qty) || 1;
        const p = parseFloat(it.price) || 0;
        return {
          product_name: it.product_name.trim(),
          qty: q,
          price: p,
          total: q * p
        };
      });

      const totalBillPrice = preparedItems.reduce((acc, it) => acc + it.total, 0);
      const totalBillQty = preparedItems.reduce((acc, it) => acc + it.qty, 0);
      const summaryProductName = preparedItems.map(it => it.product_name).join(', ').slice(0, 195);

      const payload = {
        customer_name: form.customer_name.trim() || null,
        customer_mobile: form.customer_mobile.trim() || null,
        customer_address: form.customer_address.trim() || null,
        car_name: form.car_name.trim() || null,
        vehicle_no: form.vehicle_no.trim() || null,
        payment_mode: form.payment_mode || 'cash',
        sale_date: form.sale_date || today,
        items: preparedItems,
        product_name: summaryProductName,
        price: totalBillPrice,
        qty: totalBillQty
      };

      // Fire-and-forget record suggestions
      recordFieldSuggestions({
        client_name: form.customer_name,
        mobile_no: form.customer_mobile,
        address_line: form.customer_address,
        car_name: form.car_name,
        reg_no: form.vehicle_no,
        ...preparedItems.reduce((acc, it) => ({ ...acc, product_name: it.product_name }), {})
      });

      if (editingSale) {
        // UPDATE existing bill as a single consolidated bill with all items
        const res = await api.put(`/product-sales/${editingSale.id}`, payload);
        const invNo = res.data?.invoice_no || editingSale.invoice_no || `ACC-${String(editingSale.id).padStart(4, '0')}`;
        showToast(`Invoice #${invNo} updated with ${preparedItems.length} item(s)!`, 'success');
        handleCancelEdit();
        fetchSales();
      } else {
        // CREATE new single consolidated bill with multiple items
        const res = await api.post('/product-sales', payload);
        const newSaleId = res.data?.id;
        const invoiceNo = res.data?.invoice_no || `ACC-${String(newSaleId).padStart(4, '0')}`;
        showToast(`Sale recorded & Invoice #${invoiceNo} generated (${preparedItems.length} item(s))!`, 'success');
        setForm(emptyForm);
        fetchSales();
        if (newSaleId) {
          window.open(`/invoice/accessory/${newSaleId}`, '_blank');
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to record sale', 'error');
    } finally { setSaving(false); }
  };

  const fmt = (n: number) => formatCurrency(n);
  const fmtTime = (d?: string | null) => {
    if (!d) return '';
    try {
      const normalized = typeof d === 'string' && d.includes(' ') && !d.includes('T') ? d.replace(' ', 'T') : d;
      const date = new Date(normalized);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '';
    try {
      const normalized = typeof d === 'string' && d.includes(' ') && !d.includes('T') ? d.replace(' ', 'T') : d;
      const date = new Date(normalized);
      if (isNaN(date.getTime())) return String(d).slice(0, 10);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch {
      return String(d || '').slice(0, 10);
    }
  };

  const todayTotal = Array.isArray(sales)
    ? sales.reduce((acc, s) => acc + (parseFloat(String(s.price)) || 0), 0)
    : 0;
  const currentBillTotal = calculateBillTotal(form.items);

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 px-4 sm:px-8 pb-12 max-w-[1280px] mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[10px] font-label font-bold uppercase tracking-[0.15em] text-primary">Retail & Over-the-Counter</span>
          <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">Accessories & Product Sales</h1>
          <p className="text-xs text-on-surface-muted mt-1">Record accessory sales, generate branded invoices, and collect payments via Premsharan Patel Paytm QR.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-amber-50 text-amber-900 border border-amber-200/80 px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs font-bold shadow-xs">
            <span className="material-symbols-outlined text-sm text-amber-600">qr_code_2</span>
            <span>Paytm Standee QR Configured</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Sell Form (40% -> 5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 sm:p-7 relative">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-stone-100">
              <h4 className="font-headline text-base font-extrabold uppercase tracking-wider flex items-center gap-2 text-stone-900">
                <span className="material-symbols-outlined text-amber-600">storefront</span>
                {editingSale ? 'Edit Sale Bill' : 'Record Sale & Bill'}
              </h4>
              <span className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-md border ${
                editingSale ? 'bg-amber-100 text-amber-950 border-amber-300' : 'bg-amber-50 text-amber-900 border-amber-200/80'
              }`}>
                {editingSale ? `Editing #${editingSale.invoice_no || `ACC-${editingSale.id}`}` : 'Auto Invoice'}
              </span>
            </div>

            {/* Active Editing Notice */}
            {editingSale && (
              <div className="mb-5 p-3 bg-amber-50 border border-amber-300/80 rounded-xl flex items-center justify-between text-amber-950 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-base">edit_document</span>
                  <span>Modifying Bill #{editingSale.invoice_no || `ACC-${editingSale.id}`}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-2 py-0.5 bg-white hover:bg-stone-100 text-stone-700 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-stone-200"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="space-y-5">
              {/* ═══ Top Payment Option: Cash vs Credit ═══ */}
              <div className="bg-stone-50/70 rounded-xl border border-stone-200/80 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 font-label flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-amber-600">payments</span>
                    Payment Option
                  </span>
                  <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                    form.payment_mode === 'credit'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-500/15 text-amber-900 border-amber-400/50'
                  }`}>
                    {form.payment_mode === 'credit' ? '● Goes to Payment Pending' : '● Cash Paid'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, payment_mode: 'cash' })}
                    className={`p-3 rounded-xl border-2 text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      form.payment_mode !== 'credit'
                        ? 'border-amber-500 bg-amber-50/80 text-stone-950 font-bold shadow-sm ring-1 ring-amber-500/30'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl text-amber-600">payments</span>
                    <div>
                      <div className="text-xs font-bold text-stone-900">Cash</div>
                      <div className="text-[10px] text-stone-500">Paid in Cash</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, payment_mode: 'credit' })}
                    className={`p-3 rounded-xl border-2 text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      form.payment_mode === 'credit'
                        ? 'border-amber-500 bg-amber-50/80 text-stone-950 font-bold shadow-sm ring-1 ring-amber-500/30'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl text-amber-600">pending_actions</span>
                    <div>
                      <div className="text-xs font-bold text-stone-900">Credit</div>
                      <div className="text-[10px] text-stone-500">Payment Pending</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Customer Details */}
              <div className="space-y-3 pb-4 border-b border-stone-100">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 font-label">
                  Customer & Bill Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Customer / Owner Name */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-1 font-label">
                      Customer / Owner Name (Optional)
                    </label>
                    <SuggestInput
                      type="client_name"
                      value={form.customer_name}
                      onChange={val => setForm(prev => ({ ...prev, customer_name: val }))}
                      onLinkedFill={linked => {
                        setForm(prev => ({
                          ...prev,
                          customer_mobile: prev.customer_mobile || linked.mobile_no || '',
                          customer_address: prev.customer_address || linked.address_line || '',
                          car_name: prev.car_name || linked.car_name || '',
                          vehicle_no: prev.vehicle_no || linked.reg_no || '',
                        }));
                      }}
                      placeholder="Customer name"
                      className="w-full bg-stone-50/60 border border-stone-200 rounded-xl py-2.5 px-3 text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    />
                  </div>

                  {/* 2. Customer Mobile */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-1 font-label">
                      Mobile (for Bill)
                    </label>
                    <SuggestInput
                      type="mobile_no"
                      value={form.customer_mobile}
                      onChange={val => setForm(prev => ({ ...prev, customer_mobile: val.replace(/\D/g, '').slice(0, 10) }))}
                      maxLength={10}
                      onLinkedFill={linked => {
                        setForm(prev => ({
                          ...prev,
                          customer_name: prev.customer_name || linked.customer_name || linked.client_name || '',
                          customer_address: prev.customer_address || linked.address_line || '',
                          car_name: prev.car_name || linked.car_name || '',
                          vehicle_no: prev.vehicle_no || linked.reg_no || '',
                        }));
                      }}
                      placeholder="e.g. 9876543210"
                      className="w-full bg-stone-50/60 border border-stone-200 rounded-xl py-2.5 px-3 text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Car Name */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-1 font-label">
                      Car Name / Model (Optional)
                    </label>
                    <SuggestInput
                      type="car_name"
                      value={form.car_name}
                      onChange={val => setForm(prev => ({ ...prev, car_name: val }))}
                      placeholder="e.g. Swift, Creta, Nexon..."
                      className="w-full bg-stone-50/60 border border-stone-200 rounded-xl py-2.5 px-3 text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    />
                  </div>

                  {/* Vehicle Reg No */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-1 font-label">
                      Car Number / Reg No (Optional)
                    </label>
                    <SuggestInput
                      type="reg_no"
                      value={form.vehicle_no}
                      onChange={val => setForm(prev => ({ ...prev, vehicle_no: val.toUpperCase().replace(/[\s\-_]/g, '') }))}
                      maxLength={15}
                      onLinkedFill={linked => {
                        setForm(prev => ({
                          ...prev,
                          customer_name: prev.customer_name || linked.customer_name || linked.client_name || '',
                          customer_mobile: prev.customer_mobile || linked.mobile_no || '',
                          customer_address: prev.customer_address || linked.address_line || '',
                          car_name: prev.car_name || linked.car_name || '',
                        }));
                      }}
                      placeholder="e.g. GJ06AB1234"
                      className="w-full bg-stone-50/60 border border-stone-200 rounded-xl py-2.5 px-3 text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 3. Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-1 font-label">
                      Address / Area / Landmark
                    </label>
                    <SuggestInput
                      type="address_line"
                      value={form.customer_address}
                      onChange={val => setForm(prev => ({ ...prev, customer_address: val }))}
                      placeholder="Address / Area / Landmark..."
                      className="w-full bg-stone-50/60 border border-stone-200 rounded-xl py-2.5 px-3 text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    />
                  </div>

                  {/* 4. Bill Date */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-1 font-label">
                      Bill Date
                    </label>
                    <input
                      type="date"
                      value={form.sale_date}
                      onChange={e => setForm({ ...form, sale_date: e.target.value })}
                      className="w-full bg-stone-50/60 border border-stone-200 rounded-xl py-2 px-2 text-xs font-semibold text-stone-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 font-label">
                  Popular Quick Picks (Click to Add)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {COMMON_ACCESSORIES.map(acc => (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => handleQuickPick(acc)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg border transition-all bg-amber-50 hover:bg-amber-100/80 text-amber-900 border-amber-200/80 shadow-xs cursor-pointer"
                    >
                      + {acc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items in this Bill */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-600 font-label flex items-center gap-1.5">
                    <span>Items in Bill ({form.items.length})</span>
                    <span className="text-[9px] bg-stone-100 text-stone-600 border border-stone-200 px-1.5 py-0.5 rounded font-normal normal-case">Single Bill</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {form.items.map((item, index) => {
                    const lineSubtotal = (parseInt(item.qty) || 1) * (parseFloat(item.price) || 0);
                    return (
                      <div
                        key={item.id}
                        className="bg-stone-50/80 border border-stone-200/80 rounded-xl p-3 space-y-2 relative transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 border border-amber-300/60 text-[10px] font-black flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <SuggestInput
                            type="product_name"
                            value={item.product_name}
                            onChange={val => handleItemChange(index, 'product_name', val)}
                            placeholder="Accessory / product name..."
                            className="flex-1 bg-white border border-stone-200 text-stone-900 rounded-lg py-1.5 px-2.5 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder:text-stone-400 font-medium"
                          />
                          {form.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-0.5">
                              Rate (₹)
                            </label>
                            <input
                              type="number"
                              value={item.price}
                              onChange={e => handleItemChange(index, 'price', e.target.value)}
                              min="0"
                              placeholder="₹ Rate"
                              className="w-full bg-white border border-stone-200 text-stone-900 rounded-lg py-1.5 px-2 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder:text-stone-400 font-bold"
                            />
                          </div>
                          <div className="col-span-3">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-0.5">
                              Qty
                            </label>
                            <input
                              type="number"
                              value={item.qty}
                              onChange={e => handleItemChange(index, 'qty', e.target.value)}
                              min="1"
                              className="w-full bg-white border border-stone-200 text-stone-900 rounded-lg py-1.5 px-1.5 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder:text-stone-400 text-center font-bold"
                            />
                          </div>
                          <div className="col-span-5 text-right">
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-0.5">
                              Item Total
                            </label>
                            <span className="text-xs font-black text-amber-800 font-mono">
                              ₹{lineSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-2 border border-dashed border-amber-300 hover:border-amber-400 hover:bg-amber-50 rounded-xl text-xs font-bold text-amber-900 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  <span>+ Add Another Item to this Bill</span>
                </button>
              </div>

              {/* Price Preview + Submit */}
              <div className="pt-4 border-t border-stone-100 mt-3">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 font-label uppercase tracking-widest block">
                      Single Invoice Total ({form.items.filter(it => it.product_name.trim()).length || 1} item{form.items.filter(it => it.product_name.trim()).length === 1 ? '' : 's'})
                    </span>
                    <span className="text-xs text-stone-400">Consolidated Branded Bill & QR</span>
                  </div>
                  <span className="text-3xl font-black text-stone-900 font-headline">
                    {fmt(currentBillTotal)}
                  </span>
                </div>
                <div className="flex gap-2">
                  {editingSale && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-3.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold uppercase tracking-wider text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-extrabold uppercase tracking-widest text-xs rounded-xl shadow-button hover:shadow-button-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {editingSale ? 'check_circle' : 'receipt_long'}
                    </span>
                    {saving
                      ? (editingSale ? 'Updating Bill...' : 'Generating Invoice...')
                      : (editingSale ? `Update Bill & Re-print #${editingSale.invoice_no || `ACC-${editingSale.id}`}` : 'Record Sale & Open Invoice')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Today's Summary Card */}
          <div className="p-6 bg-white border border-stone-200/80 shadow-sm rounded-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2 font-label">
              {dateFilter === 'today' ? "Today's Product Sales" : dateFilter === 'custom' ? `Sales for ${customFilterDate}` : 'All Recorded Product Sales'}
            </p>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-black text-amber-800 font-headline">{fmt(todayTotal)}</h3>
              <span className="text-sm font-bold text-stone-500">{sales.length} bills</span>
            </div>
          </div>
        </div>

        {/* Right: Sales History (60% -> 7 cols) */}
        <div className="lg:col-span-7 glass-card-solid overflow-hidden flex flex-col border-t-4 border-t-amber-500 bg-white shadow-sm rounded-2xl">
          <div className="px-6 py-4 border-b border-stone-100 flex flex-col sm:flex-row justify-between sm:items-center items-start gap-4 bg-surface/50 backdrop-blur-md">
            <div>
              <h4 className="font-bold font-headline text-stone-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">receipt_long</span>
                Accessory Sales & Invoices
              </h4>
              <p className="text-xs text-stone-500">Edit any bill, change items/details, or re-print invoices</p>
            </div>
            {/* Date Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-xl border border-stone-200 p-0.5 bg-stone-100 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setDateFilter('today')}
                  className={`px-3 py-1 rounded-lg transition-all ${dateFilter === 'today' ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all ${dateFilter === 'all' ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
                >
                  All Dates
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('custom')}
                  className={`px-3 py-1 rounded-lg transition-all ${dateFilter === 'custom' ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
                >
                  Date
                </button>
              </div>
              {dateFilter === 'custom' && (
                <input
                  type="date"
                  value={customFilterDate}
                  onChange={e => setCustomFilterDate(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-stone-200 rounded-lg font-mono bg-white text-stone-900"
                />
              )}
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] uppercase tracking-wider text-stone-700 font-bold">
                  <th className="px-4 py-3.5 whitespace-nowrap w-28">Invoice #</th>
                  <th className="px-4 py-3.5 whitespace-nowrap w-32">Date / Time</th>
                  <th className="px-4 py-3.5 min-w-[200px]">Product & Items</th>
                  <th className="px-4 py-3.5 min-w-[150px]">Customer</th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-center w-28">Payment</th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-right w-28">Amount</th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm font-medium text-stone-500">
                      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading sales data...
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-14 text-center">
                      <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200/80">
                        <span className="material-symbols-outlined text-2xl">receipt_long</span>
                      </div>
                      <p className="text-sm font-bold text-stone-700">No accessory sales found for this filter</p>
                      <p className="text-xs text-stone-400 mt-0.5">Use the form on the left to bill items or select another date</p>
                    </td>
                  </tr>
                ) : (
                  sales.map(s => {
                    const invNo = s.invoice_no || `ACC-${String(s.id).padStart(4, '0')}`;
                    const isCurrentlyEditing = editingSale?.id === s.id;
                    const dateFormatted = formatDate(s.sale_date);
                    return (
                      <tr key={s.id} className={`transition-colors ${isCurrentlyEditing ? 'bg-amber-50 font-medium' : 'hover:bg-amber-50/40'}`}>
                        <td className="px-4 py-3 font-mono font-bold text-amber-800">
                          {invNo}
                          {isCurrentlyEditing && (
                            <span className="ml-1 text-[9px] bg-amber-200 text-amber-900 px-1 py-0.5 rounded font-sans uppercase">Editing</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          <span className="font-semibold block text-stone-800">{dateFormatted}</span>
                          <span className="text-[10px] text-stone-400 font-mono">{fmtTime(s.sale_date)}</span>
                        </td>
                        <td className="px-4 py-3">
                          {s.items && s.items.length > 1 ? (
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-stone-900">{s.items[0].product_name}</span>
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                  +{s.items.length - 1} more ({s.items.length} items)
                                </span>
                              </div>
                              <div className="text-[11px] text-stone-500 font-medium truncate max-w-[200px] mt-0.5" title={s.items.map(it => `${it.product_name} (${it.qty || 1}x)`).join(', ')}>
                                {s.items.map(it => `${it.product_name} (${it.qty || 1}x)`).join(', ')}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-stone-900 block">{s.product_name}</span>
                              {s.qty && s.qty > 1 ? (
                                <span className="text-[10px] text-stone-500 font-semibold">Qty: {s.qty}</span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-stone-800 block">{s.customer_name || 'Walk-in'}</span>
                          {(s.vehicle_no || s.car_name) && (
                            <span className="text-[10px] text-stone-600 font-medium block">
                              🚗 {[s.vehicle_no, s.car_name].filter(Boolean).join(' · ')}
                            </span>
                          )}
                          {s.customer_mobile && (
                            <span className="text-[10px] text-stone-500 font-mono block">{s.customer_mobile}</span>
                          )}
                          {s.customer_address && (
                            <span className="text-[10px] text-stone-400 block truncate max-w-[150px]" title={s.customer_address}>
                              📍 {s.customer_address}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md inline-flex items-center gap-1 border ${
                            s.payment_mode === 'upi' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            s.payment_mode === 'card' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                            s.payment_mode === 'bank' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            s.payment_mode === 'credit' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {s.payment_mode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-stone-900 text-sm font-mono">{fmt(s.price)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Print */}
                            <button
                              type="button"
                              onClick={() => window.open(`/invoice/accessory/${s.id}`, '_blank')}
                              className="p-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg inline-flex items-center transition-colors"
                              title="View / Print Branded Invoice"
                            >
                              <span className="material-symbols-outlined text-sm">print</span>
                            </button>

                            {/* Edit Bill */}
                            <button
                              type="button"
                              onClick={() => handleStartEdit(s)}
                              className="p-1.5 text-xs font-bold text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg inline-flex items-center transition-colors"
                              title="Edit this Bill & Continue"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>

                            {/* Delete Bill */}
                            <button
                              type="button"
                              onClick={() => handleDelete(s)}
                              className="p-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg inline-flex items-center transition-colors"
                              title="Delete this Sale"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
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

          {!loading && sales.length > 0 && (
            <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-between items-center">
              <span className="text-xs text-stone-500 font-medium">{sales.length} transactions</span>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block">Total Sales</span>
                <span className="font-black text-amber-800 text-lg font-headline">{fmt(todayTotal)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
