import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Pin, AlertCircle, Clock, MapPin, Users } from 'lucide-react';
import { ScheduleSlot } from '../../types';
import { ViewMode } from '../../store/timetableEditorStore';

interface DraggableSlotProps {
  slot: ScheduleSlot;
  viewMode: ViewMode;
  selectedEntityId?: string | null;
  disabled?: boolean;
  onClick?: () => void;
  isOverlay?: boolean;
}

export const DraggableSlot: React.FC<DraggableSlotProps> = ({
  slot,
  viewMode,
  selectedEntityId,
  disabled = false,
  onClick,
  isOverlay = false,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: slot._id,
    data: { slot },
    disabled,
  });

  const isLab = slot.kind === 'LAB';
  const duration = slot.durationSlots || 1;

  // Styling accents based on kind and duration
  const baseClasses = isLab
    ? 'border-2 border-purple-300 bg-linear-to-br from-purple-50 via-white to-purple-100/70 text-purple-950 hover:border-purple-400 shadow-xs'
    : 'border border-sky-200 bg-sky-50/90 text-sky-900 hover:border-sky-300 shadow-xs';

  const overlayClasses = isOverlay ? 'shadow-2xl ring-2 ring-sky-500 cursor-grabbing z-50' : '';
  const draggingClasses = isDragging ? 'opacity-30' : '';

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`group relative flex flex-col justify-between rounded-lg p-2.5 text-xs transition-all select-none ${baseClasses} ${overlayClasses} ${draggingClasses} ${
        disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      }`}
      style={{
        minHeight: duration > 1 ? `${Math.max(88, duration * 60)}px` : '74px',
      }}
      role="button"
      tabIndex={0}
      aria-label={`${slot.courseId?.code || 'Slot'} - ${slot.courseId?.title || ''}`}
    >
      {/* Top row: Code & Badges */}
      <div className="flex items-start justify-between gap-1">
        <div className="flex flex-wrap items-center gap-1 font-bold tracking-tight">
          <span className="truncate font-mono">{slot.courseId?.code || 'UNASSIGNED'}</span>
          {isLab && (
            <span className="rounded bg-purple-200 px-1.5 py-0.5 text-[9px] font-bold text-purple-900 shadow-2xs">
              LAB
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {duration > 1 && (
            <span className="flex items-center gap-0.5 rounded bg-purple-200/90 px-1.5 py-0.5 text-[9px] font-bold text-purple-900 shadow-2xs">
              <Clock className="w-2.5 h-2.5" />
              {duration}h
            </span>
          )}
          {slot.pinned && (
            <span title="Pinned to this slot" className="text-amber-600">
              <Pin className="w-3.5 h-3.5 fill-amber-500" />
            </span>
          )}
        </div>
      </div>

      {/* Course title */}
      <div className="mt-1 line-clamp-1 text-[11px] font-medium text-slate-800" title={slot.courseId?.title}>
        {slot.courseId?.title}
      </div>

      {/* Section Badge (prominent, especially in All Sections view) */}
      {slot.batchId && (
        <div className="mt-1 flex items-center">
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold shadow-2xs ${
              !selectedEntityId && viewMode === 'BATCH'
                ? 'bg-amber-100 text-amber-900 border border-amber-300 ring-1 ring-amber-200'
                : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
            }`}
          >
            <Users className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate max-w-[130px]">{slot.batchId.name}</span>
          </span>
        </div>
      )}

      {/* Bottom row: Dynamic info based on view mode */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-600">
        {viewMode !== 'PROFESSOR' && slot.professorIds && slot.professorIds.length > 0 && (
          <span
            className="truncate max-w-[110px]"
            title={slot.professorIds
              .map((p) => p?.name || `${p?.firstName || ''} ${p?.lastName || ''}`.trim() || p?.email || 'Faculty')
              .join(', ')}
          >
            {slot.professorIds
              .map((p) => {
                const fullName = p?.name || `${p?.firstName || ''} ${p?.lastName || ''}`.trim() || p?.email || 'Faculty';
                return fullName.split(' ')[0];
              })
              .join(', ')}
          </span>
        )}

        {viewMode !== 'ROOM' && (
          <span className="flex items-center gap-0.5 text-slate-500">
            <MapPin className="w-2.5 h-2.5" />
            {slot.classroomId ? slot.classroomId.name : <span className="text-amber-600">No Room</span>}
          </span>
        )}
      </div>

      {/* Unplaced warning indicator */}
      {!slot.placed && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-600 font-medium">
          <AlertCircle className="w-3 h-3" />
          <span>Unplaced</span>
        </div>
      )}
    </div>
  );
};
