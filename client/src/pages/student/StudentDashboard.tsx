import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Calendar, CheckCircle2, ClipboardList } from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const batchName = typeof user?.batchId === 'object' && user.batchId ? user.batchId.name : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-800 p-6 text-white shadow-md sm:flex-row sm:items-center sm:p-8">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Welcome, {user?.firstName}!</h2>
          <p className="mt-2 text-sm text-teal-100">Roll number: <span className="font-semibold text-white">{user?.rollNumber || 'Not assigned'}</span></p>
          {batchName && <p className="mt-1 text-sm text-teal-100">Section: <span className="font-semibold text-white">{batchName}</span></p>}
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
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Your attendance summary is available after class sessions are scheduled and recorded.</p>
          </div>
          <p className="mt-4 text-xs text-slate-500">Attendance guidance: 80% or above is good standing; 70–79% is a warning; below 70% is critical.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5">
            <Calendar className="h-5 w-5 text-sky-600" />
            <h3 className="text-lg font-bold text-slate-800">My Timetable</h3>
          </div>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
            <Calendar className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 font-semibold text-slate-800">No published timetable yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Your section timetable will appear here after the administrator publishes a schedule.</p>
          </div>
        </section>
      </div>
    </div>
  );
};
