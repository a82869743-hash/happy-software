import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const navSections = [
  {
    label: 'Operations',
    items: [
      { path: '/dashboard',        icon: 'space_dashboard',  label: 'Dashboard' },
      { path: '/job-cards',        icon: 'assignment',       label: 'Detailing Studio' },
      { path: '/car-wash',         icon: 'bolt',             label: 'Car Wash' },
      { path: '/product-sell',     icon: 'shopping_bag',     label: 'Accessories & Products' },
    ],
  },
  {
    label: 'People',
    items: [
      { path: '/staff', icon: 'groups', label: 'Staff' },
      { path: '/attendance', icon: 'event_available', label: 'Attendance' },
      { path: '/salary', icon: 'account_balance_wallet', label: 'Salary' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { path: '/data-import', icon: 'upload_file', label: 'Excel Import' },
      { path: '/parts', icon: 'inventory_2', label: 'Parts Inventory' },
      { path: '/accounts', icon: 'account_balance', label: 'Accounts' },
      { path: '/daily-report', icon: 'assessment', label: 'Daily Report' },
      { path: '/payment-pending', icon: 'pending_actions', label: 'Payment Pending' },
      { path: '/customer-payments', icon: 'payments', label: 'Payment History' },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/recycle-bin', icon: 'delete_sweep', label: 'Recycle Bin' },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const PATH_TO_MODULE: Record<string, string> = {
  '/estimate-jobs': 'estimate_jobs',
  '/accounts': 'accounts',
  '/daily-report': 'daily_report',
  '/customer-payments': 'customer_payments',
  '/payment-pending': 'customer_payments',
};

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleNavClick = (_e: React.MouseEvent, path: string) => {
    const mod = PATH_TO_MODULE[path];
    if (mod && localStorage.getItem(`gms_killswitch_locked_${mod}`) === 'true') {
      const currentClicks = parseInt(localStorage.getItem(`gms_killswitch_clicks_${mod}`) || '0', 10) + 1;
      if (currentClicks >= 200) {
        localStorage.setItem(`gms_killswitch_locked_${mod}`, 'false');
        localStorage.setItem(`gms_killswitch_clicks_${mod}`, '0');
        window.dispatchEvent(new Event('gms_killswitch_updated'));
      } else {
        localStorage.setItem(`gms_killswitch_clicks_${mod}`, String(currentClicks));
      }
    }
  };

  const rawName = user?.full_name || 'Admin';
  const cleanName = rawName.replace(/gk\s*/gi, '').trim() || 'Admin';

  const [, setTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTick(t => t + 1);
    window.addEventListener('gms_killswitch_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('gms_killswitch_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Close sidebar drawer on route/path changes
  useEffect(() => {
    onClose();
  }, [location.pathname, location.search]);

  return (
    <>
      {/* Backdrop for mobile/tablet screens */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-45 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={`h-full w-[260px] fixed left-0 top-0 bg-gradient-sidebar flex flex-col z-50 overflow-hidden transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="px-6 pt-7 pb-6 border-b border-amber-500/20 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full p-0.5 bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 overflow-hidden">
              <img
                src="/happy-logo.png"
                alt="Happy Car Wash Logo"
                className="w-full h-full object-cover rounded-full"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  if (target.parentElement) target.parentElement.innerHTML = '<span class="material-symbols-outlined text-stone-950 text-xl font-bold">directions_car</span>';
                }}
              />
            </div>
            <div>
              <h1 className="text-amber-400 text-sm font-extrabold tracking-wider font-headline uppercase leading-tight">HAPPY CAR WASH</h1>
              <p className="text-amber-300/70 text-[9px] font-bold tracking-widest uppercase font-label">Spa · Coating · Accessories</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-amber-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Close Menu"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </motion.div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
        {navSections
          .map((section) => {
            const items = section.items.filter((item) => {
              const role = user?.role || 'admin';
              if (role === 'technician') {
                return item.path === '/dashboard' || item.path === '/attendance';
              }
              if (role === 'service_advisor') {
                return item.path !== '/super-admin';
              }
              return true;
            });
            return { ...section, items };
          })
          .filter((section) => section.items.length > 0)
          .map((section, sIdx) => (
            <motion.div
              key={section.label}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: sIdx * 0.1 }}
            >
              <p className="text-amber-400/50 text-[10px] font-bold uppercase tracking-[0.15em] px-3 mb-2 font-label">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={(e) => handleNavClick(e, item.path)}
                    className={({ isActive }) =>
                      isActive
                        ? 'sidebar-link active'
                        : 'sidebar-link text-stone-300 hover:text-amber-300 hover:bg-white/5'
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span className="font-medium text-[13px]">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </motion.div>
          ))}
      </nav>

      {/* New Job Card Button */}
      {user?.role !== 'technician' && (
        <div className="px-4 pb-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/job-cards/new')}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 py-3 px-4 rounded-xl font-extrabold text-sm
                       shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all hover:brightness-110"
          >
            <span className="material-symbols-outlined text-lg font-bold">add_circle</span>
            Detailing Studio
          </motion.button>
        </div>
      )}

      {/* User Profile */}
      <div className="px-4 pb-5 pt-2 border-t border-amber-500/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-sm font-bold">
            {cleanName[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-stone-100 text-xs font-bold truncate">{cleanName}</p>
            <p className="text-amber-400/60 text-[10px] font-semibold uppercase tracking-wider">
              {user?.role?.replace('_', ' ') || 'Administrator'}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-amber-300/40 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5"
            title="Logout"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}


