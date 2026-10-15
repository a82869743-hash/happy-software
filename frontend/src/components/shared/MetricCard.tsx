import { motion } from 'framer-motion';
import { formatCurrency } from '../../utils/format';

interface MetricCardProps {
  title: string;
  count: number;
  value: number;
  icon: string;
  gradient: string;
  delay?: number;
  onClick?: () => void;
}

export default function MetricCard({ title, count, value, icon, gradient, delay = 0, onClick }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4, scale: 1.02 }}
      onClick={onClick}
      className={`metric-card ${gradient} cursor-pointer`}
    >
      {/* Icon */}
      <div className="flex items-center justify-between mb-3">
        <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-xl">{icon}</span>
        </div>
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.2, type: 'spring', stiffness: 200 }}
          className="text-3xl font-extrabold font-headline text-white"
        >
          {count}
        </motion.span>
      </div>

      {/* Title */}
      <h3 className="text-white/80 text-xs font-bold uppercase tracking-wider font-label">{title}</h3>

      {/* Value */}
      <p className="text-white text-lg font-bold font-headline mt-0.5">{formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
    </motion.div>
  );
}
