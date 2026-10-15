import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import AnimatedPage from '../components/shared/AnimatedPage';
import { showToast } from '../components/shared/Toast';
import SuggestInput, { recordFieldSuggestions, type LinkedSuggestionData } from '../components/shared/SuggestInput';

export const JOB_CATEGORY_PRESETS = [
  'Engine Oil Change',
  'Oil Filter Replacement',
  'Air Filter Cleaning/Replacement',
  'Wheel Alignment',
  'Wheel Balancing',
  'Brake Inspection & Service',
  'Battery Check & Replacement',
  'Car Wash & Detailing',
  'AC Service & Gas Refilling',
  'Coolant Top-Up / Radiator Service',
  'Spark Plug Replacement',
  'Tyre Rotation',
  'Tyre Replacement & Puncture Repair',
  'Suspension Check',
  'Engine Diagnostics (OBD Scan)',
  'Transmission Oil Change',
  'Clutch Inspection & Repair',
  'Electrical System Repair',
  'Full Vehicle Inspection',
  'Periodic Maintenance Service'
];

export default function JobCardNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetCompany = searchParams.get('company') || 'Detailing Studio';

  const [submitting, setSubmitting] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);

  // Vehicle state
  const [vehicle, setVehicle] = useState({
    reg_no: '',
    car_name: '',
    insurance_expiry: '',
  });
  const [jobDate, setJobDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');



  // Customer state
  const [custType, setCustType] = useState<'individual' | 'corporate' | 'fleet'>('individual');
  const [customer, setCustomer] = useState({
    customer_name: '',
    mobile_no: '',
    alt_mobile: '',
    email: '',
    company_name: '',
    gstin: '',
    ref_no: '',
    contact_person: '',
    driver_name: '',
    address_line: '',
    colony_street: '',
    city: '',
    state: '',
    state_code: '',
    pincode: '',
  });
  const [existingCustomerId, setExistingCustomerId] = useState<number | null>(null);

  // Insurance
  const [insurance, setInsurance] = useState({
    company: '',
    claim_no: '',
    accident_date: '',
    delivery_date: '',
    approval_status: 'pending',
    approval_date: '',
    approved_amount: '',
  });

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const handleCarNameChange = (val: string) => {
    handleVehicleField('car_name', val);
  };

  // Vehicle lookup
  const lookupVehicle = useCallback(async (regNo: string, force = false) => {
    if (regNo.length < 4 || (lookupDone && !force)) return;
    try {
      const res = await api.get(`/vehicles/lookup/${encodeURIComponent(regNo)}`);
      if (res.data.found) {
        const v = res.data.vehicle;
        const carNameFound = v.last_car_name || [v.make, v.model, v.variant].filter(Boolean).join(' ') || '';
        setVehicle(prev => ({
          ...prev,
          car_name: carNameFound || prev.car_name,
          insurance_expiry: v.insurance_expiry ? v.insurance_expiry.slice(0, 10) : prev.insurance_expiry,
        }));
        if (v.customer_name) {
          setCustomer(prev => ({
            ...prev,
            customer_name: v.customer_name || '',
            mobile_no: v.customer_mobile || '',
            alt_mobile: v.alt_mobile || '',
            email: v.email || '',
            company_name: v.company_name || '',
            gstin: v.gstin || '',
            ref_no: v.ref_no || '',
            contact_person: v.contact_person || '',
            driver_name: v.driver_name || '',
            address_line: v.address_line || '',
            colony_street: v.colony_street || '',
            city: v.city || '',
            state: v.state || '',
            state_code: v.state_code || '',
            pincode: v.pincode || '',
          }));
          setExistingCustomerId(v.customer_id);
        }
        setLookupDone(true);
        showToast('Vehicle found — details auto-filled', 'success');
      } else {
        setVehicle(prev => ({
          ...prev,
          car_name: '',
          insurance_expiry: ''
        }));
        setCustomer({
          customer_name: '',
          mobile_no: '',
          alt_mobile: '',
          email: '',
          company_name: '',
          gstin: '',
          ref_no: '',
          contact_person: '',
          driver_name: '',
          address_line: '',
          colony_street: '',
          city: '',
          state: '',
          state_code: '',
          pincode: ''
        });
        setExistingCustomerId(null);
        if (force) {
          showToast('Vehicle not found. Please enter details manually.', 'info');
        }
      }
    } catch {
      if (force) {
        showToast('Error looking up vehicle', 'error');
      }
    }
  }, [lookupDone]);

  const handleVehicleField = (field: string, value: string) => {
    let val = value;
    if (field === 'reg_no') {
      val = value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
    }
    setVehicle(prev => ({ ...prev, [field]: val }));
    if (field === 'reg_no' && val.length >= 4) {
      lookupVehicle(val, false);
    }
  };

  const handleCustomerField = (field: string, value: string) => {
    setCustomer(prev => ({ ...prev, [field]: value }));
  };

  const cleanMobileNo = (num: string) => {
    if (!num) return '';
    let cleaned = num.replace(/[\s\-\(\)\+]/g, '');
    if (cleaned.startsWith('91') && cleaned.length > 10) {
      cleaned = cleaned.slice(2);
    }
    return cleaned;
  };

  const canProceed = () => {
    const cleanMobile = cleanMobileNo(customer.mobile_no);
    return (vehicle.reg_no || '').trim().length >= 4 && 
           (vehicle.car_name || '').trim().length >= 2 && 
           cleanMobile.length === 10;
  };



  const handleRegSelect = (val: string, linked?: LinkedSuggestionData) => {
    handleVehicleField('reg_no', val);
    lookupVehicle(val, true);
    if (linked) {
      if (!vehicle.car_name && linked.car_name) handleVehicleField('car_name', linked.car_name);
      if (!customer.customer_name && (linked.client_name || linked.customer_name)) handleCustomerField('customer_name', linked.client_name || linked.customer_name || '');
      if (!customer.mobile_no && linked.mobile_no) handleCustomerField('mobile_no', linked.mobile_no);
      if (!customer.address_line && linked.address_line) handleCustomerField('address_line', linked.address_line);
      if (!customer.city && linked.city) handleCustomerField('city', linked.city);
      if (!customer.company_name && linked.company_name) handleCustomerField('company_name', linked.company_name);
    }
  };

  const handleMobileSelect = (_val: string, linked?: LinkedSuggestionData) => {
    if (linked) {
      if (!customer.customer_name && (linked.client_name || linked.customer_name)) handleCustomerField('customer_name', linked.client_name || linked.customer_name || '');
      if (!vehicle.reg_no && linked.reg_no) {
        handleVehicleField('reg_no', linked.reg_no);
        lookupVehicle(linked.reg_no, true);
      }
      if (!vehicle.car_name && linked.car_name) handleVehicleField('car_name', linked.car_name);
      if (!customer.address_line && linked.address_line) handleCustomerField('address_line', linked.address_line);
      if (!customer.city && linked.city) handleCustomerField('city', linked.city);
      if (!customer.company_name && linked.company_name) handleCustomerField('company_name', linked.company_name);
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) {
      if (!vehicle.reg_no || vehicle.reg_no.trim().length < 4) {
        showToast('Please enter a valid Registration Number (at least 4 characters)', 'warning');
      } else if (!vehicle.car_name || vehicle.car_name.trim().length < 2) {
        showToast('Please enter Car Name / Model (at least 2 characters)', 'warning');
      } else if (cleanMobileNo(customer.mobile_no).length !== 10) {
        showToast('Please enter a valid 10-digit Mobile Number', 'warning');
      }
      return;
    }

    setSubmitting(true);
    try {
      const cleanCarName = vehicle.car_name.trim();

      const body: Record<string, any> = {
        reg_no: vehicle.reg_no,
        car_name: cleanCarName,
        customer_type: custType,
        job_date: jobDate,
        payment_mode: paymentType,
        ...customer,
        customer_name: customer.customer_name?.trim() || 'Customer',
        mobile_no: cleanMobileNo(customer.mobile_no),
        customer_id: existingCustomerId,
        owner_name: customer.customer_name?.trim() || 'Customer',
        insurance_company: insurance.company || null,
        insurance_claim_no: insurance.claim_no || null,
        claim_no: insurance.claim_no || null,
        accident_date: insurance.accident_date || null,
        delivery_date: insurance.delivery_date || null,
        approval_status: insurance.approval_status || 'pending',
        approval_date: insurance.approval_date || null,
        company: targetCompany,
        is_quick_job: 0,
      };

      // Record suggestions for future auto-complete (fire and forget)
      recordFieldSuggestions({
        reg_no: vehicle.reg_no,
        car_name: cleanCarName,
        client_name: customer.customer_name,
        mobile_no: customer.mobile_no,
        alt_mobile: customer.alt_mobile,
        email: customer.email,
        company_name: customer.company_name,
        address_line: customer.address_line,
        colony_street: customer.colony_street,
        city: customer.city,
        pincode: customer.pincode,
        insurance_company: insurance.company
      });

      const res = await api.post('/job-cards', body);
      const jobId = res.data.id;
      showToast(`Detailing Studio order ${res.data.job_no} created successfully!`, 'success');
      navigate(`/job-cards/${jobId}/edit`);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create job card', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStitchInput = (label: string, field: string, obj: Record<string, any>, setter: (f: string, v: string) => void, opts?: { type?: string; placeholder?: string; disabled?: boolean; list?: string; onBlur?: (v: string) => void }) => {
    const isMobile = field === 'mobile_no' || field === 'alt_mobile';
    return (
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">{label}</label>
        <SuggestInput
          type={field}
          value={obj[field] || ''}
          onChange={(val) => {
            const nextVal = isMobile ? val.replace(/\D/g, '').slice(0, 10) : val;
            setter(field, nextVal);
          }}
          onBlur={(e) => {
            opts?.onBlur && opts.onBlur(e.target.value);
          }}
          maxLength={isMobile ? 10 : undefined}
          placeholder={opts?.placeholder || ''}
          disabled={opts?.disabled}
          className="w-full bg-white border border-stone-200/90 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 py-3 px-4 font-semibold text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition-all"
        />
        {field === 'mobile_no' && obj[field] && cleanMobileNo(obj[field]).length !== 10 && (
          <p className="mt-1 text-xs text-red-500 font-medium">
            Mobile number must be exactly 10 digits.
          </p>
        )}
      </div>
    );
  };

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 px-4 sm:px-8 pb-28 min-h-screen">

      {/* ═══ Page Header ═══ */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex justify-between items-end mb-4">
          <div>
            <button onClick={() => navigate('/job-cards')} className="text-slate-500 hover:text-amber-800 transition-colors flex items-center gap-1 text-sm font-medium mb-3">
              <span className="material-symbols-outlined text-lg">arrow_back</span> Back to Detailing Studio
            </button>
            <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface">Create New Detailing Studio Order</h2>
            <p className="text-slate-500 font-medium text-sm">Enter vehicle and customer details to create order.</p>
          </div>
        </div>
      </div>

      {/* ═══ Main Content: 2/3 Form + 1/3 Sidebar ═══ */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-32">

        {/* Main Form (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* ═══ Payment Option: Cash vs Credit ═══ */}
            <section className="bg-white p-5 sm:p-6 rounded-2xl border border-amber-200/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-gradient-to-b from-amber-500 to-amber-600 rounded-full" />
                  <div>
                    <h3 className="font-headline font-bold text-base text-stone-900">Payment Option</h3>
                    <p className="text-xs text-stone-500">Select payment settlement mode for this Detailing Studio order</p>
                  </div>
                </div>
                <span className={`text-[11px] font-extrabold uppercase px-3 py-1 rounded-full border self-start sm:self-auto ${
                  paymentType === 'cash'
                    ? 'bg-amber-500/15 text-amber-900 border-amber-400/50'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {paymentType === 'cash' ? '● Cash Paid' : '● Goes to Payment Pending'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* Cash Option */}
                <button
                  type="button"
                  onClick={() => setPaymentType('cash')}
                  className={`p-4 rounded-xl border-2 text-left flex items-start gap-3.5 transition-all cursor-pointer ${
                    paymentType === 'cash'
                      ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-1 ring-amber-500/30'
                      : 'border-stone-200 bg-stone-50/40 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    paymentType === 'cash' ? 'bg-amber-500 text-stone-950 font-black shadow-sm' : 'bg-stone-200 text-stone-500'
                  }`}>
                    <span className="material-symbols-outlined text-2xl">payments</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-headline font-extrabold text-sm text-stone-900">Cash</span>
                      {paymentType === 'cash' && (
                        <span className="material-symbols-outlined text-amber-600 text-lg">check_circle</span>
                      )}
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5 leading-snug">Order is marked as Cash Paid upon billing</p>
                  </div>
                </button>

                {/* Credit Option */}
                <button
                  type="button"
                  onClick={() => setPaymentType('credit')}
                  className={`p-4 rounded-xl border-2 text-left flex items-start gap-3.5 transition-all cursor-pointer ${
                    paymentType === 'credit'
                      ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-1 ring-amber-500/30'
                      : 'border-stone-200 bg-stone-50/40 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    paymentType === 'credit' ? 'bg-amber-500 text-stone-950 font-black shadow-sm' : 'bg-stone-200 text-stone-500'
                  }`}>
                    <span className="material-symbols-outlined text-2xl">pending_actions</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-headline font-extrabold text-sm text-stone-900">Credit</span>
                      {paymentType === 'credit' && (
                        <span className="material-symbols-outlined text-amber-600 text-lg">check_circle</span>
                      )}
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5 leading-snug">Goes directly to Payment Pending register</p>
                  </div>
                </button>
              </div>
            </section>

            {/* Vehicle Details Card */}
            <section className="bg-white p-6 sm:p-8 rounded-2xl border border-amber-200/60 shadow-sm space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-1 h-6 bg-amber-600 rounded-full" />
                <h3 className="font-headline font-bold text-lg">Vehicle Details</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Registration Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Registration Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <SuggestInput
                      type="reg_no"
                      value={vehicle.reg_no}
                      maxLength={10}
                      onChange={(val) => {
                        const clean = val.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
                        handleVehicleField('reg_no', clean);
                      }}
                      onSelect={handleRegSelect}
                      placeholder="e.g. MH12AB1234"
                      className="w-full bg-white border border-stone-200/90 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 py-3 px-4 font-bold tracking-wider text-base text-stone-900 uppercase placeholder:text-stone-300 shadow-sm transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => lookupVehicle(vehicle.reg_no, true)}
                      className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 rounded-xl font-extrabold text-xs shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm">search</span>
                      Search
                    </button>
                  </div>
                </div>

                {/* Car Name / Model with Autocomplete & Auto-save */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Car Name / Model <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <SuggestInput
                    type="car_name"
                    value={vehicle.car_name}
                    onChange={(val) => handleCarNameChange(val)}
                    placeholder="e.g. MG Hector, Creta, Swift Dzire..."
                    className="w-full bg-white border border-stone-200/90 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 py-3 px-4 font-semibold text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition-all"
                  />
                  <p className="mt-1 text-[11px] text-slate-400 font-medium">
                    Type initials to select or enter a new car name (auto-saved for future use).
                  </p>
                </div>

                {/* Job / Entry Date (Select any past or recent month/date) */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Job / Entry Date <span className="text-amber-700 font-bold">(Select any past or recent month/date)</span>
                  </label>
                  <input
                    type="date"
                    value={jobDate}
                    onChange={(e) => setJobDate(e.target.value)}
                    className="w-full bg-white border border-stone-200/90 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 py-3 px-4 font-mono font-bold text-sm text-stone-900 shadow-sm transition-all"
                  />
                  <p className="mt-1 text-[11px] text-slate-400 font-medium">
                    Entry date for this order. Can be set to any previous month (e.g. September) or current date.
                  </p>
                </div>
              </div>
            </section>

            {/* Customer Information */}
            <section className="bg-white p-6 sm:p-8 rounded-2xl border border-amber-200/60 shadow-sm space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-1 h-6 bg-amber-600 rounded-full" />
                <h3 className="font-headline font-bold text-lg">Customer Information</h3>
              </div>

              {/* Customer Type Selector */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Customer Type</label>
                <div className="flex gap-3">
                  {(['individual', 'corporate', 'fleet'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCustType(t)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        custType === t
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-extrabold shadow-md shadow-amber-500/20'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70 border border-stone-200/50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Customer Name (Optional)</label>
                  <SuggestInput
                    type="client_name"
                    value={customer.customer_name}
                    onChange={(val) => handleCustomerField('customer_name', val)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-white border border-stone-200/90 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 py-3 px-4 font-semibold text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition-all"
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Mobile Number *</label>
                  <SuggestInput
                    type="mobile_no"
                    value={customer.mobile_no}
                    maxLength={10}
                    onChange={(val) => handleCustomerField('mobile_no', val.replace(/\D/g, '').slice(0, 10))}
                    onSelect={handleMobileSelect}
                    placeholder="10-digit number"
                    className="w-full bg-white border border-stone-200/90 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 py-3 px-4 font-semibold text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition-all"
                  />
                  {customer.mobile_no && cleanMobileNo(customer.mobile_no).length !== 10 && (
                    <p className="mt-1 text-xs text-red-500 font-medium">
                      Mobile number must be exactly 10 digits.
                    </p>
                  )}
                </div>

                {renderStitchInput('Alternate Mobile', 'alt_mobile', customer, handleCustomerField, { type: 'tel', placeholder: 'Optional 10-digit number' })}
                {renderStitchInput('Email Address', 'email', customer, handleCustomerField, { type: 'email', placeholder: 'e.g. rahul@example.com' })}

                {custType !== 'individual' && (
                  <>
                    {renderStitchInput('Company Name', 'company_name', customer, handleCustomerField, { placeholder: 'e.g. Acme Corp' })}
                    
                    {renderStitchInput('Contact Person', 'contact_person', customer, handleCustomerField, { placeholder: 'Contact person name' })}
                    {renderStitchInput('Driver Name', 'driver_name', customer, handleCustomerField, { placeholder: 'Driver name' })}
                  </>
                )}

                {renderStitchInput('Address Line', 'address_line', customer, handleCustomerField, { placeholder: 'House / Flat / Building No' })}
                {renderStitchInput('Colony / Street', 'colony_street', customer, handleCustomerField, { placeholder: 'Street / Area' })}
                {renderStitchInput('City', 'city', customer, handleCustomerField, { placeholder: 'e.g. Mumbai' })}
                {renderStitchInput('Pincode', 'pincode', customer, handleCustomerField, { placeholder: 'e.g. 400001' })}

                {/* Insurance details (Optional) */}
                <div className="md:col-span-2 border-t border-slate-100 pt-6 mt-2">
                  <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-widest mb-4">Insurance Details (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Insurance Company</label>
                      <SuggestInput
                        type="insurance_company"
                        value={insurance.company}
                        onChange={(val) => setInsurance(prev => ({ ...prev, company: val }))}
                        placeholder="e.g. ICICI Lombard, HDFC Ergo"
                        className="w-full bg-white border border-stone-200/90 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 py-3 px-4 font-semibold text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Insurance Expiry Date</label>
                      <input
                        type="date"
                        value={vehicle.insurance_expiry || ''}
                        onChange={(e) => handleVehicleField('insurance_expiry', e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-3 px-4 font-medium text-sm text-on-surface"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Claimant / Policy Holder Name</label>
                      <input
                        type="text"
                        value={insurance.claim_no}
                        onChange={(e) => setInsurance(prev => ({ ...prev, claim_no: e.target.value }))}
                        placeholder="Owner name for claim"
                        className="w-full bg-white border border-stone-200/90 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 py-3 px-4 font-semibold text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </motion.div>
        </div>

        {/* ═══ Right Sidebar — Context Panel ═══ */}
        <div className="space-y-6">
          {/* Quick Info Card (Obsidian & Amber Gold) */}
          <div className="bg-[#141210] text-white p-6 rounded-2xl border border-amber-500/30 shadow-xl shadow-stone-950/10">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/10">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-400 text-lg">info</span>
              </div>
              <div>
                <h3 className="font-headline font-bold text-white text-base">Quick Info</h3>
                <p className="text-[10px] text-amber-400/70 uppercase tracking-wider font-semibold">Live Order Preview</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/25">
                <p className="text-[10px] uppercase font-bold tracking-widest text-amber-300/80 mb-1">Status</p>
                <p className="font-bold text-xs text-amber-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  {lookupDone ? 'Vehicle Recognized' : 'Awaiting Input'}
                </p>
              </div>
              <div className="space-y-3">
                <div className="p-3.5 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-stone-400 mb-1">Vehicle</p>
                  <p className="font-bold text-sm text-white font-mono">{vehicle.reg_no || '—'}</p>
                  <p className="text-xs text-amber-400 font-semibold mt-0.5">{vehicle.car_name || 'No car name entered'}</p>
                </div>
                <div className="p-3.5 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-stone-400 mb-1">Customer</p>
                  <p className="font-bold text-sm text-white">{customer.customer_name || '—'}</p>
                  <p className="text-xs text-stone-400 font-mono">{customer.mobile_no || 'No mobile entered'}</p>
                </div>
                <div className="p-3.5 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-stone-400 mb-1">Payment Settlement</p>
                  <p className="font-bold text-sm text-white flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${paymentType === 'cash' ? 'bg-amber-400' : 'bg-rose-400 animate-pulse'}`} />
                    {paymentType === 'cash' ? 'Cash Paid' : 'Credit (Pending)'}
                  </p>
                  <p className="text-[11px] text-amber-300/80 font-medium mt-0.5">
                    {paymentType === 'cash' ? 'Paid upon bill generation' : 'Added to Payment Pending'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pro Tips Card */}
          <div className="bg-amber-50/70 p-6 rounded-2xl border border-amber-200/60 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-950 mb-3">
              <span className="material-symbols-outlined text-amber-600 text-lg">tips_and_updates</span>
              <h4>Pro Tips</h4>
            </div>
            <ul className="space-y-3.5">
              <li className="flex gap-2.5 text-xs text-amber-900 font-medium leading-relaxed">
                <span className="material-symbols-outlined text-amber-600 text-base flex-shrink-0 mt-0.5">lightbulb</span>
                <span>Type any car initials (e.g. <strong>MG</strong>, <strong>Cre</strong>, <strong>Swi</strong>) to auto-fill car models instantly.</span>
              </li>
              <li className="flex gap-2.5 text-xs text-amber-900 font-medium leading-relaxed">
                <span className="material-symbols-outlined text-amber-600 text-base flex-shrink-0 mt-0.5">verified</span>
                <span>Entering a new car name automatically saves it so it is suggested on future orders.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ═══ Sticky Footer Actions ═══ */}
      <div className="fixed bottom-0 right-0 w-full lg:w-[calc(100%-260px)] bg-white/80 backdrop-blur-xl border-t border-slate-100 p-4 px-4 sm:px-8 flex flex-col sm:flex-row gap-4 sm:gap-0 justify-between items-center z-40">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/job-cards')}
            className="px-6 py-2.5 text-stone-600 hover:bg-amber-50 hover:text-amber-800 rounded-xl font-bold text-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            Discard
          </button>
        </div>
        <div className="flex items-center gap-4">
          {!canProceed() && (
            <p className="text-xs text-slate-400 font-medium mr-4">
              Please enter registration number, car name, and a 10-digit mobile number.
            </p>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            disabled={submitting || !canProceed()}
            className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 rounded-xl font-extrabold text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95"
          >
            {submitting ? (
              <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> Creating Order...</>
            ) : (
              <><span className="material-symbols-outlined text-lg">check_circle</span> Create Order</>
            )}
          </motion.button>
        </div>
      </div>
    </AnimatedPage>
  );
}
