import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

let toastId = 0;
let addToastFn: ((message: string, type: 'success' | 'error' | 'info' | 'warning') => void) | null = null;

export function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') {
  if (addToastFn) addToastFn(message, type);
}

const iconMap = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
  warning: 'warning',
};

const colorMap = {
  success: 'bg-success text-white',
  error: 'bg-error text-white',
  info: 'bg-info text-white',
  warning: 'bg-warning text-white',
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`${colorMap[t.type]} px-5 py-3.5 rounded-2xl shadow-lg flex items-center gap-3 pointer-events-auto min-w-[280px] max-w-sm`}
          >
            <span className="material-symbols-outlined text-lg shrink-0">{iconMap[t.type]}</span>
            <span className="text-sm font-bold">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
