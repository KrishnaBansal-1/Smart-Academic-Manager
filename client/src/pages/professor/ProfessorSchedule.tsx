import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { getWeekSchedule } from '../../api/schedule';
import { WeekView } from '../../components/timetable/WeekView';
import { Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';

interface FacultyMember {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export const ProfessorSchedule: React.FC = () => {
  const { user } = useAuth();
  const [currentWeekOf, setCurrentWeekOf] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedProfessorId, setSelectedProfessorId] = useState<string>(user?._id || user?.id || '');

  // 1. Fetch Department Faculty members for selection dropdown
  const { data: departmentFaculty = [] } = useQuery({
    queryKey: ['professor', 'department-faculty'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { items: FacultyMember[] } }>(
        '/professor/department-faculty'
      );
      return res.data.data.items || [];
    },
  });

  // 2. Fetch Weekly Schedule
  const effectiveProfessorId = selectedProfessorId || user?._id || user?.id;
  const {
    data: scheduleData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['schedule', 'professor', currentWeekOf, effectiveProfessorId],
    queryFn: () =>
      getWeekSchedule({
        weekOf: currentWeekOf,
        professorId: effectiveProfessorId,
      }),
    enabled: Boolean(effectiveProfessorId),
  });

  const isViewingOwnSchedule =
    !selectedProfessorId ||
    selectedProfessorId === user?._id ||
    selectedProfessorId === user?.id;

  const currentFacultyMember = departmentFaculty.find(
    (f) => f._id === selectedProfessorId
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white shadow-md sm:flex-row sm:items-center sm:p-8">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-200" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
              Faculty Teaching Calendar
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            {isViewingOwnSchedule
              ? 'My Teaching Schedule'
              : `${currentFacultyMember?.firstName || 'Faculty'} ${
                  currentFacultyMember?.lastName || ''
                }'s Schedule`}
          </h1>
          <p className="mt-1 text-sm text-blue-100">
            {isViewingOwnSchedule
              ? 'View your weekly classes, rescheduled slots, and scheduled minor examinations.'
              : 'Viewing weekly calendar for a department colleague.'}
          </p>
        </div>

        {/* Colleague Selector */}
        {departmentFaculty.length > 0 && (
          <div className="flex flex-col gap-1 rounded-xl border border-white/20 bg-white/10 p-3 sm:w-64">
            <label
              htmlFor="faculty-select"
              className="flex items-center gap-1.5 text-xs font-medium text-blue-100"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Department Faculty</span>
            </label>
            <select
              id="faculty-select"
              value={selectedProfessorId}
              onChange={(e) => setSelectedProfessorId(e.target.value)}
              className="w-full rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-white"
            >
              <option value={user?._id || user?.id}>
                My Schedule ({user?.firstName} {user?.lastName})
              </option>
              {departmentFaculty
                .filter((f) => f._id !== (user?._id || user?.id))
                .map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.firstName} {f.lastName}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      <WeekView
        scheduleData={scheduleData}
        isLoading={isLoading}
        error={error ? (error as Error).message : null}
        currentWeekOf={currentWeekOf}
        onWeekChange={(newWeek) => setCurrentWeekOf(newWeek)}
        role="PROFESSOR"
        showSection={true}
        showFaculty={!isViewingOwnSchedule}
      />
    </div>
  );
};

export default ProfessorSchedule;
