import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import AnimatedPage from '../components/shared/AnimatedPage';
import StatusBadge from '../components/shared/StatusBadge';
import { showToast } from '../components/shared/Toast';
import { SkeletonForm } from '../components/shared/Skeleton';
import Modal from '../components/shared/Modal';
import VehicleSpecFields from '../components/shared/VehicleSpecFields';
import { formatCurrency } from '../utils/format';
import { JOB_CATEGORY_PRESETS } from './JobCardNew';
import SuggestInput, { recordFieldSuggestions } from '../components/shared/SuggestInput';

interface Service {
  id?: number;
  service_name: string;
  item_type: 'part' | 'labour';
  part_code: string;
  qty: number | '';
  rate: number | '';
  amount: number | '';
  discount_pct: number | '';
  hsn_sac: string;
  tax_pct: number | '';
  tax_amount: number | '';
  concern_id?: number | null;
  concern_index?: number | null;
  unit?: string;
  job_category?: string | null;
  price_type?: 'price' | 'mrp';
  old_part?: number;
  package_name?: string;
}

const emptyService: Service = {
  service_name: '', item_type: 'labour', part_code: '', qty: 1,
  rate: '', amount: '', discount_pct: '', hsn_sac: '', tax_pct: 18, tax_amount: '',
  concern_id: null, concern_index: null, unit: 'pc', price_type: 'price', job_category: null,
  old_part: 0
};

const statusPipeline = ['ready', 'delivered', 'invoiced'];






