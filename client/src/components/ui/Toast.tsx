import React from 'react';
import { useToastStore, ToastType } from '../../store/toastStore';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

const icons: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const styles: Record<ToastType, string> = {
  success: 'bg-emerald-600 text-white shadow-emerald-200',
  error: 'bg-red-600 text-white shadow-red-200',
  info: 'bg-sky-600 text-white shadow-sky-200',
  warning: 'bg-amber-600 text-white shadow-amber-200',
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        const styleClass = styles[toast.type];

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all animate-in slide-in-from-bottom-5 ${styleClass}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded hover:bg-white/20 transition-colors"
              aria-label="Dismiss toast"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
