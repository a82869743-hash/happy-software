import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import AnimatedPage from '../components/shared/AnimatedPage';
import StatusBadge from '../components/shared/StatusBadge';
import QuickJobCardModal from '../components/QuickJobCardModal';
import AccessorySaleModal from '../components/AccessorySaleModal';
import { showToast } from '../components/shared/Toast';
import Modal from '../components/shared/Modal';

interface PipelineMetric {
  count: number;
  value: number;
}

interface DashboardData {
  pipeline: {
    rfe?: PipelineMetric;
    estimation: PipelineMetric;
    spares_pending?: PipelineMetric;
    wip: PipelineMetric;
    ready: PipelineMetric;
    standard_job_cards?: PipelineMetric;
    quick_job_cards?: PipelineMetric;
  };
  active_jobs: number;
  completed_jobs: number;
  today_revenue: number;
  invoice_revenue: number;
  estimate_revenue: number;
  invoices_today: number;
  estimates_today: number;
  cash_balance: number;
  staff_present: number;
  total_staff: number;
  total_outstanding?: number;
  payments_today?: number;
  date: string;
}

interface JobRow {
  id: number;
  rfe_no: string;
  job_no: string;
  reg_no: string;
  invoice_no: string | null;
  service_type: string;
  car_name: string;
  status: string;
  cust_name: string;
  cust_mobile: string;
  owner_name: string;
  mobile_no: string;
  job_date: string;
  vehicle_make: string;
  vehicle_model: string;
}

interface StaffMember {
  id: number;
  full_name: string;
  role: string;
  present_today?: boolean;
}

