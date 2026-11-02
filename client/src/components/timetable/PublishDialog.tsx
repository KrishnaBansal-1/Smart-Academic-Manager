import React, { useState } from 'react';
import { Send, CheckCircle2, AlertTriangle, Calendar, Bell } from 'lucide-react';
import { AcademicTerm } from '../../types/academics';

interface PublishDialogProps {
  isOpen: boolean;
  term: AcademicTerm | null;
  unplacedCount: number;
  hasConflicts: boolean;
  isSubmitting?: boolean;
  onConfirm: (effectiveFrom: string) => Promise<void>;
  onClose: () => void;
}

export const PublishDialog: React.FC<PublishDialogProps> = ({
  isOpen,
  term,
  unplacedCount,
  hasConflicts,
  isSubmitting = false,
  onConfirm,
  onClose,
}) => {
  const defaultEffective = term?.startDate || new Date().toISOString().split('T')[0];
  const [effectiveFrom, setEffectiveFrom] = useState(defaultEffective);

  if (!isOpen) return null;

  const canPublish = unplacedCount === 0 && !hasConflicts;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublish) return;
    await onConfirm(effectiveFrom);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-emerald-700">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <Send className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Publish Academic Timetable</h3>
            <p className="text-xs text-slate-500">Make this timetable active and operational for the term.</p>
          </div>
        </div>

        {/* Pre-flight Checklist */}
        <div className="mt-5 space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
          <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Publish Checklist</div>

          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">Unplaced Course Offerings:</span>
            {unplacedCount === 0 ? (
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>0 (All placed)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 font-semibold text-rose-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{unplacedCount} unplaced</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">Constraint Violations:</span>
            {!hasConflicts ? (
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Passed (0 hard conflicts)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 font-semibold text-rose-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Conflicts detected</span>
              </span>
            )}
          </div>
        </div>

        {/* Effective From Date */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="effective-date" className="block text-xs font-bold text-slate-800 mb-1">
              Effective From Date
            </label>
            <div className="relative">
              <input
                id="effective-date"
                type="date"
                value={effectiveFrom}
                min={term?.startDate}
                max={term?.endDate}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-xs focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                required
              />
              <Calendar className="pointer-events-none absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Timetable classes will be expanded to operational bookings from this calendar date through term end.
            </p>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-900">
            <Bell className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              Upon publication, instant notifications will be dispatched to all faculty members and students across enrolled batches.
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canPublish || isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Publishing...' : 'Publish Timetable'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
