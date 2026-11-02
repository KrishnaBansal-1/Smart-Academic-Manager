import React from 'react';
import { ArrowLeftRight, AlertCircle } from 'lucide-react';
import { ScheduleSlot } from '../../types';

interface SwapConflictModalProps {
  slotA: ScheduleSlot | null;
  slotB: ScheduleSlot | null;
  isOpen: boolean;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const SwapConflictModal: React.FC<SwapConflictModalProps> = ({
  slotA,
  slotB,
  isOpen,
  isSubmitting = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen || !slotA || !slotB) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-sky-700">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
            <ArrowLeftRight className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Resolve Placement Conflict via Swap</h3>
            <p className="text-xs text-slate-500">The destination cell is occupied, but a mutual swap is feasible.</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {/* Card A */}
          <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3.5 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Moving Slot</div>
            <div className="mt-1 font-semibold text-slate-900">
              {slotA.courseId?.code} - {slotA.courseId?.title}
            </div>
            <div className="mt-1 text-[11px] text-slate-600">
              Batch: <span className="font-medium text-slate-800">{slotA.batchId?.name}</span> • Day {slotA.dayOfWeek}, Period {slotA.slotIndex}
            </div>
          </div>

          <div className="flex justify-center -my-1 text-slate-400">
            <ArrowLeftRight className="w-4 h-4" />
          </div>

          {/* Card B */}
          <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3.5 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Occupant Slot</div>
            <div className="mt-1 font-semibold text-slate-900">
              {slotB.courseId?.code} - {slotB.courseId?.title}
            </div>
            <div className="mt-1 text-[11px] text-slate-600">
              Batch: <span className="font-medium text-slate-800">{slotB.batchId?.name}</span> • Day {slotB.dayOfWeek}, Period {slotB.slotIndex}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 border border-slate-200">
          <AlertCircle className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            Executing this swap moves each class to the other's position atomically within a single database transaction.
          </span>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Swapping...' : 'Confirm Swap'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