function formatCurrency(amount: number): string {
  if (!amount) return '₹0';
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const pipelineConfig = [
  { key: 'standard_job_cards', label: 'Detailing Studio', icon: 'assignment', borderColor: 'border-l-amber-500', valueColor: 'text-amber-700', statusQuery: '' },
  { key: 'quick_job_cards', label: 'Car Wash Orders', icon: 'bolt', borderColor: 'border-l-emerald-500', valueColor: 'text-emerald-700', statusQuery: '' },
] as const;

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bookingsToday, setBookingsToday] = useState<any>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);
  const navigate = useNavigate();

  // FAB / Modal States
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [showAccessoryModal, setShowAccessoryModal] = useState(false);
  const [showActivityLogsModal, setShowActivityLogsModal] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const fabRef = useRef<HTMLDivElement>(null);

  const fetchActivityLogs = async () => {
    setLoadingActivityLogs(true);
    try {
      const res = await api.get('/notifications');
      setActivityLogs(res.data.data || []);
    } catch (err) {
      console.warn('Failed to load activity logs:', err);
      setActivityLogs([]);
    } finally {
      setLoadingActivityLogs(false);
    }
  };

  const openActivityLogsModal = () => {
    setShowActivityLogsModal(true);
    fetchActivityLogs();
  };

  // Click outside to close FAB menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setShowFabMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/today'),
      api.get('/job-cards', { params: { limit: 25 } }),
      api.get('/staff').catch(() => ({ data: { data: [] } })),
      api.get('/advance-bookings/today').catch(() => ({ data: { total: 0, pending: 0, confirmed: 0, arrived: 0, upcoming: [] } })),
      api.get('/parts/low-stock-alerts').catch(() => ({ data: { alerts: [], count: 0 } })),
    ]).then(([dashRes, jobsRes, staffRes, bookingsRes, lowStockRes]) => {
      setData(dashRes.data);
      setJobs(jobsRes.data.data);
      setStaffList(staffRes.data.data || []);
      setBookingsToday(bookingsRes.data);
      setLowStockAlerts(lowStockRes.data.alerts || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!search) return;
    const timer = setTimeout(() => {
      api.get('/job-cards', { params: { search, limit: 25 } })
        .then(res => setJobs(res.data.data))
        .catch(console.error);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const pipeline = data?.pipeline;
  const staffPresent = data?.staff_present ?? 0;
  const totalStaff = (data?.total_staff ?? staffList.length) || 10;
  const staffPercent = totalStaff > 0 ? Math.round((staffPresent / totalStaff) * 100) : 0;

  // For skeleton placeholders
  const SkeletonCard = ({ className = '' }: { className?: string }) => (
    <div className={`skeleton rounded-xl h-24 ${className}`} />
  );

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 px-4 sm:px-8 pb-12 space-y-8">

      {/* ═══ Section 1: CRM Pipeline (Subtle Clean Cards) ═══ */}
      {loading ? (
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 gap-4"
        >
          {pipelineConfig.map((p, idx) => {
            const metric = pipeline?.[p.key as keyof typeof pipeline];
            return (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => p.key === 'quick_job_cards' ? navigate('/car-wash') : navigate('/detailing-studio')}
                className={`bg-white p-5 rounded-xl shadow-sm border border-stone-200/70 border-l-4 ${p.borderColor} relative overflow-hidden group cursor-pointer hover:shadow-md transition-all`}
              >
                {/* Watermark Icon */}
                <span className={`material-symbols-outlined absolute -right-2 -top-2 opacity-[0.05] text-6xl rotate-12 transition-transform group-hover:scale-110`}>
                  {p.icon}
                </span>
                <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1 relative z-10">{p.label}</p>
                <h3 className="text-2xl font-headline font-extrabold text-stone-900 mb-1 relative z-10">
                  {String(metric?.count ?? 0).padStart(2, '0')}
                </h3>
                <p className={`text-xs font-mono font-bold ${p.valueColor} relative z-10`}>
                  {formatCurrency(metric?.value ?? 0)}
                </p>
              </motion.div>
            );
          })}

          {/* Quick Access Create */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white p-5 rounded-xl shadow-sm border border-stone-200/70 border-l-4 border-l-amber-500 relative overflow-hidden flex flex-col justify-between"
          >
            <span className="material-symbols-outlined absolute -right-2 -top-2 opacity-[0.05] text-6xl rotate-12">
              add_circle
            </span>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">Create New</p>
            <div className="flex flex-col gap-2 relative z-10">
              <button
                onClick={() => navigate('/job-cards/new?company=Detailing%20Studio')}
                className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100/80 text-amber-900 text-xs font-bold rounded-lg border border-amber-300/60 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                title="Create a standard Detailing Studio Job Card"
              >
                <span className="material-symbols-outlined text-[16px]">assignment</span>
                <span>Detailing Studio</span>
              </button>
              <button
                onClick={() => navigate('/car-wash')}
                className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100/80 text-blue-900 text-xs font-bold rounded-lg border border-blue-300/60 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                title="Create a Car Wash Job Card"
              >
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                <span>Car Wash</span>
              </button>
              <button
                onClick={() => navigate('/product-sell')}
                className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100/80 text-purple-900 text-xs font-bold rounded-lg border border-purple-300/60 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                title="Accessories & Products Sale"
              >
                <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
                <span>Accessories</span>
              </button>
            </div>
          </motion.div>
        </motion.section>
      )}

      {/* ═══ Section 2: Today's KPIs (Clean Subtle Cards) ═══ */}
      {!loading && data && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5"
        >
          {/* Active Jobs */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/70 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-stone-500 text-[11px] font-bold uppercase tracking-wider mb-1">Active Jobs</p>
              <h4 className="text-2xl font-headline font-extrabold text-stone-900">{data.active_jobs}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-xl">directions_car</span>
            </div>
          </div>

          {/* Completed */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/70 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-stone-500 text-[11px] font-bold uppercase tracking-wider mb-1">Completed</p>
              <h4 className="text-2xl font-headline font-extrabold text-stone-900">
                {String(data.completed_jobs).padStart(2, '0')}
              </h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined text-xl">verified</span>
            </div>
          </div>

          {/* Today's Revenue — Hero Amber Gradient */}
          <div className="bg-gradient-to-br from-amber-600 to-amber-700 p-5 rounded-xl flex flex-col justify-between shadow-md shadow-amber-600/20 text-white">
            <p className="text-amber-100/90 text-[11px] font-bold uppercase tracking-wider mb-1">Today's Revenue</p>
            <div className="flex items-baseline gap-1">
              <span className="text-amber-200 text-base font-headline font-semibold">₹</span>
              <h4 className="text-xl font-headline font-extrabold text-white">
                {(data.today_revenue || 0).toLocaleString('en-IN')}
              </h4>
            </div>
          </div>

          {/* Pending Payments / Outstanding Dues — Clickable Rose Card */}
          <div
            onClick={() => navigate('/customer-payments')}
            className="bg-white p-5 rounded-xl border border-rose-200/90 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-rose-300 transition-all group"
            title="Click to view Customer Payments & collect pending dues"
          >
            <div className="flex justify-between items-start">
              <p className="text-rose-600 text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">pending_actions</span>
                Pending Dues
              </p>
              <span className="text-[9px] bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-rose-700 font-bold group-hover:bg-rose-100 transition-colors">
                Collect
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-rose-500 text-base font-headline font-semibold">₹</span>
              <h4 className="text-xl font-headline font-extrabold text-rose-900">
                {(data.total_outstanding || 0).toLocaleString('en-IN')}
              </h4>
            </div>
          </div>

          {/* Cash Balance */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/70 shadow-sm flex flex-col justify-between">
            <p className="text-stone-500 text-[11px] font-bold uppercase tracking-wider mb-1">Cash Balance</p>
            <div className="flex items-baseline gap-1">
              <span className="text-stone-400 text-base font-headline font-semibold">₹</span>
              <h4 className="text-xl font-headline font-extrabold text-stone-900">
                {(data.cash_balance || 0).toLocaleString('en-IN')}
              </h4>
            </div>
          </div>

          {/* Staff Present */}
          <div className="bg-white p-5 rounded-xl border border-stone-200/70 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <p className="text-stone-500 text-[11px] font-bold uppercase tracking-wider mb-1">Staff Present</p>
              <span className="text-[10px] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-amber-800 font-bold">{staffPercent}%</span>
            </div>
            <h4 className="text-2xl font-headline font-extrabold text-stone-900">{staffPresent}/{totalStaff}</h4>
          </div>
        </motion.section>
      )}

      {/* ═══ Section 2.5: Advance Bookings Widget ═══ */}
      {!loading && bookingsToday && (bookingsToday.total > 0 || bookingsToday.upcoming?.length > 0) && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-stone-200/70 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-50 border border-amber-200/60 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-700">calendar_month</span>
              </div>
              <div>
                <h3 className="font-headline font-extrabold text-stone-900 text-sm">Today's Bookings</h3>
                <p className="text-[10px] text-stone-500">{bookingsToday.total} appointment{bookingsToday.total !== 1 ? 's' : ''} today</p>
              </div>
            </div>
          </div>
          {bookingsToday.upcoming?.length > 0 && (
            <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bookingsToday.upcoming.map((appt: any) => (
                <div key={appt.id} className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200/50 rounded-xl">
                  <div className="w-10 h-10 bg-amber-100/70 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-amber-800 text-lg">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-stone-900 truncate">{appt.customer_name}</p>
                    <p className="text-[10px] text-stone-500">
                      {appt.booking_time ? appt.booking_time.slice(0, 5) : '—'} · {appt.service_type || 'General'}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                    appt.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>{appt.status}</span>
                </div>
              ))}
            </div>
          )}
        </motion.section>
      )}

      {/* ═══ Section 3: Search Bar ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="search-bar max-w-2xl bg-white shadow-sm border border-stone-200/70">
          <span className="material-symbols-outlined text-amber-600 text-xl">search</span>
          <input
            type="text"
            placeholder="Customer Name / Mobile No. / Vehicle No. / Claim No."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-stone-900 placeholder:text-stone-400 font-medium"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-stone-400 hover:text-red-500 transition-colors">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* ═══ Section 3.5: Low Stock Inventory Alerts ═══ */}
      {!loading && lowStockAlerts.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.27 }}
          className="bg-white rounded-xl shadow-sm overflow-hidden border border-red-200"
        >
          <div className="px-6 py-4 border-b border-red-100 flex items-center justify-between bg-red-50/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-red-600">inventory_2</span>
              </div>
              <div>
                <h3 className="font-headline font-extrabold text-stone-900 text-sm">Low Stock Alerts</h3>
                <p className="text-[10px] text-red-600 font-bold">{lowStockAlerts.length} item{lowStockAlerts.length !== 1 ? 's' : ''} below threshold</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/parts')}
              className="text-[10px] uppercase tracking-widest font-bold text-red-600 hover:text-red-800 transition-colors flex items-center gap-1"
            >
              Manage <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
          <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockAlerts.slice(0, 6).map((part: any) => (
              <div key={part.id} className="flex items-center gap-3 p-3 bg-red-50/30 rounded-xl border border-red-100">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-red-600 text-lg">warning</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-stone-900 truncate">{part.part_name}</p>
                  <p className="text-[10px] text-stone-500 font-mono">{part.part_code}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-extrabold font-mono ${part.stock_qty === 0 ? 'text-red-600' : 'text-amber-700'}`}>
                    {part.stock_qty}
                  </span>
                  <p className="text-[9px] text-stone-400 font-bold uppercase">in stock</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ═══ Section 4: Data Table + Live Feed ═══ */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 skeleton rounded-xl h-96" />
          <div className="lg:col-span-4 skeleton rounded-xl h-96" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8"
        >
          {/* Left — Recent Job Cards Table (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-stone-200/70 overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center">
              <div>
                <h3 className="font-headline text-lg font-extrabold text-stone-900">Recent Jobs (Detailing Studio & Wash)</h3>
                <p className="text-stone-500 text-xs">Latest workshop entries</p>
              </div>
              <button
                onClick={() => navigate('/detailing-studio')}
                className="text-[10px] uppercase tracking-widest font-bold text-amber-700 hover:text-amber-900 transition-colors flex items-center gap-1"
              >
                View All <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[800px]">
                <thead>
                  <tr>
                    <th>Job No</th>
                    <th>Reg No.</th>
                    <th>Vehicle</th>
                    <th>Status</th>
                    <th>Customer</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-stone-400">
                        <span className="material-symbols-outlined text-4xl mb-2 block opacity-30">search_off</span>
                        <p className="font-bold uppercase tracking-widest text-[10px]">No detailing or wash orders found</p>
                      </td>
                    </tr>
                  ) : (
                    jobs.slice(0, 10).map((j, idx) => (
                      <motion.tr
                        key={j.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        onClick={() => navigate(`/job-cards/${j.id}/edit`)}
                        className="cursor-pointer group hover:bg-amber-50/40"
                      >
                        <td>
                          <span className="text-sm font-bold text-amber-800">{j.job_no}</span>
                        </td>
                        <td>
                          <span className="inline-block px-2.5 py-1 bg-stone-100 rounded-lg text-[11px] font-bold font-mono text-stone-800 border border-stone-200">
                            {j.reg_no}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center border border-stone-200/60">
                              <span className="material-symbols-outlined text-stone-400 text-sm">directions_car</span>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-stone-900 leading-tight">{j.car_name}</p>
                              {(j.vehicle_make || j.vehicle_model) && (
                                <p className="text-[10px] text-stone-500 font-medium mt-0.5">{[j.vehicle_make, j.vehicle_model].filter(Boolean).join(' ')}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={j.status} size="sm" />
                        </td>
                        <td>
                          <p className="text-xs font-bold text-stone-900">{j.cust_name || j.owner_name || '—'}</p>
                          <p className="text-[10px] text-stone-500 font-mono">{j.cust_mobile || j.mobile_no || ''}</p>
                        </td>
                        <td>
                          <span className="text-[10px] text-stone-400 font-mono uppercase">{formatDate(j.job_date)}</span>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {jobs.length > 0 && (
              <div className="px-6 py-4 bg-stone-50/50 border-t border-stone-100 flex justify-between items-center">
                <span className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">Showing {Math.min(jobs.length, 10)} of {jobs.length}</span>
                <button
                  onClick={() => navigate('/job-cards')}
                  className="text-[11px] uppercase tracking-widest font-bold text-amber-700 hover:text-amber-900 transition-colors flex items-center gap-1"
                >
                  View All <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            )}
          </div>

          {/* Right — Live Feed / Activity (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-stone-200/70 shadow-sm p-6 lg:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline text-lg font-extrabold text-stone-900">Live Feed</h3>
              <span
                onClick={openActivityLogsModal}
                className="material-symbols-outlined text-stone-400 text-xl cursor-pointer hover:text-amber-700 transition-colors"
                title="Refresh & View Activity Feed"
              >
                refresh
              </span>
            </div>
            <div className="space-y-4">
              {/* Dynamically generate from recent jobs */}
              {jobs.slice(0, 4).map((j, idx) => {
                const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
                  ready: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: 'check_circle' },
                  wip: { bg: 'bg-amber-100', text: 'text-amber-800', icon: 'build' },
                  spares_pending: { bg: 'bg-orange-100', text: 'text-orange-700', icon: 'pending_actions' },
                  estimation: { bg: 'bg-violet-100', text: 'text-violet-700', icon: 'edit_note' },
                  rfe: { bg: 'bg-amber-100', text: 'text-amber-800', icon: 'edit_note' },
                  delivered: { bg: 'bg-amber-100', text: 'text-amber-800', icon: 'local_shipping' },
                  invoiced: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: 'receipt' },
                };
                const sc = statusColors[j.status] || { bg: 'bg-stone-100', text: 'text-stone-600', icon: 'info' };
                const timeAgo = idx === 0 ? '2 mins ago' : idx === 1 ? '14 mins ago' : idx === 2 ? '1 hour ago' : '3 hours ago';

                return (
                  <div
                    key={j.id}
                    onClick={() => navigate(`/job-cards/${j.id}/edit`)}
                    className="flex gap-3.5 relative p-2.5 rounded-xl hover:bg-amber-50/60 cursor-pointer transition-all border border-transparent hover:border-amber-200/50 group"
                    title={`Click to view Order ${j.job_no}`}
                  >
                    {idx < 3 && (
                      <div className="flex-shrink-0 w-0.5 h-full bg-stone-200 absolute left-[19px] top-9 rounded-full" />
                    )}
                    <div className={`z-10 w-8 h-8 rounded-full ${sc.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <span className={`material-symbols-outlined ${sc.text} text-sm`}>{sc.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-stone-900 group-hover:text-amber-800 transition-colors">
                        {j.job_no}{' '}
                        <span className="text-stone-400 font-normal">marked as</span>{' '}
                        <span className={sc.text}>{j.status.replace(/_/g, ' ')}</span>
                      </p>
                      <p className="text-[11px] text-stone-500 font-medium truncate">{j.car_name || j.reg_no}</p>
                      <p className="text-[10px] text-stone-400 mt-0.5 font-mono uppercase">{timeAgo}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={openActivityLogsModal}
              className="w-full mt-6 py-3 rounded-xl text-xs font-bold font-headline text-stone-800 bg-stone-100 hover:bg-amber-50 hover:text-amber-800 transition-all border border-stone-200 flex items-center justify-center gap-2 shadow-xs"
            >
              <span className="material-symbols-outlined text-base">list_alt</span>
              <span>View Full Activity Logs</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* ═ ═ ═  Full Activity Logs Modal ═ ═ ═  */}
      {showActivityLogsModal && (
        <Modal title="Activity Logs & Workshop Live Feed" onClose={() => setShowActivityLogsModal(false)} maxWidth="max-w-2xl">
          <div className="space-y-4">
            {/* Search & Refresh Bar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-lg">search</span>
                <input
                  type="text"
                  value={activitySearch}
                  onChange={e => setActivitySearch(e.target.value)}
                  placeholder="Search logs by job no, vehicle, customer, or action..."
                  className="input-field pl-10 !py-2.5"
                  autoFocus
                />
              </div>
              <button
                onClick={fetchActivityLogs}
                disabled={loadingActivityLogs}
                className="px-4 py-2.5 bg-stone-100 hover:bg-amber-50 hover:text-amber-800 text-stone-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border border-stone-200"
              >
                <span className={`material-symbols-outlined text-base ${loadingActivityLogs ? 'animate-spin' : ''}`}>refresh</span>
                Refresh
              </button>
            </div>

            {/* Activity List */}
            {loadingActivityLogs ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-stone-500 font-medium">Loading live workshop activity logs...</p>
              </div>
            ) : (() => {
              const filtered = activityLogs.filter(a => {
                if (!activitySearch.trim()) return true;
                const q = activitySearch.toLowerCase();
                return (a.title || '').toLowerCase().includes(q) ||
                       (a.message || '').toLowerCase().includes(q) ||
                       (a.type || '').toLowerCase().includes(q);
              });

              if (filtered.length === 0) {
                return (
                  <div className="py-12 text-center text-stone-500">
                    <span className="material-symbols-outlined text-4xl text-stone-300 mb-2 block">history</span>
                    <p className="text-xs font-bold">No activity logs found</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">Try adjusting your search query</p>
                  </div>
                );
              }

              return (
                <div className="max-h-[60vh] overflow-y-auto space-y-2.5 pr-1">
                  {filtered.map((log: any) => {
                    const severityStyles: Record<string, { bg: string; text: string; icon: string }> = {
                      success: { bg: 'bg-emerald-50/70 border-emerald-200/70', text: 'text-emerald-700', icon: 'check_circle' },
                      warning: { bg: 'bg-amber-50/70 border-amber-200/70', text: 'text-amber-700', icon: 'warning' },
                      error: { bg: 'bg-red-50/70 border-red-200/70', text: 'text-red-700', icon: 'error' },
                      info: { bg: 'bg-blue-50/70 border-blue-200/70', text: 'text-blue-700', icon: 'info' }
                    };
                    const st = severityStyles[log.severity] || severityStyles.info;

                    return (
                      <div
                        key={log.id}
                        onClick={() => {
                          if (log.link) {
                            setShowActivityLogsModal(false);
                            navigate(log.link);
                          }
                        }}
                        className={`p-3.5 rounded-xl border ${st.bg} hover:shadow-md transition-all cursor-pointer flex items-start gap-3.5 group`}
                      >
                        <div className={`w-8 h-8 rounded-xl bg-white shadow-xs flex items-center justify-center shrink-0 ${st.text} mt-0.5`}>
                          <span className="material-symbols-outlined text-lg">{st.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold text-stone-900 group-hover:text-amber-800 transition-colors">{log.title}</h4>
                            <span className="text-[10px] font-mono text-stone-400 shrink-0">
                              {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <p className="text-xs text-stone-600 mt-1 font-medium leading-relaxed">{log.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </Modal>
      )}



      {/* ═══ Floating Action Button (FAB) ═══ */}
      <div className="fixed bottom-8 right-8 z-30 flex flex-col items-end gap-3" ref={fabRef}>
        <AnimatePresence>
          {showFabMenu && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.9 }}
              className="bg-stone-900 text-white rounded-xl shadow-2xl p-2 border border-stone-800 flex flex-col gap-1 w-52"
            >
              <button
                onClick={() => {
                  setShowFabMenu(false);
                  navigate('/job-cards/new?company=Detailing%20Studio');
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 text-left text-xs font-bold transition-colors"
              >
                <span className="material-symbols-outlined text-lg text-amber-400">assignment</span>
                <span>Detailing Studio</span>
              </button>
              <button
                onClick={() => {
                  setShowFabMenu(false);
                  navigate('/car-wash');
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 text-left text-xs font-bold transition-colors"
              >
                <span className="material-symbols-outlined text-lg text-blue-400">bolt</span>
                <span>Car Wash</span>
              </button>
              <button
                onClick={() => {
                  setShowFabMenu(false);
                  navigate('/product-sell');
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 text-left text-xs font-bold transition-colors"
              >
                <span className="material-symbols-outlined text-lg text-purple-400">shopping_bag</span>
                <span>Accessories</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowFabMenu(!showFabMenu)}
          className={`w-14 h-14 bg-amber-600 rounded-full shadow-xl shadow-amber-600/30 flex items-center justify-center text-white hover:bg-amber-700 transition-all ${showFabMenu ? 'rotate-45' : ''}`}
          title="Create Detailing Studio Order"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </motion.button>
      </div>

      {/* ── Quick Job Card Modal ── */}
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

      {/* ── Accessory Sale Modal ── */}
      {showAccessoryModal && (
        <AccessorySaleModal
          onClose={() => setShowAccessoryModal(false)}
          onCreated={() => {
            api.get('/dashboard/today').then(r => setData(r.data)).catch(console.error);
          }}
        />
      )}
    </AnimatedPage>
  );
}

