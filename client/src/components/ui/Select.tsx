import { SelectHTMLAttributes, forwardRef } from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, options, children, className = '', id, ...props }, ref) => {
    const fieldId = id || props.name || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
        <select
          ref={ref}
          id={fieldId}
          className={`mt-1 block w-full rounded-lg border ${
            error ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100'
          } bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-2 ${className}`}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
        {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';
