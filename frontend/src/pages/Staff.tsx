import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import AnimatedPage, { StaggerContainer, StaggerItem } from '../components/shared/AnimatedPage';
import Modal from '../components/shared/Modal';
import { showToast } from '../components/shared/Toast';
import { formatCurrency } from '../utils/format';

interface StaffMember {
  id: number; staff_code: string; full_name: string; role: string;
  mobile_no: string; date_of_joining: string; monthly_salary: number; is_active: number;
  login_username?: string;
}
interface AttendanceRecord {
  staff_id: number; staff_name: string; staff_code: string;
  status: 'present' | 'absent' | 'half' | null;
}
interface SummaryData {
  month: string; present: number; absent: number; half: number; effective_days: number;
}

const emptyForm = { full_name: '', role: '', mobile_no: '', date_of_joining: '', monthly_salary: '', is_active: 1 };

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; data: typeof emptyForm; id?: number } | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attRecords, setAttRecords] = useState<AttendanceRecord[]>([]);
  const [attChanges, setAttChanges] = useState<Record<number, string>>({});
  const [attLoading, setAttLoading] = useState(true);
  const [savingAtt, setSavingAtt] = useState(false);

  const [summaryModal, setSummaryModal] = useState<{ staffId: number; name: string } | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get('/staff'); setStaff(res.data?.data || []); }
    catch { setStaff([]); } finally { setLoading(false); }
  }, []);

  const fetchAttendance = useCallback(async () => {
    setAttLoading(true);
    try { const res = await api.get('/attendance', { params: { date } }); setAttRecords(res.data?.records || []); setAttChanges({}); }
    catch { setAttRecords([]); } finally { setAttLoading(false); }
  }, [date]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const safeStaffList = Array.isArray(staff) ? staff : [];
  const filteredStaff = safeStaffList.filter(s =>
    (s?.full_name || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (s?.staff_code || '').toLowerCase().includes((search || '').toLowerCase())
  );

  const handleSaveStaff = async () => {
    if (!modal) return;
    setSavingStaff(true);
    try {
      if (modal.mode === 'add') { await api.post('/staff', modal.data); showToast('Staff member added', 'success'); }
      else { await api.put(`/staff/${modal.id}`, modal.data); showToast('Staff updated', 'success'); }
      setModal(null); fetchStaff(); fetchAttendance();
    } catch (err: any) { showToast(err.response?.data?.error || 'Failed', 'error'); }
    finally { setSavingStaff(false); }
  };

  const handleToggleActive = async (id: number) => {
    try { const res = await api.patch(`/staff/${id}/toggle`); showToast(res.data.message, 'success'); fetchStaff(); fetchAttendance(); }
    catch { showToast('Failed to toggle status', 'error'); }
  };

  const handleDeleteStaff = async (staffMember: StaffMember) => {
    if (!window.confirm(`Are you sure you want to permanently delete staff member "${staffMember.full_name}" (${staffMember.staff_code})? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/staff/${staffMember.id}`);
      showToast(`Staff member "${staffMember.full_name}" permanently deleted`, 'success');
      fetchStaff();
      fetchAttendance();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete staff member', 'error');
    }
  };

  const handleStatusChange = (staffId: number, status: string) => {
    setAttChanges(prev => ({ ...prev, [staffId]: status }));
  };
  const getStatus = (r: AttendanceRecord) => {
    const raw = attChanges[r.staff_id] ?? r.status ?? 'present';
    if (raw === 'half' || raw === 'half_day') return 'half-day';
    return raw;
  };

  const handleSaveAttendance = async () => {
    setSavingAtt(true);
    try {
      const bulkRecords = attRecords.map(r => ({ staff_id: r.staff_id, status: getStatus(r) }));
      await api.post('/attendance/bulk', { date, records: bulkRecords });
      showToast(`Attendance saved for ${new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 'success');
      fetchAttendance();
    } catch (err: any) { showToast(err.response?.data?.error || 'Failed to save attendance', 'error'); }
    finally { setSavingAtt(false); }
  };

  const openSummary = async (staffId: number, name: string) => {
    setSummaryModal({ staffId, name });
    const d = new Date(date);
    try { const res = await api.get(`/attendance/summary/${staffId}`, { params: { month: d.getMonth() + 1, year: d.getFullYear() } }); setSummary(res.data); }
    catch { setSummary(null); }
  };

  const fmtCurrency = (n: any) => formatCurrency(n, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const safeAttRecords = Array.isArray(attRecords) ? attRecords : [];
  const activeStaffCount = safeStaffList.filter(s => s && s.is_active).length;
  
  const getWeight = (st: string | null) => {
    if (st === 'present') return 1;
    if (st === 'half' || st === 'half-day' || st === 'half_day') return 0.5;
    return 0;
  };

  const totalPresentToday = Object.values(attChanges).reduce((sum, st) => sum + getWeight(st), 0) +
    safeAttRecords.filter(r => r && attChanges[r.staff_id] === undefined).reduce((sum, r) => sum + getWeight(r.status), 0);
  
  const attendanceRate = activeStaffCount > 0 ? ((totalPresentToday / activeStaffCount) * 100).toFixed(1) : '0.0';

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 p-4 sm:p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight font-headline text-on-surface">Staff & Attendance</h2>
          <p className="text-on-surface-variant font-medium mt-1">Global Workforce Registry</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setModal({ mode: 'add', data: { ...emptyForm } })}
            className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-primary/20 active:scale-[0.98] w-full sm:w-auto justify-center"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            New Hire Form
          </button>
        </div>
      </header>

      {/* Main Bento Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

        {/* Left Section: Staff Master List (7 cols) */}
        <section className="xl:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <span className="material-symbols-outlined">badge</span>
              </div>
              <h3 className="font-headline text-xl font-bold text-on-surface">Staff Master List</h3>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-sm border border-gray-100 flex-1 sm:flex-initial">
                <span className="material-symbols-outlined text-on-surface-variant text-sm">search</span>
                <input
                  className="bg-transparent border-none focus:ring-0 text-sm text-on-surface placeholder:text-on-surface-variant font-medium w-full sm:w-36"
                  placeholder="Search staff..."
                  value={search} onChange={e => setSearch(e.target.value)}
                />
              </div>
              <span className="bg-primary/10 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-primary">
                {activeStaffCount} Active
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[650px]">
                <thead className="text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-gray-50/50">
                  <tr className="border-b border-gray-100">
                    <th className="py-3 px-5">Profile</th>
                    <th className="py-3 px-5">Role & Contact</th>
                    <th className="py-3 px-5">Payroll</th>
                    <th className="py-3 px-5 text-center">Status</th>
                    <th className="py-3 px-5 text-right">Mgt</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-sm font-medium text-on-surface-variant">Loading staff records...</td></tr>
                  ) : filteredStaff.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-sm font-medium text-on-surface-variant">No staff found.</td></tr>
                  ) : (
                    filteredStaff.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors group border-b border-gray-50">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                              {s.full_name.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-on-surface text-sm">{s.full_name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-[10px] text-on-surface-variant">{s.staff_code}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col items-start gap-1">
                            <span className="bg-gray-100 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded text-on-surface-variant">
                              {s.role}
                            </span>
                            <span className="text-[10px] font-medium text-on-surface-variant">{s.mobile_no || 'No Contact'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-primary">{fmtCurrency(s.monthly_salary)}</span>
                            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant mt-0.5">Monthly</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => handleToggleActive(s.id)}
                            className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all ${
                              s.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openSummary(s.id, s.full_name)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-on-surface-variant"
                              title="Monthly Overview"
                            >
                              <span className="material-symbols-outlined text-base">bar_chart</span>
                            </button>
                            <button
                              onClick={() => setModal({
                                mode: 'edit', id: s.id,
                                data: {
                                  full_name: s.full_name,
                                  role: s.role,
                                  mobile_no: s.mobile_no || '',
                                  date_of_joining: s.date_of_joining?.slice(0,10) || '',
                                  monthly_salary: String(s.monthly_salary),
                                  is_active: s.is_active
                                }
                              })}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-on-surface-variant"
                              title="Edit Details"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(s)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-colors text-slate-400"
                              title="Permanently Delete Staff"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
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
        </section>

        {/* Right Section: Attendance & Stats (5 cols) */}
        <section className="xl:col-span-5 space-y-6">

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/10 rounded-lg text-slate-600">
                  <span className="material-symbols-outlined">how_to_reg</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-on-surface">Daily Attendance</h3>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 w-full sm:w-auto">
                <span className="material-symbols-outlined text-primary text-sm">calendar_today</span>
                <input
                  type="date"
                  className="bg-transparent border-none p-0 text-xs font-semibold focus:ring-0 cursor-pointer flex-1 sm:flex-initial w-full sm:w-28"
                  value={date} onChange={e => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-6">
              {/* Header Labels */}
              <div className="flex text-[9px] uppercase font-bold tracking-widest text-on-surface-variant px-2 border-b border-gray-100 pb-2">
                <div className="flex-1">Staff Member</div>
                <div className="w-10 text-center text-primary" title="Present">PR</div>
                <div className="w-10 text-center text-red-500" title="Absent">AB</div>
                <div className="w-10 text-center text-amber-500" title="Half Day">HF</div>
              </div>

              {/* Rows */}
              <StaggerContainer className="space-y-2.5 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {attLoading ? (
                  <p className="text-center text-xs text-on-surface-variant py-4">Loading register...</p>
                ) : attRecords.length === 0 ? (
                  <p className="text-center text-xs text-on-surface-variant py-4">No active staff to mark.</p>
                ) : (
                  attRecords.map(r => {
                    const status = getStatus(r);
                    return (
                      <StaggerItem key={r.staff_id} className={`flex items-center px-3 py-2.5 rounded-xl border transition-all ${
                        status === 'present' ? 'bg-primary/5 border-primary/20' :
                        status === 'absent' ? 'bg-red-50 border-red-200' :
                        (status === 'half' || status === 'half-day' || status === 'half_day') ? 'bg-amber-50 border-amber-200' :
                        'bg-gray-50 border-transparent'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-on-surface truncate">{r.staff_name}</p>
                          <p className="text-[9px] text-on-surface-variant font-mono mt-0.5">{r.staff_code}</p>
                        </div>
                        <div className="w-10 flex justify-center">
                          <input type="radio" name={`att_${r.staff_id}`}
                            checked={status === 'present'} onChange={() => handleStatusChange(r.staff_id, 'present')}
                            className="w-4 h-4 text-primary bg-white border-gray-300 focus:ring-primary cursor-pointer" />
                        </div>
                        <div className="w-10 flex justify-center">
                          <input type="radio" name={`att_${r.staff_id}`}
                            checked={status === 'absent'} onChange={() => handleStatusChange(r.staff_id, 'absent')}
                            className="w-4 h-4 text-red-500 bg-white border-gray-300 focus:ring-red-400 cursor-pointer" />
                        </div>
                        <div className="w-10 flex justify-center">
                          <input type="radio" name={`att_${r.staff_id}`}
                            checked={status === 'half' || status === 'half-day' || status === 'half_day'} onChange={() => handleStatusChange(r.staff_id, 'half-day')}
                            className="w-4 h-4 text-amber-500 bg-white border-gray-300 focus:ring-amber-400 cursor-pointer" />
                        </div>
                      </StaggerItem>
                    );
                  })
                )}
              </StaggerContainer>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={handleSaveAttendance}
                  disabled={savingAtt || attRecords.length === 0}
                  className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/20 disabled:opacity-50 active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-lg">rule</span>
                  {savingAtt ? 'Committing...' : 'Commit Register'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stats Widget */}
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-4">
            <div className="bg-[#1C1917] rounded-xl p-5 relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <span className="material-symbols-outlined text-[80px] text-white">trending_up</span>
              </div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-white/60 mb-1">Daily Presence</p>
              <p className="text-3xl font-headline font-black text-white relative z-10">{attendanceRate}%</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-[9px] uppercase tracking-widest font-bold text-on-surface-variant mb-1">Active Headcount</p>
              <p className="text-3xl font-headline font-black text-primary">{activeStaffCount}</p>
            </div>
          </div>

        </section>
      </div>

      {/* --- Modals --- */}
      {modal && (
        <Modal title={modal.mode === 'add' ? 'New Hire Registration' : 'Edit Staff Profile'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Full Legal Name <span className="text-red-500">*</span></label>
              <input value={modal.data.full_name} onChange={e => setModal({ ...modal, data: { ...modal.data, full_name: e.target.value } })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Enter name..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Role/Designation <span className="text-red-500">*</span></label>
                <input value={modal.data.role} onChange={e => setModal({ ...modal, data: { ...modal.data, role: e.target.value } })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Mechanic" />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Mobile Number</label>
                <input value={modal.data.mobile_no} onChange={e => setModal({ ...modal, data: { ...modal.data, mobile_no: e.target.value } })} maxLength={10}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="10 Digits" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Joining Date</label>
                <input type="date" value={modal.data.date_of_joining} onChange={e => setModal({ ...modal, data: { ...modal.data, date_of_joining: e.target.value } })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer" />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Base Salary (₹) <span className="text-red-500">*</span></label>
                <input type="number" value={modal.data.monthly_salary} onChange={e => setModal({ ...modal, data: { ...modal.data, monthly_salary: e.target.value } })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="0" />
              </div>
            </div>


          </div>
          <div className="mt-8 flex justify-end">
            <button onClick={handleSaveStaff} disabled={savingStaff}
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-primary/20 disabled:opacity-50 active:scale-[0.98]">
              <span className="material-symbols-outlined text-lg">check_circle</span>
              {savingStaff ? 'Processing...' : modal.mode === 'add' ? 'Confirm Hire' : 'Save Update'}
            </button>
          </div>
        </Modal>
      )}

      {summaryModal && (
        <Modal title={`Staff Overview: ${summaryModal.name}`} onClose={() => { setSummaryModal(null); setSummary(null); }} maxWidth="max-w-md">
          {summary ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Reporting Month</span>
                <span className="font-extrabold text-primary font-headline">{summary.month}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-primary">{summary.present}</p>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-primary mt-1">Present</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-red-600">{summary.absent}</p>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-red-600 mt-1">Absent</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-amber-600">{summary.half}</p>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-amber-600 mt-1">Half Day</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-5 border-l-4 border-primary flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Effective Payroll Days</p>
                  <p className="text-xs text-on-surface-variant font-medium">(Present + 0.5 × Half)</p>
                </div>
                <h3 className="text-3xl font-black text-primary font-headline">
                  {summary.effective_days} <span className="text-sm font-medium text-on-surface-variant">days</span>
                </h3>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
              <p className="mt-2 text-sm font-medium">Computing ledger data...</p>
            </div>
          )}
        </Modal>
      )}

    </AnimatedPage>
  );
}

