// Toast host (design §G.2/§G.3). Thin context; the styled Toast primitive lands in task 3.4.
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type ToastTone = 'neutral' | 'win' | 'warn';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastValue {
  toasts: ToastItem[];
  pushToast: (tone: ToastTone, message: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (tone: ToastTone, message: string) => {
      const id = `toast_${counter.current++}`;
      setToasts((prev) => [...prev, { id, tone, message }]);
      window.setTimeout(() => dismissToast(id), 4000);
    },
    [dismissToast],
  );

  const value = useMemo<ToastValue>(
    () => ({ toasts, pushToast, dismissToast }),
    [toasts, pushToast, dismissToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
