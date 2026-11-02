import React, { ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

export type BannerVariant = 'error' | 'success' | 'info' | 'warning';

export interface BannerProps {
  variant?: BannerVariant;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export const Banner: React.FC<BannerProps> = ({
  variant = 'info',
  children,
  onDismiss,
  className = '',
}) => {
  const config = {
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: AlertCircle,
    },
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      icon: CheckCircle,
    },
    info: {
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      text: 'text-sky-800',
      icon: Info,
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      icon: AlertTriangle,
    },
  }[variant];

  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={`flex items-center gap-2.5 rounded-lg border ${config.border} ${config.bg} px-4 py-3 text-sm ${config.text} ${className}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss banner"
          className="rounded p-1 opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
