import React from 'react';
import { IPeriodGridItem } from '../../types';

export const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

export const SHORT_DAY_NAMES: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

export interface TimetableGridShellProps {
  workingDays: number[];
  periods: IPeriodGridItem[];
  renderCell: (dayOfWeek: number, period: IPeriodGridItem) => React.ReactNode;
  renderDayHeader?: (dayOfWeek: number) => React.ReactNode;
  renderPeriodHeader?: (period: IPeriodGridItem) => React.ReactNode;
  className?: string;
}

export const TimetableGridShell: React.FC<TimetableGridShellProps> = ({
  workingDays,
  periods,
  renderCell,
  renderDayHeader,
  renderPeriodHeader,
  className = '',
}) => {
  const sortedPeriods = [...periods].sort((a, b) => a.index - b.index);
  const sortedDays = [...workingDays].sort((a, b) => a - b);

  return (
    <div className={`overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <table className="w-full min-w-[700px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/75">
            <th className="w-28 p-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200">
              Day / Period
            </th>
            {sortedPeriods.map((period) => (
              <th
                key={period.index}
                className={`p-3 text-center border-r border-slate-200 last:border-r-0 ${
                  period.blocked ? 'bg-amber-50/60' : ''
                }`}
              >
                {renderPeriodHeader ? (
                  renderPeriodHeader(period)
                ) : (
                  <div>
                    <div className="font-semibold text-slate-800 text-xs sm:text-sm">
                      {period.label || `P${period.index}`}
                    </div>
                    <div className="text-[11px] text-slate-500 font-normal">
                      {period.start} - {period.end}
                    </div>
                    {period.blocked && (
                      <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800">
                        Blocked
                      </span>
                    )}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedDays.map((dayOfWeek) => (
            <tr key={dayOfWeek} className="hover:bg-slate-50/50 transition-colors">
              <td className="w-28 p-3.5 font-semibold text-slate-800 border-r border-slate-200 bg-slate-50/30">
                {renderDayHeader ? (
                  renderDayHeader(dayOfWeek)
                ) : (
                  <div>
                    <div className="text-sm">{DAY_NAMES[dayOfWeek] || `Day ${dayOfWeek}`}</div>
                    <div className="text-xs text-slate-400 font-normal">{SHORT_DAY_NAMES[dayOfWeek]}</div>
                  </div>
                )}
              </td>
              {sortedPeriods.map((period) => (
                <td
                  key={`${dayOfWeek}-${period.index}`}
                  className={`p-1.5 border-r border-slate-100 last:border-r-0 align-top ${
                    period.blocked ? 'bg-amber-50/30' : ''
                  }`}
                >
                  {renderCell(dayOfWeek, period)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
