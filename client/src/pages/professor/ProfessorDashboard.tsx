import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Calendar, Loader2, Sliders, Users, Clock, MapPin, ArrowRight } from 'lucide-react';
import { apiClient } from '../../api/client';
import { getTodaySchedule } from '../../api/schedule';
import { CourseOffering } from '../../types';

export const ProfessorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get<{ data: { items: CourseOffering[] } }>('/professor/offerings')
      .then(({ data }) => {
        if (isMounted) setOfferings(data.data.items);
      })
      .catch(() => {
        if (isMounted)
          setLoadError(
            'Assigned course offerings could not be loaded. Please refresh and try again.'
          );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const { data: todaySchedule, isLoading: isScheduleLoading } = useQuery({
    queryKey: ['schedule', 'today', 'professor'],
    queryFn: () => getTodaySchedule(),
  });

  const todayEntries = todaySchedule?.entries || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-700 to-sky-800 p-6 text-white shadow-md sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">
              Welcome, {user?.firstName} {user?.lastName}!
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-blue-100">
              Your assigned course offerings and sections are listed below. Configure your teaching
              availability preferences to assist the automatic timetable generator.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/professor/schedule"
              className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl bg-white text-blue-800 hover:bg-blue-50 px-4 py-2.5 text-sm font-semibold shadow-sm transition"
            >
              <Calendar className="h-4 w-4" />
              My Schedule
            </Link>
            <Link
              to="/professor/preferences"
              className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition"
            >
              <Sliders className="h-4 w-4" />
              Set Preferences
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <BookOpen className="h-5 w-5 text-sky-600" />
                <h3 className="text-lg font-bold text-slate-800">Assigned Offerings & Sections</h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Courses and sections assigned to your faculty profile.
              </p>
            </div>
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
              {offerings.length} Active
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading course offerings...
            </div>
          ) : loadError ? (
            <div role="alert" className="px-6 py-12 text-center text-sm text-red-700">
              {loadError}
            </div>
          ) : offerings.length ? (
            <div className="divide-y divide-slate-100">
              {offerings.map((offering) => {
                const otherFaculty = (offering.professorIds || []).filter(
                  (p) => p._id !== user?._id && p._id !== user?.id
                );
                return (
                  <div
                    key={offering._id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 sm:px-6 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 font-mono">
                          {offering.courseId.code}
                        </span>
                        <span className="rounded bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                          {offering.batchId.name}
                        </span>
                      </div>
                      <h4 className="mt-1.5 font-semibold text-slate-900">
                        {offering.courseId.title}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        {offering.theoryHoursPerWeek} theory hrs
                        {offering.labBlocksPerWeek > 0
                          ? ` · ${offering.labBlocksPerWeek} × ${offering.labBlockLength} hr lab block`
                          : ''}{' '}
                        weekly
                      </p>

                      {otherFaculty.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          <span>Co-teaching with:</span>
                          <span className="font-medium text-slate-700">
                            {otherFaculty.map((p) => `${p.firstName} ${p.lastName}`).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    <span className="shrink-0 self-start sm:self-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {offering.courseId.credits} credits
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <p className="font-semibold text-slate-800">No course offerings assigned yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Ask an administrator to add your course assignments for this term.
              </p>
            </div>
          )}
        </section>

        {/* Real Teaching Schedule for Today */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-800">Today's Teaching Schedule</h3>
              </div>
              <Link
                to="/professor/schedule"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
              >
                <span>Full Schedule</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {isScheduleLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2 text-indigo-600" />
                Loading schedule...
              </div>
            ) : !todaySchedule?.published ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <Calendar className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 font-semibold text-slate-800">No published schedule yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                  Your weekly calendar and teaching schedule will appear once the timetable for this
                  term is published.
                </p>
              </div>
            ) : todayEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                <Calendar className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-700">No classes scheduled for today</p>
                <p className="mt-1 text-xs text-slate-500">You have no teaching periods scheduled today.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayEntries.map((entry) => (
                  <div
                    key={entry.occurrenceId}
                    className={`rounded-xl border p-3.5 transition ${
                      entry.state === 'CANCELLED'
                        ? 'border-red-200 bg-red-50/60 opacity-75'
                        : entry.state === 'EXAM'
                        ? 'border-purple-200 bg-purple-50/60'
                        : entry.state === 'MOVED_IN'
                        ? 'border-emerald-200 bg-emerald-50/60'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-xs font-bold ${
                              entry.state === 'CANCELLED'
                                ? 'line-through text-slate-400'
                                : 'text-indigo-700'
                            }`}
                          >
                            {entry.course.code}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            {entry.batch.name} (P{entry.period})
                          </span>
                        </div>
                        <h4
                          className={`mt-0.5 text-sm font-bold text-slate-900 ${
                            entry.state === 'CANCELLED' ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {entry.course.title}
                        </h4>
                      </div>
                      {entry.state === 'CANCELLED' && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                          Cancelled
                        </span>
                      )}
                      {entry.state === 'EXAM' && (
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">
                          Exam
                        </span>
                      )}
                      {entry.state === 'MOVED_IN' && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          Rescheduled
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {entry.startTime} - {entry.endTime}
                      </span>
                      {entry.classroom && (
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {entry.classroom.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4 flex flex-col gap-2">
            <Link
              to="/professor/schedule"
              className="flex items-center justify-between text-xs font-semibold text-indigo-700 hover:text-indigo-800"
            >
              <span>View full weekly calendar</span>
              <Calendar className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/professor/preferences"
              className="flex items-center justify-between text-xs font-semibold text-sky-700 hover:text-sky-800"
            >
              <span>Manage your preferred teaching hours</span>
              <Sliders className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProfessorDashboard;
