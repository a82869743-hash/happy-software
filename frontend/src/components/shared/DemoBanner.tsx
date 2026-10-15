import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * DemoBanner — Floating banner shown in demo mode to inform
 * the client that this is a demo with mock data.
 */
export default function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-[200] bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-white px-6 py-2.5 flex items-center justify-center gap-3 shadow-lg shadow-amber-500/30"
      >
        <span className="material-symbols-outlined text-lg animate-pulse">science</span>
        <p className="text-xs font-bold tracking-wide uppercase">
          Demo Mode — All data is simulated for preview purposes only
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="ml-4 p-1 rounded-full hover:bg-white/20 transition-colors"
          title="Dismiss"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
