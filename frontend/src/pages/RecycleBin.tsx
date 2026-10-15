import { useState, useEffect } from 'react';
import api from '../api/axios';
import AnimatedPage from '../components/shared/AnimatedPage';
import { SkeletonTable } from '../components/shared/Skeleton';
import { showToast } from '../components/shared/Toast';

interface DeletedJobCard {
  id: number;
  job_no: string;
  reg_no: string;
  car_name: string;
  cust_name: string;
  cust_mobile: string;
  updated_at: string;
  vehicle_make?: string;
  vehicle_model?: string;
}

export default function RecycleBin() {
  const [deletedJobs, setDeletedJobs] = useState<DeletedJobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const fetchDeletedJobs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/job-cards/recycle-bin/list');
      setDeletedJobs(res.data.data || []);
    } catch {
      showToast('Failed to load recycle bin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedJobs();
  }, []);

  const handleRestore = async (id: number, jobNo: string) => {
    setRestoringId(id);
    try {
      await api.post(`/job-cards/${id}/restore`);
      showToast(`Order ${jobNo} restored successfully`, 'success');
      fetchDeletedJobs();
    } catch {
      showToast(`Failed to restore Order ${jobNo}`, 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AnimatedPage className="pt-[88px] sm:pt-24 px-4 sm:px-8 pb-12 max-w-[1800px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase font-label">System</p>
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline mt-1">Recycle Bin</h1>
        <p className="text-on-surface-variant font-medium mt-1">View and restore deleted Detailing Studio orders</p>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={8} />
      ) : deletedJobs.length === 0 ? (
        <div className="glass-card-solid text-center py-16 text-on-surface-muted">
          <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">delete_sweep</span>
          <p className="font-semibold text-on-surface-muted mb-1">Recycle bin is empty</p>
          <p className="text-xs text-on-surface-muted/60">No deleted orders found</p>
        </div>
      ) : (
        <div className="glass-card-solid overflow-hidden border-t-4 border-t-red-500">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[900px]">
              <thead>
                <tr>
                  <th>Job No</th>
                  <th>Registration</th>
                  <th>Vehicle</th>
                  <th>Customer</th>
                  <th>Deleted At</th>
                  <th className="w-32 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {deletedJobs.map((j) => (
                  <tr key={j.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="font-semibold text-on-surface">{j.job_no}</td>
                    <td>
                      <span className="inline-block px-2.5 py-1 bg-red-50 rounded-lg text-xs font-bold font-mono text-red-600 border border-red-100">
                        {j.reg_no}
                      </span>
                    </td>
                    <td>
                      <p className="text-sm font-semibold text-on-surface">{j.car_name}</p>
                      {(j.vehicle_make || j.vehicle_model) && (
                        <p className="text-[10px] text-on-surface-muted">
                          {[j.vehicle_make, j.vehicle_model].filter(Boolean).join(' ')}
                        </p>
                      )}
                    </td>
                    <td>
                      <p className="text-sm font-semibold text-on-surface">{j.cust_name || '—'}</p>
                      {j.cust_mobile && <p className="text-xs text-on-surface-muted font-mono">{j.cust_mobile}</p>}
                    </td>
                    <td>
                      <span className="text-xs text-on-surface-muted">{formatDate(j.updated_at)}</span>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => handleRestore(j.id, j.job_no)}
                        disabled={restoringId === j.id}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 mx-auto active:scale-[0.98] disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">settings_backup_restore</span>
                        {restoringId === j.id ? 'Restoring...' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-on-surface-muted font-medium">
              Total {deletedJobs.length} soft-deleted records
            </span>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
