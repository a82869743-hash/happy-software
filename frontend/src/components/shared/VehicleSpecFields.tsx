import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';

interface VehicleSpec {
  make: string;
  model: string;
  year: string;
  fuel_type: string;
  variant: string;
  vehicle_color: string;
}

interface Props {
  value: VehicleSpec;
  onChange: (updated: VehicleSpec) => void;
  disabled?: boolean;
}

interface ModelResult {
  model: string;
  fuel_types: string[];
  variants?: string[];
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i);
const COLORS = ['White', 'Silver', 'Black', 'Grey', 'Red', 'Blue', 'Brown', 'Beige', 'Orange', 'Yellow', 'Green', 'Gold', 'Maroon', 'Navy'];
const ALL_FUELS = ['Petrol', 'Diesel', 'CNG', 'EV', 'Electric', 'Hybrid'];

const VehicleSpecFields: React.FC<Props> = ({ value, onChange, disabled }) => {
  const [makeQuery, setMakeQuery] = useState(value.make || '');
  const [modelQuery, setModelQuery] = useState(value.model || '');
  const [variantQuery, setVariantQuery] = useState(value.variant || '');

  const [makeSuggestions, setMakeSuggestions] = useState<string[]>([]);
  const [modelSuggestions, setModelSuggestions] = useState<ModelResult[]>([]);
  
  const [showMakeDrop, setShowMakeDrop] = useState(false);
  const [showModelDrop, setShowModelDrop] = useState(false);
  const [showVariantDrop, setShowVariantDrop] = useState(false);

  const [availableFuels, setAvailableFuels] = useState<string[]>(ALL_FUELS);
  const [availableVariants, setAvailableVariants] = useState<string[]>([]);

  const [highlightedMake, setHighlightedMake] = useState(-1);
  const [highlightedModel, setHighlightedModel] = useState(-1);
  const [highlightedVariant, setHighlightedVariant] = useState(-1);

  const makeTimer = useRef<any>(null);
  const modelTimer = useRef<any>(null);
  const makeRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const variantRef = useRef<HTMLInputElement>(null);

  // Sync external value changes (e.g. from vehicle lookup or load)
  useEffect(() => {
    setMakeQuery(value.make || '');
    setModelQuery(value.model || '');
    setVariantQuery(value.variant || '');
  }, [value.make, value.model, value.variant]);

  // Fetch models (to get variants & fuels) when make/model is set/changed externally or internally
  useEffect(() => {
    if (value.make && value.model) {
      api.get('/vehicle-master/models', {
        params: { make: value.make, q: value.model }
      }).then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        const foundModel = list.find((m: any) => m && m.model && m.model.toLowerCase() === value.model.toLowerCase());
        if (foundModel) {
          const fuels = Array.from(new Set([...(foundModel.fuel_types || []), ...ALL_FUELS]));
          const vars = foundModel.variants && foundModel.variants.length > 0 ? foundModel.variants : [];
          setAvailableFuels(fuels);
          setAvailableVariants(vars);
        }
      }).catch(() => {});
    } else {
      setAvailableVariants([]);
    }
  }, [value.make, value.model]);

  // ─── Make autocomplete ───
  useEffect(() => {
    clearTimeout(makeTimer.current);
    makeTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/vehicle-master/makes', { params: { q: makeQuery } });
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setMakeSuggestions(list);
        if (list.length > 0 && document.activeElement === makeRef.current) {
          setShowMakeDrop(true);
        }
      } catch { /* silent */ }
    }, 200);
    return () => clearTimeout(makeTimer.current);
  }, [makeQuery]);

  // ─── Model autocomplete ───
  useEffect(() => {
    clearTimeout(modelTimer.current);
    if (!value.make && modelQuery.length < 1) { setModelSuggestions([]); return; }
    modelTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/vehicle-master/models', {
          params: { make: value.make || undefined, q: modelQuery || undefined }
        });
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setModelSuggestions(list);
        if (list.length > 0 && document.activeElement === modelRef.current) {
          setShowModelDrop(true);
        }
      } catch { /* silent */ }
    }, 200);
    return () => clearTimeout(modelTimer.current);
  }, [modelQuery, value.make]);

  const selectMake = (make: string) => {
    setMakeQuery(make);
    setShowMakeDrop(false);
    setHighlightedMake(-1);
    setModelQuery('');
    setVariantQuery('');
    onChange({ ...value, make, model: '', fuel_type: '', variant: '' });
    setAvailableFuels(ALL_FUELS);
    setAvailableVariants([]);
    // Focus model input after selecting make
    setTimeout(() => modelRef.current?.focus(), 50);
  };

  const selectModel = (item: ModelResult) => {
    setModelQuery(item.model);
    setShowModelDrop(false);
    setHighlightedModel(-1);
    setVariantQuery('');
    const fuels = Array.from(new Set([...item.fuel_types, ...ALL_FUELS]));
    const vars = item.variants && item.variants.length > 0 ? item.variants : [];
    setAvailableFuels(fuels);
    setAvailableVariants(vars);
    // Auto-select fuel if only one option
    const autoFuel = fuels.length === 1 ? fuels[0] : value.fuel_type;
    onChange({ ...value, model: item.model, fuel_type: autoFuel, variant: '' });
    // Focus variant input after selecting model
    setTimeout(() => variantRef.current?.focus(), 50);
  };

  const selectVariant = (variant: string) => {
    setVariantQuery(variant);
    setShowVariantDrop(false);
    setHighlightedVariant(-1);
    onChange({ ...value, variant });
  };

  // Filtered variants based on variantQuery
  const filteredVariants = availableVariants.filter(v =>
    v.toLowerCase().includes(variantQuery.toLowerCase())
  );

  // --- Keyboard navigation for dropdowns ---
  const handleMakeKeyDown = (e: React.KeyboardEvent) => {
    if (!showMakeDrop || makeSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedMake(prev => Math.min(prev + 1, makeSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedMake(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightedMake >= 0) {
      e.preventDefault();
      selectMake(makeSuggestions[highlightedMake]);
    } else if (e.key === 'Escape') {
      setShowMakeDrop(false);
    }
  };

  const handleModelKeyDown = (e: React.KeyboardEvent) => {
    if (!showModelDrop || modelSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedModel(prev => Math.min(prev + 1, modelSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedModel(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightedModel >= 0) {
      e.preventDefault();
      selectModel(modelSuggestions[highlightedModel]);
    } else if (e.key === 'Escape') {
      setShowModelDrop(false);
    }
  };

  const handleVariantKeyDown = (e: React.KeyboardEvent) => {
    if (!showVariantDrop || filteredVariants.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedVariant(prev => Math.min(prev + 1, filteredVariants.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedVariant(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightedVariant >= 0) {
      e.preventDefault();
      selectVariant(filteredVariants[highlightedVariant]);
    } else if (e.key === 'Escape') {
      setShowVariantDrop(false);
    }
  };

  // --- Fuel type pill color ---
  const fuelColor = (fuel: string) => {
    switch (fuel) {
      case 'Petrol': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Diesel': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'CNG': return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'Electric': return 'bg-violet-100 text-violet-700 border-violet-200';
      case 'EV': return 'bg-violet-100 text-violet-700 border-violet-200';
      case 'Hybrid': return 'bg-teal-100 text-teal-700 border-teal-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const inputCls = "w-full bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-amber-500/20 py-3 px-4 font-medium text-sm text-on-surface placeholder:text-slate-300";

  return (
    <section className="bg-white p-4 sm:p-8 rounded-xl shadow-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-1 h-6 bg-amber-600 rounded-full" />
        <h3 className="font-headline font-bold text-lg">Vehicle Specifications</h3>
        {value.make && value.model && (
          <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            {value.make} {value.model}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* --- MAKE (autocomplete) --- */}
        <div className="relative">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Make</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">directions_car</span>
            <input
              ref={makeRef}
              type="text"
              value={makeQuery}
              onChange={(e) => {
                setMakeQuery(e.target.value);
                onChange({ ...value, make: e.target.value });
                setHighlightedMake(-1);
              }}
              onFocus={() => {
                setShowMakeDrop(true);
                api.get('/vehicle-master/makes', { params: { q: makeQuery } })
                  .then(res => {
                    const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                    setMakeSuggestions(list);
                    if (list.length > 0) setShowMakeDrop(true);
                  })
                  .catch(() => {});
              }}
              onBlur={() => setTimeout(() => setShowMakeDrop(false), 180)}
              onKeyDown={handleMakeKeyDown}
              placeholder="Maruti, Hyundai, Tata..."
              disabled={disabled}
              className={`${inputCls} !pl-10`}
              autoComplete="off"
            />
          </div>
          {showMakeDrop && makeSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
              {makeSuggestions.map((m, idx) => (
                <div
                  key={m}
                  onMouseDown={() => selectMake(m)}
                  className={`px-4 py-3 cursor-pointer text-sm font-medium flex items-center gap-3 transition-colors ${
                    idx === highlightedMake
                      ? 'bg-amber-50 text-amber-800'
                      : 'hover:bg-slate-50 text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-slate-400 text-base">factory</span>
                  {m}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── MODEL (autocomplete) ─── */}
        <div className="relative">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Model</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">document_scanner</span>
            <input
              ref={modelRef}
              type="text"
              value={modelQuery}
              onChange={(e) => {
                setModelQuery(e.target.value);
                onChange({ ...value, model: e.target.value });
                setHighlightedModel(-1);
              }}
              onFocus={() => {
                setShowModelDrop(true);
                api.get('/vehicle-master/models', { params: { make: value.make || undefined, q: modelQuery || undefined } })
                  .then(res => {
                    const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                    setModelSuggestions(list);
                    if (list.length > 0) setShowModelDrop(true);
                  })
                  .catch(() => {});
              }}
              onBlur={() => setTimeout(() => setShowModelDrop(false), 180)}
              onKeyDown={handleModelKeyDown}
              placeholder={value.make ? `Search ${value.make} models...` : 'Select make first...'}
              disabled={disabled}
              className={`${inputCls} !pl-10`}
              autoComplete="off"
            />
          </div>
          {showModelDrop && modelSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
              {modelSuggestions.map((item, idx) => (
                <div
                  key={item.model}
                  onMouseDown={() => selectModel(item)}
                  className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors ${
                    idx === highlightedModel
                      ? 'bg-amber-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-sm font-semibold ${idx === highlightedModel ? 'text-amber-800' : 'text-on-surface'}`}>
                    {item.model}
                  </span>
                  <div className="flex gap-1.5">
                    {item.fuel_types.map(f => (
                      <span key={f} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${fuelColor(f)}`}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- YEAR --- */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Year</label>
          <select
            value={value.year}
            onChange={(e) => onChange({ ...value, year: e.target.value })}
            disabled={disabled}
            className={`${inputCls} appearance-none cursor-pointer`}
          >
            <option value="">Select year</option>
            {YEARS.map(y => <option key={y} value={y.toString()}>{y}</option>)}
          </select>
        </div>

        {/* --- FUEL TYPE --- */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            Fuel Type
            {availableFuels.length < ALL_FUELS.length && (
              <span className="ml-2 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full normal-case">
                Auto-filtered
              </span>
            )}
          </label>
          {!availableFuels.includes(value.fuel_type) && value.fuel_type !== '' ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={value.fuel_type}
                onChange={(e) => onChange({ ...value, fuel_type: e.target.value })}
                placeholder="Enter custom fuel type"
                disabled={disabled}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => onChange({ ...value, fuel_type: '' })}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 rounded-lg font-bold flex items-center gap-1 transition-all text-xs"
              >
                Reset
              </button>
            </div>
          ) : (
            <select
              value={value.fuel_type}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  onChange({ ...value, fuel_type: 'Other' });
                } else {
                  onChange({ ...value, fuel_type: e.target.value });
                }
              }}
              disabled={disabled}
              className={`${inputCls} appearance-none cursor-pointer`}
            >
              <option value="">Select fuel type</option>
              {availableFuels.map(f => <option key={f} value={f}>{f}</option>)}
              <option value="custom" className="text-amber-800 font-bold">+ Custom Fuel Type</option>
            </select>
          )}
        </div>

        {/* --- VARIANT (autocomplete) --- */}
        <div className="relative">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Variant</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">tune</span>
            <input
              ref={variantRef}
              type="text"
              value={variantQuery}
              onChange={(e) => {
                setVariantQuery(e.target.value);
                onChange({ ...value, variant: e.target.value });
                setHighlightedVariant(-1);
              }}
              onFocus={() => {
                if (value.model) {
                  setShowVariantDrop(true);
                }
              }}
              onBlur={() => setTimeout(() => setShowVariantDrop(false), 180)}
              onKeyDown={handleVariantKeyDown}
              placeholder={value.model ? "Select or type variant..." : "Select model first..."}
              disabled={disabled}
              className={`${inputCls} !pl-10`}
              autoComplete="off"
            />
          </div>
          {showVariantDrop && filteredVariants.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
              {filteredVariants.map((v, idx) => (
                <div
                  key={v}
                  onMouseDown={() => selectVariant(v)}
                  className={`px-4 py-3 cursor-pointer text-sm font-medium flex items-center gap-3 transition-colors ${
                    idx === highlightedVariant
                      ? 'bg-amber-50 text-amber-800'
                      : 'hover:bg-slate-50 text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-slate-400 text-base">widgets</span>
                  {v}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- VEHICLE COLOR --- */}
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Vehicle Color</label>
          <input
            type="text"
            value={value.vehicle_color}
            onChange={(e) => onChange({ ...value, vehicle_color: e.target.value })}
            placeholder="White, Silver..."
            disabled={disabled}
            className={inputCls}
            list="HAPPY-color-list"
          />
          <datalist id="HAPPY-color-list">
            {COLORS.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
      </div>
    </section>
  );
};

export default VehicleSpecFields;


