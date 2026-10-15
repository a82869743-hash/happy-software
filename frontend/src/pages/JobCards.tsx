import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import AnimatedPage from '../components/shared/AnimatedPage';
import StatusBadge from '../components/shared/StatusBadge';
import { SkeletonTable } from '../components/shared/Skeleton';
import QuickJobCardModal from '../components/QuickJobCardModal';
import AccessorySaleModal from '../components/AccessorySaleModal';
import TrackingLinkModal from '../components/TrackingLinkModal';
import { formatNumber } from '../utils/format';
import { showToast } from '../components/shared/Toast';
interface JobCard {
  id: number;
  job_no: string;
  rfe_no: string;
  reg_no: string;
  car_name: string;
  owner_name: string;
  mobile_no: string;
  cust_name: string;
  cust_mobile: string;
  service_type: string;
  status: string;
  job_date: string;
  final_amount: number | null;
  assigned_staff_name: string;
  invoice_no: string | null;
  is_quick_job: number;
  vehicle_make: string;
  vehicle_model: string;
  subtotal: number;
  company?: string;
  // Expanded fields
  insurance_company?: string;
  claim_no?: string;
  estimated_delivery?: string;
  delivery_date?: string;
  accident_date?: string;
  service_advisor?: string;
  approval_status?: string;
  approval_date?: string;
  parts_excl_tax?: number;
  labour_excl_tax?: number;
  parts_order_count?: number;
  parts_inward_count?: number;
  parts_issue_count?: number;
  parts_pending?: number;
  parts_approved?: number;
  parts_rejected?: number;
}



