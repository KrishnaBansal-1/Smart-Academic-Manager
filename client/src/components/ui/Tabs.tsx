import React, { ElementType } from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ElementType;
  badge?: string | number;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
}

export const Tabs = <T extends string>({
  tabs,
  activeTab,
  onChange,
  className = '',
}: TabsProps<T>): React.ReactElement => {
  return (
    <div
      role="tablist"
      className={`flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm ${className}`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              isActive
                ? 'bg-sky-50 text-sky-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                  isActive ? 'bg-sky-200/60 text-sky-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
