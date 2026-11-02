import React from 'react';
import { Users, GraduationCap, Building2 } from 'lucide-react';
import { ViewMode } from '../../store/timetableEditorStore';
import { BatchRef, UserRef, ClassroomRef } from '../../types';

interface ViewSelectorProps {
  viewMode: ViewMode;
  selectedEntityId: string | null;
  onViewModeChange: (mode: ViewMode) => void;
  onEntityChange: (id: string | null) => void;
  batches: BatchRef[];
  professors: UserRef[];
  classrooms: ClassroomRef[];
  slotCount?: number;
}

export const ViewSelector: React.FC<ViewSelectorProps> = ({
  viewMode,
  selectedEntityId,
  onViewModeChange,
  onEntityChange,
  batches,
  professors,
  classrooms,
  slotCount,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
      {/* View Mode Tabs */}
      <div className="flex items-center rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => onViewModeChange('BATCH')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
            viewMode === 'BATCH'
              ? 'bg-white text-sky-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Section View</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange('PROFESSOR')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
            viewMode === 'PROFESSOR'
              ? 'bg-white text-sky-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Faculty View</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange('ROOM')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
            viewMode === 'ROOM'
              ? 'bg-white text-sky-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Room View</span>
        </button>
      </div>

      {/* Target Selector Dropdown */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="entity-select" className="text-xs font-medium text-slate-500 whitespace-nowrap">
            {viewMode === 'BATCH' && 'Select Section:'}
            {viewMode === 'PROFESSOR' && 'Select Faculty:'}
            {viewMode === 'ROOM' && 'Select Room:'}
          </label>
          <select
            id="entity-select"
            value={selectedEntityId || ''}
            onChange={(e) => onEntityChange(e.target.value || null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500 min-w-[200px]"
          >
            <option value="">-- All {viewMode === 'BATCH' ? 'Sections' : viewMode === 'PROFESSOR' ? 'Faculty' : 'Rooms'} --</option>
            {viewMode === 'BATCH' &&
              batches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} (Sem {b.semester})
                </option>
              ))}
            {viewMode === 'PROFESSOR' &&
              professors.map((p) => {
                const name = p?.name || `${p?.firstName || ''} ${p?.lastName || ''}`.trim() || p?.email || 'Faculty';
                return (
                  <option key={p._id} value={p._id}>
                    {name}
                  </option>
                );
              })}
            {viewMode === 'ROOM' &&
              classrooms.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name} ({r.type}, Cap {r.capacity})
                </option>
              ))}
          </select>
        </div>

        {slotCount !== undefined && (
          <div className="text-xs font-medium text-slate-500 border-l pl-3 border-slate-200">
            <span className="font-bold text-slate-900">{slotCount}</span> classes
          </div>
        )}
      </div>
    </div>
  );
};
