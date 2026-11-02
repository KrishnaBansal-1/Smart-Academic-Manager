import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getTodaySchedule } from '../../api/schedule';
import { Calendar, CheckCircle2, ClipboardList, Clock, MapPin, ArrowRight, Loader2 } from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const batchName = typeof user?.batchId === 'object' && user.batchId ? user.batchId.name : null;

  const {
    data: todaySchedule,
    isLoading: isScheduleLoading,
  } = useQuery({
    queryKey: ['schedule', 'today', 'student'],
    queryFn: () => getTodaySchedule(),
  });

  const todayEntries = todaySchedule?.entries || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-800 p-6 text-white shadow-md sm:flex-row sm:items-center sm:p-8">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Welcome, {user?.firstName}!</h2>
          <p className="mt-2 text-sm text-teal-100">
            Roll number: <span className="font-semibold text-white">{user?.rollNumber || 'Not assigned'}</span>
          </p>
          {batchName && (
            <p className="mt-1 text-sm text-teal-100">
              Section: <span className="font-semibold text-white">{batchName}</span>
            </p>
          )}
        </div>
        <div className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 sm:text-right">
          <p className="text-xs font-medium text-teal-100">Attendance</p>
          <p className="mt-1 text-sm font-semibold text-white">No records yet</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-slate-800">My Attendance</h3>
          </div>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 font-semibold text-slate-800">Attendance records will appear here</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Your attendance summary is available after class sessions are scheduled and recorded.
            </p>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Attendance guidance: 80% or above is good standing; 70–79% is a warning; below 70% is critical.
          </p>
        </section>

        {/* Real Today's Schedule Panel */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="h-5 w-5 text-sky-600" />
                <h3 className="text-lg font-bold text-slate-800">Today's Schedule</h3>
              </div>
              <Link
                to="/student/timetable"
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 transition"
              >
                <span>View Full Timetable</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {isScheduleLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2 text-sky-600" />
                Loading today's schedule...
              </div>
            ) : !todaySchedule?.published ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <Calendar className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 font-semibold text-slate-800">No published timetable yet</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  Your section timetable will appear here after the administrator publishes a schedule.
                </p>
              </div>
            ) : todayEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                <Calendar className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-700">No classes scheduled for today</p>
                <p className="mt-1 text-xs text-slate-500">Enjoy your free day or prepare for upcoming lectures!</p>
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
                                : 'text-sky-700'
                            }`}
                          >
                            {entry.course.code}
                          </span>
                          <span className="text-xs text-slate-500">Period {entry.period}</span>
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

          <div className="mt-4 border-t border-slate-100 pt-3">
            <Link
              to="/student/timetable"
              className="text-xs font-semibold text-sky-700 hover:text-sky-800 transition flex items-center justify-between"
            >
              <span>Explore your complete weekly timetable</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};
