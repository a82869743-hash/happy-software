interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; class: string; dot: string }> = {
  rfe: { label: 'Req for Estimation', class: 'status-rfe', dot: 'bg-amber-500' },
  estimation: { label: 'Estimation', class: 'status-estimation', dot: 'bg-violet-500' },
  spares_pending: { label: 'Spares Pending', class: 'status-spares', dot: 'bg-orange-500' },
  wip: { label: 'Work-In-Progress', class: 'status-wip', dot: 'bg-amber-500' },
  ready: { label: 'Ready for Delivery', class: 'status-ready', dot: 'bg-emerald-500' },
  delivered: { label: 'Delivered', class: 'status-delivered', dot: 'bg-amber-500' },
  invoiced: { label: 'Invoice', class: 'status-invoiced', dot: 'bg-indigo-500' },
  active: { label: 'Active', class: 'status-wip', dot: 'bg-amber-500' },
  done: { label: 'Done', class: 'status-ready', dot: 'bg-emerald-500' },
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, class: 'bg-gray-50 text-gray-600 border border-gray-200', dot: 'bg-gray-400' };
  const sizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-3 py-1';

  return (
    <span className={`status-badge ${config.class} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${['rfe', 'wip', 'active'].includes(status) ? 'animate-pulse' : ''}`} />
      {config.label}
    </span>
  );
}

export function getStatusLabel(status: string): string {
  return statusConfig[status]?.label || status;
}