export default function JobCardEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Data states
  const [job, setJob] = useState<any>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [concerns, setConcerns] = useState<any[]>([]);


  const [_jobCategory, setJobCategory] = useState('');
  const [_jobCategoryDesc, setJobCategoryDesc] = useState('');
  const [jobCategoryAmount, setJobCategoryAmount] = useState('');
  const [jobCategoryGstPct, setJobCategoryGstPct] = useState('18');
  const [_isCustomCategory, setIsCustomCategory] = useState(false);
  
  // UI and loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState<'invoice' | 'estimate' | 'vehicle' | 'customer' | 'insurance' | 'concern' | null>(null);
  const [newConcernText, setNewConcernText] = useState('');
    const [vehicleSpec, setVehicleSpec] = useState<any>({});
  const [customerSpec, setCustomerSpec] = useState<any>({});
  const [insuranceSpec, setInsuranceSpec] = useState<any>({});
  const [staff, setStaff] = useState<any[]>([]);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [showWaMenu, setShowWaMenu] = useState(false);
      const [manualInvoiceNo, setManualInvoiceNo] = useState('');
  const [invoicePaymentStatus, setInvoicePaymentStatus] = useState<'done' | 'pending'>('done');
  const [invoicePaymentMode, setInvoicePaymentMode] = useState<'cash' | 'upi' | 'card' | 'bank_transfer'>('cash');
  const [invoiceTransactionId, setInvoiceTransactionId] = useState('');
  const [invoiceStaffId, setInvoiceStaffId] = useState('');
  const [isCustomCategoryNew, setIsCustomCategoryNew] = useState(false);
  const [customCatInputNew, setCustomCatInputNew] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; icon: string; iconColor: string; confirmLabel: string; confirmColor: string; onConfirm: () => void } | null>(null);

  // Manual Job States
  const [manualCategory, setManualCategory] = useState('Mechanic');
  const [manualType, setManualType] = useState<'part' | 'labour'>('labour');
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('');
    const [showManualSuggestions, setShowManualSuggestions] = useState(false);
  const [manualCatalogSuggestions, setManualCatalogSuggestions] = useState<any[]>([]);
  const [dropdownCategories, setDropdownCategories] = useState<string[]>([
    'Mechanic',
    'Detailing',
    'Electrical',
    'Dent & Paint',
    'AC Service',
    'Car Wash',
    'General'
  ]);

  const handleManualSearch = async (val: string, itemType: string) => {
    setManualName(val);
    if (!val || val.length < 1) {
      setManualCatalogSuggestions([]);
      setShowManualSuggestions(false);
      return;
    }
    try {
      const suggestType = itemType === 'part' ? 'part_name' : 'service_name';
      const [catalogRes, suggestRes] = await Promise.all([
        api.get('/service-catalog', { params: { search: val, item_type: itemType } }),
        api.get('/job-cards/suggestions', { params: { q: val, type: suggestType } }).catch(() => ({ data: { data: [] } })),
      ]);
      const catalogItems = catalogRes.data.data || [];
      const suggestionItems = (suggestRes.data.data || [])
        .filter((s: any) => !catalogItems.some((c: any) => c.item_name?.toLowerCase() === s.suggestion_text?.toLowerCase()))
        .map((s: any) => ({
          item_name: s.suggestion_text,
          default_rate: '',
          default_tax_pct: '18',
          _fromSuggestion: true,
        }));
      setManualCatalogSuggestions([...catalogItems, ...suggestionItems]);
      setShowManualSuggestions(true);
    } catch (err) {
      console.error(err);
      setManualCatalogSuggestions([]);
      setShowManualSuggestions(false);
    }
  };

  const handleSelectManualSuggestion = (item: any) => {
    setManualName(item.item_name);
    setManualAmount(item.default_rate || '');
        setShowManualSuggestions(false);
  };

  const handleAddManualItem = async () => {
    if (!manualName.trim()) {
      showToast('Please enter a description or part name', 'warning');
      return;
    }

    let categoryToUse = manualCategory;
    if (isCustomCategoryNew) {
      const trimmedCat = customCatInputNew.trim();
      if (!trimmedCat) {
        showToast('Please enter a custom category name', 'warning');
        return;
      }
      categoryToUse = trimmedCat;
      if (!dropdownCategories.includes(trimmedCat)) {
        setDropdownCategories(prev => [...prev, trimmedCat]);
        try {
          await api.post('/service-catalog/custom-categories', { category: trimmedCat });
        } catch (err) {
          console.warn('Failed to save custom category:', err);
        }
      }
      setIsCustomCategoryNew(false);
      setCustomCatInputNew('');
      setManualCategory(trimmedCat);
    }

    const rateVal = parseFloat(manualAmount) || 0;
        const taxPctVal = 0;
    const amountVal = rateVal;
    const taxAmtVal = 0;

    const newItem: Service = {
      ...emptyService,
      service_name: manualName.trim(),
      item_type: manualType,
      job_category: categoryToUse,
      qty: 1,
      rate: rateVal === 0 ? '' : rateVal,
      amount: amountVal === 0 ? '' : amountVal,
      tax_pct: taxPctVal,
      tax_amount: taxAmtVal === 0 ? '' : taxAmtVal,
    };

    setServices(prev => {
      const updated = [...prev, newItem];
      autoSave(updated, concerns);
      return updated;
    });

    showToast(`Added manual ${manualType}`, 'success');
    recordFieldSuggestions({ [manualType === 'part' ? 'part_name' : 'service_name']: manualName.trim() });

    setManualName('');
    setManualAmount('');
        setManualCatalogSuggestions([]);
    setShowManualSuggestions(false);
  };

  const handleAddCustomCategoryManual = async (name: string) => {
    if (!name.trim()) return;
    const trimmed = name.trim();
    if (!dropdownCategories.includes(trimmed)) {
      setDropdownCategories(prev => [...prev, trimmed]);
      try {
        await api.post('/service-catalog/custom-categories', { category: trimmed });
      } catch (err) {
        console.warn('Failed to save custom category:', err);
      }
    }
    setManualCategory(trimmed);
    setIsCustomCategoryNew(false);
    setCustomCatInputNew('');
  };



  const forceSave = async (customServices?: Service[], customConcerns?: any[]) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    const svcs = customServices || services;
    const concs = customConcerns || concerns;
    const servicesPayload = svcs.map(s => {
      let idx = undefined;
      if (s.concern_id) {
        idx = concs.findIndex(c => c.id === s.concern_id);
      } else if (s.concern_index !== undefined) {
        idx = s.concern_index;
      }
      return {
        ...s,
        concern_index: idx !== -1 && idx !== undefined ? idx : null
      };
    });

    try {
      const res = await api.put(`/job-cards/${id}`, {
        services: servicesPayload,
        concerns: concs
      });
      if (res.data) {
        setJob((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            invoice: res.data.invoice,
            estimate: res.data.estimate
          };
        });
      }
    } catch (err) {
      console.error('Force save failed:', err);
    }
  };

  const handleExplicitSave = async () => {
    setSaving(true);
    try {
      await forceSave();
      showToast('Detailing Studio Order & Bill updated successfully!', 'success');
      fetchJob();
    } catch {
      showToast('Failed to save order updates', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async (type: string) => {
    await forceSave();
    window.open(`/print/${id}?type=${type}`, '_blank');
    setShowPrintMenu(false);
  };

  const handleDownloadInvoice = async () => {
    await forceSave();
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const tk = localStorage.getItem('gms_token') || '';
    window.open(`${baseUrl}/job-cards/${id}/invoice-html?token=${tk}`, '_blank');
  };

  const handleWhatsAppShare = async (type: 'job_card' | 'estimate' | 'invoice') => {
    try {
      showToast('Sending WhatsApp message...', 'info');
      const res = await api.post(`/job-cards/${id}/share`, { type });
      if (res.data.success) {
        showToast('WhatsApp message sent successfully via Business API!', 'success');
      } else {
        showToast('Meta Cloud API unavailable. Opening WhatsApp Web fallback...', 'warning');
        window.open(res.data.fallbackUrl, '_blank');
      }
    } catch (err: any) {
      console.error(err);
      const phone = (job.mobile_no || job.cust_mobile || '').replace(/\D/g, '');
      const custName = job.owner_name || job.cust_name || 'Valued Customer';
      const vehReg = job.reg_no || '';
      const vehCar = [job.vehicle_make || job.make, job.vehicle_model || job.model].filter(Boolean).join(' ') || job.car_name || '';
      const carDisplay = vehCar ? `${vehReg} (${vehCar})` : vehReg;
      const jobNo = job.job_no || '';

      let text = '';
      if (type === 'job_card') {
        text = `Hello *${custName}*,\n\n🚗 *Detailing Studio Order Created - Happy Car Wash*\n────────────────────────\n📋 *Order No:* ${jobNo}\n🚙 *Vehicle:* ${carDisplay}\n🔧 *Service Type:* ${job.service_type || 'General Service'}\n\nThank you for choosing *Happy Car Wash*!`;
      } else if (type === 'estimate') {
        const serviceSummary = services.length > 0
          ? services.slice(0, 8).map(s => {
              const itemTotal = (parseFloat(s.amount as any) || 0) + (parseFloat(s.tax_amount as any) || 0);
              return `• ${s.service_name}: ₹${itemTotal.toLocaleString('en-IN')}`;
            }).join('\n')
          : '• General Inspection & Service';

        const calculatedGrandTotal = services.reduce((sum, s) => sum + (parseFloat(s.amount as any) || 0) + (parseFloat(s.tax_amount as any) || 0), 0);
        const estAmt = (calculatedGrandTotal || job.grand_total || job.total_amount || 0).toLocaleString('en-IN');

        text = `Hello *${custName}*,\n\n📊 *Service Estimate - Happy Car Wash*\n────────────────────────\n📋 *Job Card No:* ${jobNo}\n🚙 *Vehicle:* ${carDisplay}\n\n🛠️ *Estimated Services:*\n${serviceSummary}\n\n💰 *Total Estimated Amount:* ₹${estAmt}\n\nPlease review and let us know to proceed.\nThank you,\n*Happy Car Wash*`;
      } else if (type === 'invoice') {
                const docName = 'Invoice';
        const invNo = job.invoice?.invoice_no || job.invoice_no || jobNo;
        const calculatedGrandTotal = services.reduce((sum, s) => sum + (parseFloat(s.amount as any) || 0) + (parseFloat(s.tax_amount as any) || 0), 0);
        const totalVal = calculatedGrandTotal || job.grand_total || job.total_amount || 0;
        const totalAmt = totalVal.toLocaleString('en-IN');

        const advList = Array.isArray(job.advance_payments) ? job.advance_payments : [];
        const advPaid = advList.reduce((sum: number, ap: any) => sum + (parseFloat(ap.amount) || 0), 0);
        const balDue = Math.max(0, totalVal - advPaid).toLocaleString('en-IN');

        text = `Hello *${custName}*,\n\n🧾 *${docName} - Happy Car Wash*\n────────────────────────\n📄 *Invoice No:* ${invNo}\n📋 *Job Card No:* ${jobNo}\n🚙 *Vehicle:* ${carDisplay}\n\n💼 *Billing Summary:*\n• *Total Amount:* ₹${totalAmt}`;

        if (advPaid > 0) {
          text += `\n• *Advance Paid:* ₹${advPaid.toLocaleString('en-IN')}`;
          text += `\n• *Balance Due:* ₹${balDue}`;
        }

        text += `\n\nThank you for your business!\n*Happy Car Wash*`;
      }
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(text)}`, '_blank');
    }
    setShowWaMenu(false);
  };

  const addCategoryToJob = async (categoryName: string) => {
    if (!categoryName || categoryName.trim() === '') return;
    const name = categoryName.trim();
    const currentCats = job?.job_category
      ? job.job_category.split(',').map((c: string) => c.trim()).filter(Boolean)
      : [];
    if (currentCats.some((c: string) => c.toLowerCase() === name.toLowerCase())) {
      showToast('Category already exists', 'warning');
      return;
    }
    const updatedCats = [...currentCats, name].join(', ');
    try {
      const servicesPayload = services.map(s => {
        let idx = undefined;
        if (s.concern_id) {
          idx = concerns.findIndex(c => c.id === s.concern_id);
        } else if (s.concern_index !== undefined) {
          idx = s.concern_index;
        }
        return {
          ...s,
          concern_index: idx !== -1 && idx !== undefined ? idx : null
        };
      });
      await api.put(`/job-cards/${id}`, { 
        job_category: updatedCats,
        services: servicesPayload,
        concerns: concerns
      });
      showToast(`Category "${name}" added`, 'success');
      fetchJob();
    } catch (err) {
      showToast('Failed to add category', 'error');
    }
  };
  void addCategoryToJob; // kept for future use
  const removeCategoryFromJob = (categoryName: string) => {
    setConfirmDialog({
      title: 'Remove Category',
      message: `Are you sure you want to remove "${categoryName}" category? This will not delete its services but will move them to General.`,
      icon: 'folder_delete',
      iconColor: 'text-amber-500',
      confirmLabel: 'Remove',
      confirmColor: 'bg-amber-500 hover:bg-amber-600',
      onConfirm: async () => {
        setConfirmDialog(null);
        const updatedServices = services.map(s => {
          if (s.job_category === categoryName) {
            return { ...s, job_category: null };
          }
          return s;
        });
        const currentCats = job?.job_category
          ? job.job_category.split(',').map((c: string) => c.trim()).filter(Boolean)
          : [];
        const updatedCats = currentCats.filter((c: string) => c !== categoryName).join(', ');
        try {
          const servicesPayload = updatedServices.map(s => {
            let idx = undefined;
            if (s.concern_id) {
              idx = concerns.findIndex(c => c.id === s.concern_id);
            } else if (s.concern_index !== undefined) {
              idx = s.concern_index;
            }
            return {
              ...s,
              concern_index: idx !== -1 && idx !== undefined ? idx : null
            };
          });
          await api.put(`/job-cards/${id}`, { 
            job_category: updatedCats || null, 
            services: servicesPayload,
            concerns: concerns
          });
          showToast(`Category "${categoryName}" removed`, 'info');
          fetchJob();
        } catch (err) {
          showToast('Failed to remove category', 'error');
        }
      }
    });
  };
  void removeCategoryFromJob; // kept for future use
  // Autocomplete / Search Catalog states
  const [_activeSearchIdx, _setActiveSearchIdx] = useState<number | null>(null);
  const [catalogSuggestions, setCatalogSuggestions] = useState<any[]>([]);
  const [activeCatalogSearch, setActiveCatalogSearch] = useState<{ catIdx: number; svcIdx: number } | null>(null);
  const getCategoryBadgeStyles = (category: string) => {
    const normalized = category.toLowerCase().trim();
    if (normalized.includes('detailing')) {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    } else if (normalized.includes('mechanic') || normalized.includes('general')) {
      return 'bg-amber-50 text-amber-800 border border-amber-200';
    } else if (normalized.includes('dent') || normalized.includes('paint')) {
      return 'bg-rose-50 text-rose-700 border border-rose-100';
    } else if (normalized.includes('ac')) {
      return 'bg-amber-50 text-amber-800 border border-amber-200';
    } else {
      return 'bg-slate-50 text-slate-700 border border-slate-100';
    }
  };

  const updateService = (idx: number, field: keyof Service, value: any) => {
    setServices(prev => {
      const updated = prev.map((s, i) => {
        if (i !== idx) return s;
        const item = { ...s, [field]: value };

        if (field === 'item_type' && value === 'labour') {
          item.tax_pct = 0;
          item.tax_amount = 0;
        }
        
        // Auto-calculate if qty, rate, discount, tax, price_type changes
        if (['qty', 'rate', 'discount_pct', 'tax_pct', 'price_type', 'item_type'].includes(field)) {
          const qty = item.qty === '' ? '' : (parseFloat(String(item.qty)) || 0);
          const rate = item.rate === '' ? '' : (parseFloat(String(item.rate)) || 0);
          const discount_pct = item.discount_pct === '' ? 0 : (parseFloat(String(item.discount_pct)) || 0);
          const defaultTax = item.item_type === 'labour' ? 0 : 18;
          const tax_pct = item.tax_pct === '' ? defaultTax : (parseFloat(String(item.tax_pct)) ?? defaultTax);
          const price_type = item.price_type || 'price';

          if (qty === '' || rate === '') {
            item.amount = '';
            item.tax_amount = '';
          } else {
            const isNonGstMode = (job?.completion_type === 'estimate' || (job?.invoice && (job.invoice.gst_percent === undefined || job.invoice.gst_percent === null)));
            const effectiveTaxPct = isNonGstMode ? 0 : tax_pct;
            let baseRate = rate;
            if (price_type === 'mrp') {
              baseRate = effectiveTaxPct > 0 ? parseFloat((rate / (1 + effectiveTaxPct / 100)).toFixed(4)) : rate;
            }
            const base = qty * baseRate;
            const discounted = base * (1 - (discount_pct / 100));
            item.amount = parseFloat(discounted.toFixed(2));
            item.tax_amount = effectiveTaxPct > 0 ? parseFloat((item.amount * effectiveTaxPct / 100).toFixed(2)) : 0;
          }
        }
        if (field === 'amount') {
          const amt = item.amount === '' ? '' : (parseFloat(String(item.amount)) || 0);
          const defaultTax = item.item_type === 'labour' ? 0 : 18;
          const isNonGstMode = (job?.completion_type === 'estimate' || (job?.invoice && (job.invoice.gst_percent === undefined || job.invoice.gst_percent === null)));
          const rawTaxPct = item.tax_pct === '' ? defaultTax : (parseFloat(String(item.tax_pct)) ?? defaultTax);
          const tax_pct = isNonGstMode ? 0 : rawTaxPct;
          const qty = item.qty === '' ? 1 : (parseFloat(String(item.qty)) || 1);
          const price_type = item.price_type || 'price';
          if (amt === '') {
            item.tax_amount = '';
          } else {
            item.tax_amount = tax_pct > 0 ? parseFloat((amt * tax_pct / 100).toFixed(2)) : 0;
            const discount_pct = item.discount_pct === '' ? 0 : (parseFloat(String(item.discount_pct)) || 0);
            const baseAmt = amt / (1 - (discount_pct / 100) || 1);
            const baseRate = baseAmt / qty;
            if (price_type === 'mrp') {
              item.rate = tax_pct > 0 ? parseFloat((baseRate * (1 + tax_pct / 100)).toFixed(2)) : parseFloat(baseRate.toFixed(2));
            } else {
              item.rate = parseFloat(baseRate.toFixed(2));
            }
          }
        }
        return item;
      });
      autoSave(updated, concerns);
      return updated;
    });
  };

  const removeService = (idx: number) => {
    setServices(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      autoSave(updated, concerns);
      return updated;
    });
  };

  const selectCatalogItem = (idx: number, catalogItem: any) => {
    setServices(prev => {
      const updated = prev.map((s, i) => {
        if (i !== idx) return s;
        
        const rate = parseFloat(catalogItem.default_rate) || 0;
        const isLabourItem = (catalogItem.item_type || s.item_type) === 'labour';
        const defaultTaxPct = isLabourItem ? 0 : 18;
        const tax_pct = (catalogItem.default_tax_pct !== undefined && catalogItem.default_tax_pct !== null && catalogItem.default_tax_pct !== '') 
          ? parseFloat(catalogItem.default_tax_pct) 
          : (catalogItem.tax_rate !== undefined && catalogItem.tax_rate !== null && catalogItem.tax_rate !== '' ? parseFloat(catalogItem.tax_rate) : defaultTaxPct);
        const qty = s.qty || 1;
        const price_type = s.price_type || 'price';
        const isNonGstMode = (job?.completion_type === 'estimate' || (job?.invoice && (job.invoice.gst_percent === undefined || job.invoice.gst_percent === null)));
        const effectiveTaxPct = isNonGstMode ? 0 : tax_pct;
        
        let baseRate = rate;
        if (price_type === 'mrp') {
          baseRate = effectiveTaxPct > 0 ? parseFloat((rate / (1 + effectiveTaxPct / 100)).toFixed(4)) : rate;
        }
        const base = qty * baseRate;
        const discount_pct = parseFloat(String(s.discount_pct)) || 0;
        const discounted = base * (1 - (discount_pct / 100));
        const amount = parseFloat(discounted.toFixed(2));
        const tax_amount = effectiveTaxPct > 0 ? parseFloat((amount * effectiveTaxPct / 100).toFixed(2)) : 0;
        return {
          ...s,
          service_name: catalogItem.item_name,
          qty,
          rate,
          amount,
          tax_pct,
          tax_amount,
          unit: catalogItem.unit || 'pc',
          part_code: catalogItem.part_code || catalogItem.part_no || '',
          hsn_sac: catalogItem.hsn_sac || '',
          price_type,
          job_category: catalogItem.category || s.job_category || 'General'
        };
      });
      autoSave(updated, concerns);
      return updated;
    });
    setActiveCatalogSearch(null);
    setCatalogSuggestions([]);
  };



  const saveTimer = useRef<any>(null);

  const fetchJob = async () => {
    try {
      const res = await api.get(`/job-cards/${id}`);
      setJob(res.data);
      const fetchedServices = res.data.services?.length > 0 ? res.data.services : [];
      setServices(fetchedServices);
      
      const catsFromServices = fetchedServices.map((s: any) => s.job_category || 'General');
      const catsFromJob = res.data.job_category ? res.data.job_category.split(',').map((c: string) => c.trim()) : [];
      const uniqueCats = Array.from(new Set([...catsFromServices, ...catsFromJob])).filter(Boolean);
      setDropdownCategories(prev => Array.from(new Set([...prev, ...uniqueCats])).filter(Boolean));

      setConcerns(res.data.concerns || []);
      setJobCategory(res.data.job_category || '');
      setJobCategoryDesc(res.data.job_category_desc || '');
      setJobCategoryAmount(res.data.job_category_amount !== null && res.data.job_category_amount !== undefined ? res.data.job_category_amount.toString() : '');
      setJobCategoryGstPct(res.data.job_category_gst_pct !== null && res.data.job_category_gst_pct !== undefined ? res.data.job_category_gst_pct.toString() : '18');
      setIsCustomCategory(res.data.job_category ? !JOB_CATEGORY_PRESETS.includes(res.data.job_category) : false);

      if (res.data.payment_mode === 'credit') {
        setInvoicePaymentStatus('pending');
      } else {
        setInvoicePaymentStatus('done');
      }
    } catch (err) {
      showToast('Failed to load order', 'error');
      navigate('/job-cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
    api.get('/staff').then(res => setStaff(res.data.data || [])).catch(() => {});
    // Fetch custom categories
    api.get('/service-catalog/custom-categories').then(res => {
      const cats = res.data.data || [];
      setDropdownCategories(prev => Array.from(new Set([...prev, ...cats])).filter(Boolean));
    }).catch(() => {});
  }, [id]);

  // --- Service / Concern Auto-Save ---
  const autoSave = (updatedServices: Service[], updatedConcerns: any[]) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        // Map concern relations to indices for backend compatibility
        const servicesPayload = updatedServices.map(s => {
          let idx = undefined;
          if (s.concern_id) {
            idx = updatedConcerns.findIndex(c => c.id === s.concern_id);
          } else if (s.concern_index !== undefined) {
            idx = s.concern_index;
          }
          return {
            ...s,
            concern_index: idx !== -1 && idx !== undefined ? idx : null
          };
        });

        const uniqueCats = Array.from(new Set(updatedServices.map(s => s.job_category || 'General'))).filter(Boolean);
        const res = await api.put(`/job-cards/${id}`, {
          job_category: uniqueCats.join(', ') || null,
          services: servicesPayload,
          concerns: updatedConcerns
        });
        showToast('Auto-saved', 'info');
        if (res.data && res.data.services && res.data.concerns) {
          setJob((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              invoice: res.data.invoice,
              estimate: res.data.estimate
            };
          });
          setServices(prev => {
            return prev.map((svc) => {
              const backendSvc = res.data.services.find((bs: any) => 
                bs.service_name === svc.service_name &&
                bs.item_type === svc.item_type &&
                (parseFloat(bs.rate) === parseFloat(String(svc.rate)) || (bs.rate === 0 && svc.rate === ''))
              );
              if (backendSvc) {
                return {
                  ...svc,
                  id: backendSvc.id,
                  concern_id: backendSvc.concern_id
                };
              }
              return svc;
            });
          });
          setConcerns(prev => {
            return prev.map((c) => {
              const backendC = res.data.concerns.find((bc: any) => bc.concern_text === c.concern_text);
              if (backendC) {
                return {
                  ...c,
                  id: backendC.id
                };
              }
              return c;
            });
          });
        }
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, 1000);
  };



  // --- Search catalog for Autocomplete ---
  const handleCatalogSearch = async (val: string, itemType: string) => {
    if (!val || val.length < 1) {
      setCatalogSuggestions([]);
      return;
    }
    try {
      const res = await api.get('/service-catalog', {
        params: { search: val, item_type: itemType }
      });
      setCatalogSuggestions(res.data.data || []);
    } catch (err) {
      console.error(err);
      setCatalogSuggestions([]);
    }
  };






  const handleRemovePackage = (pkgName: string) => {
    setServices(prev => {
      const updated = prev.filter(s => s.package_name !== pkgName);
      autoSave(updated, concerns);
      return updated;
    });
    showToast(`Removed package items`, 'info');
  };









  const subtotal = services.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) + (parseFloat(jobCategoryAmount) || 0);
  const totalTax = services.reduce((sum, s) => sum + (Number(s.tax_amount) || 0), 0) + ((parseFloat(jobCategoryAmount) || 0) * (parseFloat(jobCategoryGstPct) || 0) / 100);
    const grandTotal = subtotal + totalTax;



  // --- Status transition ---
  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === 'delivered' || newStatus === 'invoiced') {
      // Intercept transition to prompt for GST and payment mode
            setShowModal('invoice');
      return;
    }
    try {
      await api.patch(`/job-cards/${id}/status`, { status: newStatus });
      showToast(`Status -> ${newStatus.replace('_', ' ').toUpperCase()}`, 'success');
      fetchJob();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  // --- Edit Vehicle Info ---
  const openVehicleEdit = () => {
    setVehicleSpec({
      make: job.make || '',
      model: job.vehicle_model || '',
      year: job.vehicle_year || '',
      fuel_type: job.fuel_type || '',
      variant: job.variant || '',
      vehicle_color: job.vehicle_color || '',
      reg_no: job.reg_no || '',
      odometer: job.odometer || '',
      spare_wheel: job.spare_wheel === 1 || job.spare_wheel === true,
      pointers: job.pointers || ''
    });
    setShowModal('vehicle');
  };

  const handleSaveVehicle = async () => {
    setSaving(true);
    try {
      await api.put(`/job-cards/${id}`, { 
        make: vehicleSpec.make,
        model: vehicleSpec.model,
        year: vehicleSpec.year,
        fuel_type: vehicleSpec.fuel_type,
        variant: vehicleSpec.variant,
        vehicle_color: vehicleSpec.vehicle_color,
        reg_no: vehicleSpec.reg_no,
        odometer: vehicleSpec.odometer ? parseInt(vehicleSpec.odometer) : null,
        spare_wheel: vehicleSpec.spare_wheel ? 1 : 0,
        pointers: vehicleSpec.pointers || null
      });
      showToast('Vehicle details updated', 'success');
      recordFieldSuggestions({
        reg_no: vehicleSpec.reg_no,
        remarks: vehicleSpec.pointers,
      });
      setShowModal(null);
      fetchJob();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update vehicle', 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- Edit Customer Info ---
  const openCustomerEdit = () => {
    setCustomerSpec({
      customer_name: job.cust_name || job.owner_name || '',
      mobile_no: job.cust_mobile || job.mobile_no || '',
      alt_mobile: job.alt_mobile || '',
      email: job.cust_email || job.email || '',
      address_line: job.address_line || '',
      colony_street: job.colony_street || '',
      city: job.city || job.customer_city || '',
      state: job.state || job.customer_state || '',
      pincode: job.pincode || '',
      company_name: job.company_name || '',
      gstin: job.gstin || '',
      customer_type: job.customer_type || 'individual'
    });
    setShowModal('customer');
  };

  const handleSaveCustomer = async () => {
    setSaving(true);
    try {
      if (job.customer_id) {
        try {
          await api.put(`/customers/${job.customer_id}`, {
            customer_name: customerSpec.customer_name,
            mobile_no: customerSpec.mobile_no,
            alt_mobile: customerSpec.alt_mobile,
            email: customerSpec.email,
            address_line: customerSpec.address_line,
            colony_street: customerSpec.colony_street,
            city: customerSpec.city,
            state: customerSpec.state,
            pincode: customerSpec.pincode,
            company_name: customerSpec.company_name,
            gstin: customerSpec.gstin,
            customer_type: customerSpec.customer_type
          });
        } catch (cErr) {
          console.warn('Direct customer update fallback:', cErr);
        }
      }
      await api.put(`/job-cards/${id}`, {
        owner_name: customerSpec.customer_name,
        customer_name: customerSpec.customer_name,
        mobile_no: customerSpec.mobile_no,
        alt_mobile: customerSpec.alt_mobile,
        email: customerSpec.email,
        address_line: customerSpec.address_line,
        colony_street: customerSpec.colony_street,
        city: customerSpec.city,
        state: customerSpec.state,
        pincode: customerSpec.pincode,
        company_name: customerSpec.company_name,
        gstin: customerSpec.gstin,
        customer_type: customerSpec.customer_type
      });
      showToast('Customer details updated', 'success');
      recordFieldSuggestions({
        client_name: customerSpec.customer_name,
        mobile_no: customerSpec.mobile_no,
        alt_mobile: customerSpec.alt_mobile,
        email: customerSpec.email,
        address_line: customerSpec.address_line,
        colony_street: customerSpec.colony_street,
        city: customerSpec.city,
        state: customerSpec.state,
        pincode: customerSpec.pincode,
        company_name: customerSpec.company_name,
        gstin: customerSpec.gstin,
      });
      setShowModal(null);
      fetchJob();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- Edit Job & Insurance Info ---
  const openInsuranceEdit = () => {
    setInsuranceSpec({
      service_type: job.service_type || '',
      assigned_staff_id: job.assigned_staff_id || '',
      estimated_delivery: job.estimated_delivery || '',
      fuel_level: job.fuel_level || '',
      charging_pct: job.charging_pct || 0,
      notes: job.notes || '',
      insurance_company: job.insurance_company || '',
      insurance_claim_no: job.insurance_claim_no || job.claim_no || '',
      claim_no: job.claim_no || job.insurance_claim_no || '',
      accident_date: job.accident_date ? job.accident_date.slice(0, 10) : '',
      delivery_date: job.delivery_date ? job.delivery_date.slice(0, 10) : '',
      approval_status: job.approval_status || 'pending',
      approval_date: job.approval_date ? job.approval_date.slice(0, 10) : '',
      insurance_expiry: job.insurance_expiry ? job.insurance_expiry.slice(0, 10) : '',
      job_date: job.job_date ? job.job_date.slice(0, 10) : ''
    });
    setShowModal('insurance');
  };

  const handleSaveInsurance = async () => {
    setSaving(true);
    try {
      await api.put(`/job-cards/${id}`, {
        service_type: insuranceSpec.service_type,
        assigned_staff_id: insuranceSpec.assigned_staff_id ? parseInt(insuranceSpec.assigned_staff_id) : null,
        estimated_delivery: insuranceSpec.estimated_delivery || null,
        fuel_level: job.fuel_type === 'electric' ? null : insuranceSpec.fuel_level || null,
        charging_pct: job.fuel_type === 'electric' ? parseInt(insuranceSpec.charging_pct) || 0 : null,
        notes: insuranceSpec.notes || null,
        insurance_company: insuranceSpec.insurance_company || null,
        insurance_claim_no: insuranceSpec.insurance_claim_no || null,
        claim_no: insuranceSpec.claim_no || null,
        accident_date: insuranceSpec.accident_date || null,
        delivery_date: insuranceSpec.delivery_date || null,
        approval_status: insuranceSpec.approval_status || 'pending',
        approval_date: insuranceSpec.approval_date || null,
        insurance_expiry: insuranceSpec.insurance_expiry || null,
        job_date: insuranceSpec.job_date || null
      });
      showToast('Job & Insurance details updated', 'success');
      recordFieldSuggestions({
        insurance_company: insuranceSpec.insurance_company,
      });
      setShowModal(null);
      fetchJob();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update job details', 'error');
    } finally {
      setSaving(false);
    }
  };

  const serviceTypes = ['Regular Service', 'Quick Wash', 'Full Detailing', 'PPF Coating', 'Ceramic Coating', 'Dent & Paint', 'AC Service', 'Mechanical Repair', 'Electrical', 'Custom'];

  // --- Generate Invoice / Estimate ---
  const handleInvoice = async () => {
    try {
      // First save current services
      await api.put(`/job-cards/${id}`, { services });

      const payload = {
        payment_status: invoicePaymentStatus,
        payment_mode: invoicePaymentStatus === 'done' ? invoicePaymentMode : 'pending',
        transaction_id: invoicePaymentStatus === 'done' ? (invoiceTransactionId || undefined) : undefined,
        staff_id: invoicePaymentStatus === 'done' ? (invoiceStaffId || undefined) : undefined,
        invoice_no: manualInvoiceNo || undefined
      };

      const res = await api.post(`/job-cards/${id}/generate-invoice-without-gst`, payload);
      showToast(`Invoice ${res.data.invoice_no} generated (${invoicePaymentStatus === 'done' ? 'Payment Recorded' : 'Payment Pending'})!`, 'success');
      localStorage.removeItem('estimate_delete_completed');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const tk = localStorage.getItem('gms_token') || '';
      window.open(`${baseUrl}/job-cards/${id}/invoice-html?token=${tk}`, '_blank');
      setShowModal(null);
      setManualInvoiceNo('');
      setInvoiceTransactionId('');
      setInvoiceStaffId('');
      fetchJob();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const handleAddConcernConfirm = () => {
    if (newConcernText && newConcernText.trim()) {
      setConcerns(prev => {
        const updated = [...prev, { concern_text: newConcernText.trim(), is_completed: 0 }];
        autoSave(services, updated);
        return updated;
      });
      setShowModal(null);
      setNewConcernText('');
    }
  };



  const isCompleted = job?.status === 'cancelled';
  const currentStepIndex = Math.max(0, statusPipeline.indexOf(job?.status || 'ready'));

  // Multi-category services grouping
  const categoriesList: string[] = [];
  if (job?.job_category) {
    job.job_category.split(',').forEach((c: string) => {
      const trimmed = c.trim();
      if (trimmed && !categoriesList.includes(trimmed)) {
        categoriesList.push(trimmed);
      }
    });
  }
  services.forEach(s => {
    if (s.job_category) {
      const trimmed = s.job_category.trim();
      if (trimmed && !categoriesList.includes(trimmed)) {
        categoriesList.push(trimmed);
      }
    }
  });

  const categoriesToRender = [...categoriesList];
  const hasGeneralServices = services.some(s => !s.job_category || s.job_category.trim() === '' || s.job_category.trim() === 'General');
  if (hasGeneralServices && !categoriesToRender.includes('General')) {
    categoriesToRender.push('General');
  }
  if (categoriesToRender.length === 0) {
    categoriesToRender.push('General');
  }

  if (loading) return <AnimatedPage className="pt-[88px] sm:pt-6 px-4 sm:px-8 pb-12"><SkeletonForm /></AnimatedPage>;
  if (!job) return null;

  return (
    <AnimatedPage className="pt-[88px] sm:pt-6 px-4 sm:px-8 pb-12 max-w-[1600px] mx-auto">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col md:flex-row items-start justify-between mb-6 gap-4">
        <div>
          <button onClick={() => navigate('/job-cards')} className="btn-ghost mb-2">
            <span className="material-symbols-outlined text-lg">arrow_back</span> Back to Detailing Studio
          </button>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-extrabold text-on-surface font-headline">{job.job_no}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-sm text-on-surface-muted mt-1 font-medium">
            {job.reg_no} · {job.car_name} · {job.cust_name || job.owner_name || '—'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(isCompleted || job.status === 'invoiced' || job.status === 'delivered' || job.estimate) && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleDownloadInvoice}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-extrabold shadow-md transition-all text-stone-950 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 hover:shadow-lg"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              Download Invoice
            </motion.button>
          )}
          
          {/* -- Print / Share Menu -- */}
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowPrintMenu(!showPrintMenu)}
              className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <span className="material-symbols-outlined text-lg text-on-surface-muted">print</span>
            </motion.button>
            {showPrintMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute left-0 right-auto md:right-0 md:left-auto top-12 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden"
              >
                <button
                  onClick={() => handlePrint('work_order')}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm font-medium text-on-surface transition-colors border-t border-gray-100"
                >
                  <span className="material-symbols-outlined text-amber-700 text-lg">engineering</span>
                  Print Work Order
                </button>
                <button
                  onClick={() => handlePrint('proforma')}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm font-medium text-on-surface transition-colors border-t border-gray-100"
                >
                  <span className="material-symbols-outlined text-secondary text-lg">request_quote</span>
                  Proforma Invoice
                </button>
                <button
                  onClick={() => handlePrint('full_job_card')}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 text-sm font-bold text-amber-800 transition-colors border-t border-b border-gray-100"
                >
                  <span className="material-symbols-outlined text-amber-700 text-lg">picture_as_pdf</span>
                  Download Full Order
                </button>
                <button
                  onClick={() => handlePrint('job_card_share')}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 text-sm font-bold text-emerald-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-emerald-600 text-lg">share</span>
                  Share Order
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Status Pipeline ═══ */}
      <div className="glass-card-solid p-5 mb-6 overflow-hidden">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 pb-scroll-friendly">
          {statusPipeline.map((s, idx) => (
            <div key={s} className="flex items-center">
              <button
                onClick={() => !isCompleted && handleStatusChange(s)}
                disabled={isCompleted}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                  idx === currentStepIndex
                    ? 'bg-primary text-white shadow-md scale-105'
                    : idx < currentStepIndex
                    ? 'bg-success-light/30 text-success-dark border border-success/20 hover:bg-success-light/50'
                    : 'bg-surface text-on-surface-muted border border-gray-100 hover:bg-gray-50'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
              {idx < statusPipeline.length - 1 && (
                <span className={`material-symbols-outlined text-sm mx-2 ${idx < currentStepIndex ? 'text-success-dark/50' : 'text-gray-300'}`}>
                  chevron_right
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Direct invoice billing transition button */}
        {!isCompleted && (
          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 justify-end items-center">
            <button
              onClick={handleExplicitSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-amber-600 hover:bg-amber-700 text-white transition-all flex items-center gap-1.5 shadow-md shadow-amber-600/20 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-base">save</span>
              Save & Update Bill
            </button>
            <button
              onClick={() => {
                                setShowModal('invoice');
              }}
              className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-primary hover:bg-primary-dark text-white transition-all flex items-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer active:scale-95"
            >
              {job.status === 'invoiced' ? 'Update Invoice' : 'Next Step'}
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        )}
      </div>

      {/* ═══ Info Cards ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Vehicle */}
        <div className="glass-card-solid p-6 border-t-4 border-t-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-6xl">directions_car</span>
          </div>
          <h3 className="text-xs font-bold text-on-surface-muted uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-primary">directions_car</span> Vehicle
            {!isCompleted && (
              <button 
                onClick={openVehicleEdit} 
                className="ml-auto text-primary text-xs hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">edit</span> Edit
              </button>
            )}
          </h3>
          <p className="text-xl font-bold text-on-surface font-headline">{job.reg_no}</p>
          <p className="text-sm text-on-surface-muted font-medium mb-2">{job.car_name}</p>
          {job.make && <p className="text-[11px] font-bold text-on-surface-muted uppercase tracking-wider">{[job.make, job.vehicle_model, job.variant].filter(Boolean).join(' ')}</p>}
          {job.spare_wheel !== undefined && <p className="text-[11px] font-bold text-on-surface-muted uppercase tracking-wider mt-1">Spare Wheel: {job.spare_wheel ? 'Yes' : 'No'}</p>}
          {job.pointers && <p className="text-[11px] font-bold text-on-surface-muted uppercase tracking-wider mt-1">Pointers: {job.pointers}</p>}
        </div>

        {/* Customer */}
        <div className="glass-card-solid p-6 border-t-4 border-t-secondary relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-6xl">person</span>
          </div>
          <h3 className="text-xs font-bold text-on-surface-muted uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-slate-600">person</span> Customer
            {!isCompleted && (
              <button 
                onClick={openCustomerEdit} 
                className="ml-auto text-secondary text-xs hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">edit</span> Edit
              </button>
            )}
          </h3>
          <p className="text-xl font-bold text-on-surface font-headline">{job.cust_name || job.owner_name || '—'}</p>
          <p className="text-sm font-mono font-medium text-on-surface-muted mb-2">{job.cust_mobile || job.mobile_no}</p>
          {job.cust_email && <p className="text-[11px] text-on-surface-muted mb-1">{job.cust_email}</p>}
          {job.city && <p className="text-[11px] font-bold text-on-surface-muted uppercase tracking-wider">{[job.city, job.state].filter(Boolean).join(', ')}</p>}
          {job.address_line && <p className="text-xs text-on-surface-muted mt-1 font-medium">Address: {job.address_line}</p>}
          {job.pincode && <p className="text-xs text-on-surface-muted font-medium">Pin Code: {job.pincode}</p>}
        </div>

        {/* Job Info */}
        <div className="glass-card-solid p-6 border-t-4 border-t-success relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-6xl">info</span>
          </div>
          <h3 className="text-xs font-bold text-on-surface-muted uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-success">info</span> Job Info
            {!isCompleted && (
              <button 
                onClick={openInsuranceEdit} 
                className="ml-auto text-success text-xs hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">edit</span> Edit
              </button>
            )}
          </h3>
          <div className="space-y-2 text-sm font-medium">
            {job.rfe_no && <p className="flex justify-between"><span className="text-on-surface-muted">RFE:</span> <span className="font-mono text-on-surface">{job.rfe_no}</span></p>}
            {job.service_type && <p className="flex justify-between"><span className="text-on-surface-muted">Service:</span> <span className="text-on-surface">{job.service_type}</span></p>}
            {job.assigned_staff_name && <p className="flex justify-between"><span className="text-on-surface-muted">Staff:</span> <span className="text-on-surface">{job.assigned_staff_name}</span></p>}
            {job.estimated_delivery && <p className="flex justify-between"><span className="text-on-surface-muted">Est. Delivery:</span> <span className="text-on-surface">{job.estimated_delivery}</span></p>}
            {job.fuel_type === 'electric' ? (
              <p className="flex justify-between items-center">
                <span className="text-on-surface-muted">EV Charge:</span>
                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 font-bold text-xs px-3 py-1 rounded-full border border-green-200">
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                  {job.charging_pct || 0}%
                </span>
              </p>
            ) : (
              job.fuel_level && (
                <p className="flex justify-between items-center">
                  <span className="text-on-surface-muted">Fuel Level:</span>
                  <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 font-bold text-xs px-3 py-1 rounded-full border border-amber-200">
                    <span className="material-symbols-outlined text-[14px]">local_gas_station</span>
                    {job.fuel_level}
                  </span>
                </p>
              )
            )}
            {job.insurance_company && (
              <p className="flex justify-between"><span className="text-on-surface-muted">Insurance:</span> <span className="text-on-surface font-bold text-amber-800">{job.insurance_company}</span></p>
            )}
            {job.insurance_expiry && (
              <p className="flex justify-between"><span className="text-on-surface-muted">Ins. Expiry:</span> <span className="text-on-surface">{job.insurance_expiry.slice(0, 10)}</span></p>
            )}
            {job.insurance_claim_no && (
              <p className="flex justify-between"><span className="text-on-surface-muted">Claim No:</span> <span className="text-on-surface font-mono">{job.insurance_claim_no}</span></p>
            )}
            {job.accident_date && (
              <p className="flex justify-between"><span className="text-on-surface-muted">Accident Date:</span> <span className="text-on-surface">{job.accident_date.slice(0, 10)}</span></p>
            )}
            {job.approval_status && (
              <p className="flex justify-between"><span className="text-on-surface-muted">Approval:</span> <span className="text-on-surface font-bold capitalize">{job.approval_status}</span></p>
            )}
            <p className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-on-surface-muted">Payment:</span>
              <span className={`inline-flex items-center gap-1.5 font-extrabold text-xs px-2.5 py-0.5 rounded-full border ${
                job.payment_mode === 'credit'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                <span className="material-symbols-outlined text-[13px]">
                  {job.payment_mode === 'credit' ? 'pending_actions' : 'payments'}
                </span>
                {job.payment_mode === 'credit' ? 'Credit (Pending)' : 'Cash Paid'}
              </span>
            </p>
          </div>
        </div>
      </div>


      {/* --- Section 3: Job Categories & Estimation --- */}
      <div className="glass-card-solid p-6 mb-6 space-y-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-headline font-black text-sm text-slate-800 flex items-center gap-1.5 border-l-4 border-amber-500 pl-2.5">
            Job Categories & Estimation
          </h3>
          <span className="text-[10px] font-bold text-slate-400">Add categories, services and parts below — everything auto-saves</span>
        </div>

        {/* Add Manual Job Section */}
        {!isCompleted && (
          <div className="space-y-4 bg-slate-50/50 border border-slate-100 p-5 rounded-2xl">
            <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-slate-400">build</span>
              Add Manual Job
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              {/* Category selector */}
              <div className="col-span-12 sm:col-span-6 lg:col-span-4 w-full">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">Category *</label>
                <select
                  value={manualCategory}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomCategoryNew(true);
                    } else {
                      setManualCategory(e.target.value);
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 cursor-pointer focus:ring-2 focus:ring-amber-500/20"
                >
                  {dropdownCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="custom" className="text-amber-800 font-bold">+ Add Custom Category</option>
                </select>
              </div>

              {/* Type selector */}
              <div className="col-span-12 sm:col-span-6 lg:col-span-3 w-full">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">Type *</label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as 'part' | 'labour')}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold uppercase text-slate-700 cursor-pointer focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="labour">Labour (auto)</option>
                  <option value="part">Part (auto)</option>
                </select>
              </div>

              {/* Name/Description input with autocomplete */}
              <div className="col-span-12 sm:col-span-12 lg:col-span-5 w-full relative">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                  {manualType === 'labour' ? 'Job Description *' : 'Part Name *'}
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => handleManualSearch(e.target.value, manualType)}
                  onBlur={(e) => { if (e.target.value.trim()) recordFieldSuggestions({ [manualType === 'part' ? 'part_name' : 'service_name']: e.target.value }); }}
                  placeholder={manualType === 'labour' ? 'e.g. Paid Service Labour' : 'e.g. Engine Oil (5W-30)'}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-amber-500/20"
                />
                
                {showManualSuggestions && manualCatalogSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-[999] min-w-[280px]">
                    {manualCatalogSuggestions.map((sug, sIdx) => (
                      <div
                        key={sIdx}
                        onMouseDown={() => handleSelectManualSuggestion(sug)}
                        className="p-2.5 hover:bg-amber-50 cursor-pointer border-b border-gray-100 last:border-none flex justify-between items-center text-xs"
                      >
                        <div>
                          <div className="font-bold text-xs text-on-surface">{sug.item_name}</div>
                          <div className="text-[9px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">
                            {sug.category} · {sug.item_type}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-xs text-primary">₹{sug.default_rate}</div>
                          {sug.part_code && <div className="text-[8px] font-mono text-slate-400">{sug.part_code}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rate / Amount input */}
              <div className="col-span-12 sm:col-span-4 lg:col-span-4 w-full">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">Amount (₹) *</label>
                <input
                  type="number"
                  min="0"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-right text-slate-700 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {/* GST % input */}
              

              {/* Add Button */}
              <button
                type="button"
                onClick={handleAddManualItem}
                className="col-span-12 sm:col-span-6 lg:col-span-6 w-full bg-amber-600 hover:bg-amber-600 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 h-[36px] shadow-sm hover:shadow transition-all"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add
              </button>
            </div>

            {/* Custom Category Input */}
            {isCustomCategoryNew && (
              <div className="flex gap-2 bg-amber-50/50 border border-amber-200 p-3 rounded-xl max-w-md mt-2">
                <div className="flex-1">
                  <label className="block text-[9px] font-black text-amber-800 uppercase tracking-wider mb-1.5">Custom Category Name</label>
                  <input
                    type="text"
                    value={customCatInputNew}
                    onChange={(e) => setCustomCatInputNew(e.target.value)}
                    placeholder="Enter custom category"
                    className="w-full bg-white border border-amber-200 rounded-lg py-1.5 px-3 font-medium text-xs text-on-surface focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div className="flex items-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddCustomCategoryManual(customCatInputNew)}
                    className="bg-amber-600 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomCategoryNew(false)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 py-1.5 rounded-lg font-bold text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* List of Selected Categories */}
        {/* Estimate Items Table */}
        {services.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">receipt_long</span>
            <p className="text-xs font-medium text-slate-500">No estimate items added yet</p>
            {!isCompleted && <p className="text-[10px] text-slate-400">Add services/parts using quick presets or manual form above</p>}
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400">receipt_long</span>
                Bill Items
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-400">{services.length} Items Total</span>
                <button
                  type="button"
                  onClick={handleExplicitSave}
                  disabled={saving}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer active:scale-95"
                  title="Save all changes to items and update bill totals"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  Save & Update Bill
                </button>
              </div>
            </div>

            <div className="hidden md:block overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse min-w-[1280px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/50 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                    <th className="py-2.5 px-2 text-center w-8">#</th>
                    <th className="py-2.5 px-2 w-24 xl:w-28">Category</th>
                    <th className="py-2.5 px-2 w-20 xl:w-24">Type</th>
                    <th className="py-2.5 px-2 min-w-[220px] xl:min-w-[280px]">Job / Part Description</th>
                    <th className="py-2.5 px-2 w-24 xl:w-28">Price Type</th>
                    <th className="py-2.5 px-2 w-28 xl:w-32 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-1 w-16 xl:w-20 text-center">Qty</th>
                    <th className="py-2.5 px-1 w-16 xl:w-20 text-center">Disc %</th>
                    <th className="py-2.5 px-1 w-24 xl:w-28 text-center">HSN/SAC</th>
                    <th className="py-2.5 px-1 w-16 xl:w-20 text-center">Tax %</th>
                    <th className="py-2.5 px-2 w-32 xl:w-36 text-right">Amt (Excl. Tax)</th>
                    <th className="py-2.5 px-2 w-32 xl:w-36 text-right font-bold text-amber-700">Total</th>
                    <th className="py-2.5 px-1 text-center w-8"></th>
                  </tr>
                </thead>
                {services.map((item, idx) => {
                  const totalInclGst = (parseFloat(String(item.amount)) || 0) + (parseFloat(String(item.tax_amount)) || 0);
                  
                  const isPackageItem = !!item.package_name;
                  const showPackageBanner = isPackageItem && (idx === 0 || services[idx - 1].package_name !== item.package_name);
                  const packageItemsCount = isPackageItem ? services.filter(s => s.package_name === item.package_name).length : 0;

                  return (
                    <tbody key={idx} className="border-b border-slate-100 last:border-none hover:bg-slate-50/30 transition-colors">
                      {showPackageBanner && (
                        <tr className="bg-amber-50/80 border-b border-amber-100">
                          <td colSpan={13} className="py-2.5 px-4">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">redeem</span>
                                PACKAGE: {item.package_name} · {packageItemsCount} ITEMS
                              </span>
                              {!isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => handleRemovePackage(item.package_name!)}
                                  className="text-[10px] font-bold text-red-600 hover:text-red-800 flex items-center gap-1 bg-white border border-red-100 rounded-lg py-1 px-2.5 shadow-sm hover:shadow transition-all"
                                >
                                  <span className="material-symbols-outlined text-xs">delete</span>
                                  Remove Entire Package
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      
                      <tr className="align-middle">
                        <td className="py-2.5 px-2 text-center font-bold text-xs text-slate-400">
                          {idx + 1}
                        </td>
                        
                        <td className="py-2.5 px-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${getCategoryBadgeStyles(item.job_category || 'General')}`}>
                            {item.job_category || 'General'}
                          </span>
                        </td>

                        <td className="py-2.5 px-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                          {item.item_type === 'part' ? 'Part' : 'Labour'}
                        </td>

                        <td className="py-2.5 px-2 relative">
                          <input
                            type="text"
                            value={item.service_name}
                            onChange={(e) => {
                              updateService(idx, 'service_name', e.target.value);
                              handleCatalogSearch(e.target.value, item.item_type);
                              setActiveCatalogSearch({ catIdx: -1, svcIdx: idx });
                            }}
                            onFocus={() => {
                              setActiveCatalogSearch({ catIdx: -1, svcIdx: idx });
                              handleCatalogSearch(item.service_name, item.item_type);
                            }}
                            onBlur={() => {
                              setTimeout(() => setActiveCatalogSearch(null), 250);
                            }}
                            disabled={isCompleted}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs lg:text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-700 disabled:bg-slate-50 disabled:text-slate-500"
                            placeholder={item.item_type === 'labour' ? 'e.g. Paid Service Labour' : 'e.g. Engine Oil (5W-30)'}
                          />

                          {activeCatalogSearch?.catIdx === -1 && activeCatalogSearch?.svcIdx === idx && catalogSuggestions.length > 0 && (
                            <div className="absolute left-2 right-2 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto z-[999] min-w-[320px]">
                              {catalogSuggestions.map((sug, sIdx) => (
                                <div
                                  key={sIdx}
                                  onMouseDown={() => selectCatalogItem(idx, sug)}
                                  className="p-3 hover:bg-amber-50 cursor-pointer border-b border-gray-100 last:border-none flex justify-between items-center text-xs lg:text-sm"
                                >
                                  <div>
                                    <div className="font-bold text-xs lg:text-sm text-on-surface">{sug.item_name}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">
                                      {sug.category} · {sug.item_type}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-xs lg:text-sm text-primary">₹{sug.default_rate}</div>
                                    {sug.part_code && <div className="text-[9px] font-mono text-slate-400">{sug.part_code}</div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-2">
                          <select
                            value={item.price_type || 'price'}
                            onChange={(e) => updateService(idx, 'price_type', e.target.value)}
                            disabled={isCompleted}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs lg:text-xs font-bold uppercase text-slate-700 disabled:bg-slate-50"
                          >
                            <option value="price">Price</option>
                            <option value="mrp">MRP</option>
                          </select>
                        </td>

                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate}
                            onChange={(e) => updateService(idx, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            disabled={isCompleted}
                            className="w-full min-w-[80px] lg:min-w-[110px] bg-white border border-slate-200 rounded-lg py-2 px-2.5 text-xs lg:text-sm font-bold text-right text-slate-700 focus:ring-2 focus:ring-amber-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                            placeholder="0.00"
                          />
                        </td>

                        <td className="py-2.5 px-1">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.qty}
                            onChange={(e) => updateService(idx, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            disabled={isCompleted}
                            className="w-full min-w-[50px] lg:min-w-[70px] bg-white border border-slate-200 rounded-lg py-2 px-2 text-xs lg:text-sm font-bold text-center text-slate-700 focus:ring-2 focus:ring-amber-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </td>

                        <td className="py-2.5 px-1">
                          <input
                            type="number"
                            value={item.discount_pct}
                            onChange={(e) => updateService(idx, 'discount_pct', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            disabled={isCompleted}
                            className="w-full min-w-[50px] lg:min-w-[70px] bg-white border border-slate-200 rounded-lg py-2 px-2 text-xs lg:text-sm font-bold text-center text-slate-700 focus:ring-2 focus:ring-amber-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                            placeholder="0"
                          />
                        </td>

                        <td className="py-2.5 px-1">
                          <input
                            value={item.hsn_sac || ''}
                            onChange={(e) => updateService(idx, 'hsn_sac', e.target.value)}
                            disabled={isCompleted}
                            className="w-full min-w-[60px] lg:min-w-[80px] bg-white border border-slate-200 rounded-lg py-2 px-2 text-xs lg:text-sm font-mono uppercase text-center text-slate-700 focus:ring-2 focus:ring-amber-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                            placeholder="—"
                          />
                        </td>

                        <td className="py-2.5 px-1">
                          <input
                            type="number"
                            value={item.tax_pct}
                            onChange={(e) => updateService(idx, 'tax_pct', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            disabled={isCompleted}
                            className="w-full min-w-[50px] lg:min-w-[70px] bg-white border border-slate-200 rounded-lg py-2 px-2 text-xs lg:text-sm font-bold text-center text-slate-700 focus:ring-2 focus:ring-amber-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                            placeholder="18"
                          />
                        </td>

                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.amount}
                            onChange={(e) => updateService(idx, 'amount', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            disabled={isCompleted}
                            className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2 text-xs font-bold text-right text-slate-700 focus:ring-2 focus:ring-amber-500/20 disabled:bg-slate-50 disabled:text-slate-500 inline-block"
                            placeholder="0.00"
                          />
                        </td>

                        <td className="py-2.5 px-2 text-right">
                          <span className="text-xs font-extrabold font-mono text-emerald-600 whitespace-nowrap">
                            {totalInclGst !== 0 ? formatCurrency(totalInclGst) : '—'}
                          </span>
                        </td>

                        <td className="py-2.5 px-1 text-center">
                          {!isCompleted && (
                            <button
                              type="button"
                              onClick={() => removeService(idx)}
                              className="text-slate-300 hover:text-red-500 transition-colors p-1"
                            >
                              <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  );
                })}
              </table>
            </div>

            {/* Mobile Card Layout (visible on phone, hidden on desktop/tablet) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {services.map((item, idx) => {
                const totalInclGst = (parseFloat(String(item.amount)) || 0) + (parseFloat(String(item.tax_amount)) || 0);
                const isPackageItem = !!item.package_name;
                const showPackageBanner = isPackageItem && (idx === 0 || services[idx - 1].package_name !== item.package_name);
                const packageItemsCount = isPackageItem ? services.filter(s => s.package_name === item.package_name).length : 0;

                return (
                  <div key={idx} className="p-4 bg-white hover:bg-slate-50/20 transition-colors">
                    {showPackageBanner && (
                      <div className="bg-amber-50/80 border border-amber-100 rounded-lg py-2 px-3 mb-3 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">redeem</span>
                          PACKAGE: {item.package_name} · {packageItemsCount} ITEMS
                        </span>
                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleRemovePackage(item.package_name!)}
                            className="text-[9px] font-bold text-red-600 hover:text-red-800 bg-white border border-red-100 rounded-md py-0.5 px-2 shadow-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}

                    <div className="space-y-3">
                      {/* Mobile Card Header */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${getCategoryBadgeStyles(item.job_category || 'General')}`}>
                            {item.job_category || 'General'}
                          </span>
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                            {item.item_type === 'part' ? 'Part' : 'Labour'}
                          </span>
                        </div>
                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => removeService(idx)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                          >
                            <span className="material-symbols-outlined text-lg">close</span>
                          </button>
                        )}
                      </div>

                      {/* Mobile Card Title Input */}
                      <div className="relative">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Job / Part Description</label>
                        <input
                          type="text"
                          value={item.service_name}
                          onChange={(e) => {
                            updateService(idx, 'service_name', e.target.value);
                            handleCatalogSearch(e.target.value, item.item_type);
                            setActiveCatalogSearch({ catIdx: -1, svcIdx: idx });
                          }}
                          onFocus={() => {
                            setActiveCatalogSearch({ catIdx: -1, svcIdx: idx });
                            handleCatalogSearch(item.service_name, item.item_type);
                          }}
                          onBlur={() => {
                            setTimeout(() => setActiveCatalogSearch(null), 250);
                          }}
                          disabled={isCompleted}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50 disabled:text-slate-500"
                          placeholder={item.item_type === 'labour' ? 'e.g. Paid Service Labour' : 'e.g. Engine Oil'}
                        />

                        {activeCatalogSearch?.catIdx === -1 && activeCatalogSearch?.svcIdx === idx && catalogSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-40 overflow-y-auto z-[999]">
                            {catalogSuggestions.map((sug, sIdx) => (
                              <div
                                key={sIdx}
                                onMouseDown={() => selectCatalogItem(idx, sug)}
                                className="p-2 hover:bg-amber-50 cursor-pointer border-b border-gray-100 last:border-none flex justify-between items-center text-xs"
                              >
                                <div>
                                  <div className="font-bold text-xs text-on-surface">{sug.item_name}</div>
                                  <div className="text-[8px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">
                                    {sug.category} · {sug.item_type}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-xs text-primary">₹{sug.default_rate}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Mobile Card Pricing Form */}
                      <div className="grid grid-cols-2 gap-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Price Type</label>
                          <select
                            value={item.price_type || 'price'}
                            onChange={(e) => updateService(idx, 'price_type', e.target.value)}
                            disabled={isCompleted}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold uppercase text-slate-700 disabled:bg-slate-50"
                          >
                            <option value="price">Price</option>
                            <option value="mrp">MRP</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Rate</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate}
                            onChange={(e) => updateService(idx, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            disabled={isCompleted}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 text-right disabled:bg-slate-50"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Qty</label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.qty}
                            onChange={(e) => updateService(idx, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            disabled={isCompleted}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-700 disabled:bg-slate-50"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Disc %</label>
                          <input
                            type="number"
                            value={item.discount_pct}
                            onChange={(e) => updateService(idx, 'discount_pct', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            disabled={isCompleted}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-700 disabled:bg-slate-50"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">HSN/SAC</label>
                          <input
                            value={item.hsn_sac || ''}
                            onChange={(e) => updateService(idx, 'hsn_sac', e.target.value)}
                            disabled={isCompleted}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono uppercase text-slate-700 disabled:bg-slate-50"
                            placeholder="—"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tax %</label>
                          <input
                            type="number"
                            value={item.tax_pct}
                            onChange={(e) => updateService(idx, 'tax_pct', e.target.value === '' ? '' : parseFloat(e.target.value))}
                            disabled={isCompleted}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-700 disabled:bg-slate-50"
                            placeholder="18"
                          />
                        </div>
                        <div className="col-span-2 flex justify-between items-center bg-white p-2 rounded-lg mt-1 border border-slate-100">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Total</span>
                          <span className="text-xs font-extrabold font-mono text-emerald-600">
                            {totalInclGst !== 0 ? formatCurrency(totalInclGst) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Service Totals ═══ */}
      <div className="glass-card-solid overflow-hidden mb-6">
        <div className="px-6 py-6 bg-gray-50/50 flex justify-end">
          <div className="w-72 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-muted font-bold uppercase tracking-widest text-xs">Subtotal</span>
              <span className="font-bold font-mono text-on-surface">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm pb-3 border-b border-gray-200">
              <span className="text-on-surface-muted font-bold uppercase tracking-widest text-xs">Total Tax</span>
              <span className="font-mono text-on-surface-muted">{formatCurrency(totalTax)}</span>
            </div>
            <div className="flex justify-between text-xl font-extrabold items-end">
              <span className="uppercase tracking-widest text-xs text-on-surface-muted mb-1">Grand Total</span>
              <span className="text-primary font-mono font-headline">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- Bottom Status transition buttons --- */}
      {!isCompleted && (
        <div className="glass-card-solid p-6 mb-6 flex flex-wrap gap-3 justify-end items-center">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mr-auto flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            Current Status: {job.status.replace('_', ' ')}
          </span>

          <button
            onClick={handleExplicitSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-amber-600 hover:bg-amber-700 text-white transition-all flex items-center gap-1.5 shadow-md shadow-amber-600/20 cursor-pointer active:scale-95"
            title="Save changes and update bill totals"
          >
            <span className="material-symbols-outlined text-base">save</span>
            Save & Update Bill
          </button>

          {(job.status === 'invoiced' || job.invoice_no) && (
            <button
              onClick={() => {
                const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                const tk = localStorage.getItem('gms_token') || '';
                window.open(`${baseUrl}/job-cards/${id}/invoice-html?token=${tk}`, '_blank');
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-purple-700 hover:bg-purple-800 text-white transition-all flex items-center gap-1.5 shadow-md shadow-purple-700/20 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-base">print</span>
              Re-print Invoice
            </button>
          )}

          <button
            onClick={() => {
                            setShowModal('invoice');
            }}
            className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-primary hover:bg-primary-dark text-white transition-all flex items-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer active:scale-95"
          >
            {job.status === 'invoiced' ? 'Update Invoice & Payment' : 'Next Step / Generate Invoice'}
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        </div>
      )}

      {/* ═══ Advance Payments ═══ */}
      {job.advance_payments && job.advance_payments.length > 0 && (
        <div className="glass-card-solid p-6 mb-6 border-l-4 border-l-amber-500">
          <h3 className="font-headline font-extrabold text-base flex items-center gap-2 text-on-surface mb-4">
            <span className="material-symbols-outlined text-amber-600 text-xl">payments</span>
            Advance Payments
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-[10px] font-bold text-on-surface-muted uppercase tracking-widest">#</th>
                  <th className="text-left py-2 px-3 text-[10px] font-bold text-on-surface-muted uppercase tracking-widest">Date</th>
                  <th className="text-left py-2 px-3 text-[10px] font-bold text-on-surface-muted uppercase tracking-widest">Mode</th>
                  <th className="text-left py-2 px-3 text-[10px] font-bold text-on-surface-muted uppercase tracking-widest">Bank</th>
                  <th className="text-right py-2 px-3 text-[10px] font-bold text-on-surface-muted uppercase tracking-widest">Amount</th>
                </tr>
              </thead>
              <tbody>
                {job.advance_payments.map((ap: any, idx: number) => (
                  <tr key={ap.id || idx} className="border-b border-gray-50 hover:bg-emerald-50/30 transition-colors">
                    <td className="py-2.5 px-3 text-xs font-bold text-on-surface-muted">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-on-surface">
                      {ap.payment_date ? new Date(ap.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {ap.payment_type || 'cash'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-on-surface-muted font-medium">{ap.bank_name || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-bold font-mono text-emerald-700">{formatCurrency(ap.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-emerald-200">
                  <td colSpan={4} className="py-3 px-3 text-right text-xs font-bold uppercase tracking-widest text-on-surface-muted">Total Advance</td>
                  <td className="py-3 px-3 text-right font-extrabold font-mono text-lg text-emerald-700">
                    {formatCurrency(job.advance_payments.reduce((sum: number, ap: any) => sum + (parseFloat(ap.amount) || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}



      {/* ═══ Invoice/Estimate Info (if completed) ═══ */}
      {job.invoice && (
        <div className="glass-card-solid p-6 border-l-4 border-l-amber-500 mb-6 bg-amber-50/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-xl ${job.invoice.gst_percent === undefined ? 'text-amber-600' : 'text-emerald-600'}`}>
                {job.invoice.gst_percent === undefined ? 'description' : 'receipt_long'}
              </span>
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest flex items-center">
                'Invoice' #{job.invoice.invoice_no}
                <button
                  onClick={async () => {
                    const newInv = prompt(`Enter new $'Invoice' number:`, job.invoice.invoice_no);
                    if (newInv && newInv.trim() && newInv.trim() !== job.invoice.invoice_no) {
                      try {
                        await api.patch(`/job-cards/${id}/invoice-number`, { invoice_no: newInv.trim() });
                        showToast(`$'Invoice' number updated successfully`, 'success');
                        fetchJob();
                      } catch (err: any) {
                        showToast(err.response?.data?.error || `Failed to update ${job.invoice.gst_percent === undefined ? 'estimate' : 'invoice'} number`, 'error');
                      }
                    }
                  }}
                  className="ml-2 text-slate-400 hover:text-amber-700 transition-colors align-middle"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                </button>
              </h3>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleDownloadInvoice}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                job.invoice.gst_percent === undefined
                  ? 'bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/20'
                  : 'bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/20'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              'Download Invoice'
            </motion.button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div><span className="text-on-surface-muted font-bold uppercase tracking-widest text-[10px] block mb-1">Subtotal</span><span className="font-bold font-mono text-lg">{formatCurrency(job.invoice.subtotal)}</span></div>
            {job.invoice.gst_percent !== undefined ? (
              <div><span className="text-on-surface-muted font-bold uppercase tracking-widest text-[10px] block mb-1">GST ({job.invoice.gst_percent}%)</span><span className="font-bold font-mono text-lg text-on-surface-muted">{formatCurrency(job.invoice.gst_amount)}</span></div>
            ) : (
              <div><span className="text-on-surface-muted font-bold uppercase tracking-widest text-[10px] block mb-1">Tax</span><span className="font-bold font-mono text-lg text-on-surface-muted">Non-GST</span></div>
            )}
            <div><span className="text-on-surface-muted font-bold uppercase tracking-widest text-[10px] block mb-1">Total</span><span className="font-bold font-mono text-lg text-primary">{formatCurrency(job.invoice.total_amount)}</span></div>
            <div><span className="text-on-surface-muted font-bold uppercase tracking-widest text-[10px] block mb-1">Mode</span><span className="font-bold uppercase text-sm px-3 py-1 bg-gray-100 rounded-lg inline-block">{job.invoice.payment_mode}</span></div>
          </div>
        </div>
      )}

      {job.estimate && (
        <div className="glass-card-solid p-6 border-l-4 border-l-amber-500 mb-6 bg-amber-50/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-600 text-xl">description</span>
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest flex items-center">
                Estimate #{job.estimate.estimate_no}
                <button
                  onClick={async () => {
                    const newEst = prompt('Enter new Estimate number:', job.estimate.estimate_no);
                    if (newEst && newEst.trim() && newEst.trim() !== job.estimate.estimate_no) {
                      try {
                        await api.patch(`/job-cards/${id}/invoice-number`, { invoice_no: newEst.trim() });
                        showToast('Estimate number updated successfully', 'success');
                        fetchJob();
                      } catch (err: any) {
                        showToast(err.response?.data?.error || 'Failed to update estimate number', 'error');
                      }
                    }
                  }}
                  className="ml-2 text-slate-400 hover:text-amber-700 transition-colors align-middle"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                </button>
              </h3>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleDownloadInvoice}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold
                         bg-amber-500/10 text-amber-700 border border-amber-500/20
                         hover:bg-amber-500/20 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Download Estimate
            </motion.button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
            <div><span className="text-on-surface-muted font-bold uppercase tracking-widest text-[10px] block mb-1">Subtotal</span><span className="font-bold font-mono text-lg">{formatCurrency(job.estimate.subtotal)}</span></div>
            <div><span className="text-on-surface-muted font-bold uppercase tracking-widest text-[10px] block mb-1">Mode</span><span className="font-bold uppercase text-sm px-3 py-1 bg-gray-100 rounded-lg inline-block">{job.estimate.payment_mode}</span></div>
          </div>

        </div>
      )}

      {/* ═══ Modals ═══ */}
      {showModal && (
        <Modal 
          title={
            showModal === 'vehicle' 
              ? 'Edit Vehicle Info' 
              : showModal === 'concern' 
              ? 'Add New Concern' 
              : 'Generate Invoice'
          } 
          onClose={() => setShowModal(null)}
          maxWidth={showModal === 'vehicle' || showModal === 'customer' || showModal === 'insurance' ? 'max-w-2xl' : 'max-w-md'}
        >
          <div className="space-y-6">
            {showModal === 'vehicle' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Registration Number</label>
                    <input
                      type="text"
                      value={vehicleSpec.reg_no || ''}
                      maxLength={10}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
                        setVehicleSpec({ ...vehicleSpec, reg_no: val });
                      }}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface uppercase font-mono"
                    />
                  </div>
                  <div className="md:col-span-2 py-2">
                    <span className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Spare Wheel Present?</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="spare_wheel_edit" checked={vehicleSpec.spare_wheel === 1 || vehicleSpec.spare_wheel === true} onChange={() => setVehicleSpec({ ...vehicleSpec, spare_wheel: 1 })} className="w-4 h-4 text-primary border-border focus:ring-primary/20 cursor-pointer" />
                        <span className="text-sm font-semibold text-on-surface">Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="spare_wheel_edit" checked={vehicleSpec.spare_wheel === 0 || vehicleSpec.spare_wheel === false} onChange={() => setVehicleSpec({ ...vehicleSpec, spare_wheel: 0 })} className="w-4 h-4 text-primary border-border focus:ring-primary/20 cursor-pointer" />
                        <span className="text-sm font-semibold text-on-surface">No</span>
                      </label>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Other Pointers / Remarks / Indicators</label>
                    <SuggestInput
                      type="remarks"
                      value={vehicleSpec.pointers || ''}
                      onChange={(val) => setVehicleSpec({ ...vehicleSpec, pointers: val })}
                      placeholder="e.g. Dent on front bumper, scratches on left door..."
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                </div>
                <VehicleSpecFields 
                  value={vehicleSpec} 
                  onChange={setVehicleSpec} 
                  disabled={saving}
                />
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSaveVehicle}
                  disabled={saving}
                  className="btn-primary w-full py-3.5 shadow-md mt-4"
                >
                  <span className="material-symbols-outlined text-lg">save</span>
                  <span>{saving ? 'Saving...' : 'Save Vehicle Updates'}</span>
                </motion.button>
              </>
            ) : showModal === 'customer' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Customer Name</label>
                    <SuggestInput
                      type="client_name"
                      value={customerSpec.customer_name || ''}
                      onChange={(val) => setCustomerSpec({ ...customerSpec, customer_name: val })}
                      onLinkedFill={(linked) => {
                        setCustomerSpec((prev: any) => ({
                          ...prev,
                          mobile_no: prev.mobile_no || linked.mobile_no || '',
                          email: prev.email || linked.email || '',
                          address_line: prev.address_line || linked.address_line || '',
                          city: prev.city || linked.city || '',
                          pincode: prev.pincode || linked.pincode || '',
                        }));
                      }}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Mobile Number</label>
                    <SuggestInput
                      type="mobile_no"
                      value={customerSpec.mobile_no || ''}
                      onChange={(val) => setCustomerSpec({ ...customerSpec, mobile_no: val.replace(/\D/g, '').slice(0, 10) })}
                      maxLength={10}
                      onLinkedFill={(linked) => {
                        setCustomerSpec((prev: any) => ({
                          ...prev,
                          customer_name: prev.customer_name || linked.customer_name || linked.client_name || '',
                          email: prev.email || linked.email || '',
                          address_line: prev.address_line || linked.address_line || '',
                          city: prev.city || linked.city || '',
                          pincode: prev.pincode || linked.pincode || '',
                        }));
                      }}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Alternate Mobile</label>
                    <SuggestInput
                      type="alt_mobile"
                      value={customerSpec.alt_mobile || ''}
                      onChange={(val) => setCustomerSpec({ ...customerSpec, alt_mobile: val.replace(/\D/g, '').slice(0, 10) })}
                      maxLength={10}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Email</label>
                    <SuggestInput
                      type="email"
                      value={customerSpec.email || ''}
                      onChange={(val) => setCustomerSpec({ ...customerSpec, email: val })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Address</label>
                    <SuggestInput
                      type="address_line"
                      value={customerSpec.address_line || ''}
                      onChange={(val) => setCustomerSpec({ ...customerSpec, address_line: val })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Area / Colony / Street</label>
                    <SuggestInput
                      type="colony_street"
                      value={customerSpec.colony_street || ''}
                      onChange={(val) => setCustomerSpec({ ...customerSpec, colony_street: val })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">City</label>
                    <SuggestInput
                      type="city"
                      value={customerSpec.city || ''}
                      onChange={(val) => setCustomerSpec({ ...customerSpec, city: val })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">State</label>
                    <SuggestInput
                      type="state"
                      value={customerSpec.state || ''}
                      onChange={(val) => setCustomerSpec({ ...customerSpec, state: val })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Pin Code</label>
                    <SuggestInput
                      type="pincode"
                      value={customerSpec.pincode || ''}
                      onChange={(val) => setCustomerSpec({ ...customerSpec, pincode: val })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Customer Type</label>
                    <select
                      value={customerSpec.customer_type || 'individual'}
                      onChange={(e) => setCustomerSpec({ ...customerSpec, customer_type: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface appearance-none cursor-pointer"
                    >
                      <option value="individual">Individual</option>
                      <option value="corporate">Corporate</option>
                      <option value="fleet">Fleet</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Company Name</label>
                    <SuggestInput
                      type="company_name"
                      value={customerSpec.company_name || ''}
                      onChange={(val) => setCustomerSpec({ ...customerSpec, company_name: val })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">GSTIN</label>
                    <SuggestInput
                      type="gstin"
                      value={customerSpec.gstin || ''}
                      onChange={(val) => setCustomerSpec({ ...customerSpec, gstin: val })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSaveCustomer}
                  disabled={saving}
                  className="btn-primary w-full py-3.5 shadow-md mt-4"
                >
                  <span className="material-symbols-outlined text-lg">save</span>
                  <span>{saving ? 'Saving...' : 'Save Customer Updates'}</span>
                </motion.button>
              </div>
            ) : showModal === 'insurance' ? (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2">Job Configuration</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Service Type(s)</label>
                    {(() => {
                      const selectedTypes = insuranceSpec.service_type ? insuranceSpec.service_type.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                      const toggleType = (type: string) => {
                        const newTypes = selectedTypes.includes(type)
                          ? selectedTypes.filter((t: string) => t !== type)
                          : [...selectedTypes, type];
                        setInsuranceSpec({ ...insuranceSpec, service_type: newTypes.join(', ') });
                      };
                      return (
                        <>
                          <div
                            className="w-full bg-slate-50 border-none rounded-lg py-2.5 px-3 font-medium text-sm cursor-pointer flex items-center justify-between min-h-[40px] flex-wrap gap-1"
                            onClick={() => {
                              const el = document.getElementById('edit-service-type-dropdown');
                              if (el) el.classList.toggle('hidden');
                            }}
                          >
                            {selectedTypes.length === 0 ? (
                              <span className="text-slate-400">Select service types...</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {selectedTypes.map((t: string) => (
                                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 text-xs font-bold rounded-full">
                                    {t}
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); toggleType(t); }}
                                      className="text-amber-600 hover:text-amber-900 text-xs leading-none"
                                    >Ã—</button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <span className="material-symbols-outlined text-slate-400 text-base ml-auto">expand_more</span>
                          </div>
                          <div id="edit-service-type-dropdown" className="hidden absolute z-30 mt-1 w-full bg-white rounded-lg shadow-lg border border-slate-200 max-h-60 overflow-y-auto">
                            {serviceTypes.filter(s => s !== 'Custom').map(s => (
                              <label key={s} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedTypes.includes(s)}
                                  onChange={() => toggleType(s)}
                                  className="w-4 h-4 text-amber-800 rounded border-slate-300 focus:ring-amber-500/20"
                                />
                                <span className="text-sm font-medium text-on-surface">{s}</span>
                              </label>
                            ))}
                            <div className="border-t border-slate-100 px-3 py-2">
                              <input
                                type="text"
                                placeholder="Custom type..."
                                className="w-full bg-slate-100 rounded-md py-1.5 px-3 text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = (e.target as HTMLInputElement).value.trim();
                                    if (val && !selectedTypes.includes(val)) {
                                      setInsuranceSpec({ ...insuranceSpec, service_type: [...selectedTypes, val].join(', ') });
                                    }
                                    (e.target as HTMLInputElement).value = '';
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Service Advisor / Staff</label>
                    <select
                      value={insuranceSpec.assigned_staff_id || ''}
                      onChange={(e) => setInsuranceSpec({ ...insuranceSpec, assigned_staff_id: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface appearance-none cursor-pointer"
                    >
                      <option value="">Select staff...</option>
                      {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Estimated Delivery</label>
                    <input
                      type="date"
                      value={insuranceSpec.estimated_delivery || ''}
                      onChange={(e) => setInsuranceSpec({ ...insuranceSpec, estimated_delivery: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Job / Entry Date</label>
                    <input
                      type="date"
                      value={insuranceSpec.job_date || ''}
                      onChange={(e) => setInsuranceSpec({ ...insuranceSpec, job_date: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface font-mono"
                    />
                  </div>
                  {job.fuel_type === 'electric' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">EV Charge (%)</label>
                      <div className="flex items-center gap-4 py-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={insuranceSpec.charging_pct || 0}
                          onChange={(e) => setInsuranceSpec({ ...insuranceSpec, charging_pct: parseInt(e.target.value) })}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <span className="font-mono text-sm font-bold text-on-surface w-12 text-right">
                          {insuranceSpec.charging_pct || 0}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Fuel Level</label>
                      <select
                        value={insuranceSpec.fuel_level || ''}
                        onChange={(e) => setInsuranceSpec({ ...insuranceSpec, fuel_level: e.target.value })}
                        className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface appearance-none cursor-pointer"
                      >
                        <option value="">Select...</option>
                        <option value="Empty">Empty</option>
                        <option value="1/4">1/4</option>
                        <option value="1/2">1/2</option>
                        <option value="3/4">3/4</option>
                        <option value="Full">Full</option>
                      </select>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Notes</label>
                    <textarea
                      value={insuranceSpec.notes || ''}
                      onChange={(e) => setInsuranceSpec({ ...insuranceSpec, notes: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                </div>

                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2 pt-4">Insurance Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Insurance Company</label>
                    <SuggestInput
                      type="insurance_company"
                      value={insuranceSpec.insurance_company || ''}
                      onChange={(val) => setInsuranceSpec({ ...insuranceSpec, insurance_company: val })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Claim Number</label>
                    <input
                      type="text"
                      value={insuranceSpec.insurance_claim_no || ''}
                      onChange={(e) => setInsuranceSpec({ ...insuranceSpec, insurance_claim_no: e.target.value, claim_no: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Insurance Expiry Date</label>
                    <input
                      type="date"
                      value={insuranceSpec.insurance_expiry || ''}
                      onChange={(e) => setInsuranceSpec({ ...insuranceSpec, insurance_expiry: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Accident Date</label>
                    <input
                      type="date"
                      value={insuranceSpec.accident_date || ''}
                      onChange={(e) => setInsuranceSpec({ ...insuranceSpec, accident_date: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Accident Delivery Date</label>
                    <input
                      type="date"
                      value={insuranceSpec.delivery_date || ''}
                      onChange={(e) => setInsuranceSpec({ ...insuranceSpec, delivery_date: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Approval Status</label>
                    <select
                      value={insuranceSpec.approval_status || 'pending'}
                      onChange={(e) => setInsuranceSpec({ ...insuranceSpec, approval_status: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface appearance-none cursor-pointer"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Approval Date</label>
                    <input
                      type="date"
                      value={insuranceSpec.approval_date || ''}
                      onChange={(e) => setInsuranceSpec({ ...insuranceSpec, approval_date: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-2.5 px-3 font-medium text-sm text-on-surface"
                    />
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSaveInsurance}
                  disabled={saving}
                  className="btn-primary w-full py-3.5 shadow-md mt-4"
                >
                  <span className="material-symbols-outlined text-lg">save</span>
                  <span>{saving ? 'Saving...' : 'Save Job & Insurance Updates'}</span>
                </motion.button>
              </div>
            ) : showModal === 'concern' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Concern Description</label>
                  <input
                    type="text"
                    value={newConcernText}
                    onChange={(e) => setNewConcernText(e.target.value)}
                    placeholder="e.g. Engine noise, front brake pads worn, etc."
                    className="w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-3 px-4 font-medium text-sm text-on-surface placeholder:text-slate-300"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddConcernConfirm();
                    }}
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setShowModal(null)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-on-surface-muted hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddConcernConfirm}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/95 transition-all shadow-button"
                  >
                    Add Concern
                  </button>
                </div>
              </>
            ) : (
              <>
                {showModal === 'invoice' && (
                  <>
                    {/* GST Mode Selector */}
                    {/* Invoice Summary */}
                    <div className="p-5 rounded-xl border text-sm bg-primary-50 border-primary/20">
                      <p className="font-bold font-label uppercase tracking-widest text-[10px] mb-3 text-primary">Invoice Summary</p>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <p className="text-on-surface-muted">Subtotal</p>
                        <p className="font-bold font-mono text-right">{formatCurrency(subtotal)}</p>
                        
                        <div className="col-span-2 border-t pt-3 flex justify-between items-end mt-1 border-primary/20">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Grand Total</span>
                          <span className="text-xl font-extrabold font-headline text-primary">
                            {formatCurrency(subtotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {showModal === 'invoice' && (
                  <div>
                    <label className="input-label">Manual Invoice Number (Optional)</label>
                    <input
                      type="text"
                      value={manualInvoiceNo}
                      onChange={(e) => setManualInvoiceNo(e.target.value)}
                      placeholder="Leave empty for auto-generate"
                      className="input-field"
                    />
                  </div>
                )}


                {/* ── Payment Collection Status (Payment Done vs Pending) ── */}
                {showModal === 'invoice' && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-extrabold text-on-surface uppercase tracking-wider">
                        Payment Status *
                      </label>
                      <span className="text-[10px] font-bold text-slate-400">Choose received or pending</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setInvoicePaymentStatus('done')}
                        className={`p-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                          invoicePaymentStatus === 'done'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm'
                            : 'border-gray-200 text-on-surface-muted hover:border-gray-300'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg text-emerald-600">check_circle</span>
                        Payment Done (Paid)
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvoicePaymentStatus('pending')}
                        className={`p-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                          invoicePaymentStatus === 'pending'
                            ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                            : 'border-gray-200 text-on-surface-muted hover:border-gray-300'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg text-amber-600">pending_actions</span>
                        Payment Pending
                      </button>
                    </div>

                    {invoicePaymentStatus === 'done' ? (
                      <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-900 uppercase tracking-widest mb-1.5">
                            Received Payment Mode *
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { id: 'cash', label: 'Cash', icon: 'payments' },
                              { id: 'upi', label: 'UPI', icon: 'qr_code_2' },
                              { id: 'card', label: 'Card', icon: 'credit_card' },
                              { id: 'bank_transfer', label: 'Bank', icon: 'account_balance' },
                            ].map(m => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setInvoicePaymentMode(m.id as any)}
                                className={`py-2 px-2 rounded-lg text-center border font-bold text-[11px] transition-all flex flex-col items-center gap-1 ${
                                  invoicePaymentMode === m.id
                                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300'
                                }`}
                              >
                                <span className="material-symbols-outlined text-base">{m.icon}</span>
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                              Txn / Ref No (Optional)
                            </label>
                            <input
                              type="text"
                              value={invoiceTransactionId}
                              onChange={(e) => setInvoiceTransactionId(e.target.value)}
                              placeholder="e.g. UPI Ref / Last 4 digits"
                              className="input-field text-xs py-1.5"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                              Received By Staff (Optional)
                            </label>
                            <select
                              value={invoiceStaffId}
                              onChange={(e) => setInvoiceStaffId(e.target.value)}
                              className="input-field text-xs py-1.5"
                            >
                              <option value="">-- Direct / Admin --</option>
                              {staff.map((s: any) => (
                                <option key={s.id} value={s.id}>{s.full_name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <p className="text-[10px] text-emerald-800 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
                          Directly posts receipt entry to <strong>Accounts</strong> and <strong>Daily Report</strong>.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                        <span className="material-symbols-outlined text-amber-700 text-base mt-0.5">info</span>
                        <div>
                          <p className="font-bold">Payment will be marked as Pending</p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            This invoice will be sent to the <strong>Payment Pending</strong> page under this client's profile. You can register full or partial payments manually later.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-4 bg-warning-light/30 rounded-xl border border-warning/20">
                  <p className="text-xs font-bold text-warning-dark flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    <span>This action is final. The job card will be permanently marked as <strong>Invoiced</strong>.</span>
                  </p>
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleInvoice}
                  className={`w-full py-3.5 shadow-md rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
                    invoicePaymentStatus === 'done'
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 shadow-amber-500/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {invoicePaymentStatus === 'done' ? 'task_alt' : 'receipt'}
                  </span>
                  <span>
                    {invoicePaymentStatus === 'done'
                      ? `Confirm & Record Payment (${formatCurrency(subtotal)})`
                      : 'Confirm Invoice (Payment Pending)'}
                  </span>
                </motion.button>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ═══ WhatsApp Share FAB ═══ */}
      {job && (
        <div className="fixed right-6 bottom-24 z-50">
          {showWaMenu && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute bottom-16 right-0 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden mb-2"
            >
              <div className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-500 text-white">
                <p className="text-sm font-bold flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.592-.822-6.328-2.2l-.44-.352-3.276 1.098 1.098-3.276-.352-.44A9.953 9.953 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                  Send via WhatsApp
                </p>
                <p className="text-[10px] text-white/80 mt-0.5">To: {job.mobile_no || job.cust_mobile || 'N/A'}</p>
              </div>

              <button
                onClick={() => handleWhatsAppShare('job_card')}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 text-sm font-medium text-gray-800 transition-colors"
              >
                <span className="material-symbols-outlined text-emerald-600 text-lg">assignment</span>
                Send Detailing Studio Order
              </button>


              {(job.status === 'invoiced' || job.invoice_no) && (
                <button
                  onClick={() => handleWhatsAppShare('invoice')}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50 text-sm font-medium text-gray-800 transition-colors border-t border-gray-100"
                >
                  <span className="material-symbols-outlined text-purple-600 text-lg">receipt_long</span>
                  Send Invoice
                </button>
              )}
            </motion.div>
          )}

          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.1 }}
            onClick={() => setShowWaMenu(!showWaMenu)}
            className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ${
              showWaMenu
                ? 'bg-gray-700 rotate-45'
                : 'bg-gradient-to-br from-emerald-500 to-green-600 hover:shadow-2xl hover:shadow-green-300/40'
            }`}
          >
            {showWaMenu ? (
              <span className="material-symbols-outlined text-white text-2xl">close</span>
            ) : (
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.592-.822-6.328-2.2l-.44-.352-3.276 1.098 1.098-3.276-.352-.44A9.953 9.953 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
              </svg>
            )}
          </motion.button>
        </div>
      )}

      {/* ═══ Custom Confirm Dialog ═══ */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmDialog(null)}
          />
          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Top accent bar */}
            <div className={`h-1 w-full ${confirmDialog.confirmColor.split(' ')[0]}`} />
            
            <div className="p-6">
              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                confirmDialog.iconColor.includes('red') ? 'bg-red-50' :
                confirmDialog.iconColor.includes('amber') ? 'bg-amber-50' : 'bg-amber-50'
              }`}>
                <span className={`material-symbols-outlined text-3xl ${confirmDialog.iconColor}`}>
                  {confirmDialog.icon}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">
                {confirmDialog.title}
              </h3>

              {/* Message */}
              <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">
                {confirmDialog.message}
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className={`flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-bold transition-colors shadow-lg ${confirmDialog.confirmColor}`}
                >
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </AnimatedPage>
  );
}

