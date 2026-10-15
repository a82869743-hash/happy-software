import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import AnimatedPage from '../components/shared/AnimatedPage';
import { showToast } from '../components/shared/Toast';
import { formatCurrency } from '../utils/format';

interface ImportTypeOption {
  value: string;
  label: string;
  icon: string;
  desc: string;
  badge?: string;
  recommended?: boolean;
}

const IMPORT_TYPES: ImportTypeOption[] = [
  {
    value: 'working_sheet',
    label: 'All Operations & Working Sheet',
    icon: 'table_chart',
    desc: 'Auto-creates Customers, Vehicles, Orders (Car Wash/Detailing Studio), Accessories & Pending Payments',
    badge: 'Recommended',
    recommended: true,
  },
  {
    value: 'customers',
    label: 'Customers Only',
    icon: 'group',
    desc: 'Import customer directory with name, mobile, address, and GSTIN',
  },
  {
    value: 'vehicles',
    label: 'Vehicles Only',
    icon: 'directions_car',
    desc: 'Import vehicle registry with registration number, make, model & owner mobile',
  },
  {
    value: 'service_catalog',
    label: 'Service & Rate Catalog',
    icon: 'build',
    desc: 'Import services, packages, labor rates, and spare parts catalog',
  },
];

export default function DataImport() {
  const [importType, setImportType] = useState('working_sheet');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [skipDupes, setSkipDupes] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  // Date filtering state
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'range' | 'single'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [singleDate, setSingleDate] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setPreview(null);
    setResult(null);
    setSelectedSheet('');
    setDateFilterMode('all');
    setFromDate('');
    setToDate('');
    setSingleDate('');
  };

  const [fromDay, setFromDay] = useState<number | ''>(10);
  const [toDay, setToDay] = useState<number | ''>(15);

  const handlePreview = async (
    sheetOverride?: string,
    customFrom?: string,
    customTo?: string,
    customMode?: 'all' | 'range' | 'single',
    customFromDay?: number,
    customToDay?: number
  ) => {
    if (!file) {
      showToast('Please select an Excel or CSV file first', 'error');
      return;
    }
    setPreviewing(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', importType);
    if (sheetOverride !== undefined) {
      fd.append('sheet_name', sheetOverride);
    } else if (selectedSheet) {
      fd.append('sheet_name', selectedSheet);
    }

    const mode = customMode !== undefined ? customMode : dateFilterMode;
    const fDate = customFrom !== undefined ? customFrom : fromDate;
    const tDate = customTo !== undefined ? customTo : toDate;

    if (mode === 'range') {
      fd.append('filter_by_date', 'true');
      if (fDate) fd.append('from_date', fDate);
      if (tDate) fd.append('to_date', tDate);
      if (customFromDay !== undefined) {
        fd.append('from_day', String(customFromDay));
      } else if (fromDay !== '') {
        fd.append('from_day', String(fromDay));
      }
      if (customToDay !== undefined) {
        fd.append('to_day', String(customToDay));
      } else if (toDay !== '') {
        fd.append('to_day', String(toDay));
      }
    } else if (mode === 'single') {
      fd.append('filter_by_date', 'true');
      const sDate = customFrom !== undefined ? customFrom : singleDate;
      if (sDate) {
        fd.append('from_date', sDate);
        fd.append('to_date', sDate);
        const d = parseInt(sDate.slice(8, 10), 10);
        if (!isNaN(d)) {
          fd.append('from_day', String(d));
          fd.append('to_day', String(d));
        }
      }
    }

    try {
      const res = await api.post('/imports/preview', fd);
      setPreview(res.data);
      if (res.data.selected_sheet && !selectedSheet) {
        setSelectedSheet(res.data.selected_sheet);
      }

      // Sync date fields with actual detected sheet dates
      if (res.data.date_filter?.from_date) {
        setFromDate(res.data.date_filter.from_date);
        const fdNum = parseInt(res.data.date_filter.from_date.slice(8, 10), 10);
        if (!isNaN(fdNum)) setFromDay(fdNum);
      } else if (res.data.date_filter?.min_date && !fromDate && customFrom === undefined) {
        setFromDate(res.data.date_filter.min_date);
      }

      if (res.data.date_filter?.to_date) {
        setToDate(res.data.date_filter.to_date);
        const tdNum = parseInt(res.data.date_filter.to_date.slice(8, 10), 10);
        if (!isNaN(tdNum)) setToDay(tdNum);
      } else if (res.data.date_filter?.max_date && !toDate && customTo === undefined) {
        setToDate(res.data.date_filter.max_date);
      }

      if (res.data.date_filter?.min_date && !singleDate && customFrom === undefined) {
        setSingleDate(res.data.date_filter.min_date);
      }

      setResult(null);
      const isFiltered = res.data.date_filter?.active && res.data.filtered_rows !== res.data.total_rows;
      const countMsg = isFiltered
        ? `${res.data.filtered_rows} matching rows in date range (out of ${res.data.total_rows} total)`
        : `${res.data.total_rows} rows found`;
      showToast(`${countMsg} in sheet "${res.data.selected_sheet || 'Sheet 1'}"`, 'info');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to preview file', 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    setFromDate('');
    setToDate('');
    setSingleDate('');
    setFromDay(10);
    setToDay(15);
    setDateFilterMode('all');
    handlePreview(newSheet, '', '', 'all');
  };

  const handleApplyPreset = (startDay: number, endDay: number) => {
    const minD = preview?.date_filter?.min_date || '2024-10-01';
    const [y, m] = minD.split('-');
    const newFrom = `${y}-${m}-${String(startDay).padStart(2, '0')}`;
    const newTo = `${y}-${m}-${String(endDay).padStart(2, '0')}`;
    setFromDate(newFrom);
    setToDate(newTo);
    setFromDay(startDay);
    setToDay(endDay);
    setDateFilterMode('range');
    handlePreview(undefined, newFrom, newTo, 'range', startDay, endDay);
  };

  const handleApplySingleDate = (d: string) => {
    setSingleDate(d);
    setDateFilterMode('single');
    handlePreview(undefined, d, d, 'single');
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', importType);
    fd.append('skip_duplicates', skipDupes ? 'true' : 'false');
    if (selectedSheet) {
      fd.append('sheet_name', selectedSheet);
    }

    if (dateFilterMode === 'range') {
      fd.append('filter_by_date', 'true');
      if (fromDate) fd.append('from_date', fromDate);
      if (toDate) fd.append('to_date', toDate);
      if (fromDay !== '') {
        fd.append('from_day', String(fromDay));
      } else if (fromDate) {
        const d = parseInt(fromDate.slice(8, 10), 10);
        if (!isNaN(d)) fd.append('from_day', String(d));
      }
      if (toDay !== '') {
        fd.append('to_day', String(toDay));
      } else if (toDate) {
        const d = parseInt(toDate.slice(8, 10), 10);
        if (!isNaN(d)) fd.append('to_day', String(d));
      }
    } else if (dateFilterMode === 'single') {
      fd.append('filter_by_date', 'true');
      if (singleDate) {
        fd.append('from_date', singleDate);
        fd.append('to_date', singleDate);
        const d = parseInt(singleDate.slice(8, 10), 10);
        if (!isNaN(d)) {
          fd.append('from_day', String(d));
          fd.append('to_day', String(d));
        }
      }
    }

    try {
      const res = await api.post('/imports/execute', fd);
      setResult(res.data);
      setPreview(null);
      showToast(res.data.message || 'Import completed successfully!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Import failed to execute', 'error');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setSelectedSheet('');
    setDateFilterMode('all');
    setFromDate('');
    setToDate('');
    setSingleDate('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 px-4 sm:px-8 pb-16 max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[10px] font-label font-bold uppercase tracking-[0.15em] text-primary">Data Management & Migration</span>
          <h1 className="text-3xl sm:text-4xl font-headline font-black text-on-surface tracking-tight">Excel Data Import</h1>
          <p className="text-xs sm:text-sm text-on-surface-muted mt-1">
            Easily upload your customer working sheets. Auto-creates customers, vehicles, orders, accessories, and pending payment ledger entries.
          </p>
        </div>
      </div>

      {/* Import Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {IMPORT_TYPES.map(t => {
          const isSelected = importType === t.value;
          return (
            <motion.button
              key={t.value}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => { setImportType(t.value); reset(); }}
              className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between ${
                isSelected
                  ? 'border-purple-600 bg-purple-50/50 shadow-md ring-2 ring-purple-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
              }`}
            >
              {t.badge && (
                <span className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-wider bg-purple-600 text-white px-2 py-0.5 rounded-full shadow-sm">
                  {t.badge}
                </span>
              )}
              <div className="space-y-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  isSelected ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                }`}>
                  <span className="material-symbols-outlined text-2xl">{t.icon}</span>
                </div>
                <div>
                  <p className="font-headline font-bold text-slate-900 text-sm">{t.label}</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t.desc}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-bold">
                <span className={isSelected ? 'text-purple-700' : 'text-slate-400'}>
                  {isSelected ? '✓ Selected Mode' : 'Click to select'}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Upload Box */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-6">
        <div className="border-2 border-dashed border-purple-200 bg-purple-50/20 rounded-2xl p-8 sm:p-12 text-center hover:border-purple-400 hover:bg-purple-50/40 transition-all">
          <div className="w-16 h-16 bg-purple-100 text-purple-700 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-inner">
            <span className="material-symbols-outlined text-3xl">upload_file</span>
          </div>
          <h2 className="font-headline font-black text-slate-900 text-lg sm:text-xl mb-1">
            Upload {IMPORT_TYPES.find(t => t.value === importType)?.label} Spreadsheet
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            Upload your Excel file (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-purple-700">.xlsx</code>, <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-purple-700">.xls</code>, or <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-purple-700">.csv</code> up to 25MB).
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
            id="import-excel-file"
          />

          <div className="flex flex-wrap items-center justify-center gap-3">
            <label
              htmlFor="import-excel-file"
              className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs sm:text-sm py-2.5 px-6 rounded-xl cursor-pointer inline-flex items-center gap-2 shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-base">attach_file</span>
              {file ? 'Change Selected File' : 'Choose Excel / CSV File'}
            </label>

            {file && (
              <button
                type="button"
                onClick={reset}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {file && (
            <div className="mt-4 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-lg text-emerald-800 text-xs font-bold">
              <span className="material-symbols-outlined text-sm">task_alt</span>
              <span>Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </div>

        {/* Working sheet expected format guide */}
        {importType === 'working_sheet' && (
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <span className="material-symbols-outlined text-sm text-purple-700">info</span>
              <span>Supported Working Sheet Columns:</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Your sheet can have columns: <strong className="text-slate-900 font-semibold">Date, Name of Customer, Mobile No., Address, Car Name, Car Reg. No., Service Type, Amount, Remarks</strong>.
              Rows with remarks containing <em>"Pending"</em> are automatically tracked under <strong>Pending Payments</strong>. Other rows are logged as <strong>Paid</strong> with cash ledger entries. Accessories (like matting, mud flaps, perfume) are also auto-recorded!
            </p>
          </div>
        )}

        {/* Action Controls */}
        {file && !result && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <label className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={skipDupes}
                onChange={e => setSkipDupes(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span>Skip duplicate records if already in system</span>
            </label>

            <button
              onClick={() => handlePreview()}
              disabled={previewing}
              className="bg-purple-700 hover:bg-purple-800 disabled:opacity-60 text-white font-bold text-xs sm:text-sm py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {previewing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-base">visibility</span>
              )}
              <span>{previewing ? 'Reading Sheet…' : 'Preview & Verify Data'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Preview Section */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden space-y-0"
          >
            {/* Header with Sheet Selector */}
            <div className="p-6 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-700">table_view</span>
                  <h3 className="font-headline font-bold text-slate-900 text-base sm:text-lg">
                    Data Preview: {preview.file_name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {preview.preview?.length || 0} rows out of{' '}
                  <strong className="text-slate-800 font-bold">
                    {preview.filtered_rows !== undefined ? preview.filtered_rows : preview.total_rows} matching records
                  </strong>
                  {preview.filtered_rows !== undefined && preview.filtered_rows !== preview.total_rows && (
                    <span> (filtered from {preview.total_rows} total rows in sheet)</span>
                  )}
                </p>
              </div>

              {/* Sheet selector if multiple sheets */}
              <div className="flex flex-wrap items-center gap-3">
                {preview.sheet_names && preview.sheet_names.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-600">Select Sheet / Month:</label>
                    <select
                      value={selectedSheet}
                      onChange={e => handleSheetChange(e.target.value)}
                      className="text-xs border border-purple-200 rounded-lg px-2.5 py-1.5 bg-white font-bold text-purple-900 focus:ring-2 focus:ring-purple-500"
                    >
                      {preview.sheet_names.map((sn: string) => (
                        <option key={sn} value={sn}>{sn}</option>
                      ))}
                      <option value="all">⚡ All Sheets ({preview.sheet_names.length} months)</option>
                    </select>
                  </div>
                )}

                <button
                  onClick={reset}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2 px-3.5 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  onClick={handleImport}
                  disabled={importing || (preview.filtered_rows !== undefined && preview.filtered_rows === 0)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm py-2 px-5 rounded-lg shadow-sm disabled:opacity-60 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {importing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-base">cloud_upload</span>
                  )}
                  <span>
                    {importing 
                      ? 'Importing Rows…' 
                      : (dateFilterMode !== 'all' && preview.filtered_rows !== undefined)
                        ? `Import ${preview.filtered_rows} Records (${dateFilterMode === 'range' ? `${fromDate || 'Start'} to ${toDate || 'End'}` : singleDate})`
                        : `Start Import (${preview.total_rows} Records)`}
                  </span>
                </button>
              </div>
            </div>

            {/* ═══ Date-wise Upload Filter Section ═══ */}
            {importType === 'working_sheet' && preview.date_filter && (
              <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-amber-50/50 border-b border-purple-100 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <span className="material-symbols-outlined text-xl">calendar_month</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-headline font-bold text-slate-900 text-sm">
                          Date-Wise Upload Filter
                        </h4>
                        <span className="text-[10px] bg-purple-100 text-purple-900 font-extrabold px-2 py-0.5 rounded-full border border-purple-200">
                          Specific Dates Only
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {preview.date_filter.min_date && preview.date_filter.max_date ? (
                          <>File has dates from <strong className="text-slate-800 font-mono">{preview.date_filter.min_date}</strong> to <strong className="text-slate-800 font-mono">{preview.date_filter.max_date}</strong> ({preview.total_rows} total rows)</>
                        ) : 'Select a custom date range to upload only specific days from this sheet'}
                      </p>
                    </div>
                  </div>

                  {/* Mode switcher */}
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-2xs self-start lg:self-auto text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilterMode('all');
                        handlePreview(undefined, '', '', 'all');
                      }}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        dateFilterMode === 'all'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Dates ({preview.total_rows})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilterMode('range');
                        const f = fromDate || preview.date_filter.min_date || '';
                        const t = toDate || preview.date_filter.max_date || '';
                        setFromDate(f);
                        setToDate(t);
                        handlePreview(undefined, f, t, 'range');
                      }}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                        dateFilterMode === 'range'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">date_range</span>
                      <span>Date Range (e.g. 10 to 15)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilterMode('single');
                        const s = singleDate || preview.date_filter.min_date || '';
                        setSingleDate(s);
                        handlePreview(undefined, s, s, 'single');
                      }}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                        dateFilterMode === 'single'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">event</span>
                      <span>Single Day</span>
                    </button>
                  </div>
                </div>

                {/* Range inputs & quick presets */}
                {dateFilterMode === 'range' && (
                  <div className="bg-white rounded-xl p-3.5 border border-purple-100 shadow-2xs space-y-3">
                    {/* Day-of-month and Full Date pickers */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* 1. Direct Day Range (10 to 15) */}
                      <div className="flex items-center gap-1.5 bg-amber-50/80 border border-amber-200/80 rounded-lg px-2.5 py-1">
                        <span className="text-xs font-bold text-amber-950 whitespace-nowrap flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-amber-600">numbers</span>
                          Days:
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          placeholder="From"
                          value={fromDay}
                          onChange={e => {
                            const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                            setFromDay(val);
                            if (val !== '' && preview?.date_filter?.min_date) {
                              const [y, m] = preview.date_filter.min_date.split('-');
                              setFromDate(`${y}-${m}-${String(val).padStart(2, '0')}`);
                            }
                          }}
                          className="w-14 text-xs text-center border border-amber-300 rounded bg-white font-mono font-bold text-slate-900 py-1 focus:ring-1 focus:ring-amber-500"
                        />
                        <span className="text-xs font-bold text-amber-800">to</span>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          placeholder="To"
                          value={toDay}
                          onChange={e => {
                            const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                            setToDay(val);
                            if (val !== '' && preview?.date_filter?.min_date) {
                              const [y, m] = preview.date_filter.min_date.split('-');
                              setToDate(`${y}-${m}-${String(val).padStart(2, '0')}`);
                            }
                          }}
                          className="w-14 text-xs text-center border border-amber-300 rounded bg-white font-mono font-bold text-slate-900 py-1 focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const fdNum = fromDay !== '' ? fromDay : 1;
                            const tdNum = toDay !== '' ? toDay : 31;
                            handleApplyPreset(fdNum, tdNum);
                          }}
                          disabled={previewing}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] py-1 px-2.5 rounded shadow-2xs transition-all cursor-pointer ml-1"
                        >
                          Filter Days
                        </button>
                      </div>

                      <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                      {/* 2. Calendar Date Pickers */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-700 whitespace-nowrap">From:</label>
                        <input
                          type="date"
                          value={fromDate}
                          onChange={e => {
                            setFromDate(e.target.value);
                            const d = parseInt(e.target.value.slice(8, 10), 10);
                            if (!isNaN(d)) setFromDay(d);
                          }}
                          className="text-xs border border-purple-200 rounded-lg px-2.5 py-1.5 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 shadow-2xs"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-700 whitespace-nowrap">To:</label>
                        <input
                          type="date"
                          value={toDate}
                          onChange={e => {
                            setToDate(e.target.value);
                            const d = parseInt(e.target.value.slice(8, 10), 10);
                            if (!isNaN(d)) setToDay(d);
                          }}
                          className="text-xs border border-purple-200 rounded-lg px-2.5 py-1.5 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 shadow-2xs"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePreview(undefined, fromDate, toDate, 'range', fromDay !== '' ? fromDay : undefined, toDay !== '' ? toDay : undefined)}
                        disabled={previewing}
                        className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs py-1.5 px-4 rounded-lg shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">filter_alt</span>
                        <span>{previewing ? 'Filtering...' : 'Apply Date Filter'}</span>
                      </button>
                    </div>

                    {/* Quick Presets based on file month */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-purple-50">
                      <span className="text-[11px] font-bold text-purple-900 mr-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">bolt</span>
                        Quick Presets:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(10, 15)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                      >
                        <span>⭐</span>
                        <span>10th to 15th</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(1, 10)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200 transition-all cursor-pointer"
                      >
                        1st to 10th
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(16, 20)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200 transition-all cursor-pointer"
                      >
                        16th to 20th
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(21, 31)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200 transition-all cursor-pointer"
                      >
                        21st to End of Month
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const minD = preview?.date_filter?.min_date || '';
                          const maxD = preview?.date_filter?.max_date || '';
                          setFromDate(minD);
                          setToDate(maxD);
                          setFromDay(1);
                          setToDay(31);
                          handlePreview(undefined, minD, maxD, 'range', 1, 31);
                        }}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 transition-all cursor-pointer"
                      >
                        Full Range
                      </button>
                    </div>

                    {/* All detected days breakdown pills */}
                    {preview.date_filter.unique_dates && preview.date_filter.unique_dates.length > 0 && (
                      <div className="pt-2 border-t border-purple-50">
                        <div className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-purple-600">calendar_view_day</span>
                          <span>Click any day to filter to that date:</span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                          {preview.date_filter.unique_dates.map((dStr: string) => {
                            const count = preview.date_filter.dates_breakdown?.[dStr] || 0;
                            const isSelected = fromDate === dStr && toDate === dStr;
                            const dayNum = parseInt(dStr.slice(8), 10);
                            const inRange = fromDay !== '' && toDay !== '' && dayNum >= Math.min(fromDay, toDay) && dayNum <= Math.max(fromDay, toDay);
                            return (
                              <button
                                key={dStr}
                                type="button"
                                onClick={() => {
                                  setFromDate(dStr);
                                  setToDate(dStr);
                                  setFromDay(dayNum);
                                  setToDay(dayNum);
                                  handlePreview(undefined, dStr, dStr, 'range', dayNum, dayNum);
                                }}
                                className={`px-2 py-0.5 rounded text-xs font-mono font-bold border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-purple-700 text-white border-purple-700 shadow-xs scale-105'
                                    : inRange
                                    ? 'bg-amber-100 text-amber-950 border-amber-300'
                                    : 'bg-white hover:bg-purple-50 text-slate-700 border-slate-200'
                                }`}
                              >
                                {dayNum}th ({count})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Filter Status Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pt-1 gap-2">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                        <span>
                          Filtered rows: <strong className="text-emerald-700 font-bold">{preview.filtered_rows || 0}</strong> out of <strong className="text-slate-700">{preview.total_rows}</strong> total records in sheet
                        </span>
                      </div>
                      {preview.filtered_rows !== undefined && preview.filtered_rows < preview.total_rows && (
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md self-start sm:self-auto">
                          {preview.total_rows - preview.filtered_rows} rows outside date range will be skipped
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Single Date Selection */}
                {dateFilterMode === 'single' && (
                  <div className="bg-white rounded-xl p-3.5 border border-purple-100 shadow-2xs space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Choose Date:</label>
                        <input
                          type="date"
                          value={singleDate}
                          onChange={e => setSingleDate(e.target.value)}
                          className="text-xs border border-purple-200 rounded-lg px-2.5 py-1.5 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 shadow-2xs"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplySingleDate(singleDate)}
                        disabled={previewing}
                        className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs py-1.5 px-4 rounded-lg shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">filter_alt</span>
                        <span>{previewing ? 'Filtering...' : 'Apply Date'}</span>
                      </button>
                    </div>

                    {/* Dropdown of detected dates */}
                    {preview.date_filter.unique_dates && preview.date_filter.unique_dates.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-purple-50">
                        <span className="text-[11px] font-bold text-purple-900 mr-1">Or pick detected day:</span>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                          {preview.date_filter.unique_dates.map((dStr: string) => {
                            const count = preview.date_filter.dates_breakdown?.[dStr] || 0;
                            const isCur = singleDate === dStr;
                            return (
                              <button
                                key={dStr}
                                type="button"
                                onClick={() => handleApplySingleDate(dStr)}
                                className={`px-2 py-0.5 rounded text-xs font-mono font-bold border transition-all cursor-pointer ${
                                  isCur
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                    : 'bg-white hover:bg-purple-50 text-slate-700 border-slate-200'
                                }`}
                              >
                                {dStr.slice(8)} ({count})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium pt-0.5">
                      <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                      <span>
                        Matching rows for {singleDate}: <strong className="text-emerald-700 font-bold">{preview.filtered_rows || 0}</strong> out of {preview.total_rows} total rows
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Preview Table */}
            <div className="overflow-x-auto max-h-[460px]">
              <table className="data-table min-w-[850px] w-full text-left">
                <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-600 font-bold">
                    {importType === 'working_sheet' ? (
                      <>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Customer</th>
                        <th className="px-4 py-2.5">Mobile</th>
                        <th className="px-4 py-2.5">Car & Reg No</th>
                        <th className="px-4 py-2.5">Service Type</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5">Status</th>
                      </>
                    ) : (
                      preview.file_columns?.map((c: string) => (
                        <th key={c} className="px-4 py-2.5">{c}</th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {preview.preview?.map((r: any, idx: number) => {
                    if (importType === 'working_sheet') {
                      const isPending = r._parsed_status === 'Pending Payment';
                      return (
                        <tr key={idx} className="hover:bg-purple-50/30 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-slate-600">{r._parsed_date || '—'}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-800">{r._parsed_customer || 'Walk-in'}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-500">{r._parsed_mobile || '—'}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-700">{r._parsed_car || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-700">{r._parsed_service || '—'}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900 font-mono">
                            {formatCurrency(parseFloat(String(r._parsed_amount || 0)))}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {r._parsed_category}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPending
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {r._parsed_status}
                            </span>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        {preview.file_columns?.map((c: string) => (
                          <td key={c} className="px-4 py-2 text-slate-700">
                            {String(r[c] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Stats */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-2xl shadow-md border border-emerald-200 p-6 sm:p-8 space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <div>
                <h3 className="font-headline font-black text-slate-900 text-lg sm:text-xl">
                  {result.message}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Database import has finished processing your records.
                </p>
              </div>
            </div>

            {/* Date filter applied summary banner */}
            {result.date_filter?.active && (
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-purple-900 font-medium">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-purple-700">calendar_month</span>
                  <span>
                    <strong>Date Filter Applied:</strong> Imported records between{' '}
                    <strong className="font-mono bg-purple-100 text-purple-900 px-2 py-0.5 rounded border border-purple-200 font-bold">
                      {result.date_filter.from_date && result.date_filter.to_date
                        ? `${result.date_filter.from_date} to ${result.date_filter.to_date}`
                        : (result.date_filter.from_date || result.date_filter.to_date)}
                    </strong>
                  </span>
                </div>
                {result.skipped_date_filter !== undefined && result.skipped_date_filter > 0 && (
                  <span className="text-[11px] bg-white border border-purple-200 text-purple-800 font-bold px-2.5 py-1 rounded-full self-start sm:self-auto">
                    {result.skipped_date_filter} records outside range were safely skipped
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              <div className="p-4 bg-emerald-50 rounded-xl text-center border border-emerald-100">
                <p className="text-2xl font-black text-emerald-700 font-headline">{result.imported || 0}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Total Processed</p>
              </div>

              {result.job_cards_created !== undefined && (
                <div className="p-4 bg-purple-50 rounded-xl text-center border border-purple-100">
                  <p className="text-2xl font-black text-purple-700 font-headline">{result.job_cards_created}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Orders Created</p>
                </div>
              )}

              {result.paid_payments_count !== undefined && (
                <div className="p-4 bg-sky-50 rounded-xl text-center border border-sky-100">
                  <p className="text-2xl font-black text-sky-700 font-headline">{result.paid_payments_count}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Settled / Paid</p>
                </div>
              )}

              {result.pending_payments_count !== undefined && (
                <div className="p-4 bg-amber-50 rounded-xl text-center border border-amber-100">
                  <p className="text-2xl font-black text-amber-700 font-headline">{result.pending_payments_count}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Pending Balance</p>
                </div>
              )}

              {result.accessories_created !== undefined && (
                <div className="p-4 bg-fuchsia-50 rounded-xl text-center border border-fuchsia-100">
                  <p className="text-2xl font-black text-fuchsia-700 font-headline">{result.accessories_created}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Accessories</p>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-200">
                <p className="text-2xl font-black text-slate-600 font-headline">{result.skipped || 0}</p>
                <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Skipped Dupes</p>
              </div>

              {result.date_filter?.active && result.skipped_date_filter !== undefined && (
                <div className="p-4 bg-stone-50 rounded-xl text-center border border-stone-200">
                  <p className="text-2xl font-black text-stone-600 font-headline">{result.skipped_date_filter}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Outside Date Range</p>
                </div>
              )}
            </div>

            {/* Actions after import */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href="/job-cards"
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs py-2.5 px-5 rounded-xl inline-flex items-center gap-2 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-sm">assignment</span>
                <span>View Detailing Studio</span>
              </a>

              <a
                href="/payment-pending"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl inline-flex items-center gap-2 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-sm">pending_actions</span>
                <span>View Pending Payments</span>
              </a>

              <a
                href="/product-sell"
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 px-5 rounded-xl inline-flex items-center gap-2 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-sm">shopping_bag</span>
                <span>View Accessories Sales</span>
              </a>

              <button
                onClick={reset}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl transition-colors ml-auto"
              >
                Import Another File
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatedPage>
  );
}
