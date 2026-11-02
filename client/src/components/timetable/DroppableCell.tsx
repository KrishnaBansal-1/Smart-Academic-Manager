import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { IPeriodGridItem } from '../../types/academics';
import { ScheduleSlot, DropMapCell } from '../../types';
import { DraggableSlot } from './DraggableSlot';
import { ViewMode } from '../../store/timetableEditorStore';
import { Check, AlertTriangle, XCircle, ArrowLeftRight } from 'lucide-react';

interface DroppableCellProps {
  dayOfWeek: number;
  period: IPeriodGridItem;
  slots: ScheduleSlot[];
  ongoingSlots?: ScheduleSlot[];
  dropMapCell?: DropMapCell;
  isDragging: boolean;
  viewMode: ViewMode;
  selectedEntityId?: string | null;
  disabled?: boolean;
  onSlotClick?: (slot: ScheduleSlot) => void;
}

export const DroppableCell: React.FC<DroppableCellProps> = ({
  dayOfWeek,
  period,
  slots,
  ongoingSlots = [],
  dropMapCell,
  isDragging,
  viewMode,
  selectedEntityId,
  disabled = false,
  onSlotClick,
}) => {
  const cellId = `${dayOfWeek}:${period.index}`;
  const { isOver, setNodeRef } = useDroppable({
    id: cellId,
    data: { dayOfWeek, periodIndex: period.index },
    disabled: disabled || period.blocked,
  });

  // Calculate drop indicator styles
  let stateClasses = '';
  let indicatorIcon = null;

  if (isDragging && dropMapCell && !period.blocked) {
    if (dropMapCell.state === 'GREEN') {
      stateClasses = isOver
        ? 'ring-2 ring-emerald-500 bg-emerald-100/70 border-emerald-400'
        : 'ring-1 ring-emerald-300 bg-emerald-50/40';
      indicatorIcon = (
        <div className="absolute top-1 right-1 flex items-center gap-0.5 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-semibold text-emerald-800 shadow-xs z-10">
          <Check className="w-2.5 h-2.5" />
          <span>{dropMapCell.suggestedRoomName || 'Fit'}</span>
        </div>
      );
    } else if (dropMapCell.state === 'YELLOW') {
      stateClasses = isOver
        ? 'ring-2 ring-amber-500 bg-amber-100/70 border-amber-400'
        : 'ring-1 ring-amber-300 bg-amber-50/40';
      indicatorIcon = (
        <div
          title={dropMapCell.warnings.join('; ')}
          className="absolute top-1 right-1 flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-800 shadow-xs z-10"
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          <span>Warning</span>
        </div>
      );
    } else if (dropMapCell.state === 'RED') {
      stateClasses = isOver
        ? 'ring-2 ring-rose-500 bg-rose-100/70 border-rose-400 cursor-not-allowed'
        : 'ring-1 ring-rose-200 bg-rose-50/20';
      indicatorIcon = (
        <div
          title={dropMapCell.reasons.join('; ')}
          className="absolute top-1 right-1 flex items-center gap-0.5 rounded bg-rose-100 px-1 py-0.5 text-[9px] font-semibold text-rose-800 shadow-xs z-10"
        >
          {dropMapCell.swapValid ? (
            <>
              <ArrowLeftRight className="w-2.5 h-2.5" />
              <span>Swap</span>
            </>
          ) : (
            <>
              <XCircle className="w-2.5 h-2.5" />
              <span>Conflict</span>
            </>
          )}
        </div>
      );
    }
  }

  if (period.blocked) {
    return (
      <div className="h-full min-h-[76px] rounded-lg bg-amber-50/40 border border-dashed border-amber-200/80 p-1 flex items-center justify-center text-center">
        <span className="text-[11px] font-medium text-amber-700/80">
          {period.label || 'Break'}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`relative h-full min-h-[76px] rounded-lg border border-slate-100 bg-white/70 p-1 transition-colors ${stateClasses}`}
    >
      {indicatorIcon}

      <div className="flex flex-col gap-1.5 h-full">
        {/* Active slots starting in this period */}
        {slots.map((slot) => (
          <DraggableSlot
            key={slot._id}
            slot={slot}
            viewMode={viewMode}
            selectedEntityId={selectedEntityId}
            disabled={disabled}
            onClick={() => onSlotClick && onSlotClick(slot)}
          />
        ))}

        {/* Continuation indicator for multi-period slots spanning into this cell */}
        {ongoingSlots.length > 0 && (
          <div className="flex flex-col gap-1">
            {ongoingSlots.map((os) => (
              <div
                key={`cont-${os._id}`}
                onClick={() => onSlotClick && onSlotClick(os)}
                className="flex items-center gap-1.5 rounded-md border border-dashed border-purple-300 bg-purple-50/80 px-2 py-1 text-[10px] text-purple-900 cursor-pointer hover:bg-purple-100 transition-colors shadow-2xs"
                title={`Continuation of ${os.courseId?.title || ''} (${os.durationSlots}h Lab from P${os.slotIndex})`}
              >
                <span className="rounded bg-purple-200 px-1 py-0.2 font-mono font-bold text-[9px] text-purple-800">
                  CONT
                </span>
                <span className="font-semibold truncate">{os.courseId?.code}</span>
                {os.batchId && (
                  <span className="text-purple-700 truncate">({os.batchId.name})</span>
                )}
              </div>
            ))}
          </div>
        )}

        {slots.length === 0 && ongoingSlots.length === 0 && !isDragging && (
          <div className="h-full min-h-[64px] rounded-md border border-dashed border-transparent hover:border-slate-200/60 transition-colors" />
        )}
      </div>
    </div>
  );
};
