import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Modal from './shared/Modal';
import api from '../api/axios';
import { showToast } from './shared/Toast';
import { formatCurrency } from '../utils/format';
import SuggestInput, { recordFieldSuggestions, type LinkedSuggestionData } from './shared/SuggestInput';

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

interface Props {
  onClose: () => void;
  onCreated: (data: { id: number; job_no: string; tracking_url: string; public_token: string }) => void;
}

export default function QuickJobCardModal({ onClose, onCreated }: Props) {
  const [quickServices, setQuickServices] = useState<QuickService[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [customService, setCustomService] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [saveCustomService, setSaveCustomService] = useState(false);
  const [billingType, setBillingType] = useState<'gst' | 'non_gst'>('gst');

  // Form fields
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [regNo, setRegNo] = useState('');
  const [carName, setCarName] = useState('');
  const [odometer, setOdometer] = useState('');



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

  const toggleService = (svc: QuickService) => {
    const exists = selectedServices.find(s => s.service_name === svc.service_name);
    if (exists) {
      setSelectedServices(prev => prev.filter(s => s.service_name !== svc.service_name));
    } else {
      setSelectedServices(prev => [...prev, {
        service_name: svc.service_name,
        rate: 0,
        qty: 1,
        amount: 0
      }]);
    }
  };

  const isSelected = (name: string) => selectedServices.some(s => s.service_name === name);

  const subtotal = selectedServices.reduce((sum, s) => sum + (parseFloat(String(s.amount)) || 0), 0)
    + (customService.trim() ? parseFloat(customRate) || 0 : 0);
  const gstAmount = billingType === 'gst' ? subtotal * 0.18 : 0;
  const total = subtotal + gstAmount;

  const handleRegSelect = (_val: string, linked?: LinkedSuggestionData) => {
    if (!linked) return;
    if (!carName && linked.car_name) setCarName(linked.car_name);
    if (!ownerName && (linked.client_name || linked.customer_name)) setOwnerName(linked.client_name || linked.customer_name || '');
    if (!mobile && linked.mobile_no) setMobile(linked.mobile_no);
    if (!address && linked.address_line) setAddress(linked.address_line);
    if (linked.odometer) setOdometer(String(linked.odometer));
  };

  const handleMobileSelect = (_val: string, linked?: LinkedSuggestionData) => {
    if (!linked) return;
    if (!ownerName && (linked.client_name || linked.customer_name)) setOwnerName(linked.client_name || linked.customer_name || '');
    if (!regNo && linked.reg_no) setRegNo(linked.reg_no);
    if (!carName && linked.car_name) setCarName(linked.car_name);
    if (!address && linked.address_line) setAddress(linked.address_line);
    if (linked.odometer) setOdometer(String(linked.odometer));
  };

  const handleSubmit = async () => {
    if (!regNo.trim() || !mobile.trim() || !carName.trim()) {
      showToast('Please enter registration number, car name, and mobile number', 'error');
      return;
    }
    if (selectedServices.length === 0 && !customService.trim()) {
      showToast('Please select at least one service', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/quick-job-cards', {
        reg_no: regNo.toUpperCase().trim(),
        owner_name: ownerName.trim() || 'Customer',
        mobile: mobile.trim(),
        address: address.trim(),
        car_name: carName.trim(),
        odometer: odometer.trim(),
        billing_type: billingType,
        services: selectedServices.map(s => ({
          ...s,
          tax_pct: billingType === 'gst' ? 18 : 0
        })),
        custom_service: customService.trim(),
        custom_service_rate: customRate,
        save_custom_service: saveCustomService
      });
      recordFieldSuggestions({
        reg_no: regNo,
        car_name: carName,
        client_name: ownerName,
        mobile_no: mobile,
        address_line: address,
        service_name: customService
      });
      showToast(`Car Wash job ${res.data.job_no} created!`, 'success');
      onCreated(res.data);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to create job card', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-slate-50 border border-stone-200/80 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 py-3 px-4 font-medium text-sm text-on-surface placeholder:text-slate-300";

  return (
    <Modal title="🚗 Car Wash Job Card" onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">

        {/* ── Customer Details ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Owner Name <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <SuggestInput
              type="client_name"
              value={ownerName}
              onChange={setOwnerName}
              placeholder="Customer name"
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Mobile <span className="text-red-400">*</span>
            </label>
            <SuggestInput
              type="mobile_no"
              value={mobile}
              onChange={(val) => setMobile(val.replace(/\D/g, '').slice(0, 10))}
              onSelect={handleMobileSelect}
              placeholder="9876543210"
              maxLength={10}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Address
            </label>
            <SuggestInput
              type="address_line"
              value={address}
              onChange={setAddress}
              placeholder="Address / Area / Landmark..."
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Reg. No <span className="text-red-400">*</span>
            </label>
            <SuggestInput
              type="reg_no"
              value={regNo}
              onChange={(val) => setRegNo(val.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10))}
              onSelect={handleRegSelect}
              placeholder="GJ06XX0000"
              maxLength={10}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Car Name <span className="text-red-400">*</span>
            </label>
            <SuggestInput
              type="car_name"
              value={carName}
              onChange={setCarName}
              placeholder="Swift Dzire, Creta..."
              className={inputCls}
            />
          </div>
        </div>

        {/* ── Quick Service Buttons ── */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
            Quick Services
          </label>
          <div className="flex flex-wrap gap-2">
            {quickServices.map(svc => (
              <motion.button
                key={svc.id}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => toggleService(svc)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  isSelected(svc.service_name)
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                    : 'bg-white text-on-surface-muted border-gray-200 hover:border-amber-400 hover:bg-amber-50'
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  {isSelected(svc.service_name) ? 'check_circle' : 'add_circle_outline'}
                </span>
                {svc.service_name}
              </motion.button>
            ))}
          </div>

          {/* Option to add new preset service */}
          <div className="flex gap-2 mt-3 items-center max-w-sm">
            <div className="flex-grow">
              <SuggestInput
                type="service_name"
                placeholder="Save new quick service for future use..."
                value={newPresetName}
                onChange={setNewPresetName}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-medium text-on-surface placeholder:text-slate-400"
              />
            </div>
            <button
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
                } catch (err) {
                  showToast('Failed to save preset', 'error');
                }
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1 shrink-0"
            >
              <span className="material-symbols-outlined text-xs">save</span>
              Save
            </button>
          </div>
        </div>

        {/* ── Selected Services Pricing (Manual) ── */}
        {selectedServices.length > 0 && (
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
              Enter Service Prices (Manual)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedServices.map((svc, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-xs font-bold text-on-surface truncate pr-2">{svc.service_name}</span>
                  <div className="w-28 relative flex-shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      placeholder="Rate"
                      value={svc.rate || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSelectedServices(prev => prev.map((s, i) => i === idx ? { ...s, rate: val, amount: val * s.qty } : s));
                      }}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-1.5 pl-6 pr-2 text-xs font-bold text-on-surface"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Custom Service (optional) ── */}
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Custom Service (optional)
              </label>
              <SuggestInput
                type="service_name"
                value={customService}
                onChange={setCustomService}
                placeholder="Add any other service..."
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Rate ₹</label>
              <input
                type="number"
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              id="saveCustomService"
              checked={saveCustomService}
              onChange={(e) => setSaveCustomService(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 border-gray-300 focus:ring-amber-500/20"
            />
            <label htmlFor="saveCustomService" className="text-xs font-bold text-slate-500 cursor-pointer select-none">
              Save this service to Quick Services list for future use
            </label>
          </div>
        </div>

        {/* ── Billing Type Selector (GST vs Non-GST) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600 text-lg">receipt_long</span>
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Billing Type</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-stone-200 shadow-xs">
            <button
              type="button"
              onClick={() => setBillingType('gst')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                billingType === 'gst'
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-sm'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              <span className="material-symbols-outlined text-sm">description</span>
              GST Invoice (18%)
            </button>
            <button
              type="button"
              onClick={() => setBillingType('non_gst')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                billingType === 'non_gst'
                  ? 'bg-stone-800 text-white shadow-sm'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              <span className="material-symbols-outlined text-sm">assignment</span>
              Non-GST / Estimate (0%)
            </button>
          </div>
        </div>

        {/* ── Total Summary ── */}
        <div className="flex items-center justify-between bg-amber-50 px-5 py-3.5 rounded-xl border border-amber-200">
          <div>
            <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              {selectedServices.length + (customService.trim() ? 1 : 0)} services selected &middot; {billingType === 'gst' ? 'GST Invoice' : 'Non-GST / Estimate'}
            </p>
            <p className="text-[10px] text-stone-600 font-medium mt-0.5">
              Subtotal: {formatCurrency(subtotal)} &middot; {billingType === 'gst' ? `GST (18%): ${formatCurrency(gstAmount)}` : 'GST (0%): ₹0.00'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-amber-800 font-medium">{billingType === 'gst' ? 'Estimated Total (Incl. 18% GST)' : 'Estimated Total (Non-GST)'}</p>
            <p className="text-xl font-extrabold text-amber-900 font-mono">
              {formatCurrency(total)}
            </p>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary text-sm py-2.5 px-5">
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary text-sm py-2.5 px-6 flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                Creating...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">local_car_wash</span>
                Create Car Wash Job
              </>
            )}
          </motion.button>
        </div>
      </div>
    </Modal>
  );
}
