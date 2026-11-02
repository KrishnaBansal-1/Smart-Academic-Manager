import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getWeekSchedule } from '../../api/schedule';
import { WeekView } from '../../components/timetable/WeekView';
import { GraduationCap } from 'lucide-react';
import { format } from 'date-fns';

export const StudentTimetable: React.FC = () => {
  const { user } = useAuth();
  const [currentWeekOf, setCurrentWeekOf] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const {
    data: scheduleData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['schedule', 'student', currentWeekOf],
    queryFn: () => getWeekSchedule({ weekOf: currentWeekOf }),
  });

  const batchName = typeof user?.batchId === 'object' && user.batchId ? user.batchId.name : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Title & Section Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-800 p-6 text-white shadow-md sm:flex-row sm:items-center sm:p-8">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-teal-200" />
            <span className="text-xs font-bold uppercase tracking-wider text-teal-200">
              Student Schedule Portal
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">My Class Timetable</h1>
          <p className="mt-1 text-sm text-teal-100">
            Official published timetable for your enrolled batch and courses.
          </p>
        </div>

        {batchName && (
          <div className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 sm:text-right">
            <p className="text-xs font-medium text-teal-100">Enrolled Section</p>
            <p className="mt-0.5 text-base font-bold text-white">{batchName}</p>
            <p className="text-xs text-teal-200">{user?.rollNumber || 'Enrolled Student'}</p>
          </div>
        )}
      </div>

      <WeekView
        scheduleData={scheduleData}
        isLoading={isLoading}
        error={error ? (error as Error).message : null}
        currentWeekOf={currentWeekOf}
        onWeekChange={(newWeek) => setCurrentWeekOf(newWeek)}
        role="STUDENT"
        showSection={false}
        showFaculty={true}
      />
    </div>
  );
};

export default StudentTimetable;
