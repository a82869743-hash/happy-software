import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import AnimatedPage from '../components/shared/AnimatedPage';

interface StaffMember {
  id: number;
  full_name: string;
  role: string;
  department: string;
}

interface AttendanceRecord {
  staff_id: number;
  full_name: string;
  status: string;
  date: string;
}

type AttendanceStatus = 'present' | 'half-day' | 'absent';

export default function Attendance() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [existing, setExisting] = useState<AttendanceRecord[]>([]);
  const [attendance, setAttendance] = useState<Record<number, AttendanceStatus>>({});
  const [entryTimes, setEntryTimes] = useState<Record<number, string>>({});
  const [exitTimes, setExitTimes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, attRes] = await Promise.all([
        api.get('/staff'),
        api.get('/attendance', { params: { date } }),
      ]);
      const staff: StaffMember[] = staffRes.data.data || staffRes.data;
      setStaffList(staff);
      const records: any[] = attRes.data.records || attRes.data.data || attRes.data;
      setExisting(records);
      const map: Record<number, AttendanceStatus> = {};
      const entryMap: Record<number, string> = {};
      const exitMap: Record<number, string> = {};
      staff.forEach((s) => {
        const rec = records.find((r: any) => r.staff_id === s.id);
        const rawStatus = rec?.status;
        const normalizedStatus = (rawStatus === 'half' || rawStatus === 'half_day' || rawStatus === 'half-day') ? 'half-day' : (rawStatus || 'present');
        map[s.id] = normalizedStatus as AttendanceStatus;
        entryMap[s.id] = rec?.entry_time || '';
        exitMap[s.id] = rec?.exit_time || '';
      });
      setAttendance(map);
      setEntryTimes(entryMap);
      setExitTimes(exitMap);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setStatus = (staffId: number, status: AttendanceStatus) => {
    setAttendance((prev) => ({ ...prev, [staffId]: status }));
    // Auto-capture current time as entry_time when marking Present
    if (status === 'present' && !entryTimes[staffId]) {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setEntryTimes((prev) => ({ ...prev, [staffId]: hhmm }));
    }
    // Clear times if marking absent
    if (status === 'absent') {
      setEntryTimes((prev) => ({ ...prev, [staffId]: '' }));
      setExitTimes((prev) => ({ ...prev, [staffId]: '' }));
    }
  };

  const markAll = (status: AttendanceStatus) => {
    const map: Record<number, AttendanceStatus> = {};
    staffList.forEach((s) => (map[s.id] = status));
    setAttendance(map);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const records = staffList.map((s) => ({
        staff_id: s.id,
        date,
        status: attendance[s.id] || 'present',
        entry_time: entryTimes[s.id] || null,
        exit_time: exitTimes[s.id] || null,
      }));
      await api.post('/attendance/bulk', { date, records });
      setToast({ type: 'success', msg: `Attendance saved for ${records.length} staff members` });
      fetchData();
    } catch (err: any) {
      setToast({ type: 'error', msg: err.response?.data?.error || 'Failed to save attendance' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const presentCount = Object.values(attendance).filter((s) => s === 'present').length;
  const halfDayCount = Object.values(attendance).filter((s) => s === 'half-day').length;
  const absentCount = Object.values(attendance).filter((s) => s === 'absent').length;
  const alreadyMarked = existing.length > 0;
  const efficiency = staffList.length > 0 ? Math.round(((presentCount + halfDayCount * 0.5) / staffList.length) * 100) : 0;

  const dateFmt = new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 p-4 sm:p-8 space-y-8">
      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 border ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.msg}
        </motion.div>
      )}

      {/* Page Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface">Attendance Marking</h2>
          <p className="text-on-surface-variant font-medium flex items-center gap-1.5 mt-1">
            <span className="material-symbols-outlined text-sm">event</span>
            {dateFmt}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2 bg-white p-2 px-3 rounded-xl shadow-sm border border-gray-100 flex-1 sm:flex-initial">
            <span className="material-symbols-outlined text-primary text-sm">calendar_month</span>
            <input
              type="date"
              className="bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 cursor-pointer w-full sm:w-32"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={saving || staffList.length === 0}
            className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">
              {saving ? 'progress_activity' : 'save'}
            </span>
            {saving ? 'Saving...' : alreadyMarked ? 'Update' : 'Save'}
          </motion.button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-1">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total Staff</span>
          <span className="text-3xl font-extrabold font-headline text-primary">{String(staffList.length).padStart(2, '0')}</span>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-1 border-l-4 border-l-emerald-500">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Present</span>
          <span className="text-3xl font-extrabold font-headline text-emerald-600">{String(presentCount).padStart(2, '0')}</span>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-1 border-l-4 border-l-amber-500">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Half Day</span>
          <span className="text-3xl font-extrabold font-headline text-amber-600">{String(halfDayCount).padStart(2, '0')}</span>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-1 border-l-4 border-l-red-500">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Absent</span>
          <span className="text-3xl font-extrabold font-headline text-red-600">{String(absentCount).padStart(2, '0')}</span>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-1 col-span-2 md:col-span-1">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Efficiency</span>
          <span className="text-3xl font-extrabold font-headline text-primary">{efficiency}%</span>
          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1 overflow-hidden">
            <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${efficiency}%` }}></div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Quick Mark All:</span>
        {[
          { label: 'All Present', status: 'present' as AttendanceStatus, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
          { label: 'All Half Day', status: 'half-day' as AttendanceStatus, cls: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
          { label: 'All Absent', status: 'absent' as AttendanceStatus, cls: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
        ].map(({ label, status, cls }) => (
          <button
            key={status}
            onClick={() => markAll(status)}
            className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg border transition-colors ${cls}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status Banner */}
      {alreadyMarked && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="material-symbols-outlined text-primary text-lg">info</span>
          <span className="text-xs font-bold text-primary">
            Attendance already marked for this date. Changes will overwrite existing records.
          </span>
        </div>
      )}

      {/* Attendance Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <span className="text-sm font-semibold text-on-surface-variant animate-pulse">
            Loading staff roster...
          </span>
        </div>
      ) : staffList.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-3 block">group_off</span>
          <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">No staff members found</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100"
        >
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-sm font-bold font-headline uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">groups</span>
              Staff Roster — {staffList.length} Members
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[750px]">
              <thead className="text-xs font-bold text-on-surface-variant uppercase tracking-wider bg-gray-50/50">
                <tr>
                  <th className="py-3 px-4 w-12">#</th>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-center">Present</th>
                  <th className="py-3 px-4 text-center">Half Day</th>
                  <th className="py-3 px-4 text-center">Absent</th>
                  <th className="py-3 px-4 text-center">Entry Time</th>
                  <th className="py-3 px-4 text-center">Exit Time</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {staffList.map((staff, idx) => {
                  const status = attendance[staff.id] || 'present';
                  return (
                    <motion.tr
                      key={staff.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className={`group border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                        status === 'absent' ? 'bg-red-50/30' : status === 'half-day' ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-xs font-mono text-on-surface-variant font-bold">{idx + 1}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-extrabold text-primary">{staff.full_name.charAt(0)}</span>
                          </div>
                          <span className="text-sm font-bold text-on-surface">{staff.full_name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-gray-100 px-2 py-1 rounded-md">
                          {staff.role || staff.department || 'Staff'}
                        </span>
                      </td>
                      {/* Present Radio */}
                      <td className="py-3.5 px-4 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input type="radio" name={`att-${staff.id}`} checked={status === 'present'} onChange={() => setStatus(staff.id, 'present')} className="hidden" />
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 border-2 ${
                            status === 'present'
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/30 scale-110'
                              : 'bg-gray-50 text-gray-300 border-gray-200 hover:border-emerald-300 hover:text-emerald-400'
                          }`}>
                            <span className="material-symbols-outlined text-lg">check</span>
                          </span>
                        </label>
                      </td>
                      {/* Half Day Radio */}
                      <td className="py-3.5 px-4 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input type="radio" name={`att-${staff.id}`} checked={status === 'half-day'} onChange={() => setStatus(staff.id, 'half-day')} className="hidden" />
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 border-2 ${
                            status === 'half-day'
                              ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/30 scale-110'
                              : 'bg-gray-50 text-gray-300 border-gray-200 hover:border-amber-300 hover:text-amber-400'
                          }`}>
                            <span className="material-symbols-outlined text-lg">remove</span>
                          </span>
                        </label>
                      </td>
                      {/* Absent Radio */}
                      <td className="py-3.5 px-4 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input type="radio" name={`att-${staff.id}`} checked={status === 'absent'} onChange={() => setStatus(staff.id, 'absent')} className="hidden" />
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 border-2 ${
                            status === 'absent'
                              ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/30 scale-110'
                              : 'bg-gray-50 text-gray-300 border-gray-200 hover:border-red-300 hover:text-red-400'
                          }`}>
                            <span className="material-symbols-outlined text-lg">close</span>
                          </span>
                        </label>
                      </td>
                      {/* Entry Time */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="time"
                          value={entryTimes[staff.id] || ''}
                          onChange={(e) => setEntryTimes(prev => ({ ...prev, [staff.id]: e.target.value }))}
                          disabled={status === 'absent'}
                          className="bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono py-1.5 px-2 w-24 text-center focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>
                      {/* Exit Time */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="time"
                          value={exitTimes[staff.id] || ''}
                          onChange={(e) => setExitTimes(prev => ({ ...prev, [staff.id]: e.target.value }))}
                          disabled={status === 'absent'}
                          className="bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono py-1.5 px-2 w-24 text-center focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
              {presentCount}P · {halfDayCount}HD · {absentCount}A
            </span>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">
                {saving ? 'progress_activity' : 'save'}
              </span>
              {saving ? 'Saving...' : 'Save Attendance'}
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatedPage>
  );
}

