import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { getWeekSchedule } from '../../api/schedule';
import { WeekView } from '../../components/timetable/WeekView';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';

interface BatchItem {
  _id: string;
  name: string;
  departmentId?: any;
}

interface ProfessorItem {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface RoomItem {
  _id: string;
  name: string;
  building: string;
  type: string;
}

export const AdminSchedule: React.FC = () => {
  const queryClient = useQueryClient();
  const [currentWeekOf, setCurrentWeekOf] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [filterType, setFilterType] = useState<'BATCH' | 'PROFESSOR' | 'ROOM'>('BATCH');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedProfId, setSelectedProfId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  // Fetch batches
  const { data: batches = [] } = useQuery({
    queryKey: ['admin', 'batches'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { items: BatchItem[] } }>('/admin/semesters');
      const items = res.data.data.items || [];
      if (items.length > 0 && !selectedBatchId) {
        setSelectedBatchId(items[0]._id);
      }
      return items;
    },
  });

  // Fetch professors
  const { data: professors = [] } = useQuery({
    queryKey: ['admin', 'professors'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { items: ProfessorItem[] } }>('/admin/professors');
      const items = res.data.data.items || [];
      if (items.length > 0 && !selectedProfId) {
        setSelectedProfId(items[0]._id);
      }
      return items;
    },
  });

  // Fetch rooms
  const { data: rooms = [] } = useQuery({
    queryKey: ['admin', 'rooms'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { items: RoomItem[] } }>('/admin/rooms');
      const items = res.data.data.items || [];
      if (items.length > 0 && !selectedRoomId) {
        setSelectedRoomId(items[0]._id);
      }
      return items;
    },
  });

  // Determine query params
  const effectiveBatchId = filterType === 'BATCH' ? selectedBatchId : undefined;
  const effectiveProfId = filterType === 'PROFESSOR' ? selectedProfId : undefined;
  const effectiveRoomId = filterType === 'ROOM' ? selectedRoomId : undefined;

  const hasFilter = Boolean(effectiveBatchId || effectiveProfId || effectiveRoomId);

  const {
    data: scheduleData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      'schedule',
      'admin',
      currentWeekOf,
      effectiveBatchId,
      effectiveProfId,
      effectiveRoomId,
    ],
    queryFn: () =>
      getWeekSchedule({
        weekOf: currentWeekOf,
        batchId: effectiveBatchId,
        professorId: effectiveProfId,
        roomId: effectiveRoomId,
      }),
    enabled: hasFilter,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-purple-800 to-indigo-900 p-6 text-white shadow-md sm:flex-row sm:items-center sm:p-8">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-purple-200" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-200">
              Institutional Schedule Manager
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Campus Schedule Viewer & Overrides</h1>
          <p className="mt-1 text-sm text-purple-200">
            View any section, faculty member, or classroom schedule. Cancel, reschedule, or restore classes with full administrative authority.
          </p>
        </div>

        {/* View Filter Mode Selector */}
        <div className="flex flex-col gap-2 rounded-xl border border-white/20 bg-white/10 p-3 sm:w-80">
          <div className="flex items-center gap-1 rounded-lg bg-black/20 p-1 text-xs">
            <button
              onClick={() => setFilterType('BATCH')}
              className={`flex-1 rounded-md py-1 font-semibold transition ${
                filterType === 'BATCH' ? 'bg-white text-slate-900 shadow-sm' : 'text-purple-200 hover:text-white'
              }`}
            >
              Section
            </button>
            <button
              onClick={() => setFilterType('PROFESSOR')}
              className={`flex-1 rounded-md py-1 font-semibold transition ${
                filterType === 'PROFESSOR' ? 'bg-white text-slate-900 shadow-sm' : 'text-purple-200 hover:text-white'
              }`}
            >
              Faculty
            </button>
            <button
              onClick={() => setFilterType('ROOM')}
              className={`flex-1 rounded-md py-1 font-semibold transition ${
                filterType === 'ROOM' ? 'bg-white text-slate-900 shadow-sm' : 'text-purple-200 hover:text-white'
              }`}
            >
              Room
            </button>
          </div>

          {filterType === 'BATCH' && (
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-white focus:bg-white focus:outline-none"
            >
              {batches.map((b) => (
                <option key={b._id} value={b._id}>
                  Section: {b.name}
                </option>
              ))}
            </select>
          )}

          {filterType === 'PROFESSOR' && (
            <select
              value={selectedProfId}
              onChange={(e) => setSelectedProfId(e.target.value)}
              className="w-full rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-white focus:bg-white focus:outline-none"
            >
              {professors.map((p) => (
                <option key={p._id} value={p._id}>
                  Prof. {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
          )}

          {filterType === 'ROOM' && (
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-white focus:bg-white focus:outline-none"
            >
              {rooms.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name} ({r.type})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <WeekView
        scheduleData={scheduleData}
        isLoading={isLoading}
        error={error ? (error as Error).message : null}
        currentWeekOf={currentWeekOf}
        onWeekChange={(newWeek) => setCurrentWeekOf(newWeek)}
        role="ADMIN"
        showSection={filterType !== 'BATCH'}
        showFaculty={filterType !== 'PROFESSOR'}
        onScheduleChange={() => queryClient.invalidateQueries({ queryKey: ['schedule'] })}
      />
    </div>
  );
};

export default AdminSchedule;
