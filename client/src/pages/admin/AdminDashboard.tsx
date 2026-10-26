import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Users, Building, BookOpen, Play, CheckSquare } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-purple-800 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-md mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold">Welcome back, {user?.firstName}!</h2>
        <p className="text-purple-200 mt-2 text-sm max-w-2xl">
          Institutional Control Center. Generate collision-free academic timetables, edit them with interactive drag-and-drop, and monitor campus-wide attendance records.
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Active Faculty</p>
            <p className="text-xl font-bold text-slate-800">12 Professors</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Classrooms & Labs</p>
            <p className="text-xl font-bold text-slate-800">8 Rooms Available</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Courses</p>
            <p className="text-xl font-bold text-slate-800">14 Registered</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Current Term</p>
            <p className="text-xl font-bold text-slate-800">2026-2027 Sem 3</p>
          </div>
        </div>
      </div>

      {/* Primary Action Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Module 1: Schedule Generator & Editor */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 bg-sky-100 text-sky-700 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Module 1: Schedule Generator & Editor</h3>
              <p className="text-xs text-slate-500">Constraint-satisfaction solver & drag-and-drop editor</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-5">
            Run the heuristic algorithm to compute collision-free timetables respecting room capacities, teacher unavailability, and soft preferences. Fine-tune manually via drag-and-drop.
          </p>
          <div className="flex space-x-3">
            <button className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
              <Play className="w-4 h-4" />
              <span>Generate Timetable</span>
            </button>
            <button className="flex items-center space-x-2 border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <span>Open Visual Editor</span>
            </button>
          </div>
        </div>

        {/* Module 2: Attendance Records Keeper */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Module 2: Attendance Records Keeper</h3>
              <p className="text-xs text-slate-500">Live roster sessions, defaulter reports & audit trail</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-5">
            Monitor real-time class attendance logs mapped directly to scheduled slots. Track students falling below the 80% and 70% threshold zones across all batches.
          </p>
          <div className="flex space-x-3">
            <button className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
              <span>View Defaulter Reports</span>
            </button>
            <button className="flex items-center space-x-2 border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <span>Manage Student Rosters</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
