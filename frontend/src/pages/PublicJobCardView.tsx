import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { formatCurrency } from '../utils/format';

interface TrackedJob {
  job_no: string;
  reg_no: string;
  car_name: string;
  owner_name: string;
  status: string;
  status_label: string;
  job_date: string;
  service_type: string;
  vehicle_make: string;
  vehicle_model: string;
  is_quick_job: number;
  services: { name: string; type: string; qty: number; rate: number; amount: number }[];
  total: number;
  media: { url: string; stage: string; caption: string | null }[];
}

// Standard steps for normal job card
const NORMAL_STATUS_STEPS = [
  { key: 'estimation', label: 'Order Confirmed', desc: 'Vehicle checked in & order registered', icon: 'task_alt' },
  { key: 'wip', label: 'Work in Progress', desc: 'Spares allocated & servicing underway', icon: 'build' },
  { key: 'ready', label: 'Ready for Pickup', desc: 'Quality inspection complete & ready for pickup', icon: 'check_circle' },
  { key: 'delivered', label: 'Delivered', desc: 'Vehicle successfully handed over to customer', icon: 'local_shipping' },
  { key: 'invoiced', label: 'Completed & Invoiced', desc: 'Billing complete & transactions registered', icon: 'receipt' },
];

// Simplified steps for quick job card
const QUICK_STATUS_STEPS = [
  { key: 'estimation', label: 'Express Job Booked', desc: 'Quick service registered in system', icon: 'login' },
  { key: 'wip', label: 'Servicing Underway', desc: 'Technician assigned & work in progress', icon: 'bolt' },
  { key: 'ready', label: 'Ready for Delivery', desc: 'Express checkup & wash complete', icon: 'verified' },
  { key: 'delivered', label: 'Delivered', desc: 'Returned back to customer', icon: 'directions_car' },
  { key: 'invoiced', label: 'Closed & Completed', desc: 'Payment received & card marked done', icon: 'done_all' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = API_URL.replace('/api', '');

export default function PublicJobCardView() {
  const { token } = useParams<{ token: string }>();
  const [job, setJob] = useState<TrackedJob | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [mediaTab, setMediaTab] = useState<'all' | 'before' | 'after' | 'other'>('all');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/public/job-card/${token}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Order not found');
        return;
      }
      const data = await res.json();
      setJob(data);
      setError('');
    } catch {
      setError('Unable to fetch order status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch + auto-refresh + dynamic font/icon imports
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);

    // Append Google Font (Outfit) dynamically
    const linkOutfit = document.createElement('link');
    linkOutfit.rel = 'stylesheet';
    linkOutfit.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap';
    document.head.appendChild(linkOutfit);

    // Append Material Symbols Outlined dynamically
    const linkSymbols = document.createElement('link');
    linkSymbols.rel = 'stylesheet';
    linkSymbols.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
    document.head.appendChild(linkSymbols);

    return () => {
      clearInterval(interval);
      document.head.removeChild(linkOutfit);
      document.head.removeChild(linkSymbols);
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium text-sm animate-pulse">Loading vehicle status...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-3xl text-red-500">error</span>
        </div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">Order Not Found</h2>
        <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-6">
          {error || 'This tracking link may have expired or is invalid.'}
        </p>
        <div className="text-slate-600 text-xs uppercase tracking-widest font-bold">
          Happy Car Wash
        </div>
      </div>
    );
  }

  const isQuick = job.is_quick_job === 1;
  const steps = isQuick ? QUICK_STATUS_STEPS : NORMAL_STATUS_STEPS;

  // Custom step resolver to handle states like 'active' safely
  const getStatusIndex = (status: string) => {
    const idx = steps.findIndex(s => s.key === status);
    if (idx !== -1) return idx;
    if (status === 'active') return 1; // WIP
    if (status === 'cancelled') return -1;
    return 0; // estimation
  };

  const currentIdx = getStatusIndex(job.status);
  const filteredMedia = job.media?.filter(m => mediaTab === 'all' || m.stage === mediaTab) || [];

  return (
    <div className="relative min-h-screen bg-[#1C1917] text-slate-100 font-sans pb-16 selection:bg-amber-600 selection:text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
      {/* Premium Ambient Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.12)_0%,_transparent_60%)] pointer-events-none z-0" />
      <div className="absolute bottom-10 right-[-10%] w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-md mx-auto px-4 pt-10 z-10 space-y-6">
        
        {/* --- Premium Header --- */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-bold text-amber-400 uppercase tracking-widest">
            <span className="material-symbols-outlined text-xs animate-pulse">radar</span> Live Tracker
          </div>
          <h1 className="text-2xl font-black tracking-wider text-white uppercase pt-1">
            Happy Car Wash
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            Real-time Garage Tracking Portal
          </p>
        </div>

        {/* --- Vehicle Status Overview Card --- */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl space-y-5">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                Customer Vehicle
              </span>
              <h2 className="text-xl font-extrabold text-white leading-tight">
                {job.car_name}
              </h2>
              {(job.vehicle_make || job.vehicle_model) && (
                <p className="text-xs text-slate-400">
                  {[job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')}
                </p>
              )}
            </div>
            
            {/* Styled License Plate */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl px-3 py-1.5 shadow-md shadow-amber-600/30 border border-amber-400/20">
              <span className="font-mono text-xs font-black tracking-wider uppercase">{job.reg_no}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-4 gap-x-6 pt-2 border-t border-white/5">
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Order No</p>
              <p className="text-xs font-semibold text-white font-mono">{job.job_no}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Job Date</p>
              <p className="text-xs font-semibold text-white">
                {new Date(job.job_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Customer Name</p>
              <p className="text-xs font-semibold text-white">{job.owner_name}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Service Type</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <p className="text-xs font-semibold text-white">{job.service_type || 'General Service'}</p>
              </div>
            </div>
          </div>

          {/* Quick vs Normal Card Indicator */}
          <div className={`flex items-center gap-2 p-3.5 rounded-2xl border text-xs font-semibold ${
            isQuick 
              ? 'bg-amber-500/5 border-amber-500/10 text-amber-400' 
              : 'bg-indigo-500/5 border-indigo-500/10 text-indigo-400'
          }`}>
            <span className="material-symbols-outlined text-base">
              {isQuick ? 'bolt' : 'verified_user'}
            </span>
            <span>
              {isQuick ? '¡ Express Job Card — Scheduled for quick dispatch' : '¸ Standard Job Card — Scheduled for full check-up'}
            </span>
          </div>
        </div>

        {/* --- Live Status Timeline Card --- */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl space-y-6">
          <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">hourglass_empty</span> Work Pipeline Status
          </h3>

          <div className="space-y-0.5 pl-1.5">
            {steps.map((step, idx) => {
              const isActive = idx < currentIdx;
              const isCurrent = idx === currentIdx;

              return (
                <div key={step.key} className="flex gap-4 items-start relative group">
                  
                  {/* Timeline Badge and Connector */}
                  <div className="flex flex-col items-center flex-shrink-0 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all duration-300 border-2 z-10 ${
                      isActive ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' :
                      isCurrent ? 'bg-amber-600 border-amber-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' :
                      'bg-slate-950 border-slate-800/80 text-slate-600'
                    }`}>
                      {isActive ? (
                        <span className="material-symbols-outlined text-base font-black">check</span>
                      ) : (
                        <span className="material-symbols-outlined text-base">{step.icon}</span>
                      )}
                    </div>
                    
                    {/* Connecting Vertical Line */}
                    {idx < steps.length - 1 && (
                      <div className={`w-[2px] absolute top-8 bottom-[-8px] transition-all duration-300 ${
                        isActive ? 'bg-emerald-500' : 'bg-slate-800'
                      }`} style={{
                        backgroundImage: isCurrent ? 'linear-gradient(to bottom, #F59E0B 30%, rgba(30,41,59,0.3) 70%)' : undefined
                      }} />
                    )}
                  </div>

                  {/* Step Description Content */}
                  <div className="pb-6 flex-1 pt-0.5">
                    <p className={`text-sm font-bold transition-all duration-300 ${
                      isCurrent ? 'text-white text-base' :
                      isActive ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      {step.label}
                      {isCurrent && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-400 rounded-full animate-pulse uppercase">
                          Active
                        </span>
                      )}
                    </p>
                    <p className={`text-xs mt-1 leading-relaxed transition-all duration-300 ${
                      isCurrent ? 'text-amber-300/80' :
                      isActive ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* --- Services & Billing Card --- */}
        {job.services && job.services.length > 0 && (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">receipt_long</span> Services Summary
            </h3>
            
            <div className="space-y-3 pt-2">
              {job.services.map((svc, idx) => (
                <div key={idx} className="flex justify-between items-start gap-4 py-2.5 border-b border-white/5 last:border-0">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-slate-200">{svc.name}</p>
                    {svc.qty && svc.rate && (
                      <p className="text-[10px] text-slate-500 font-medium uppercase font-mono">
                        {svc.qty} x {formatCurrency(svc.rate)}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-extrabold font-mono text-white">
                    {formatCurrency(svc.amount)}
                  </span>
                </div>
              ))}

              {/* Total Card Block */}
              <div className="bg-amber-600/5 border border-amber-500/10 rounded-2xl p-4 mt-4 flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Total Est. Bill</p>
                  <p className="text-[10px] text-slate-400">Excluding additional taxes</p>
                </div>
                <span className="text-xl font-black font-mono text-amber-400">
                  {formatCurrency(job.total)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* --- Vehicle Photos Card --- */}
        {job.media && job.media.length > 0 && (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">camera_alt</span> Vehicle Photos
            </h3>

            {/* Stage Selector Tabs */}
            <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/5">
              {(['all', 'before', 'after', 'other'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setMediaTab(tab)}
                  className={`flex-1 text-center py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                    mediaTab === tab 
                      ? 'bg-amber-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Photos Grid */}
            {filteredMedia.length === 0 ? (
              <div className="text-center py-8 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
                <span className="material-symbols-outlined text-3xl text-slate-600 mb-1.5 block">image_not_supported</span>
                <p className="text-xs font-semibold text-slate-500">No photos in this section</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5 pt-2">
                {filteredMedia.map((photo, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setLightboxUrl(`${BASE_URL}/${photo.url}`)}
                    className="group relative rounded-2xl overflow-hidden border border-white/5 bg-slate-950 shadow-md aspect-video cursor-pointer hover:border-amber-500/30 transition-all duration-300"
                  >
                    <img
                      src={`${BASE_URL}/${photo.url}`}
                      alt={photo.caption || `Vehicle photo`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                      loading="lazy"
                    />
                    
                    {/* Glowing Layer */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-85 transition-opacity" />
                    
                    {/* Stage Label */}
                    <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                        photo.stage === 'before' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        photo.stage === 'after' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {photo.stage}
                      </span>
                      {photo.caption && (
                        <span className="text-[8px] text-slate-400 truncate max-w-[60px]">{photo.caption}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- Footer Details --- */}
        <div className="text-center pt-4 space-y-1 bg-transparent">
          <p className="text-[10px] text-slate-600 flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-xs animate-spin">sync</span>
            Refreshes automatically every 30 seconds
          </p>
          <p className="text-[9px] text-slate-700 uppercase tracking-widest font-black">
            © {new Date().getFullYear()} Happy Car Wash • Vadodara
          </p>
        </div>

      </div>

      {/* --- Lightbox Modal Preview --- */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300"
          onClick={() => setLightboxUrl(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-amber-400 transition-colors w-10 h-10 rounded-full bg-slate-900/50 flex items-center justify-center"
            onClick={() => setLightboxUrl(null)}
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          
          <img 
            src={lightboxUrl} 
            alt="Vehicle photo preview" 
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain border border-white/5"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
}


