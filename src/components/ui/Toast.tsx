"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";
interface Toast { id: number; type: ToastType; message: string; }

const ToastContext = createContext<{ push: (type: ToastType, message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let seq = 0;

  const push = useCallback((type: ToastType, message: string) => {
    const id = ++seq;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const remove = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const icons = { success: CheckCircle, error: XCircle, info: Info };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon size={16} />
              <span style={{ flex: 1 }}>{t.message}</span>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(t.id)}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast requires ToastProvider");
  return ctx;
}