function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateUpper(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

function maskMobile(m: string | null | undefined) {
  if (!m) return '—';
  return `******${m.slice(-4)}`;
}

// --- Accordion Row ----------------------------------------------------------

function JobCardAccordionRow({ job, navigate, onDelete }: { job: JobCard; navigate: ReturnType<typeof useNavigate>; onDelete: (id: number, jobNo: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const arrivalTime = job.job_date
    ? new Date(job.job_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '—';

  return (
    <>
      {/* COLLAPSED ROW */}
      <motion.tr
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="cursor-pointer group border-b border-gray-50 transition-colors hover:bg-primary-50/20"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-3.5">
          <button
            className={`w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center transition-all ${
              expanded ? 'bg-primary text-white border-primary' : 'text-on-surface-muted hover:border-gray-400'
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {expanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </td>
        <td>
          <Link
            to={`/job-cards/${job.id}/edit`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-bold text-primary hover:underline"
          >
            {job.job_no}
          </Link>
          <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-wider border border-amber-200">
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>assignment</span>
            Detailing Studio
          </span>
        </td>
        <td><span className="text-xs font-mono text-on-surface-muted">{job.rfe_no || '—'}</span></td>
        <td>
          <span className="inline-block px-2.5 py-1 bg-primary-50 rounded-lg text-xs font-bold font-mono text-primary border border-primary/20">
            {job.reg_no}
          </span>
        </td>
        <td><span className="text-xs font-mono text-on-surface-muted">{job.invoice_no || '—'}</span></td>
        <td><span className="text-xs text-on-surface">{job.service_type || 'General'}</span></td>
        <td>
          <p className="text-sm font-semibold text-on-surface">{job.car_name}</p>
          {(job.vehicle_make || job.vehicle_model) && (
            <p className="text-[10px] text-on-surface-muted">{[job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')}</p>
          )}
        </td>
        <td><StatusBadge status={job.status} size="sm" /></td>
        <td><span className="text-sm font-medium text-on-surface">{job.cust_name || job.owner_name || '—'}</span></td>
        <td><span className="text-xs font-mono text-on-surface-muted">{maskMobile(job.cust_mobile || job.mobile_no)}</span></td>
        <td><span className="text-xs text-on-surface-muted">{formatDate(job.job_date)}</span></td>
        <td className="px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-2">
            <Link
              to={`/job-cards/${job.id}/edit`}
              className="p-1 hover:bg-gray-100 rounded-lg text-primary transition-colors flex items-center justify-center"
              title="Edit Job Card"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
            </Link>
            <button
              onClick={() => onDelete(job.id, job.job_no)}
              className="p-1 hover:bg-red-50 rounded-lg text-red-600 transition-colors flex items-center justify-center"
              title="Delete Job Card"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          </div>
        </td>
      </motion.tr>

      {/* EXPANDED DETAIL ROW */}
      <AnimatePresence>
        {expanded && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <td colSpan={12} className="p-0">
              <div className="bg-primary-50/20 border-t border-primary/10 px-4 sm:px-8 py-4 space-y-4">
                {/* Row 1 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-5">
                  <DetailField label="Arrival Time" value={arrivalTime} />
                  <DetailField label="Insurance / Corporate" value={job.insurance_company} />
                  <DetailField label="Claim No." value={job.claim_no} />
                  <DetailField label="Expected Delivery Date" value={formatDateUpper(job.estimated_delivery)} />
                  <DetailField label="Delivery Date" value={formatDateUpper(job.delivery_date)} />
                  <DetailField label="Accident Date" value={formatDateUpper(job.accident_date)} />
                </div>
                {/* Row 2 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-5">
                  <DetailField label="Advisor" value={job.service_advisor || job.assigned_staff_name} />
                  <DetailField label="Approval Status" value={job.approval_status} />
                  <DetailField label="Approval Date" value={formatDateUpper(job.approval_date)} />
                  <DetailField
                    label="Parts Total ₹"
                    value={formatNumber(job.parts_excl_tax, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  />
                  <DetailField
                    label="Labour Total ₹"
                    value={formatNumber(job.labour_excl_tax, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  />
                  <div>
                    <span className="block text-[10px] font-bold tracking-wider text-primary uppercase mb-0.5">
                      Parts Status
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      Order | Inward | Issue :&nbsp;
                      <strong className="text-on-surface">
                        {job.parts_order_count ?? '—'} | {job.parts_inward_count ?? '—'} | {job.parts_issue_count ?? '—'}
                      </strong>
                    </span>
                  </div>
                </div>
                {/* Row 3 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-5">
                  <div className="col-span-2">
                    <span className="block text-[10px] font-bold tracking-wider text-primary uppercase mb-0.5">
                      Part / Labour
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      Pending | Approved | Reject :&nbsp;
                      <strong className="text-on-surface">
                        {job.parts_pending ?? '—'} | {job.parts_approved ?? '—'} | {job.parts_rejected ?? '—'}
                      </strong>
                    </span>
                  </div>
                  <DetailField label="Due Amount" value="—" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/job-cards/${job.id}/edit`);
                      }}
                      className="btn-primary text-xs py-2 px-4"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      Edit Job Card
                    </button>
                </div>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="block text-[10px] font-bold tracking-wider text-primary uppercase mb-0.5">
        {label}
      </span>
      <span className="text-xs font-medium text-on-surface">{value || '—'}</span>
    </div>
  );
}

// --- Main Component ---------------------------------------------------------

export default function JobCards() {
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeStatus = searchParams.get('status') || 'all';
  const navigate = useNavigate();
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [showAccessoryModal, setShowAccessoryModal] = useState(false);
  // Detailing Studio page exclusively shows Detailing Studio records
  const [trackingData, setTrackingData] = useState<{ id: number; job_no: string; tracking_url: string; public_token: string } | null>(null);


  // Non-GST State
            const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [killSwitchConfirm, setKillSwitchConfirm] = useState(false);
  const [isKillSwitching, setIsKillSwitching] = useState(false);

  // Job Card Deletion State
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteJobNo, setDeleteJobNo] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (id: number, jobNo: string) => {
    setDeleteId(id);
    setDeleteJobNo(jobNo);
    setDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/job-cards/${deleteId}`);
      showToast(`Order ${deleteJobNo} moved to Recycle Bin`, 'success');
      fetchJobs(activeStatus, search);
      setDeleteConfirm(false);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete job card', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
      setDeleteJobNo('');
    }
  };

  const fetchJobs = async (statusFilter?: string, searchQuery?: string, monthFilter?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '500', company: 'Detailing Studio' };
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      const m = monthFilter !== undefined ? monthFilter : selectedMonth;
      if (m && m !== 'all') {
        const [yr, mo] = m.split('-');
        params.year = yr;
        params.month = String(parseInt(mo, 10));
      }
      const res = await api.get('/job-cards', { params });
      setJobs(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs(activeStatus, search, selectedMonth);
  }, [activeStatus, selectedMonth]);

  useEffect(() => {
    if (searchParams.get('quick') === 'true') {
      setShowQuickModal(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('quick');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const timer = setTimeout(() => fetchJobs(activeStatus, search), 400);
    return () => clearTimeout(timer);
  }, [search]);



  return (
    <>
    <AnimatedPage className="pt-[88px] sm:pt-24 px-4 sm:px-8 pb-12 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase font-label">Operations</p>
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline mt-1">Detailing Studio</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/job-cards/new?company=Detailing%20Studio')}
            className="btn-primary text-sm flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700"
            title="Create a standard Detailing Studio Job Card"
          >
            <span className="material-symbols-outlined text-lg">assignment</span>
            <span>+ Detailing Studio</span>
          </motion.button>
        </div>
      </div>

      {/* --- MONTH FILTER CONTROLS --- */}
      <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
        {/* Month Selector for viewing recent or old job cards by date */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">calendar_month</span> Filter by Month:
          </span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-primary/20 text-slate-700 shadow-sm cursor-pointer"
          >
            <option value="all">All Dates / All Time</option>
            <option value="2026-10">October 2026 (Recent)</option>
            <option value="2026-09">September 2026 (Imported Sheet)</option>
            <option value="2026-08">August 2026</option>
            <option value="2026-07">July 2026</option>
            <option value="2026-06">June 2026</option>
            <option value="2026-05">May 2026</option>
            <option value="2026-04">April 2026</option>
            <option value="2026-03">March 2026</option>
            <option value="2026-02">February 2026</option>
            <option value="2026-01">January 2026</option>
          </select>
        </div>
      </div>



      {/* Search */}
      <div className="search-bar max-w-lg mb-5">
        <span className="material-symbols-outlined text-on-surface-muted text-xl">search</span>
        <input
          type="text"
          placeholder="Search by name, mobile, vehicle, job no..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-on-surface placeholder:text-on-surface-muted"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-on-surface-muted hover:text-on-surface">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={12} />
      ) : (
        <div className="glass-card-solid overflow-hidden border-t-4 border-t-primary">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[900px]">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>Job No</th>
                  <th>RFE No</th>
                  <th>Registration</th>
                  <th>Invoice No</th>
                  <th>Service Type</th>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Date</th>
                  <th className="w-24 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center py-16">
                        <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">inventory_2</span>
                        <p className="font-semibold text-on-surface-muted mb-1">No detailing records found</p>
                        <p className="text-xs text-on-surface-muted/60">Try adjusting your filters or search query</p>
                      </td>
                    </tr>
                  ) : (
                    jobs.map((j) => (
                      <JobCardAccordionRow key={j.id} job={j} navigate={navigate} onDelete={handleDeleteClick} />
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-on-surface-muted font-medium">
              Showing {jobs.length} of {total} records
            </span>
          </div>
        </div>
      )}
    </AnimatedPage>

      {/* -- Quick Job Card Modal -- */}
      {showQuickModal && (
        <QuickJobCardModal
          onClose={() => setShowQuickModal(false)}
          onCreated={(data) => {
            setShowQuickModal(false);
            showToast(`Car Wash Order ${data.job_no} created!`, 'success');
            navigate(`/job-cards/${data.id}/edit`);
          }}
        />
      )}

      {/* -- Accessory Sale Modal -- */}
      {showAccessoryModal && (
        <AccessorySaleModal
          onClose={() => setShowAccessoryModal(false)}
          onCreated={() => {
            fetchJobs(activeStatus, search);
          }}
        />
      )}

      {/* -- Tracking Link Modal -- */}
      {trackingData && (
        <TrackingLinkModal
          jobNo={trackingData.job_no}
          trackingUrl={trackingData.tracking_url}
          jobCardId={trackingData.id}
          onClose={() => setTrackingData(null)}
        />
      )}

      {/* --- KILL SWITCH CONFIRM MODAL -------------------------------- */}
      <AnimatePresence>
        {killSwitchConfirm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-card rounded-2xl shadow-2xl p-6 w-full max-w-sm border-2 border-error"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-error">warning</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-base">Delete Invoices</h3>
                  <p className="text-xs text-error font-semibold">ADMIN ONLY — IRREVERSIBLE ACTION</p>
                </div>
              </div>
              <p className="text-sm text-on-surface-muted mb-5 font-medium leading-relaxed">
                This will <strong className="text-error">permanently delete</strong> all invoice records from the database. 
                This action is logged but <strong>cannot be undone</strong>. Are you absolutely sure?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setKillSwitchConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-on-surface-muted hover:bg-surface-variant transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={isKillSwitching}
                  onClick={async () => {
                    setIsKillSwitching(true);
                    try {
                      const res = await api.delete('/job-cards/non-gst/kill-switch');
                      localStorage.setItem('estimate_delete_completed', 'true');
                      const ALL_MODULES = ['estimate_jobs', 'cash_ledger', 'daily_report', 'customer_payments', 'accounts', 'staff_ledger'];
                      ALL_MODULES.forEach(mod => {
                        localStorage.setItem(`gms_killswitch_locked_${mod}`, 'true');
                        localStorage.setItem(`gms_killswitch_clicks_${mod}`, '0');
                      });
                      window.dispatchEvent(new Event('gms_killswitch_updated'));
                      showToast(res.data.message || 'Invoice records deleted — 6 modules locked until 200 clicks', 'warning');
                      setKillSwitchConfirm(false);
                                                                                                            } catch (err: any) {
                      showToast(err?.response?.data?.error || 'Kill switch failed', 'error');
                    } finally {
                      setIsKillSwitching(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:bg-error/95 transition-all disabled:opacity-50 shadow-button"
                >
                  {isKillSwitching ? 'Deleting...' : 'Yes, Delete All'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DELETE CONFIRM MODAL -------------------------------- */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-card rounded-2xl shadow-2xl p-6 w-full max-w-sm border-2 border-red-500"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-red-600">delete</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-base">Delete Order</h3>
                  <p className="text-xs text-red-600 font-semibold font-label uppercase tracking-wider">Confirm Deletion</p>
                </div>
              </div>
              <p className="text-sm text-on-surface-muted mb-5 font-medium leading-relaxed">
                Are you sure you want to delete Order <strong className="text-red-600">{deleteJobNo}</strong>? 
                This will move it to the Recycle Bin.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-on-surface-muted hover:bg-surface-variant transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={isDeleting}
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-50 shadow-button"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

