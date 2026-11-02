import React from 'react';
import { Cpu, CheckCircle2, AlertOctagon } from 'lucide-react';
import { GenerationJob } from '../../types';

interface GenerationProgressProps {
  job: GenerationJob | null;
  onClose?: () => void;
  onViewDraft?: (timetableId: string) => void;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  job,
  onClose,
  onViewDraft,
}) => {
  if (!job) return null;

  const isRunning = job.status === 'RUNNING' || job.status === 'QUEUED';
  const isDone = job.status === 'DONE';
  const isFailed = job.status === 'FAILED';

  const timetableId =
    typeof job.timetableId === 'object' && job.timetableId !== null
      ? job.timetableId._id
      : job.timetableId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              isRunning
                ? 'bg-sky-100 text-sky-600'
                : isDone
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-rose-100 text-rose-600'
            }`}
          >
            {isRunning && <Cpu className="w-5 h-5 animate-pulse" />}
            {isDone && <CheckCircle2 className="w-5 h-5" />}
            {isFailed && <AlertOctagon className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isRunning && 'Generating Timetable...'}
              {isDone && 'Timetable Generated!'}
              {isFailed && 'Generation Failed'}
            </h3>
            <p className="text-xs text-slate-500">
              {isRunning && 'CSP Solver & Simulated Annealing in progress'}
              {isDone && 'Draft timetable created with optimized constraints'}
              {isFailed && (job.error || 'Solver encountered an unexpected error')}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5 space-y-2">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Status: {job.status}</span>
            <span>{job.progress}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full transition-all duration-300 ${
                isDone ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : 'bg-sky-600'
              }`}
              style={{ width: `${Math.max(5, job.progress)}%` }}
            />
          </div>
        </div>

        {/* Metrics when done */}
        {isDone && job.metrics && (
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs">
            <div>
              <div className="font-bold text-slate-900">{job.metrics.placed}</div>
              <div className="text-[10px] text-slate-500">Placed Slots</div>
            </div>
            <div>
              <div className="font-bold text-slate-900">{job.metrics.unplaced}</div>
              <div className="text-[10px] text-slate-500">Unplaced</div>
            </div>
            <div>
              <div className="font-bold text-emerald-600 font-mono">{job.metrics.softScore}%</div>
              <div className="text-[10px] text-slate-500">Score</div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex items-center justify-end gap-3">
          {isFailed && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Dismiss
            </button>
          )}

          {isDone && (
            <>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              )}
              {timetableId && onViewDraft && (
                <button
                  type="button"
                  onClick={() => onViewDraft(timetableId)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm"
                >
                  Open Generated Draft
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
