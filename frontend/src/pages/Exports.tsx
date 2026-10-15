import { useState } from 'react';
import api from '../api/axios';
import { downloadFile } from '../utils/download';
import AnimatedPage from '../components/shared/AnimatedPage';
import { showToast } from '../components/shared/Toast';

export default function Exports() {
  const today = new Date().toISOString().slice(0, 10);
  const [jcFrom, setJcFrom] = useState(today);
  const [jcTo, setJcTo] = useState(today);
  const [attMonth, setAttMonth] = useState(String(new Date().getMonth() + 1));
  const [attYear, setAttYear] = useState(String(new Date().getFullYear()));
  const [accFrom, setAccFrom] = useState(today);
  const [accTo, setAccTo] = useState(today);
  const [dl, setDl] = useState<Record<string, boolean>>({});

  const handleDl = async (key: string, url: string, filename: string, params?: object) => {
    setDl(d => ({ ...d, [key]: true }));
    try {
      await downloadFile(api, url, filename, params);
      showToast(`${filename} generated successfully`, 'success');
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.error || 'Export engine failed to process request';
      showToast(msg, 'error');
    }
    finally { setDl(d => ({ ...d, [key]: false })); }
  };

  const exportCards = [
    {
      key: 'db_sql',
      icon: 'database',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-600',
      borderColor: 'border-l-purple-600',
      title: 'Full SQL Database Backup',
      desc: 'Download complete SQL database dump (.sql file) of all tables, schema, job cards, customer records, and inventory for safety and offline restore.',
      fields: (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-[10px] font-bold text-purple-800 uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-xs">verified_user</span>
            Full System Snapshot — Non-destructive pure SQL backup script.
          </p>
        </div>
      ),
      btnClass: 'border-purple-200 text-purple-700 hover:bg-purple-50',
      onClick: () => handleDl('db_sql', '/exports/sql-backup', `HAPPYGMS_Full_Database_Backup_${today}.sql`),
      btnLabel: 'Download SQL Backup',
      loadingLabel: 'Dumping DB...',
    },
    {
      key: 'jc',
      icon: 'assignment',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      borderColor: 'border-l-primary',
      title: 'Job Card Ledger',
      desc: 'Export raw job records, statuses, and billed final amounts across a specified operating window.',
      fields: (
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">From Date</label>
            <input type="date" value={jcFrom} onChange={e => setJcFrom(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">To Date</label>
            <input type="date" value={jcTo} onChange={e => setJcTo(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer" />
          </div>
        </div>
      ),
      btnClass: 'border-primary/20 text-primary hover:bg-primary/5',
      onClick: () => handleDl('jc', '/exports/job-cards', 'HAPPYGMS_JobCards.xlsx', { from: jcFrom, to: jcTo }),
      btnLabel: 'Export Job Registry',
      loadingLabel: 'Compiling...',
    },

    {
      key: 'att',
      icon: 'group',
      iconBg: 'bg-secondary/10',
      iconColor: 'text-slate-600',
      borderColor: 'border-l-secondary',
      title: 'Staff & Attendance Audit',
      desc: 'Fetch monthly compilation of daily presence matrix and foundational staff parameters.',
      fields: (
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Fiscal Month</label>
            <select value={attMonth} onChange={e => setAttMonth(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('en-US', { month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Year</label>
            <input type="number" value={attYear} onChange={e => setAttYear(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
        </div>
      ),
      btnClass: 'border-secondary/20 text-slate-600 hover:bg-secondary/5',
      onClick: () => handleDl('att', '/exports/staff-attendance', 'HAPPYGMS_StaffAttendance.xlsx', { month: attMonth, year: attYear }),
      btnLabel: 'Export Matrix',
      loadingLabel: 'Compiling...',
    },
    {
      key: 'parts',
      icon: 'inventory_2',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
      borderColor: 'border-l-emerald-500',
      title: 'Inventory Snapshot',
      desc: 'Download current master state of the parts database, including margins, thresholds, and active counts.',
      fields: (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-xs">info</span>
            Context-Free — No scoping required. Generates absolute snapshot.
          </p>
        </div>
      ),
      btnClass: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
      onClick: () => handleDl('parts', '/exports/parts-inventory', 'HAPPYGMS_PartsInventory.xlsx'),
      btnLabel: 'Export Ledger State',
      loadingLabel: 'Compiling...',
    },
    {
      key: 'acc',
      icon: 'receipt_long',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
      borderColor: 'border-l-amber-500',
      title: 'Income & Expense Node',
      desc: 'Compile deep transactional history spanning manual entries, salaries, part sales, and services.',
      fields: (
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">From Date</label>
            <input type="date" value={accFrom} onChange={e => setAccFrom(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">To Date</label>
            <input type="date" value={accTo} onChange={e => setAccTo(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer" />
          </div>
        </div>
      ),
      btnClass: 'border-amber-200 text-amber-700 hover:bg-amber-50',
      onClick: () => handleDl('acc', '/exports/accounts', 'HAPPYGMS_Accounts.xlsx', { from: accFrom, to: accTo }),
      btnLabel: 'Export Transaction Ring',
      loadingLabel: 'Compiling...',
    },
  ];

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 p-4 sm:p-8 space-y-8 max-w-[1200px] mx-auto">
      {/* Page Header */}
      <header>
        <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface">System Exports</h2>
        <p className="text-on-surface-variant font-medium max-w-2xl mt-2">
          Compile native system data into Excel spreadsheets for compliance, offline audits, or third-party legacy integrations. Select filters per module.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {exportCards.map((card) => (
          <div
            key={card.key}
            className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col gap-5 hover:shadow-md transition-all relative overflow-hidden group border-l-4 ${card.borderColor}`}
          >
            {/* Card Header */}
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 ${card.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
                <span className={`material-symbols-outlined ${card.iconColor} text-[24px]`}>{card.icon}</span>
              </div>
              <div>
                <h3 className="text-xl font-bold font-headline text-on-surface tracking-tight mb-1">{card.title}</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">{card.desc}</p>
              </div>
            </div>

            {/* Card Fields */}
            <div className="mt-auto">
              {card.fields}
            </div>

            {/* Export Button */}
            <button
              className={`w-full bg-white border-2 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 ${card.btnClass}`}
              disabled={dl[card.key]}
              onClick={card.onClick}
            >
              <span className="material-symbols-outlined text-sm">file_download</span>
              {dl[card.key] ? card.loadingLabel : card.btnLabel}
            </button>
          </div>
        ))}
      </div>
    </AnimatedPage>
  );
}

