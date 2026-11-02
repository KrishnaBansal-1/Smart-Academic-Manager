import React, { useState } from 'react';
import { X, Pin, MapPin, Users, GraduationCap, Calendar, Clock, BookOpen } from 'lucide-react';
import { ScheduleSlot, ClassroomRef } from '../../types';
import { DAY_NAMES } from './TimetableGridShell';

interface SlotDetailsPanelProps {
  slot: ScheduleSlot | null;
  classrooms: ClassroomRef[];
  isPublished: boolean;
  onClose: () => void;
  onUpdateRoom: (slotId: string, classroomId: string | null) => Promise<void>;
  onTogglePin: (slotId: string, pinned: boolean) => Promise<void>;
}

export const SlotDetailsPanel: React.FC<SlotDetailsPanelProps> = ({
  slot,
  classrooms,
  isPublished,
  onClose,
  onUpdateRoom,
  onTogglePin,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    slot?.classroomId ? slot.classroomId._id : ''
  );
  const [isUpdatingRoom, setIsUpdatingRoom] = useState(false);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  if (!slot) return null;

  const handleRoomChange = async (newId: string) => {
    setSelectedRoomId(newId);
    try {
      setIsUpdatingRoom(true);
      await onUpdateRoom(slot._id, newId ? newId : null);
    } finally {
      setIsUpdatingRoom(false);
    }
  };

  const handleTogglePin = async () => {
    try {
      setIsUpdatingPin(true);
      await onTogglePin(slot._id, !slot.pinned);
    } finally {
      setIsUpdatingPin(false);
    }
  };

  // Filter classrooms by kind
  const suitableRooms = classrooms.filter((r) =>
    slot.kind === 'LAB' ? r.type === 'LABORATORY' : r.type !== 'LABORATORY'
  );

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-sky-600" />
          <h3 className="font-bold text-slate-900 text-sm">Class Details</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
          aria-label="Close panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-700">
        {/* Course Card */}
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-sky-900">{slot.courseId?.code}</span>
            <span className="rounded bg-sky-200/80 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
              {slot.kind}
            </span>
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {slot.courseId?.title}
          </div>
        </div>

        {/* Schedule Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
              <Calendar className="w-3.5 h-3.5" />
              <span>Day</span>
            </div>
            <div className="mt-1 font-semibold text-slate-900 text-sm">
              {DAY_NAMES[slot.dayOfWeek] || `Day ${slot.dayOfWeek}`}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
              <Clock className="w-3.5 h-3.5" />
              <span>Period</span>
            </div>
            <div className="mt-1 font-semibold text-slate-900 text-sm">
              Period {slot.slotIndex} ({slot.durationSlots || 1} hr)
            </div>
          </div>
        </div>

        {/* Section & Faculty */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-3">
            <Users className="w-4 h-4 text-slate-500 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Batch / Section</div>
              <div className="font-semibold text-slate-900">{slot.batchId?.name}</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
            <GraduationCap className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Faculty Member(s)</div>
              <div className="font-semibold text-slate-900">
                {slot.professorIds && slot.professorIds.length > 0
                  ? slot.professorIds.map((p) => p?.name || `${p?.firstName || ''} ${p?.lastName || ''}`.trim() || p?.email || 'Faculty').join(', ')
                  : 'Unassigned'}
              </div>
            </div>
          </div>
        </div>

        {/* Room Selection */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="room-select" className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>Classroom Allocation</span>
            </label>
            {isUpdatingRoom && <span className="text-[10px] text-sky-600 font-medium">Saving...</span>}
          </div>

          <select
            id="room-select"
            value={selectedRoomId}
            disabled={isPublished || isUpdatingRoom}
            onChange={(e) => handleRoomChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
          >
            <option value="">-- No Classroom Assigned --</option>
            {suitableRooms.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name} ({r.type}, Capacity: {r.capacity})
              </option>
            ))}
          </select>
          {isPublished && (
            <p className="text-[11px] text-slate-400">Classrooms cannot be changed on published timetables.</p>
          )}
        </div>

        {/* Pin Controls */}
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Pin className={`w-3.5 h-3.5 ${slot.pinned ? 'text-amber-600 fill-amber-500' : 'text-slate-400'}`} />
                <span>Pin Placement</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Pinned classes stay locked in their current position during future solver regenerations.
              </p>
            </div>
            <button
              type="button"
              disabled={isPublished || isUpdatingPin}
              onClick={handleTogglePin}
              className={`rounded-lg px-3 py-1.5 font-semibold text-xs transition-all ${
                slot.pinned
                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              } disabled:opacity-50`}
            >
              {slot.pinned ? 'Pinned' : 'Pin Slot'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 px-5 py-3 bg-slate-50 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
