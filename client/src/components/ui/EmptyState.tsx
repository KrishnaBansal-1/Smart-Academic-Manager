import React, { ElementType, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: ElementType | LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`px-6 py-16 text-center ${className}`}>
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};
