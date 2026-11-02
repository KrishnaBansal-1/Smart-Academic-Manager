import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed';

  const variantClasses = {
    primary:
      'bg-sky-600 text-white hover:bg-sky-700 focus:ring-sky-500 disabled:hover:bg-sky-600',
    secondary:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-400',
    danger:
      'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:hover:bg-red-600',
    ghost:
      'bg-transparent text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-300',
  }[variant];

  const padding = variant === 'ghost' ? 'p-2' : 'px-4 py-2.5';

  return (
    <button
      className={`${baseClasses} ${variantClasses} ${padding} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : icon}
      {children}
    </button>
  );
};
