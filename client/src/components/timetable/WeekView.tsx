import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User as UserIcon,
  AlertTriangle,
  CalendarOff,
} from 'lucide-react';
import { format, parseISO, addWeeks, subWeeks } from 'date-fns';
import { ScheduleResponse, ScheduleEntry } from '../../types/schedule';
import { DAY_NAMES, SHORT_DAY_NAMES } from './TimetableGridShell';

export interface WeekViewProps {
  scheduleData: ScheduleResponse | undefined;
  isLoading: boolean;
  error?: string | null;
  currentWeekOf: string;
  onWeekChange: (newWeekOf: string) => void;
  role?: 'ADMIN' | 'PROFESSOR' | 'STUDENT';
  showSection?: boolean; // If true, shows section name (helpful for professors/admins)
  showFaculty?: boolean; // If true, shows faculty name (helpful for students/admins)
  headerAction?: React.ReactNode;
}

export const WeekView: React.FC<WeekViewProps> = ({
  scheduleData,
  isLoading,
  error,
  currentWeekOf,
  onWeekChange,
  showSection = true,
  showFaculty = true,
  headerAction,
}) => {
  const [selectedMobileDay, setSelectedMobileDay] = useState<number>(1);

  const handlePrevWeek = () => {
    const d = parseISO(currentWeekOf);
    const prev = subWeeks(d, 1);
    onWeekChange(format(prev, 'yyyy-MM-dd'));
  };

  const handleNextWeek = () => {
    const d = parseISO(currentWeekOf);
    const next = addWeeks(d, 1);
    onWeekChange(format(next, 'yyyy-MM-dd'));
  };

  const handleCurrentWeek = () => {
    onWeekChange(format(new Date(), 'yyyy-MM-dd'));
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-600"></div>
          <p className="text-sm font-medium">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-800">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
        <h3 className="mt-2 text-lg font-bold">Failed to load schedule</h3>
        <p className="mt-1 text-sm text-red-600">{error}</p>
      </div>
    );
  }

  // Explicit empty state if schedule is not published
  if (!scheduleData || !scheduleData.published) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
        <CalendarOff className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-4 text-xl font-bold text-slate-800">No Published Timetable</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          {scheduleData?.message ||
            'The academic timetable for this term has not been published yet. Check back soon or contact your department administrator.'}
        </p>
      </div>
    );
  }

  const { term, range, entries = [], holidays = [] } = scheduleData;
  const periods = term?.periods ? [...term.periods].sort((a, b) => a.index - b.index) : [];
  const workingDays = term?.workingDays ? [...term.workingDays].sort((a, b) => a - b) : [1, 2, 3, 4, 5];

  const holidayByDate = new Map<string, string>();
  for (const h of holidays) {
    holidayByDate.set(h.dateKey, h.label);
  }

  // Format week range label
  let rangeLabel = 'Current Week';
  try {
    const fromDate = parseISO(range.from);
    const toDate = parseISO(range.to);
    rangeLabel = `${format(fromDate, 'EEE, d MMM')} – ${format(toDate, 'EEE, d MMM yyyy')}`;
  } catch {
    rangeLabel = `${range.from} to ${range.to}`;
  }

  // Map entries by dateKey and period for grid lookup
  const entriesByDate = new Map<string, ScheduleEntry[]>();
  for (const entry of entries) {
    const list = entriesByDate.get(entry.dateKey) || [];
    list.push(entry);
    entriesByDate.set(entry.dateKey, list);
  }

  // Helper to compute dateKey for a day of week within range
  const getDateKeyForDay = (dayOfWeek: number): string => {
    try {
      const from = parseISO(range.from);
      // range.from is Monday (day 1)
      const targetDate = new Date(from);
      targetDate.setDate(from.getDate() + (dayOfWeek - 1));
      return format(targetDate, 'yyyy-MM-dd');
    } catch {
      return '';
    }
  };

  const renderBadgeForState = (state: ScheduleEntry['state'], reason?: string) => {
    switch (state) {
      case 'CANCELLED':
        return (
          <span
            className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700"
            title={reason}
          >
            Cancelled
          </span>
        );
      case 'MOVED_OUT':
        return (
          <span
            className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
            title={reason}
          >
            Moved
          </span>
        );
      case 'MOVED_IN':
        return (
          <span
            className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800"
            title={reason}
          >
            Rescheduled
          </span>
        );
      case 'EXAM':
        return (
          <span
            className="inline-flex items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800"
            title={reason}
          >
            Minor Exam
          </span>
        );
      default:
        return null;
    }
  };

  const getEntryCardStyle = (state: ScheduleEntry['state']) => {
    switch (state) {
      case 'CANCELLED':
        return 'border-red-200 bg-red-50/70 text-slate-400 opacity-80';
      case 'MOVED_OUT':
        return 'border-amber-200 bg-amber-50/70 text-slate-400 opacity-80';
      case 'MOVED_IN':
        return 'border-emerald-300 bg-emerald-50/80 shadow-sm ring-1 ring-emerald-200';
      case 'EXAM':
        return 'border-purple-300 bg-purple-50/80 shadow-sm ring-1 ring-purple-200';
      default:
        return 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-sm';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Week Navigator, Term info and Legend */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-700">
              {term?.name || 'Academic Term'}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {term?.academicYear} ({term?.semesterType} Sem)
            </span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{rangeLabel}</h2>
        </div>

        {/* Navigator Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {headerAction}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={handlePrevWeek}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition"
              title="Previous Week"
              aria-label="Previous Week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleCurrentWeek}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white rounded-lg transition"
            >
              Today
            </button>
            <button
              onClick={handleNextWeek}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition"
              title="Next Week"
              aria-label="Next Week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Status Legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600 shadow-sm">
        <span className="font-semibold text-slate-800">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span>
          <span>Normal Class</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
          <span>Cancelled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
          <span>Moved Out</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          <span>Rescheduled In</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span>
          <span>Minor Exam</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300"></span>
          <span>Holiday</span>
        </div>
      </div>

      {/* 3. Desktop Grid View (>= lg) */}
      <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75">
              <th className="w-32 p-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200">
                Day / Date
              </th>
              {periods.map((period) => (
                <th
                  key={period.index}
                  className={`p-3 text-center border-r border-slate-200 last:border-r-0 ${
                    period.blocked ? 'bg-amber-50/60' : ''
                  }`}
                >
                  <div className="font-semibold text-slate-800 text-xs sm:text-sm">
                    {period.label || `P${period.index}`}
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal">
                    {period.start} - {period.end}
                  </div>
                  {period.blocked && (
                    <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800">
                      Break
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workingDays.map((dayOfWeek) => {
              const dateKey = getDateKeyForDay(dayOfWeek);
              const holidayLabel = holidayByDate.get(dateKey);
              const dayEntries = entriesByDate.get(dateKey) || [];

              let dayFormatted = DAY_NAMES[dayOfWeek];
              try {
                if (dateKey) {
                  dayFormatted = format(parseISO(dateKey), 'EEE, d MMM');
                }
              } catch {
                dayFormatted = DAY_NAMES[dayOfWeek];
              }

              return (
                <tr key={dayOfWeek} className="hover:bg-slate-50/30 transition-colors">
                  {/* Day Header Column */}
                  <td className="w-32 p-3 font-medium text-slate-900 border-r border-slate-200 bg-slate-50/50">
                    <div className="font-bold text-slate-800 text-xs">{dayFormatted}</div>
                    {dateKey && (
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{dateKey}</div>
                    )}
                    {holidayLabel && (
                      <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        Holiday
                      </span>
                    )}
                  </td>

                  {/* If holiday and no classes, span entire row with holiday notice */}
                  {holidayLabel && dayEntries.length === 0 ? (
                    <td
                      colSpan={periods.length}
                      className="bg-amber-50/40 p-4 text-center font-medium text-amber-800 text-xs"
                    >
                      🎉 {holidayLabel} — Term Holiday
                    </td>
                  ) : (
                    (() => {
                      const cells: React.ReactNode[] = [];
                      let i = 0;

                      while (i < periods.length) {
                        const period = periods[i];
                        const entry = dayEntries.find((e) => e.period === period.index);

                        if (entry) {
                          const colSpan = Math.max(1, entry.durationSlots || 1);
                          const isCancelled = entry.state === 'CANCELLED';
                          const isMovedOut = entry.state === 'MOVED_OUT';

                          cells.push(
                            <td
                              key={`slot-${period.index}`}
                              colSpan={colSpan}
                              className="p-1.5 border-r border-slate-200 last:border-r-0 align-top"
                            >
                              <div
                                className={`h-full min-h-[92px] rounded-xl border p-2.5 transition flex flex-col justify-between ${getEntryCardStyle(
                                  entry.state
                                )}`}
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-1">
                                    <span
                                      className={`font-mono text-xs font-bold ${
                                        isCancelled || isMovedOut
                                          ? 'line-through text-slate-400'
                                          : 'text-sky-700'
                                      }`}
                                    >
                                      {entry.course.code}
                                    </span>
                                    {renderBadgeForState(entry.state, entry.reason)}
                                  </div>

                                  <p
                                    className={`mt-1 font-semibold text-xs leading-tight line-clamp-1 ${
                                      isCancelled || isMovedOut
                                        ? 'line-through text-slate-400'
                                        : 'text-slate-800'
                                    }`}
                                    title={entry.course.title}
                                  >
                                    {entry.course.title}
                                  </p>

                                  {entry.reason && (
                                    <p className="mt-1 text-[11px] text-amber-700 font-medium line-clamp-1 italic">
                                      {entry.reason}
                                    </p>
                                  )}
                                </div>

                                <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">
                                  {showSection && entry.batch && (
                                    <div className="flex items-center gap-1 font-medium text-slate-700">
                                      <span>Section: {entry.batch.name}</span>
                                    </div>
                                  )}

                                  {showFaculty && entry.professors.length > 0 && (
                                    <div className="flex items-center gap-1 truncate text-slate-600">
                                      <UserIcon className="h-3 w-3 shrink-0 text-slate-400" />
                                      <span className="truncate">
                                        {entry.professors.map((p) => p.name).join(', ')}
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                                    <span className="flex items-center gap-0.5">
                                      <Clock className="h-3 w-3" />
                                      {entry.startTime} - {entry.endTime}
                                    </span>
                                    {entry.classroom && (
                                      <span className="flex items-center gap-0.5 font-medium text-slate-600">
                                        <MapPin className="h-3 w-3" />
                                        {entry.classroom.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          );

                          i += colSpan;
                        } else {
                          // Empty cell
                          cells.push(
                            <td
                              key={`empty-${period.index}`}
                              className={`p-2 border-r border-slate-200 last:border-r-0 text-center ${
                                period.blocked ? 'bg-amber-50/30' : ''
                              }`}
                            >
                              <span className="text-xs text-slate-300 select-none">
                                {period.blocked ? '—' : 'Free'}
                              </span>
                            </td>
                          );
                          i += 1;
                        }
                      }

                      return cells;
                    })()
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. Mobile Day List View (< lg) */}
      <div className="block lg:hidden space-y-4">
        {/* Day selector pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
          {workingDays.map((dayOfWeek) => {
            const dateKey = getDateKeyForDay(dayOfWeek);
            const isSelected = selectedMobileDay === dayOfWeek;
            const isHoliday = holidayByDate.has(dateKey);

            return (
              <button
                key={dayOfWeek}
                onClick={() => setSelectedMobileDay(dayOfWeek)}
                className={`flex shrink-0 flex-col items-center rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{SHORT_DAY_NAMES[dayOfWeek]}</span>
                {isHoliday && (
                  <span
                    className={`mt-0.5 rounded-full px-1 text-[9px] ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Holiday
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day classes */}
        {(() => {
          const dateKey = getDateKeyForDay(selectedMobileDay);
          const holidayLabel = holidayByDate.get(dateKey);
          const dayEntries = entriesByDate.get(dateKey) || [];

          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="font-bold text-slate-800">
                  {DAY_NAMES[selectedMobileDay]} ({dateKey})
                </h3>
                <span className="text-xs text-slate-500">{dayEntries.length} items scheduled</span>
              </div>

              {holidayLabel && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center font-medium text-amber-900 text-sm">
                  🎉 {holidayLabel}
                </div>
              )}

              {dayEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                  <CalendarIcon className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium">No classes scheduled for this day</p>
                </div>
              ) : (
                dayEntries.map((entry) => (
                  <div
                    key={entry.occurrenceId || `${entry.dateKey}-${entry.period}`}
                    className={`rounded-xl border p-4 shadow-sm transition ${getEntryCardStyle(
                      entry.state
                    )}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-sm font-bold ${
                              entry.state === 'CANCELLED' || entry.state === 'MOVED_OUT'
                                ? 'line-through text-slate-400'
                                : 'text-sky-700'
                            }`}
                          >
                            {entry.course.code}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            (Period {entry.period}
                            {entry.durationSlots > 1
                              ? ` - ${entry.period + entry.durationSlots - 1}`
                              : ''}
                            )
                          </span>
                        </div>
                        <h4
                          className={`mt-1 font-bold text-slate-900 ${
                            entry.state === 'CANCELLED' || entry.state === 'MOVED_OUT'
                              ? 'line-through text-slate-400'
                              : ''
                          }`}
                        >
                          {entry.course.title}
                        </h4>
                      </div>
                      {renderBadgeForState(entry.state, entry.reason)}
                    </div>

                    {entry.reason && (
                      <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800 font-medium">
                        Note: {entry.reason}
                      </p>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>
                          {entry.startTime} - {entry.endTime}
                        </span>
                      </div>
                      {entry.classroom && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>{entry.classroom.name}</span>
                        </div>
                      )}
                      {showSection && entry.batch && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-500">Section:</span>
                          <span className="font-semibold text-slate-800">{entry.batch.name}</span>
                        </div>
                      )}
                      {showFaculty && entry.professors.length > 0 && (
                        <div className="col-span-2 flex items-center gap-1.5 truncate">
                          <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate">
                            {entry.professors.map((p) => p.name).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
