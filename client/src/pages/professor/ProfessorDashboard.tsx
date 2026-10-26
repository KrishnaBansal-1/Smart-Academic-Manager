import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Clock, CheckSquare, Sliders, AlertTriangle } from 'lucide-react';

export const ProfessorDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-blue-700 to-sky-800 rounded-2xl p-6 sm:p-8 text-white shadow-md mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold">Good day, Prof. {user?.lastName}!</h2>
        <p className="text-blue-100 mt-2 text-sm max-w-2xl">
          Faculty Portal. View your teaching commitments, submit personal scheduling constraints, manage temporary class rescheduling, and record lecture attendance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Today's Classes & Fast Attendance */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center space-x-2.5">
                <Clock className="w-5 h-5 text-sky-600" />
                <h3 className="text-lg font-bold text-slate-800">Today's Schedule & Attendance</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-sky-50 text-sky-700 rounded-full border border-sky-100">
                Monday (Active Term)
              </span>
            </div>

            {/* Mock Scheduled Sessions for Demo */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 hover:border-sky-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-blue-100 text-blue-700">CS301</span>
                    <h4 className="font-semibold text-slate-900">Data Structures & Algorithms (Theory)</h4>
                  </div>
                  <p className="text-xs text-slate-500">
                    09:00 AM - 10:00 AM • Room: <span className="font-medium text-slate-700">LH-101</span> • Batch: <span className="font-medium text-slate-700">CSE-2026-SecA</span>
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors">
                    <CheckSquare className="w-4 h-4" />
                    <span>Take Attendance</span>
                  </button>
                  <button className="px-3 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition-colors">
                    Reschedule
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 hover:border-sky-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-purple-100 text-purple-700">CS302</span>
                    <h4 className="font-semibold text-slate-900">Operating Systems (Lab Session)</h4>
                  </div>
                  <p className="text-xs text-slate-500">
                    02:00 PM - 04:00 PM • Room: <span className="font-medium text-slate-700">Lab-A</span> • Batch: <span className="font-medium text-slate-700">CSE-2026-SecA</span>
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors">
                    <CheckSquare className="w-4 h-4" />
                    <span>Take Attendance</span>
                  </button>
                  <button className="px-3 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition-colors">
                    Reschedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Soft Constraints Portal Card */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-2.5 mb-4">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-800">My Soft Constraints</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Submit your preferred lecture hours, non-teaching research blocks, and daily lecture hour caps. The generator engine optimizes against these preferences.
            </p>
            <div className="space-y-2 mb-5">
              <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="font-semibold text-slate-700">Max Daily Limit:</span> 4 Hours/Day
              </div>
              <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="font-semibold text-slate-700">Preferred Hours:</span> Morning (09:00 - 13:00)
              </div>
              <div className="text-xs bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-800 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Unavailable: Wednesday 02:00 PM - 05:00 PM (Research)</span>
              </div>
            </div>
            <button className="w-full py-2 px-3 text-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition-colors">
              Edit Scheduling Constraints
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
