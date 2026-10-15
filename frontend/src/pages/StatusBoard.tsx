import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import AnimatedPage, { StaggerContainer, StaggerItem } from '../components/shared/AnimatedPage';
import StatusBadge from '../components/shared/StatusBadge';
import Modal from '../components/shared/Modal';
import { showToast } from '../components/shared/Toast';
import { formatCurrency as safeFormatCurrency } from '../utils/format';

interface JobCard {
  id: number; job_no: string; rfe_no: string;
  reg_no: string; car_name: string; service_type: string;
  assigned_staff_name: string; estimated_amount: number | null;
  final_amount: number | null; status: string;
  job_date: string; closed_at: string | null;
  cust_name: string; owner_name: string; subtotal: number;
}

export default function StatusBoard() {
  const [activeJobs, setActiveJobs] = useState<JobCard[]>([]);
  const [doneJobs, setDoneJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [closeModal, setCloseModal] = useState<JobCard | null>(null);
  const [closeForm, setCloseForm] = useState({ final_amount: '', payment_mode: 'cash' });
  const [closing, setClosing] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, doneRes] = await Promise.all([
        api.get('/job-cards', { params: { status: 'active' } }),
        api.get('/job-cards', { params: { status: 'delivered', date: new Date().toISOString().slice(0, 10) } }),
      ]);
      setActiveJobs(activeRes.data.data);
      setDoneJobs(doneRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleClose = async () => {
    if (!closeModal) return;
    if (!closeForm.final_amount || parseFloat(closeForm.final_amount) <= 0) {
      showToast('Enter a valid final amount', 'error');
      return;
    }
    setClosing(true);
    try {
      await api.post(`/job-cards/${closeModal.id}/save-estimate`, {
        payment_mode: closeForm.payment_mode,
      });
      showToast(`Job ${closeModal.job_no} marked as done`, 'success');
      setCloseModal(null);
      fetchJobs();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    } finally {
      setClosing(false);
    }
  };

  const formatCurrency = (amt: number | null) => {
    if (amt === null || amt === undefined) return '—';
    return safeFormatCurrency(amt, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const renderCard = (j: JobCard, isActive: boolean) => (
    <StaggerItem key={j.id}>
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 300 }}
        className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all"
      >
        <div className={`absolute top-0 left-0 w-1.5 h-full ${isActive ? 'bg-primary' : 'bg-emerald-500'} opacity-80 group-hover:opacity-100 transition-opacity`} />

        {/* Background icon */}
        <div className="absolute right-[-10%] top-[-10%] opacity-[0.03] pointer-events-none transform rotate-12 group-hover:rotate-0 transition-transform duration-500">
           <span className="material-symbols-outlined text-[150px]">{isActive ? 'engineering' : 'task_alt'}</span>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 ml-2 relative z-10">
          <div>
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary bg-primary/5 px-2 py-0.5 rounded-md mb-2 inline-block border border-primary/10">{j.job_no}</span>
            <h3 className="text-xl font-extrabold text-on-surface font-headline tracking-tight">{j.reg_no}</h3>
            <p className="text-sm font-bold text-on-surface-variant mt-0.5">{j.car_name}</p>
          </div>
          <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end gap-2">
            <span className="text-[10px] text-on-surface-variant bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg font-mono font-bold">{formatTime(j.job_date)}</span>
            <StatusBadge status={j.status} size="sm" />
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-5 ml-2 relative z-10">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface">{j.service_type || 'General'}</span>
            <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">badge</span>
              {j.assigned_staff_name || j.cust_name || j.owner_name || 'Unassigned'}
            </span>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-on-surface-variant block text-[10px] uppercase font-bold tracking-widest mb-0.5">{isActive ? 'Estimated' : 'Final'}</span>
            <span className="font-extrabold font-mono text-lg text-primary">{formatCurrency(j.subtotal || j.final_amount)}</span>
          </div>
        </div>

        {isActive && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setCloseModal(j);
              setCloseForm({ final_amount: String(j.subtotal || j.estimated_amount || ''), payment_mode: 'cash' });
            }}
            className="w-full mt-4 ml-2 bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest relative z-10 shadow-md shadow-primary/20 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span> Mark Done
          </motion.button>
        )}
      </motion.div>
    </StaggerItem>
  );

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 p-4 sm:p-8 max-w-[1600px] mx-auto">
      <header className="mb-8">
        <p className="text-on-surface-variant text-sm font-medium">Operations Monitor</p>
        <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline mt-1">Live Status Board</h2>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }} className="material-symbols-outlined text-5xl text-primary/30 mb-4">autorenew</motion.span>
          <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest animate-pulse">Syncing pipeline data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Active */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
               <div className="flex items-center gap-3">
                 <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                   <span className="material-symbols-outlined text-2xl animate-spin-slow">autorenew</span>
                 </div>
                 <h2 className="text-2xl font-black text-on-surface font-headline uppercase tracking-tight">Active Bay</h2>
               </div>
               <div className="px-4 py-2 bg-primary text-white rounded-full font-bold text-sm shadow-sm">
                 {activeJobs.length} Live
               </div>
            </div>

            <StaggerContainer className="space-y-5">
              {activeJobs.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">deck</span>
                  <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Bay is currently clear</p>
                </div>
              ) : activeJobs.map(j => renderCard(j, true))}
            </StaggerContainer>
          </div>

          {/* Completed */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
           <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
               <div className="flex items-center gap-3">
                 <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                   <span className="material-symbols-outlined text-2xl">task_alt</span>
                 </div>
                 <h2 className="text-2xl font-black text-on-surface font-headline uppercase tracking-tight">Completed</h2>
               </div>
               <div className="px-4 py-2 bg-emerald-500 text-white rounded-full font-bold text-sm shadow-sm">
                 {doneJobs.length} Today
               </div>
            </div>
            <StaggerContainer className="space-y-5">
              {doneJobs.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">receipt_long</span>
                  <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">No completions yet today</p>
                </div>
              ) : doneJobs.map(j => renderCard(j, false))}
            </StaggerContainer>
          </div>
        </div>
      )}

      {closeModal && (
        <Modal title={`Close Job: ${closeModal.job_no}`} onClose={() => setCloseModal(null)}>
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 flex items-start gap-3">
              <span className="material-symbols-outlined text-sm">warning</span>
              <span className="leading-relaxed">This action is final — the job will be permanently marked as <strong>Delivered</strong>.</span>
            </div>
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Final Amount (₹)</label>
              <input type="number" value={closeForm.final_amount}
                onChange={(e) => setCloseForm({ ...closeForm, final_amount: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" min="1" autoFocus />
            </div>
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Payment Mode</label>
              <select value={closeForm.payment_mode}
                onChange={(e) => setCloseForm({ ...closeForm, payment_mode: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold transition-all">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="pending">Payment Pending</option>
                <option value="manual_settlement">Manual Settlement</option>
              </select>
            </div>
            <motion.button whileTap={{ scale: 0.97 }}
              className="w-full bg-primary hover:bg-primary/90 text-white py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/20 disabled:opacity-50 active:scale-[0.98]"
              onClick={handleClose} disabled={closing}>
              {closing ? 'Processing...' : 'Confirm Closure'}
            </motion.button>
          </div>
        </Modal>
      )}
    </AnimatedPage>
  );
}
