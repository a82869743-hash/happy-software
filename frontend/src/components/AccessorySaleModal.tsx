import { useState } from 'react';
import Modal from './shared/Modal';
import api from '../api/axios';
import { showToast } from './shared/Toast';
import SuggestInput, { recordFieldSuggestions } from './shared/SuggestInput';

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

      // Fire-and-forget record suggestions
      recordFieldSuggestions({
        client_name: customerName,
        mobile_no: customerMobile,
        address_line: customerAddress,
        car_name: carName,
        reg_no: regNo,
        ...preparedItems.reduce((acc, it) => ({ ...acc, product_name: it.product_name }), {})
      });

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
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Customer / Owner Name <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <SuggestInput
              type="client_name"
              value={customerName}
              onChange={val => setCustomerName(val)}
              onLinkedFill={linked => {
                if (linked.mobile_no && !customerMobile) setCustomerMobile(linked.mobile_no);
                if (linked.address_line && !customerAddress) setCustomerAddress(linked.address_line);
                if (linked.car_name && !carName) setCarName(linked.car_name);
                if (linked.reg_no && !regNo) setRegNo(linked.reg_no);
              }}
              placeholder="e.g. Rahul Sharma"
              className={inputCls}
              autoFocus
            />
          </div>

          {/* 2. Customer Mobile */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Customer Mobile
            </label>
            <SuggestInput
              type="mobile_no"
              value={customerMobile}
              onChange={val => setCustomerMobile(val.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
              onLinkedFill={linked => {
                if ((linked.customer_name || linked.client_name) && !customerName) setCustomerName(linked.customer_name || linked.client_name || '');
                if (linked.address_line && !customerAddress) setCustomerAddress(linked.address_line);
                if (linked.car_name && !carName) setCarName(linked.car_name);
                if (linked.reg_no && !regNo) setRegNo(linked.reg_no);
              }}
              placeholder="e.g. 9876543210"
              className={inputCls}
            />
          </div>

          {/* 3. Car Number / Reg No */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Car Number / Reg. No
            </label>
            <SuggestInput
              type="reg_no"
              value={regNo}
              maxLength={12}
              onChange={val => setRegNo(val.toUpperCase().replace(/[\s\-_]/g, ''))}
              onLinkedFill={linked => {
                if ((linked.customer_name || linked.client_name) && !customerName) setCustomerName(linked.customer_name || linked.client_name || '');
                if (linked.mobile_no && !customerMobile) setCustomerMobile(linked.mobile_no);
                if (linked.address_line && !customerAddress) setCustomerAddress(linked.address_line);
                if (linked.car_name && !carName) setCarName(linked.car_name);
              }}
              placeholder="e.g. GJ06AB1234"
              className={`${inputCls} uppercase font-mono`}
            />
          </div>

          {/* 4. Car Name / Model */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Car Name / Model
            </label>
            <SuggestInput
              type="car_name"
              value={carName}
              onChange={val => setCarName(val)}
              placeholder="e.g. Swift Dzire, Creta, Nexon..."
              className={inputCls}
            />
          </div>

          {/* 5. Address */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Address
            </label>
            <SuggestInput
              type="address_line"
              value={customerAddress}
              onChange={val => setCustomerAddress(val)}
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
                    <SuggestInput
                      type="product_name"
                      value={it.product_name}
                      onChange={val => handleItemChange(idx, 'product_name', val)}
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
