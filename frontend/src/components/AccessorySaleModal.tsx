import { useState } from 'react';
import Modal from './shared/Modal';
import api from '../api/axios';
import { showToast } from './shared/Toast';

interface Props {
  onClose: () => void;
  onCreated?: () => void;
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

interface ModalBillItem {
  id: string;
  product_name: string;
  price: string;
  qty: string;
}

export default function AccessorySaleModal({ onClose, onCreated }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [regNo, setRegNo] = useState('');
  const [carName, setCarName] = useState('');

  const [items, setItems] = useState<ModalBillItem[]>([
    { id: '1', product_name: '', price: '', qty: '1' }
  ]);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card' | 'bank'>('cash');
  const [saving, setSaving] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeField, setActiveField] = useState<'regNo' | 'customerName' | 'customerMobile' | null>(null);

  // Car name suggestions state
  const [carNameSuggestions, setCarNameSuggestions] = useState<string[]>([]);
  const [showCarNameSuggestions, setShowCarNameSuggestions] = useState(false);

  const handleCustomerSearch = async (val: string, field: 'regNo' | 'customerName' | 'customerMobile') => {
    setActiveField(field);
    if (!val || val.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await api.get(`/customers/search-connected`, { params: { q: val } });
      setSuggestions(res.data.data || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectCustomer = (sug: any) => {
    if (sug.customer_name) setCustomerName(sug.customer_name);
    if (sug.customer_mobile || sug.mobile_no) setCustomerMobile(sug.customer_mobile || sug.mobile_no);
    if (sug.address_line) setCustomerAddress(sug.address_line);
    if (sug.reg_no) setRegNo(sug.reg_no);
    const resolvedCar = [sug.make, sug.model, sug.variant].filter(Boolean).join(' ') || sug.car_name || '';
    if (resolvedCar) setCarName(resolvedCar);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveField(null);
  };

  const handleCarNameChange = async (val: string) => {
    setCarName(val);
    if (!val || val.trim().length < 1) {
      setCarNameSuggestions([]);
      setShowCarNameSuggestions(false);
      return;
    }
    try {
      const res = await api.get('/job-cards/suggestions/list', {
        params: { type: 'car_name', q: val.trim() }
      });
      setCarNameSuggestions(res.data.data || []);
      setShowCarNameSuggestions(true);
    } catch {
      setCarNameSuggestions([]);
      setShowCarNameSuggestions(false);
    }
  };

  const handleSelectCarName = (name: string) => {
    setCarName(name);
    setShowCarNameSuggestions(false);
    setCarNameSuggestions([]);
  };

  const renderSuggestions = (field: 'regNo' | 'customerName' | 'customerMobile') => {
    if (!showSuggestions || activeField !== field || suggestions.length === 0) return null;
    return (
      <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
        {suggestions.map((sug, idx) => (
          <div
            key={idx}
            onMouseDown={() => handleSelectCustomer(sug)}
            className="p-2.5 hover:bg-amber-50 cursor-pointer border-b border-gray-50 last:border-0 text-xs font-medium text-slate-700"
          >
            <div className="font-bold text-slate-800 flex justify-between">
              <span>{sug.customer_name || 'Customer'}</span>
              <span className="font-mono text-[10px] text-slate-400">{sug.customer_mobile || sug.mobile_no}</span>
            </div>
            {sug.reg_no && (
              <div className="text-[10px] text-slate-500 mt-0.5">
                🚗 {sug.reg_no} · {[sug.make, sug.model].filter(Boolean).join(' ') || sug.car_name || ''}
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

  const renderCarNameSuggestions = () => {
    if (!showCarNameSuggestions || carNameSuggestions.length === 0) return null;
    return (
      <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-50">
        {carNameSuggestions.map((name, idx) => (
          <div
            key={idx}
            onMouseDown={() => handleSelectCarName(name)}
            className="p-2 hover:bg-amber-50 cursor-pointer border-b border-gray-50 last:border-0 text-xs font-medium text-slate-800 flex items-center gap-1.5"
          >
            <span>🚗</span>
            <span>{name}</span>
          </div>
        ))}
      </div>
    );
  };

  const handleQuickPick = (acc: string) => {
    setItems(prev => {
      const last = prev[prev.length - 1];
      if (last && !last.product_name.trim()) {
        const copy = [...prev];
        copy[copy.length - 1] = { ...last, product_name: acc };
        return copy;
      }
      return [
        ...prev,
        { id: Date.now().toString() + Math.random().toString(36).slice(2, 5), product_name: acc, price: '', qty: '1' }
      ];
    });
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: Date.now().toString() + Math.random().toString(36).slice(2, 5), product_name: '', price: '', qty: '1' }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.length <= 1 ? [{ id: Date.now().toString(), product_name: '', price: '', qty: '1' }] : prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ModalBillItem, value: string) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const grandTotal = items.reduce((acc, it) => acc + ((parseInt(it.qty) || 1) * (parseFloat(it.price) || 0)), 0);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const validItems = items.filter(it => it.product_name.trim());
    if (validItems.length === 0) {
      showToast('Please enter at least one accessory or product name', 'warning');
      return;
    }
    const hasInvalidPrice = validItems.some(it => !it.price || parseFloat(it.price) <= 0);
    if (hasInvalidPrice) {
      showToast('Please enter valid prices for all items', 'warning');
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
      const summaryName = preparedItems.map(it => it.product_name).join(', ').slice(0, 195);

      const res = await api.post('/product-sales', {
        product_name: summaryName,
        price: totalBillPrice,
        qty: totalBillQty,
        items: preparedItems,
        customer_name: customerName.trim() || 'Counter Customer',
        customer_mobile: customerMobile.trim() || null,
        customer_address: customerAddress.trim() || null,
        car_name: carName.trim() || null,
        vehicle_no: regNo.trim().toUpperCase() || null,
        payment_mode: paymentMode
      });

      // Record car name suggestion for future autocomplete
      if (carName.trim()) {
        api.post('/job-cards/suggestions/record', { type: 'car_name', text: carName.trim() }).catch(() => {});
      }

      const newSaleId = res.data?.id;
      const invoiceNo = res.data?.invoice_no || `ACC-${String(newSaleId).padStart(4, '0')}`;
      showToast(`Sale recorded! Invoice #${invoiceNo} generated (${preparedItems.length} items).`, 'success');

      if (newSaleId) {
        window.open('/invoice/accessory/' + newSaleId, '_blank');
      }

      if (onCreated) onCreated();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to record accessory sale', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-slate-50 border border-stone-200/80 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 py-2 px-3 font-medium text-xs text-on-surface placeholder:text-slate-400";

  return (
    <Modal title="🛍️ Accessories & Product Sale" onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Customer & Vehicle Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* 1. Customer Name */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Customer / Owner Name <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={e => {
                setCustomerName(e.target.value);
                handleCustomerSearch(e.target.value, 'customerName');
              }}
              onFocus={() => { if (customerName) setShowSuggestions(true); setActiveField('customerName'); }}
              onBlur={() => { setTimeout(() => { setShowSuggestions(false); }, 200); }}
              placeholder="e.g. Rahul Sharma"
              className={inputCls}
              autoFocus
            />
            {renderSuggestions('customerName')}
          </div>

          {/* 2. Customer Mobile */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Customer Mobile
            </label>
            <input
              type="tel"
              value={customerMobile}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setCustomerMobile(val);
                handleCustomerSearch(val, 'customerMobile');
              }}
              onFocus={() => { if (customerMobile) setShowSuggestions(true); setActiveField('customerMobile'); }}
              onBlur={() => { setTimeout(() => { setShowSuggestions(false); }, 200); }}
              placeholder="e.g. 9876543210"
              maxLength={10}
              className={inputCls}
            />
            {renderSuggestions('customerMobile')}
          </div>

          {/* 3. Car Number / Reg No */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Car Number / Reg. No
            </label>
            <input
              type="text"
              value={regNo}
              maxLength={12}
              onChange={e => {
                const val = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12);
                setRegNo(val);
                handleCustomerSearch(val, 'regNo');
              }}
              onFocus={() => { if (regNo) setShowSuggestions(true); setActiveField('regNo'); }}
              onBlur={() => { setTimeout(() => { setShowSuggestions(false); }, 200); }}
              placeholder="e.g. GJ06AB1234"
              className={`${inputCls} uppercase font-mono`}
            />
            {renderSuggestions('regNo')}
          </div>

          {/* 4. Car Name / Model */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Car Name / Model
            </label>
            <input
              type="text"
              value={carName}
              onChange={e => handleCarNameChange(e.target.value)}
              onFocus={() => { if (carName.trim()) handleCarNameChange(carName); }}
              onBlur={() => { setTimeout(() => setShowCarNameSuggestions(false), 200); }}
              placeholder="e.g. Swift Dzire, Creta, Nexon..."
              className={inputCls}
            />
            {renderCarNameSuggestions()}
          </div>

          {/* 5. Address */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Address
            </label>
            <input
              type="text"
              value={customerAddress}
              onChange={e => setCustomerAddress(e.target.value)}
              placeholder="Address / Area / Landmark..."
              className={inputCls}
            />
          </div>
        </div>

        {/* Quick Presets */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Popular Accessories (Click to Add)
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
            {COMMON_ACCESSORIES.map(acc => (
              <button
                key={acc}
                type="button"
                onClick={() => handleQuickPick(acc)}
                className="px-2 py-0.5 text-xs font-semibold rounded-lg border transition-all bg-slate-50 hover:bg-purple-50 text-slate-700 border-slate-200 hover:border-purple-300 cursor-pointer"
              >
                + {acc}
              </button>
            ))}
          </div>
        </div>

        {/* Items in this Bill */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Items in Bill ({items.length})
            </label>
            <button
              type="button"
              onClick={handleAddItem}
              className="text-xs text-purple-700 hover:text-purple-900 font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              <span>Add Item</span>
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {items.map((it, idx) => {
              const lineTot = (parseInt(it.qty) || 1) * (parseFloat(it.price) || 0);
              return (
                <div key={it.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={it.product_name}
                      onChange={e => handleItemChange(idx, 'product_name', e.target.value)}
                      placeholder="Product / accessory name..."
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                      required
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                        title="Remove"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <div className="relative">
                        <span className="absolute left-2 top-1.5 text-[11px] text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          value={it.price}
                          onChange={e => handleItemChange(idx, 'price', e.target.value)}
                          placeholder="Rate"
                          className="w-full bg-white border border-slate-200 rounded-lg pl-5 pr-2 py-1 text-xs font-bold"
                          required
                        />
                      </div>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-bold text-center"
                      />
                    </div>
                    <div className="col-span-4 text-right">
                      <span className="text-xs font-black text-slate-900 font-mono">
                        ₹{lineTot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Mode & Total */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Payment Mode
            </label>
            <select
              value={paymentMode}
              onChange={e => setPaymentMode(e.target.value as any)}
              className={`${inputCls} font-bold cursor-pointer`}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI / QR</option>
              <option value="card">Card / POS</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>
          <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-200 flex flex-col justify-center items-end">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Bill Grand Total</span>
            <span className="text-lg font-black text-amber-950 font-mono">
              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg flex items-center justify-between text-[11px] text-amber-900">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="material-symbols-outlined text-sm text-amber-600">receipt</span>
            <span>Generates formatted single invoice with Paytm QR standee</span>
          </div>
          <span className="font-bold text-amber-900">Auto-Opens</span>
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 text-xs font-extrabold rounded-xl shadow-button hover:shadow-button-hover transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            <span>{saving ? 'Recording & Invoicing...' : 'Record & Print Invoice'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
