import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ScheduleSlot } from '../../types';
import { DraggableSlot } from './DraggableSlot';
import { ViewMode } from '../../store/timetableEditorStore';

interface UnplacedTrayProps {
  unplacedSlots: ScheduleSlot[];
  viewMode: ViewMode;
  disabled?: boolean;
  onSlotClick?: (slot: ScheduleSlot) => void;
}

export const UnplacedTray: React.FC<UnplacedTrayProps> = ({
  unplacedSlots,
  viewMode,
  disabled = false,
  onSlotClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (unplacedSlots.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-800 shadow-xs">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="font-semibold">All classes placed!</span>
        <span className="text-emerald-700">The timetable has zero unplaced offerings and is ready to publish.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs overflow-hidden">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-amber-100/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-200 text-amber-900 font-bold text-xs">
            {unplacedSlots.length}
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
              Unplaced Classes ({unplacedSlots.length})
            </h4>
            <p className="text-[11px] text-amber-800/80">
              Drag classes directly onto free grid cells to resolve unscheduled offerings
            </p>
          </div>
        </div>
        <button
          type="button"
          className="rounded p-1 text-amber-800 hover:bg-amber-200/60"
          aria-label={isExpanded ? 'Collapse unplaced tray' : 'Expand unplaced tray'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-3 border-t border-amber-200/60 bg-white/60">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {unplacedSlots.map((slot) => (
              <div key={slot._id} className="flex flex-col gap-1">
                <DraggableSlot
                  slot={slot}
                  viewMode={viewMode}
                  disabled={disabled}
                  onClick={() => onSlotClick && onSlotClick(slot)}
                />
                {slot.unplacedReason && (
                  <div className="flex items-start gap-1 text-[10px] text-amber-800 leading-tight px-1">
                    <AlertCircle className="w-2.5 h-2.5 shrink-0 text-amber-600 mt-0.5" />
                    <span className="line-clamp-2" title={slot.unplacedReason}>
                      {slot.unplacedReason}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
