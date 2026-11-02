import React, { useEffect, useState, useRef } from 'react';
import { apiClient } from '../../api/client';
import { useToastStore } from '../../store/toastStore';
import { getErrorMessage } from '../../lib/errors';
import { AcademicTerm, SoftConstraint, ITimeWindow, IPeriodGridItem } from '../../types';
import { TimetableGridShell } from '../../components/timetable/TimetableGridShell';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Banner } from '../../components/ui/Banner';
import { Skeleton } from '../../components/ui/Skeleton';
import { Sliders, Save, CheckCircle2, XCircle, MinusCircle, Info } from 'lucide-react';

type PaintMode = 'PREFERRED' | 'UNAVAILABLE' | 'NEUTRAL';

export const ProfessorPreferences: React.FC = () => {
  const { addToast } = useToastStore();
  const [activeTerm, setActiveTerm] = useState<AcademicTerm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Paint state: map of `day-slot` => 'PREFERRED' | 'UNAVAILABLE'
  const [gridState, setGridState] = useState<Record<string, PaintMode>>({});
  const [selectedMode, setSelectedMode] = useState<PaintMode>('PREFERRED');
  const [maxDailyHours, setMaxDailyHours] = useState<number>(4);
  const [priorityWeight, setPriorityWeight] = useState<number>(3);

  const isMouseDownRef = useRef(false);

  useEffect(() => {
    const handleMouseUp = () => {
      isMouseDownRef.current = false;
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      // 1. Fetch active term
      const termRes = await apiClient.get<{ data: AcademicTerm | null }>('/terms/active');
      const term = termRes.data.data;
      setActiveTerm(term);

      if (!term) {
        setIsLoading(false);
        return;
      }

      // 2. Fetch professor's constraint
      const constraintRes = await apiClient.get<{ data: SoftConstraint | null }>(
        `/constraints/me?termId=${term._id}`
      );
      const data = constraintRes.data.data;

      const initialGrid: Record<string, PaintMode> = {};
      if (data) {
        setMaxDailyHours(data.maxDailyHours || 4);
        setPriorityWeight(data.priorityWeight || 3);

        (data.preferredTimeWindows || []).forEach((w: ITimeWindow) => {
          for (let s = w.startSlot; s <= w.endSlot; s += 1) {
            initialGrid[`${w.dayOfWeek}-${s}`] = 'PREFERRED';
          }
        });

        (data.unavailableWindows || []).forEach((w: ITimeWindow) => {
          for (let s = w.startSlot; s <= w.endSlot; s += 1) {
            initialGrid[`${w.dayOfWeek}-${s}`] = 'UNAVAILABLE';
          }
        });
      }

      setGridState(initialGrid);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const paintCell = (dayOfWeek: number, slotIndex: number, mode: PaintMode) => {
    setGridState((prev) => {
      const key = `${dayOfWeek}-${slotIndex}`;
      if (mode === 'NEUTRAL') {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: mode };
    });
  };

  const handleMouseDown = (dayOfWeek: number, slotIndex: number, blocked?: boolean) => {
    if (blocked) return;
    isMouseDownRef.current = true;
    paintCell(dayOfWeek, slotIndex, selectedMode);
  };

  const handleMouseEnter = (dayOfWeek: number, slotIndex: number, blocked?: boolean) => {
    if (isMouseDownRef.current && !blocked) {
      paintCell(dayOfWeek, slotIndex, selectedMode);
    }
  };

  // Convert painted cells into contiguous windows
  const buildWindows = (mode: 'PREFERRED' | 'UNAVAILABLE'): ITimeWindow[] => {
    if (!activeTerm) return [];
    const windows: ITimeWindow[] = [];

    const sortedDays = [...activeTerm.workingDays].sort((a, b) => a - b);
    const sortedPeriods = [...activeTerm.periods].sort((a, b) => a.index - b.index);

    for (const day of sortedDays) {
      let currentStart: number | null = null;
      let currentEnd: number | null = null;

      for (const p of sortedPeriods) {
        const key = `${day}-${p.index}`;
        const isMatch = gridState[key] === mode;

        if (isMatch) {
          if (currentStart === null) {
            currentStart = p.index;
            currentEnd = p.index;
          } else {
            currentEnd = p.index;
          }
        } else {
          if (currentStart !== null && currentEnd !== null) {
            windows.push({ dayOfWeek: day, startSlot: currentStart, endSlot: currentEnd });
            currentStart = null;
            currentEnd = null;
          }
        }
      }

      if (currentStart !== null && currentEnd !== null) {
        windows.push({ dayOfWeek: day, startSlot: currentStart, endSlot: currentEnd });
      }
    }

    return windows;
  };

  const handleSave = async () => {
    if (!activeTerm) return;
    try {
      setIsSaving(true);
      const preferredTimeWindows = buildWindows('PREFERRED');
      const unavailableWindows = buildWindows('UNAVAILABLE');

      const payload = {
        termId: activeTerm._id,
        preferredTimeWindows,
        unavailableWindows,
        maxDailyHours: Number(maxDailyHours) || 4,
      };

      await apiClient.put<{ data: SoftConstraint }>('/constraints/me', payload);
      addToast('Teaching preferences saved successfully', 'success');
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Banner variant="error">
          <div className="font-semibold mb-1">Failed to load preferences</div>
          <div>{loadError}</div>
          <div className="mt-3">
            <Button variant="secondary" onClick={loadData}>
              Try Again
            </Button>
          </div>
        </Banner>
      </div>
    );
  }

  if (!activeTerm) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Banner variant="info">
          <span className="font-semibold">No Active Academic Term:</span> There is currently no active academic term configured. Teaching preferences will be available once the administration activates a term.
        </Banner>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-sky-700 to-indigo-800 p-6 text-white shadow-md sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="h-6 w-6 text-sky-200" />
              <h2 className="text-2xl font-bold sm:text-3xl">Teaching Preferences</h2>
            </div>
            <p className="mt-1 text-sm text-sky-100 max-w-2xl">
              Configure your preferred and unavailable teaching hours for {activeTerm.name}.
              The automated timetable solver prioritizes these constraints when generating schedules.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <Badge variant="purple" className="px-3 py-1.5 text-xs font-semibold">
              Priority Weight: {priorityWeight} / 5
            </Badge>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Paint Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
            Paint Tool:
          </span>
          <button
            type="button"
            onClick={() => setSelectedMode('PREFERRED')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              selectedMode === 'PREFERRED'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Preferred (Green)
          </button>
          <button
            type="button"
            onClick={() => setSelectedMode('UNAVAILABLE')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              selectedMode === 'UNAVAILABLE'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <XCircle className="h-3.5 w-3.5" />
            Unavailable (Red)
          </button>
          <button
            type="button"
            onClick={() => setSelectedMode('NEUTRAL')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              selectedMode === 'NEUTRAL'
                ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <MinusCircle className="h-3.5 w-3.5" />
            Neutral / Clear
          </button>
        </div>

        {/* Max Daily Hours & Save Button */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="maxDailyHours" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Daily Limit:
            </label>
            <input
              id="maxDailyHours"
              type="number"
              min={1}
              max={8}
              value={maxDailyHours}
              onChange={(e) => setMaxDailyHours(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
              className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
            <span className="text-xs text-slate-500">hours/day</span>
          </div>

          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={isSaving}
            icon={<Save className="h-4 w-4" />}
            className="px-5"
          >
            Save Preferences
          </Button>
        </div>
      </div>

      {/* Grid Canvas */}
      <div className="mb-4">
        <p className="mb-2 text-xs text-slate-500 flex items-center gap-1.5">
          <Info className="h-4 w-4 text-sky-600" />
          Click or click-and-drag across the grid to paint your preferred or unavailable time slots. Blocked lunch periods are non-assignable.
        </p>

        <TimetableGridShell
          workingDays={activeTerm.workingDays}
          periods={activeTerm.periods}
          renderCell={(dayOfWeek, period: IPeriodGridItem) => {
            const key = `${dayOfWeek}-${period.index}`;
            const state = gridState[key];
            const isBlocked = period.blocked;

            let bgClass = 'bg-slate-50/50 hover:bg-slate-100/80 text-slate-400';
            let label = 'Neutral';

            if (isBlocked) {
              bgClass = 'bg-amber-100/70 text-amber-800 cursor-not-allowed';
              label = 'Blocked';
            } else if (state === 'PREFERRED') {
              bgClass = 'bg-emerald-500 text-white font-semibold shadow-xs';
              label = 'Preferred';
            } else if (state === 'UNAVAILABLE') {
              bgClass = 'bg-rose-500 text-white font-semibold shadow-xs';
              label = 'Unavailable';
            }

            return (
              <div
                onMouseDown={() => handleMouseDown(dayOfWeek, period.index, isBlocked)}
                onMouseEnter={() => handleMouseEnter(dayOfWeek, period.index, isBlocked)}
                role="button"
                tabIndex={0}
                aria-label={`${period.label || `P${period.index}`} ${label}`}
                className={`h-14 w-full select-none rounded-lg p-2 text-center text-xs transition-colors flex flex-col justify-center items-center ${bgClass} cursor-pointer`}
              >
                <span className="text-[11px] font-medium leading-tight">{label}</span>
              </div>
            );
          }}
        />
      </div>

      {/* Priority Note */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 flex items-start gap-3">
        <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800">About Constraint Priorities:</span> Unavailable windows are treated as high-penalty constraints weighted by your admin-assigned priority ({priorityWeight}/5). If strict solver feasibility requires placing a class during an unavailable window, the visual editor flags it prominently for administrative review.
        </div>
      </div>
    </div>
  );
};

export default ProfessorPreferences;
