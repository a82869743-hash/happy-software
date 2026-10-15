import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import AnimatedPage from '../components/shared/AnimatedPage';
import Modal from '../components/shared/Modal';
import { showToast } from '../components/shared/Toast';
import { formatCurrency } from '../utils/format';
import { motion, AnimatePresence } from 'framer-motion';

interface StaffMember {
  id: number;
  staff_code: string;
  full_name: string;
  role: string;
  mobile_no: string;
  date_of_joining: string;
  monthly_salary: number;
  is_active: number;
}

interface CatalogItem {
  id: number;
  item_name: string;
  category: string;
  item_type: 'part' | 'labour';
  default_rate: number;
  hsn_sac: string | null;
  default_tax_pct: number;
  source: 'catalog' | 'inventory';
}

interface ConcernPreset {
  id: number;
  concern_text: string;
  category: string;
  sort_order: number;
}

interface ServicePackage {
  id: number;
  name: string;
  category: string;
  description: string;
  parts: string[];
  labour: string[];
}

const emptyStaffForm = {
  full_name: '',
  role: '',
  mobile_no: '',
  date_of_joining: new Date().toISOString().slice(0, 10),
  monthly_salary: '',
  is_active: 1
};

const emptyCatalogForm = {
  name: '',
  category: 'General',
  item_type: 'labour' as 'part' | 'labour',
  default_rate: '',
  hsn_sac: '',
  tax_pct: 18
};

const emptyPackageForm = {
  name: '',
  category: 'General',
  description: '',
  parts: [] as string[],
  labour: [] as string[]
};

const emptyConcernForm = {
  concern_text: '',
  category: 'General',
  sort_order: 0
};

const emptyRecommendedForm = {
  name: '',
  category: 'General',
  item_type: 'labour' as 'part' | 'labour',
  period: '1 yr'
};

const emptyUserForm = {
  username: '',
  password: '',
  full_name: '',
  role: 'service_advisor'
};

const emptyRoleForm = {
  role_name: '',
  perm_create_job_card: 1,
  perm_delete_invoice: 1,
  perm_view_accounts: 1,
  perm_view_payments: 1,
  perm_edit_estimate: 1,
  perm_inventory: 1,
  perm_customer: 1,
  perm_reports: 1,
  perm_settings: 1
};

