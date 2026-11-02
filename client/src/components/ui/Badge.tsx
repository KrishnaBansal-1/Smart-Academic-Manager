import React, { ReactNode } from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className = '',
}) => {
  const variantClasses = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  }[variant];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variantClasses} ${className}`}
    >
      {children}
    </span>
  );
};
