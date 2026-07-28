import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] px-4 w-full max-w-sm pointer-events-none"
        >
          <div className="bg-brand-dark text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-semibold text-sm border border-brand-light-gray/20">
            <CheckCircle className="w-5 h-5 text-brand-mint" />
            <span className="flex-1">{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
