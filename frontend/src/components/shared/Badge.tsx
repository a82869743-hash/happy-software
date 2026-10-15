import styles from './Badge.module.css';

interface BadgeProps {
  status: 'active' | 'done' | 'full' | 'wash' | 'in' | 'out';
  label?: string;
}

const defaultLabels: Record<string, string> = {
  active: 'Active',
  done: 'Done',
  full: 'Full',
  wash: 'Wash',
  in: 'IN',
  out: 'OUT',
};

export default function Badge({ status, label }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      {label || defaultLabels[status] || status}
    </span>
  );
}