export default function SuperAdmin() {
  const [activeTab, setActiveTab] = useState<'settings' | 'staff' | 'catalog' | 'packages' | 'concerns' | 'recommended' | 'users' | 'roles'>('settings');
  const [loading, setLoading] = useState(true);

  // Settings state
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Staff state
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffModal, setStaffModal] = useState<{ mode: 'add' | 'edit'; data: typeof emptyStaffForm; id?: number } | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);

  // Catalog state
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogModal, setCatalogModal] = useState<{ mode: 'add' | 'edit'; data: typeof emptyCatalogForm; id?: number } | null>(null);
  const [savingCatalog, setSavingCatalog] = useState(false);

  // Packages state
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [packagesSearch, setPackagesSearch] = useState('');
  const [packageModal, setPackageModal] = useState<{ mode: 'add' | 'edit'; data: typeof emptyPackageForm; id?: number } | null>(null);
  const [savingPackage, setSavingPackage] = useState(false);

  // Concern state
  const [concerns, setConcerns] = useState<ConcernPreset[]>([]);
  const [concernModal, setConcernModal] = useState<{ mode: 'add' | 'edit'; data: typeof emptyConcernForm; id?: number } | null>(null);
  const [savingConcern, setSavingConcern] = useState(false);

  // Recommended state
  const [recommended, setRecommended] = useState<any[]>([]);
  const [recommendedModal, setRecommendedModal] = useState<{ mode: 'add' | 'edit'; data: typeof emptyRecommendedForm; id?: number } | null>(null);
  const [savingRecommended, setSavingRecommended] = useState(false);

  // Users state
  const [users, setUsers] = useState<any[]>([]);
  const [usersModal, setUsersModal] = useState<{ mode: 'add' | 'edit'; data: typeof emptyUserForm; id?: number } | null>(null);
  const [savingUsers, setSavingUsers] = useState(false);

  // Roles state
  const [roles, setRoles] = useState<any[]>([]);
  const [roleModal, setRoleModal] = useState<{ mode: 'add' | 'edit'; data: typeof emptyRoleForm; id?: number } | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, staffRes, catalogRes, packagesRes, concernsRes, recommendedRes, usersRes, rolesRes] = await Promise.all([
        api.get('/settings'),
        api.get('/staff'),
        api.get('/service-catalog?limit=250'),
        api.get('/service-catalog/packages'),
        api.get('/service-catalog/concern-presets'),
        api.get('/service-catalog/recommended-services').catch(() => ({ data: { data: [] } })),
        api.get('/auth/users').catch(() => ({ data: { data: [] } })),
        api.get('/auth/roles').catch(() => ({ data: { data: [] } }))
      ]);

      setSettings(settingsRes.data.data || {});
      setStaff(staffRes.data.data || []);
      setCatalog(catalogRes.data.data || []);
      setPackages(packagesRes.data.data || []);
      setConcerns(concernsRes.data.data || []);
      setRecommended(recommendedRes.data.data || []);
      setUsers(usersRes.data.data || []);
      setRoles(rolesRes.data.data || []);
    } catch (err) {
      showToast('Failed to load admin settings data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put('/settings', { settings });
      showToast('Settings updated successfully', 'success');
    } catch {
      showToast('Failed to update system settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Staff Handlers
  const handleSaveStaff = async () => {
    if (!staffModal) return;
    if (!staffModal.data.full_name || !staffModal.data.role || !staffModal.data.monthly_salary) {
      showToast('Please fill all required staff fields', 'warning');
      return;
    }
    setSavingStaff(true);
    try {
      if (staffModal.mode === 'add') {
        await api.post('/staff', staffModal.data);
        showToast('Staff member registered', 'success');
      } else {
        await api.put(`/staff/${staffModal.id}`, staffModal.data);
        showToast('Staff profile updated', 'success');
      }
      setStaffModal(null);
      const res = await api.get('/staff');
      setStaff(res.data.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save staff', 'error');
    } finally {
      setSavingStaff(false);
    }
  };

  const handleToggleStaff = async (id: number) => {
    try {
      const res = await api.patch(`/staff/${id}/toggle`);
      showToast(res.data.message, 'success');
      const staffRes = await api.get('/staff');
      setStaff(staffRes.data.data || []);
    } catch {
      showToast('Failed to toggle staff status', 'error');
    }
  };

  // Catalog Handlers
  const handleSaveCatalog = async () => {
    if (!catalogModal) return;
    if (!catalogModal.data.name || !catalogModal.data.default_rate) {
      showToast('Please fill all required catalog fields', 'warning');
      return;
    }
    setSavingCatalog(true);
    try {
      if (catalogModal.mode === 'add') {
        await api.post('/service-catalog', catalogModal.data);
        showToast('Item added to service catalog', 'success');
      } else {
        await api.put(`/service-catalog/${catalogModal.id}`, catalogModal.data);
        showToast('Service catalog item updated', 'success');
      }
      setCatalogModal(null);
      const res = await api.get('/service-catalog?limit=250');
      setCatalog(res.data.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save catalog item', 'error');
    } finally {
      setSavingCatalog(false);
    }
  };

  const handleDeleteCatalogItem = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this item from the recommended presets?')) return;
    try {
      await api.delete(`/service-catalog/${id}`);
      showToast('Catalog item removed', 'info');
      const res = await api.get('/service-catalog?limit=250');
      setCatalog(res.data.data || []);
    } catch {
      showToast('Failed to remove catalog item', 'error');
    }
  };

  // Packages Handlers
  const handleSavePackage = async () => {
    if (!packageModal) return;
    if (!packageModal.data.name) {
      showToast('Package name is required', 'warning');
      return;
    }
    setSavingPackage(true);
    try {
      if (packageModal.mode === 'add') {
        await api.post('/service-catalog/packages', packageModal.data);
        showToast('Service package created', 'success');
      } else {
        await api.put(`/service-catalog/packages/${packageModal.id}`, packageModal.data);
        showToast('Service package updated', 'success');
      }
      setPackageModal(null);
      const res = await api.get('/service-catalog/packages');
      setPackages(res.data.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save service package', 'error');
    } finally {
      setSavingPackage(false);
    }
  };

  const handleDeletePackage = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this service package?')) return;
    try {
      await api.delete(`/service-catalog/packages/${id}`);
      showToast('Service package deleted', 'info');
      const res = await api.get('/service-catalog/packages');
      setPackages(res.data.data || []);
    } catch {
      showToast('Failed to delete service package', 'error');
    }
  };

  // Concern Presets Handlers
  const handleSaveConcern = async () => {
    if (!concernModal) return;
    if (!concernModal.data.concern_text) {
      showToast('Concern text is required', 'warning');
      return;
    }
    setSavingConcern(true);
    try {
      if (concernModal.mode === 'add') {
        await api.post('/service-catalog/concern-presets', concernModal.data);
        showToast('Concern preset added', 'success');
      } else {
        await api.put(`/service-catalog/concern-presets/${concernModal.id}`, concernModal.data);
        showToast('Concern preset updated', 'success');
      }
      setConcernModal(null);
      const res = await api.get('/service-catalog/concern-presets');
      setConcerns(res.data.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save concern preset', 'error');
    } finally {
      setSavingConcern(false);
    }
  };

  const handleDeleteConcern = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this concern preset?')) return;
    try {
      await api.delete(`/service-catalog/concern-presets/${id}`);
      showToast('Concern preset removed', 'info');
      const res = await api.get('/service-catalog/concern-presets');
      setConcerns(res.data.data || []);
    } catch {
      showToast('Failed to delete concern preset', 'error');
    }
  };

  // Recommended Handlers
  const handleSaveRecommended = async () => {
    if (!recommendedModal) return;
    if (!recommendedModal.data.name || !recommendedModal.data.category || !recommendedModal.data.period) {
      showToast('Please fill all required fields', 'warning');
      return;
    }
    setSavingRecommended(true);
    try {
      if (recommendedModal.mode === 'add') {
        await api.post('/service-catalog/recommended-services', recommendedModal.data);
        showToast('Recommended service preset added', 'success');
      } else {
        await api.put(`/service-catalog/recommended-services/${recommendedModal.id}`, recommendedModal.data);
        showToast('Recommended service preset updated', 'success');
      }
      setRecommendedModal(null);
      const res = await api.get('/service-catalog/recommended-services');
      setRecommended(res.data.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save recommended service', 'error');
    } finally {
      setSavingRecommended(false);
    }
  };

  const handleDeleteRecommended = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this recommended service preset?')) return;
    try {
      await api.delete(`/service-catalog/recommended-services/${id}`);
      showToast('Recommended service preset removed', 'info');
      const res = await api.get('/service-catalog/recommended-services');
      setRecommended(res.data.data || []);
    } catch {
      showToast('Failed to delete recommended service preset', 'error');
    }
  };

  // User Accounts Handlers
  const handleSaveUser = async () => {
    if (!usersModal) return;
    if (!usersModal.data.username || !usersModal.data.full_name || !usersModal.data.role) {
      showToast('Please fill all required fields', 'warning');
      return;
    }
    if (usersModal.mode === 'add' && !usersModal.data.password) {
      showToast('Password is required for new accounts', 'warning');
      return;
    }
    setSavingUsers(true);
    try {
      if (usersModal.mode === 'add') {
        await api.post('/auth/users', usersModal.data);
        showToast('User account created', 'success');
      } else {
        await api.put(`/auth/users/${usersModal.id}`, usersModal.data);
        showToast('User account updated', 'success');
      }
      setUsersModal(null);
      const res = await api.get('/auth/users');
      setUsers(res.data.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save user account', 'error');
    } finally {
      setSavingUsers(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this user account? This will block their login access immediately.')) return;
    try {
      await api.delete(`/auth/users/${id}`);
      showToast('User account deleted', 'info');
      const res = await api.get('/auth/users');
      setUsers(res.data.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete user account', 'error');
    }
  };

  // Roles CRUD Handlers
  const handleSaveRole = async () => {
    if (!roleModal) return;
    if (!roleModal.data.role_name) {
      showToast('Role name is required', 'warning');
      return;
    }
    setSavingRole(true);
    try {
      if (roleModal.mode === 'add') {
        await api.post('/auth/roles', roleModal.data);
        showToast('Role created successfully', 'success');
      } else {
        await api.put(`/auth/roles/${roleModal.id}`, roleModal.data);
        showToast('Role updated successfully', 'success');
      }
      setRoleModal(null);
      const res = await api.get('/auth/roles');
      setRoles(res.data.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save role', 'error');
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this role? Users assigned to this role might lose their custom permissions.')) return;
    try {
      await api.delete(`/auth/roles/${id}`);
      showToast('Role deleted successfully', 'info');
      const res = await api.get('/auth/roles');
      setRoles(res.data.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete role', 'error');
    }
  };

  const filteredCatalog = catalog.filter(item =>
    item.item_name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(catalogSearch.toLowerCase())
  );

  const filteredPackages = packages.filter(pkg =>
    pkg.name.toLowerCase().includes(packagesSearch.toLowerCase()) ||
    (pkg.category || '').toLowerCase().includes(packagesSearch.toLowerCase())
  );

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 p-4 sm:p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight font-headline text-on-surface">Super Admin Panel</h2>
          <p className="text-on-surface-variant font-medium mt-1">Live GMS Management & Global System Overrides</p>
        </div>
      </header>

      {/* Tab Selector */}
      <div className="flex border-b border-gray-100 overflow-x-auto gap-2 pb-1 scrollbar-thin">
        {(['settings', 'staff', 'catalog', 'concerns', 'recommended', 'users', 'roles'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-bold uppercase tracking-wider rounded-t-xl transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-primary text-white shadow-md'
                : 'text-on-surface-muted hover:text-on-surface hover:bg-gray-50'
            }`}
          >
            {tab === 'settings' && 'Business Profile & Settings'}
            {tab === 'staff' && 'Staff Management'}
            {tab === 'catalog' && 'Service Catalog'}
            {tab === 'concerns' && 'Customer Concerns'}
            {tab === 'recommended' && 'Recommended Services'}
            {tab === 'users' && 'User Accounts'}
            {tab === 'roles' && 'Roles & Permissions'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl animate-spin text-primary">progress_activity</span>
          <p className="mt-4 font-semibold text-lg">Fetching live system data overrides...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeTab === 'settings' && (
            <motion.div
              key="settings-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 xl:grid-cols-12 gap-8"
            >
              {/* Form Config Fields */}
              <div className="xl:col-span-7 space-y-6">
                <div className="glass-card-solid p-6 space-y-6">
                  <h3 className="font-headline text-xl font-bold text-on-surface border-b pb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">storefront</span>
                    Company Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">Business Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.business_name || ''}
                        onChange={e => handleSettingChange('business_name', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">GSTIN Registration</label>
                      <input
                        type="text"
                        className="form-input uppercase"
                        value={settings.business_gstin || ''}
                        onChange={e => handleSettingChange('business_gstin', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">Contact Phone</label>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.business_phone || ''}
                        onChange={e => handleSettingChange('business_phone', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">Contact Email</label>
                      <input
                        type="email"
                        className="form-input"
                        value={settings.business_email || ''}
                        onChange={e => handleSettingChange('business_email', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">Physical Address</label>
                    <textarea
                      rows={3}
                      className="form-input"
                      value={settings.business_address || ''}
                      onChange={e => handleSettingChange('business_address', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">State</label>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.business_state || ''}
                        onChange={e => handleSettingChange('business_state', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">State Code</label>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.business_state_code || ''}
                        onChange={e => handleSettingChange('business_state_code', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="glass-card-solid p-6 space-y-6">
                  <h3 className="font-headline text-xl font-bold text-on-surface border-b pb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">tune</span>
                    System Constants & Prefixes
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">Invoice Prefix</label>
                      <input
                        type="text"
                        className="form-input uppercase"
                        value={settings.invoice_prefix || ''}
                        onChange={e => handleSettingChange('invoice_prefix', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">Invoice Prefix</label>
                      <input
                        type="text"
                        className="form-input uppercase"
                        value={settings.estimate_prefix || ''}
                        onChange={e => handleSettingChange('estimate_prefix', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">Detailing Studio Prefix</label>
                      <input
                        type="text"
                        className="form-input uppercase"
                        value={settings.job_prefix || ''}
                        onChange={e => handleSettingChange('job_prefix', e.target.value)}
                      />
                    </div>
                    
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="bg-primary hover:bg-primary/95 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-md shadow-primary/20 flex items-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-lg">save</span>
                    {savingSettings ? 'Saving Settings...' : 'Save Live Overrides'}
                  </button>
                </div>
              </div>

              {/* Print Header Preview */}
              <div className="xl:col-span-5 space-y-6">
                <div className="glass-card-solid p-6 bg-slate-900 text-slate-100 space-y-4">
                  <h3 className="font-headline text-lg font-bold text-cyan-400 flex items-center gap-2">
                    <span className="material-symbols-outlined">visibility</span>
                    Live Header Preview
                  </h3>
                  <p className="text-xs text-slate-400">
                    This is how your business header will instantly render on printable invoices, Estimates, and Work Orders.
                  </p>

                  <div className="bg-white text-slate-800 p-5 rounded-xl border border-slate-700 shadow-inner font-sans min-h-[160px] text-xs leading-normal">
                    <div className="text-center border-b-2 border-cyan-700 pb-2 mb-3">
                      <h4 className="font-extrabold text-base text-cyan-800 uppercase tracking-wide">
                        {settings.business_name || 'Happy Car Wash'}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                        Live Print Format
                      </p>
                    </div>

                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-12 font-medium text-slate-700">
                        <p className="font-bold text-slate-800 mb-1">Company Details:</p>
                        <p className="whitespace-pre-wrap">{settings.business_address || 'Address...'}</p>

                        <p>
                          <strong>Contact:</strong> {settings.business_phone || 'Phone...'} |{' '}
                          <strong>Email:</strong> {settings.business_email || 'Email...'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'staff' && (
            <motion.div
              key="staff-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-headline text-xl font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">groups</span>
                  Active Staff Master Register
                </h3>
                <button
                  onClick={() => setStaffModal({ mode: 'add', data: { ...emptyStaffForm } })}
                  className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Add Staff Member
                </button>
              </div>

              <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[750px]">
                    <thead className="text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-gray-50/50 border-b border-gray-100">
                      <tr>
                        <th className="py-4 px-5">Staff Member</th>
                        <th className="py-4 px-5">Designation</th>
                        <th className="py-4 px-5">Phone No</th>
                        <th className="py-4 px-5">Salary (Monthly)</th>
                        <th className="py-4 px-5 text-center">Status</th>
                        <th className="py-4 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {staff.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-on-surface-variant font-medium">
                            No staff records currently registered.
                          </td>
                        </tr>
                      ) : (
                        staff.map(s => (
                          <tr key={s.id} className="hover:bg-gray-50 border-b border-gray-50 transition-all">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                  {s.full_name[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-on-surface">{s.full_name}</p>
                                  <p className="text-[10px] text-on-surface-variant font-mono">{s.staff_code}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className="bg-gray-100 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded text-on-surface-variant">
                                {s.role}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-semibold text-on-surface-variant">
                              {s.mobile_no || 'N/A'}
                            </td>
                            <td className="px-5 py-3 font-bold text-primary">
                              {formatCurrency(s.monthly_salary, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <button
                                onClick={() => handleToggleStaff(s.id)}
                                className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all ${
                                  s.is_active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                {s.is_active ? 'Active' : 'Inactive'}
                              </button>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <button
                                onClick={() =>
                                  setStaffModal({
                                    mode: 'edit',
                                    id: s.id,
                                    data: {
                                      full_name: s.full_name,
                                      role: s.role,
                                      mobile_no: s.mobile_no || '',
                                      date_of_joining: s.date_of_joining?.slice(0, 10) || '',
                                      monthly_salary: String(s.monthly_salary),
                                      is_active: s.is_active
                                    }
                                  })
                                }
                                className="p-1.5 text-on-surface-muted hover:text-primary transition-colors hover:bg-gray-100 rounded-lg"
                                title="Edit Staff Member"
                              >
                                <span className="material-symbols-outlined text-lg">edit</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'catalog' && (
            <motion.div
              key="catalog-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-headline text-xl font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">inventory_2</span>
                  Service Presets & Catalog Master
                </h3>

                <div className="flex gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-sm border border-gray-100 flex-1 sm:flex-initial">
                    <span className="material-symbols-outlined text-on-surface-variant text-sm">search</span>
                    <input
                      className="bg-transparent border-none focus:ring-0 text-sm text-on-surface placeholder:text-on-surface-variant font-medium w-full sm:w-48"
                      placeholder="Search catalog presets..."
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => setCatalogModal({ mode: 'add', data: { ...emptyCatalogForm } })}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    New Catalog Preset
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[750px]">
                    <thead className="text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-gray-50/50 border-b border-gray-100">
                      <tr>
                        <th className="py-4 px-5">Preset Service / Item</th>
                        <th className="py-4 px-5">Category</th>
                        <th className="py-4 px-5">Type</th>
                        <th className="py-4 px-5">Default Rate</th>
                        <th className="py-4 px-5">HSN / SAC</th>
                        <th className="py-4 px-5">Tax</th>
                        <th className="py-4 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredCatalog.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-on-surface-variant font-medium">
                            No catalog items found matching your filters.
                          </td>
                        </tr>
                      ) : (
                        filteredCatalog.map(item => (
                          <tr key={`${item.source}_${item.id}`} className="hover:bg-gray-50 border-b border-gray-50 transition-all">
                            <td className="px-5 py-3 font-bold text-on-surface">
                              {item.item_name}
                            </td>
                            <td className="px-5 py-3 text-on-surface-variant font-semibold">
                              {item.category || 'General'}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-block text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded ${
                                item.item_type === 'part'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}>
                                {item.item_type}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-bold text-primary">
                              {formatCurrency(item.default_rate, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </td>
                            <td className="px-5 py-3 font-mono text-xs text-on-surface-variant">
                              {item.hsn_sac || '—'}
                            </td>
                            <td className="px-5 py-3 font-semibold text-on-surface-variant">
                              {item.default_tax_pct}%
                            </td>
                            <td className="px-5 py-3 text-right">
                              {item.source === 'catalog' ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() =>
                                      setCatalogModal({
                                        mode: 'edit',
                                        id: item.id,
                                        data: {
                                          name: item.item_name,
                                          category: item.category || 'General',
                                          item_type: item.item_type,
                                          default_rate: String(item.default_rate),
                                          hsn_sac: item.hsn_sac || '',
                                          tax_pct: item.default_tax_pct || 18
                                        }
                                      })
                                    }
                                    className="p-1.5 text-on-surface-muted hover:text-primary transition-colors hover:bg-gray-100 rounded-lg"
                                    title="Edit Preset"
                                  >
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCatalogItem(item.id)}
                                    className="p-1.5 text-on-surface-muted hover:text-red-500 transition-colors hover:bg-gray-100 rounded-lg"
                                    title="Delete Preset"
                                  >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] uppercase font-bold text-slate-400 px-2 select-none" title="Editable via Parts Inventory tab">
                                  Inventory Item
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'packages' && (
            <motion.div
              key="packages-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-headline text-xl font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">redeem</span>
                  Service Package Presets
                </h3>

                <div className="flex gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-sm border border-gray-100 flex-1 sm:flex-initial">
                    <span className="material-symbols-outlined text-on-surface-variant text-sm">search</span>
                    <input
                      className="bg-transparent border-none focus:ring-0 text-sm text-on-surface placeholder:text-on-surface-variant font-medium w-full sm:w-48"
                      placeholder="Search packages..."
                      value={packagesSearch}
                      onChange={e => setPackagesSearch(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => setPackageModal({ mode: 'add', data: { ...emptyPackageForm } })}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    New Package Preset
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPackages.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-on-surface-variant font-medium">
                    No service packages found.
                  </div>
                ) : (
                  filteredPackages.map(pkg => (
                    <div key={pkg.id} className="glass-card-solid p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-bold text-base text-on-surface font-headline">{pkg.name}</h4>
                            <span className="text-[10px] uppercase font-extrabold text-primary-dark/80 bg-primary/10 px-2 py-0.5 rounded mt-1 inline-block">
                              {pkg.category} Package
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() =>
                                setPackageModal({
                                  mode: 'edit',
                                  id: pkg.id,
                                  data: {
                                    name: pkg.name,
                                    category: pkg.category,
                                    description: pkg.description || '',
                                    parts: [...pkg.parts],
                                    labour: [...pkg.labour]
                                  }
                                })
                              }
                              className="p-1.5 text-on-surface-muted hover:text-primary hover:bg-gray-100 rounded-lg transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button
                              onClick={() => handleDeletePackage(pkg.id)}
                              className="p-1.5 text-on-surface-muted hover:text-red-500 hover:bg-red-55 rounded-lg transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        </div>

                        {pkg.description && (
                          <p className="text-xs text-on-surface-variant mb-4 whitespace-pre-wrap">{pkg.description}</p>
                        )}

                        <div className="space-y-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                              Included Parts ({pkg.parts.length})
                            </span>
                            {pkg.parts.length === 0 ? (
                              <span className="text-xs text-slate-400 italic">No parts included</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {pkg.parts.map((p, idx) => (
                                  <span key={idx} className="bg-amber-50 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded border border-amber-200">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                              Included Labour ({pkg.labour.length})
                            </span>
                            {pkg.labour.length === 0 ? (
                              <span className="text-xs text-slate-400 italic">No labour included</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {pkg.labour.map((l, idx) => (
                                  <span key={idx} className="bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-indigo-100">
                                    {l}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'concerns' && (
            <motion.div
              key="concerns-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-headline text-xl font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">checklist</span>
                  Customer Concern Preset Chips
                </h3>
                <button
                  onClick={() => setConcernModal({ mode: 'add', data: { ...emptyConcernForm } })}
                  className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Add Concern Preset
                </button>
              </div>

              <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[650px]">
                    <thead className="text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-gray-50/50 border-b border-gray-100">
                      <tr>
                        <th className="py-4 px-5">Concern Preset Text</th>
                        <th className="py-4 px-5">Category / Area</th>
                        <th className="py-4 px-5">Sort Order</th>
                        <th className="py-4 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {concerns.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-on-surface-variant font-medium">
                            No concern presets created yet.
                          </td>
                        </tr>
                      ) : (
                        concerns.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50 border-b border-gray-50 transition-all">
                            <td className="px-5 py-3 font-semibold text-on-surface">
                              {item.concern_text}
                            </td>
                            <td className="px-5 py-3 text-on-surface-variant font-medium">
                              {item.category || 'General'}
                            </td>
                            <td className="px-5 py-3 font-mono text-xs text-on-surface-variant">
                              {item.sort_order}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() =>
                                    setConcernModal({
                                      mode: 'edit',
                                      id: item.id,
                                      data: {
                                        concern_text: item.concern_text,
                                        category: item.category || 'General',
                                        sort_order: item.sort_order
                                      }
                                    })
                                  }
                                  className="p-1.5 text-on-surface-muted hover:text-primary transition-colors hover:bg-gray-100 rounded-lg"
                                  title="Edit Preset"
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteConcern(item.id)}
                                  className="p-1.5 text-on-surface-muted hover:text-red-500 transition-colors hover:bg-gray-100 rounded-lg"
                                  title="Delete Preset"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'recommended' && (
            <motion.div
              key="recommended-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-headline text-xl font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">bookmark</span>
                  Recommended Service Presets
                </h3>
                <button
                  onClick={() => setRecommendedModal({ mode: 'add', data: { ...emptyRecommendedForm } })}
                  className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Add Recommended Service
                </button>
              </div>

              <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[650px]">
                    <thead className="text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-gray-50/50 border-b border-gray-100">
                      <tr>
                        <th className="py-4 px-5">Service / Item Name</th>
                        <th className="py-4 px-5">Category</th>
                        <th className="py-4 px-5">Type</th>
                        <th className="py-4 px-5">Period</th>
                        <th className="py-4 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {recommended.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-on-surface-variant font-medium">
                            No recommended service presets created yet.
                          </td>
                        </tr>
                      ) : (
                        recommended.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50 border-b border-gray-50 transition-all">
                            <td className="px-5 py-3 font-semibold text-on-surface">
                              {item.name}
                            </td>
                            <td className="px-5 py-3 text-on-surface-variant font-medium">
                              {item.category}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-block text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded ${
                                item.item_type === 'part'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}>
                                {item.item_type}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-on-surface font-medium">
                              {item.period}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() =>
                                    setRecommendedModal({
                                      mode: 'edit',
                                      id: item.id,
                                      data: {
                                        name: item.name,
                                        category: item.category,
                                        item_type: item.item_type,
                                        period: item.period
                                      }
                                    })
                                  }
                                  className="p-1.5 text-on-surface-muted hover:text-primary transition-colors hover:bg-gray-100 rounded-lg"
                                  title="Edit Preset"
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteRecommended(item.id)}
                                  className="p-1.5 text-on-surface-muted hover:text-red-500 transition-colors hover:bg-gray-100 rounded-lg"
                                  title="Delete Preset"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="users-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-headline text-xl font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">account_circle</span>
                  GMS Login User Accounts
                </h3>
                <button
                  onClick={() => setUsersModal({ mode: 'add', data: { ...emptyUserForm } })}
                  className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Create Login Account
                </button>
              </div>

              <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[650px]">
                    <thead className="text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-gray-50/50 border-b border-gray-100">
                      <tr>
                        <th className="py-4 px-5">Full Name</th>
                        <th className="py-4 px-5">Username</th>
                        <th className="py-4 px-5">Login Role</th>
                        <th className="py-4 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-on-surface-variant font-medium">
                            No user login accounts created yet.
                          </td>
                        </tr>
                      ) : (
                        users.map(u => (
                          <tr key={u.id} className="hover:bg-gray-50 border-b border-gray-50 transition-all">
                            <td className="px-5 py-3 font-semibold text-on-surface">
                              {u.full_name}
                            </td>
                            <td className="px-5 py-3 text-on-surface-variant font-mono">
                              {u.username}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-block text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded ${
                                u.role === 'admin'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : u.role === 'service_advisor'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}>
                                {u.role?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() =>
                                    setUsersModal({
                                      mode: 'edit',
                                      id: u.id,
                                      data: {
                                        username: u.username,
                                        password: '',
                                        full_name: u.full_name,
                                        role: u.role
                                      }
                                    })
                                  }
                                  className="p-1.5 text-on-surface-muted hover:text-primary transition-colors hover:bg-gray-100 rounded-lg"
                                  title="Edit User"
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="p-1.5 text-on-surface-muted hover:text-red-500 transition-colors hover:bg-gray-100 rounded-lg"
                                  title="Delete User"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'roles' && (
            <motion.div
              key="roles-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-headline text-xl font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">rule</span>
                  Staff Roles & Permissions
                </h3>
                <button
                  onClick={() => setRoleModal({ mode: 'add', data: { ...emptyRoleForm } })}
                  className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Create Custom Role
                </button>
              </div>

              <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[1000px]">
                    <thead className="text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-gray-50/50 border-b border-gray-100">
                      <tr>
                        <th className="py-4 px-5">Role Name</th>
                        <th className="py-4 px-3 text-center">Create Orders</th>
                        <th className="py-4 px-3 text-center">Delete Invoice</th>
                        <th className="py-4 px-3 text-center">View Accounts</th>
                        <th className="py-4 px-3 text-center">View Payments</th>
                        <th className="py-4 px-3 text-center">Edit Invoices</th>
                        <th className="py-4 px-3 text-center">Inventory</th>
                        <th className="py-4 px-3 text-center">Customer DB</th>
                        <th className="py-4 px-3 text-center">Reports</th>
                        <th className="py-4 px-3 text-center">Settings</th>
                        <th className="py-4 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {roles.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-8 text-center text-on-surface-variant font-medium">
                            No roles defined. System default permissions will be applied.
                          </td>
                        </tr>
                      ) : (
                        roles.map(r => {
                          const isSystem = ['admin', 'service_advisor', 'technician'].includes(r.role_name);
                          return (
                            <tr key={r.id} className="hover:bg-gray-50 border-b border-gray-50 transition-all">
                              <td className="px-5 py-4 font-bold text-on-surface capitalize">
                                {r.role_name?.replace('_', ' ')}
                                {isSystem && <span className="ml-2 text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">System</span>}
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className={`material-symbols-outlined text-lg ${r.perm_create_job_card ? 'text-emerald-500' : 'text-slate-300'}`}>
                                  {r.perm_create_job_card ? 'check_circle' : 'cancel'}
                                </span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className={`material-symbols-outlined text-lg ${r.perm_delete_invoice ? 'text-emerald-500' : 'text-slate-300'}`}>
                                  {r.perm_delete_invoice ? 'check_circle' : 'cancel'}
                                </span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className={`material-symbols-outlined text-lg ${r.perm_view_accounts ? 'text-emerald-500' : 'text-slate-300'}`}>
                                  {r.perm_view_accounts ? 'check_circle' : 'cancel'}
                                </span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className={`material-symbols-outlined text-lg ${r.perm_view_payments ? 'text-emerald-500' : 'text-slate-300'}`}>
                                  {r.perm_view_payments ? 'check_circle' : 'cancel'}
                                </span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className={`material-symbols-outlined text-lg ${r.perm_edit_estimate ? 'text-emerald-500' : 'text-slate-300'}`}>
                                  {r.perm_edit_estimate ? 'check_circle' : 'cancel'}
                                </span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className={`material-symbols-outlined text-lg ${r.perm_inventory ? 'text-emerald-500' : 'text-slate-300'}`}>
                                  {r.perm_inventory ? 'check_circle' : 'cancel'}
                                </span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className={`material-symbols-outlined text-lg ${r.perm_customer ? 'text-emerald-500' : 'text-slate-300'}`}>
                                  {r.perm_customer ? 'check_circle' : 'cancel'}
                                </span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className={`material-symbols-outlined text-lg ${r.perm_reports ? 'text-emerald-500' : 'text-slate-300'}`}>
                                  {r.perm_reports ? 'check_circle' : 'cancel'}
                                </span>
                              </td>
                              <td className="px-3 py-4 text-center">
                                <span className={`material-symbols-outlined text-lg ${r.perm_settings ? 'text-emerald-500' : 'text-slate-300'}`}>
                                  {r.perm_settings ? 'check_circle' : 'cancel'}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() =>
                                      setRoleModal({
                                        mode: 'edit',
                                        id: r.id,
                                        data: { ...r }
                                      })
                                    }
                                    className="p-1.5 text-on-surface-muted hover:text-primary transition-colors hover:bg-gray-100 rounded-lg"
                                    title="Edit Role & Permissions"
                                  >
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                  </button>
                                  {!isSystem && (
                                    <button
                                      onClick={() => handleDeleteRole(r.id)}
                                      className="p-1.5 text-on-surface-muted hover:text-red-500 transition-colors hover:bg-gray-100 rounded-lg"
                                      title="Delete Role"
                                    >
                                      <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Staff Modal */}
      {staffModal && (
        <Modal
          title={staffModal.mode === 'add' ? 'New Hire Registration' : 'Edit Staff Profile'}
          onClose={() => setStaffModal(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Rahul Sharma"
                value={staffModal.data.full_name}
                onChange={e => setStaffModal({ ...staffModal, data: { ...staffModal.data, full_name: e.target.value } })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Role / Designation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Head Mechanic"
                  value={staffModal.data.role}
                  onChange={e => setStaffModal({ ...staffModal, data: { ...staffModal.data, role: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Mobile Number
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="10 Digits"
                  maxLength={10}
                  value={staffModal.data.mobile_no}
                  onChange={e => setStaffModal({ ...staffModal, data: { ...staffModal.data, mobile_no: e.target.value } })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Date of Joining
                </label>
                <input
                  type="date"
                  className="form-input cursor-pointer"
                  value={staffModal.data.date_of_joining}
                  onChange={e => setStaffModal({ ...staffModal, data: { ...staffModal.data, date_of_joining: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Monthly Base Salary (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={staffModal.data.monthly_salary}
                  onChange={e => setStaffModal({ ...staffModal, data: { ...staffModal.data, monthly_salary: e.target.value } })}
                />
              </div>
            </div>
          </div>
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSaveStaff}
              disabled={savingStaff}
              className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              {savingStaff ? 'Processing...' : staffModal.mode === 'add' ? 'Confirm Hire' : 'Save Profile'}
            </button>
          </div>
        </Modal>
      )}

      {/* Catalog Preset Modal */}
      {catalogModal && (
        <Modal
          title={catalogModal.mode === 'add' ? 'Add Catalog Preset' : 'Edit Catalog Preset'}
          onClose={() => setCatalogModal(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Service / Item Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Engine Oil Flush Preset"
                value={catalogModal.data.name}
                onChange={e => setCatalogModal({ ...catalogModal, data: { ...catalogModal.data, name: e.target.value } })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Category / Group
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Engine Service"
                  value={catalogModal.data.category}
                  onChange={e => setCatalogModal({ ...catalogModal, data: { ...catalogModal.data, category: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Item Type
                </label>
                <select
                  className="form-input cursor-pointer"
                  value={catalogModal.data.item_type}
                  onChange={e => setCatalogModal({ ...catalogModal, data: { ...catalogModal.data, item_type: e.target.value as any } })}
                >
                  <option value="labour">Labour / Service</option>
                  <option value="part">Part / Material</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Default Rate (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={catalogModal.data.default_rate}
                  onChange={e => setCatalogModal({ ...catalogModal, data: { ...catalogModal.data, default_rate: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  HSN / SAC Code
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 998729"
                  value={catalogModal.data.hsn_sac}
                  onChange={e => setCatalogModal({ ...catalogModal, data: { ...catalogModal.data, hsn_sac: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Default Tax %
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="18"
                  value={catalogModal.data.tax_pct}
                  onChange={e => setCatalogModal({ ...catalogModal, data: { ...catalogModal.data, tax_pct: Number(e.target.value) } })}
                />
              </div>
            </div>
          </div>
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSaveCatalog}
              disabled={savingCatalog}
              className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              {savingCatalog ? 'Saving Item...' : catalogModal.mode === 'add' ? 'Add Item' : 'Save Update'}
            </button>
          </div>
        </Modal>
      )}

      {/* Customer Concern Modal */}
      {concernModal && (
        <Modal
          title={concernModal.mode === 'add' ? 'Add Concern Preset' : 'Edit Concern Preset'}
          onClose={() => setConcernModal(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Concern Preset Text <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Engine making high noise while accelerating"
                value={concernModal.data.concern_text}
                onChange={e => setConcernModal({ ...concernModal, data: { ...concernModal.data, concern_text: e.target.value } })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Category / Group
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Engine"
                  value={concernModal.data.category}
                  onChange={e => setConcernModal({ ...concernModal, data: { ...concernModal.data, category: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Sort Order
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={concernModal.data.sort_order}
                  onChange={e => setConcernModal({ ...concernModal, data: { ...concernModal.data, sort_order: Number(e.target.value) } })}
                />
              </div>
            </div>
          </div>
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSaveConcern}
              disabled={savingConcern}
              className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              {savingConcern ? 'Saving Preset...' : concernModal.mode === 'add' ? 'Add Preset' : 'Save Update'}
            </button>
          </div>
        </Modal>
      )}

      {/* Service Package Modal */}
      {packageModal && (
        <PackageModalWrapper
          modal={packageModal}
          setModal={setPackageModal}
          onSave={handleSavePackage}
          saving={savingPackage}
        />
      )}

      {/* Recommended Modal */}
      {recommendedModal && (
        <Modal
          title={recommendedModal.mode === 'add' ? 'New Recommended Service Preset' : 'Edit Recommended Service Preset'}
          onClose={() => setRecommendedModal(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">
                Service / Preset Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Engine Oil & Filter Change"
                value={recommendedModal.data.name}
                onChange={e => setRecommendedModal({ ...recommendedModal, data: { ...recommendedModal.data, name: e.target.value } })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Mechanical"
                  value={recommendedModal.data.category}
                  onChange={e => setRecommendedModal({ ...recommendedModal, data: { ...recommendedModal.data, category: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">
                  Periodicity / Interval <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 10000 km or 1 yr"
                  value={recommendedModal.data.period}
                  onChange={e => setRecommendedModal({ ...recommendedModal, data: { ...recommendedModal.data, period: e.target.value } })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">Item Type</label>
              <select
                className="form-input"
                value={recommendedModal.data.item_type}
                onChange={e => setRecommendedModal({ ...recommendedModal, data: { ...recommendedModal.data, item_type: e.target.value as any } })}
              >
                <option value="labour">Labour Service</option>
                <option value="part">Spare Part</option>
              </select>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSaveRecommended}
                disabled={savingRecommended}
                className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                {savingRecommended ? 'Saving...' : 'Save Preset'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Users Modal */}
      {usersModal && (
        <Modal
          title={usersModal.mode === 'add' ? 'Create New User Login' : 'Edit User Login'}
          onClose={() => setUsersModal(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Amit Patel"
                value={usersModal.data.full_name}
                onChange={e => setUsersModal({ ...usersModal, data: { ...usersModal.data, full_name: e.target.value } })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. amit_advisor"
                  value={usersModal.data.username}
                  onChange={e => setUsersModal({ ...usersModal, data: { ...usersModal.data, username: e.target.value.toLowerCase().trim() } })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">
                  Login Role <span className="text-red-500">*</span>
                </label>
                <select
                  className="form-input text-xs font-bold"
                  value={usersModal.data.role}
                  onChange={e => setUsersModal({ ...usersModal, data: { ...usersModal.data, role: e.target.value } })}
                >
                  <option value="admin">Administrator (admin)</option>
                  <option value="service_advisor">Service Advisor (service_advisor)</option>
                  <option value="technician">Technician / Mechanic (technician)</option>
                  {roles.filter(r => !['admin', 'service_advisor', 'technician'].includes(r.role_name)).map(r => (
                    <option key={r.id} value={r.role_name}>
                      {r.role_name?.replace('_', ' ').toUpperCase()} ({r.role_name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">
                Password {usersModal.mode === 'edit' && <span className="text-[10px] text-slate-400 font-normal">(Leave blank to keep current)</span>}
              </label>
              <input
                type="password"
                className="form-input"
                placeholder={usersModal.mode === 'add' ? '••••••••' : 'Change password'}
                value={usersModal.data.password || ''}
                onChange={e => setUsersModal({ ...usersModal, data: { ...usersModal.data, password: e.target.value } })}
              />
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSaveUser}
                disabled={savingUsers}
                className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                {savingUsers ? 'Saving...' : 'Save User Account'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Role Modal */}
      {roleModal && (
        <Modal
          title={roleModal.mode === 'add' ? 'Create Custom Role & Permissions' : 'Edit Role Permissions'}
          onClose={() => setRoleModal(null)}
        >
          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. supervisor"
                disabled={['admin', 'service_advisor', 'technician'].includes(roleModal.data.role_name)}
                value={roleModal.data.role_name}
                onChange={e => setRoleModal({ ...roleModal, data: { ...roleModal.data, role_name: e.target.value.toLowerCase().replace(/\s+/g, '_') } })}
              />
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider border-b pb-1.5">
                Enable Modules & Permissions
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'perm_create_job_card', label: 'Create/Edit Detailing Studio Orders' },
                  { key: 'perm_delete_invoice', label: 'Delete Invoices / Bills' },
                  { key: 'perm_view_accounts', label: 'Access Accounts Module' },
                  { key: 'perm_view_payments', label: 'View Customer Payments' },
                  { key: 'perm_edit_estimate', label: 'Edit Invoices & Quotes' },
                  { key: 'perm_inventory', label: 'Access Inventory & Parts' },
                  { key: 'perm_customer', label: 'Manage Customer Database' },
                  { key: 'perm_reports', label: 'Access Performance Reports' },
                  { key: 'perm_settings', label: 'Access System Settings' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 p-3 border border-slate-100 hover:bg-slate-50/50 rounded-xl cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      className="w-4.5 h-4.5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                      checked={Boolean((roleModal.data as any)[key])}
                      onChange={e => setRoleModal({
                        ...roleModal,
                        data: { ...roleModal.data, [key]: e.target.checked ? 1 : 0 }
                      })}
                    />
                    <span className="text-xs font-bold text-on-surface">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSaveRole}
                disabled={savingRole}
                className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                {savingRole ? 'Saving Permissions...' : 'Save Role Permissions'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AnimatedPage>
  );
}

function PackageModalWrapper({
  modal,
  setModal,
  onSave,
  saving
}: {
  modal: { mode: 'add' | 'edit'; data: typeof emptyPackageForm; id?: number };
  setModal: (m: any) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [newPart, setNewPart] = useState('');
  const [newLabout, setNewLabour] = useState('');

  const addPart = () => {
    if (!newPart.trim()) return;
    if (modal.data.parts.includes(newPart.trim())) return;
    setModal({
      ...modal,
      data: {
        ...modal.data,
        parts: [...modal.data.parts, newPart.trim()]
      }
    });
    setNewPart('');
  };

  const removePart = (pName: string) => {
    setModal({
      ...modal,
      data: {
        ...modal.data,
        parts: modal.data.parts.filter(p => p !== pName)
      }
    });
  };

  const addLabour = () => {
    if (!newLabout.trim()) return;
    if (modal.data.labour.includes(newLabout.trim())) return;
    setModal({
      ...modal,
      data: {
        ...modal.data,
        labour: [...modal.data.labour, newLabout.trim()]
      }
    });
    setNewLabour('');
  };

  const removeLabour = (lName: string) => {
    setModal({
      ...modal,
      data: {
        ...modal.data,
        labour: modal.data.labour.filter(l => l !== lName)
      }
    });
  };

  return (
    <Modal
      title={modal.mode === 'add' ? 'Create Package Preset' : 'Edit Package Preset'}
      onClose={() => setModal(null)}
    >
      <div className="space-y-4 font-sans">
        <div>
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
            Package Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Premium Detailing Package"
            value={modal.data.name}
            onChange={e => setModal({ ...modal, data: { ...modal.data, name: e.target.value } })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
              Category
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Detailing / Mechanic"
              value={modal.data.category}
              onChange={e => setModal({ ...modal, data: { ...modal.data, category: e.target.value } })}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
              Description
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Short description..."
              value={modal.data.description}
              onChange={e => setModal({ ...modal, data: { ...modal.data, description: e.target.value } })}
            />
          </div>
        </div>

        {/* Parts Section */}
        <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">
            Included Parts
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              className="form-input py-2 text-sm"
              placeholder="Add part name (e.g. Engine Oil 5W30)"
              value={newPart}
              onChange={e => setNewPart(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPart())}
            />
            <button
              onClick={addPart}
              className="bg-secondary text-slate-800 px-4 rounded-xl text-xs font-bold hover:bg-secondary/90 transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {modal.data.parts.length === 0 ? (
              <span className="text-xs text-slate-400 italic">No parts added yet.</span>
            ) : (
              modal.data.parts.map(p => (
                <span
                  key={p}
                  className="bg-amber-50 text-amber-800 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5"
                >
                  <span>{p}</span>
                  <button
                    onClick={() => removePart(p)}
                    className="hover:text-red-500 transition-colors flex items-center"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">close</span>
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Labour Section */}
        <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">
            Included Labour Services
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              className="form-input py-2 text-sm"
              placeholder="Add service name (e.g. Paid Service Labour)"
              value={newLabout}
              onChange={e => setNewLabour(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLabour())}
            />
            <button
              onClick={addLabour}
              className="bg-secondary text-slate-800 px-4 rounded-xl text-xs font-bold hover:bg-secondary/90 transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {modal.data.labour.length === 0 ? (
              <span className="text-xs text-slate-400 italic">No labour services added yet.</span>
            ) : (
              modal.data.labour.map(l => (
                <span
                  key={l}
                  className="bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1.5"
                >
                  <span>{l}</span>
                  <button
                    onClick={() => removeLabour(l)}
                    className="hover:text-red-500 transition-colors flex items-center"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">close</span>
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="mt-8 flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">check_circle</span>
          {saving ? 'Saving Package...' : modal.mode === 'add' ? 'Create Preset' : 'Save Update'}
        </button>
      </div>
    </Modal>
  );
}


