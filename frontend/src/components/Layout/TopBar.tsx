import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

interface SearchResult {
  id: number;
  job_no: string;
  reg_no: string;
  cust_name: string;
  car_name: string;
}

interface NotificationItem {
  id: string;
  type: 'low_stock' | 'service_booking' | 'advance_booking' | 'status_change' | 'new_jobcard';
  title: string;
  message: string;
  link: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}

interface TopBarProps {
  onToggleSidebar: () => void;
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [placeholder, setPlaceholder] = useState('Global Search...');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setPlaceholder('Search...');
      } else {
        setPlaceholder('Global Search (Reg No, Cust Name, Job Card...)');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Notifications states
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('gms_read_notifications');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const notificationsRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = () => {
    api.get('/notifications')
      .then(res => {
        setNotifications(res.data.data || []);
      })
      .catch(err => {
        console.error('Failed to fetch notifications:', err);
      });
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Poll every 60 seconds
    return () => clearInterval(interval);
  }, []);

  // Handle click outside to close notifications popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;

  const markAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const updated = [...readIds, id];
      setReadIds(updated);
      localStorage.setItem('gms_read_notifications', JSON.stringify(updated));
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    const updated = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(updated);
    localStorage.setItem('gms_read_notifications', JSON.stringify(updated));
  };

  const formatRelativeTime = (timestamp: string) => {
    try {
      const now = new Date();
      const date = new Date(timestamp);
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHrs = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHrs / 24);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHrs < 24) return `${diffHrs}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch (e) {
      return '';
    }
  };

  const getNotificationStyles = (item: NotificationItem) => {
    switch (item.type) {
      case 'low_stock':
        return {
          icon: 'inventory_2',
          iconBg: 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30',
        };
      case 'service_booking':
      case 'advance_booking':
        return {
          icon: 'calendar_today',
          iconBg: 'bg-amber-50 dark:bg-stone-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30',
        };
      case 'status_change':
        return {
          icon: 'build',
          iconBg: 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30',
        };
      case 'new_jobcard':
        return {
          icon: 'check_circle',
          iconBg: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30',
        };
      default:
        return {
          icon: 'notifications',
          iconBg: 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-900/30',
        };
    }
  };

  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Handle click outside to close search popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced Search API Call
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    
    setIsSearching(true);
    setShowResults(true);

    const timer = setTimeout(() => {
      api.get('/job-cards', { params: { search, limit: 5 } })
        .then(res => {
          setResults(res.data.data);
        })
        .catch(console.error)
        .finally(() => setIsSearching(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const handleResultClick = (id: number) => {
    setShowResults(false);
    setSearch('');
    navigate(`/job-cards/${id}/edit`);
  };

  return (
    <header className="fixed top-0 right-0 w-full lg:w-[calc(100%-260px)] z-40 flex justify-between items-center h-[72px] px-4 sm:px-8 bg-surface-card/95 backdrop-blur-md border-b border-gray-100/50 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-colors duration-300">
      
      {/* Search Section */}
      <div className={`flex-1 flex items-center justify-start max-w-xl gap-2.5 sm:gap-3 ${isSearchExpanded ? 'w-full' : ''}`} ref={searchRef}>
        {!isSearchExpanded && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 text-on-surface-variant hover:text-primary rounded-xl hover:bg-surface border border-gray-100 shadow-sm flex items-center justify-center min-w-[44px] min-h-[44px]"
            title="Toggle Navigation Menu"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
        )}
        
        {/* On mobile, if not expanded, show search as a button. If expanded, show full width with close/back button */}
        <div className={`relative ${isSearchExpanded ? 'w-full flex items-center gap-2' : 'w-full hidden md:block'}`}>
          {isSearchExpanded && (
            <button
              onClick={() => { setIsSearchExpanded(false); setSearch(''); setShowResults(false); }}
              className="md:hidden p-2 text-on-surface-variant hover:text-primary rounded-xl hover:bg-surface border border-gray-100 shadow-sm flex items-center justify-center min-w-[44px] min-h-[44px]"
              title="Back"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <div className="flex-1 flex items-center bg-surface border border-gray-100 rounded-xl px-4 py-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-sm group">
            <span className="material-symbols-outlined text-on-surface-muted text-[20px] group-focus-within:text-primary transition-colors">search</span>
            <input
              type="text"
              placeholder={placeholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => { if (search) setShowResults(true); }}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-on-surface placeholder:text-on-surface-muted/60 pl-3 py-0.5"
            />
            {isSearching && (
              <span className="material-symbols-outlined text-primary text-[18px] animate-spin">progress_activity</span>
            )}
            {search && !isSearching && (
              <button onClick={() => {setSearch(''); setShowResults(false);}} className="text-on-surface-muted hover:text-error transition-colors flex items-center">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
          
          {/* Search Dropdown Popover */}
          {showResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-surface-card border border-gray-100 rounded-xl shadow-modal overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {results.length === 0 && !isSearching ? (
                 <div className="p-4 text-center text-sm font-medium text-on-surface-muted">No matches found</div>
              ) : (
                <ul className="max-h-[300px] overflow-y-auto">
                  {results.map(r => (
                    <li 
                      key={r.id} 
                      onClick={() => handleResultClick(r.id)}
                      className="p-3 border-b border-gray-50 last:border-0 hover:bg-primary-50/50 cursor-pointer transition-colors flex flex-col gap-1 list-none group"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{r.reg_no}</span>
                        <span className="text-[10px] font-bold font-mono text-on-surface-muted uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded">{r.job_no}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-on-surface-variant truncate pr-4">{r.cust_name || 'Walk-in'}</span>
                        <span className="text-on-surface-muted truncate max-w-[120px]">{r.car_name}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {results.length > 0 && (
                <div 
                  onClick={() => { setShowResults(false); navigate(`/job-cards?search=${encodeURIComponent(search)}`); setSearch(''); }}
                  className="bg-gray-50 p-2 text-center text-xs font-bold text-primary cursor-pointer hover:bg-primary-50/20 transition-colors uppercase tracking-widest"
                >
                  View all results
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Search Button (visible only when search is not expanded on mobile) */}
        {!isSearchExpanded && (
          <button
            onClick={() => setIsSearchExpanded(true)}
            className="md:hidden p-2 text-on-surface-variant hover:text-primary rounded-xl hover:bg-surface border border-gray-100 shadow-sm flex items-center justify-center min-w-[44px] min-h-[44px]"
            title="Search"
          >
            <span className="material-symbols-outlined">search</span>
          </button>
        )}
      </div>
      
      {/* Quick Actions & Profile */}
      <div className={`flex items-center gap-1.5 sm:gap-5 ${isSearchExpanded ? 'hidden md:flex' : 'flex'}`}>

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary-50/50 rounded-lg border border-primary/10">
           <span className="material-symbols-outlined text-[16px] text-primary">calendar_today</span>
           <span className="text-xs font-bold uppercase tracking-widest text-primary">{today}</span>
        </div>
        
        <div className="hidden sm:block w-px h-6 bg-gray-200/50 ml-1 mr-1"></div>
        
        <div className="flex items-center gap-2">
          <div className="relative flex items-center" ref={notificationsRef}>
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                fetchNotifications();
              }}
              className="w-11 h-11 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface hover:text-primary transition-all border border-transparent hover:border-gray-200 shadow-sm relative"
              title="Notifications"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 min-w-[14px] h-3.5 px-0.5 bg-error rounded-full border border-surface-card text-[8px] font-bold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="fixed sm:absolute right-4 sm:right-0 top-[76px] sm:top-full w-[calc(100vw-32px)] sm:w-[380px] bg-surface-card border border-gray-100 rounded-2xl shadow-modal overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-4 border-b border-gray-100/50 flex justify-between items-center bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-on-surface">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        {unreadCount} New
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs font-semibold text-primary hover:text-primary-dark hover:underline transition-colors"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-on-surface-muted/30 text-[36px]">notifications_off</span>
                      <p className="text-sm font-semibold text-on-surface-muted">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map(n => {
                      const isRead = readIds.includes(n.id);
                      const styles = getNotificationStyles(n);
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            markAsRead(n.id);
                            setShowNotifications(false);
                            navigate(n.link);
                          }}
                          className={`p-3.5 hover:bg-primary-50/20 cursor-pointer transition-colors flex gap-3 items-start ${!isRead ? 'bg-primary-50/10' : ''}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${styles.iconBg}`}>
                            <span className="material-symbols-outlined text-[18px]">{styles.icon}</span>
                          </div>
                          <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <span className={`text-xs font-bold truncate ${!isRead ? 'text-on-surface' : 'text-on-surface-variant'}`}>{n.title}</span>
                              <span className="text-[10px] text-on-surface-muted whitespace-nowrap shrink-0 mt-0.5">
                                {formatRelativeTime(n.timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed text-left">{n.message}</p>
                          </div>
                          {!isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 self-center"></span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          <button 
            onClick={logout}
            className="w-11 h-11 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-light hover:text-error transition-all border border-transparent hover:border-error/20 shadow-sm ml-1"
            title="Logout"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}

