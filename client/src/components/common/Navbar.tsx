import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Calendar, CheckSquare, Shield, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="bg-purple-100 text-purple-700 font-semibold text-xs px-2.5 py-0.5 rounded-full border border-purple-200">Admin</span>;
      case 'PROFESSOR':
        return <span className="bg-blue-100 text-blue-700 font-semibold text-xs px-2.5 py-0.5 rounded-full border border-blue-200">Faculty</span>;
      case 'STUDENT':
        return <span className="bg-emerald-100 text-emerald-700 font-semibold text-xs px-2.5 py-0.5 rounded-full border border-emerald-200">Student</span>;
      default:
        return null;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-sky-600 text-white p-2 rounded-lg shadow-sm">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-none">Smart Academic Manager</h1>
            <p className="text-xs text-slate-500 mt-0.5">Scheduler & Attendance Records</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-right">
              <div>
                <p className="text-sm font-medium text-slate-800 leading-tight">
                  {user.firstName} {user.lastName}
                </p>
                <div className="mt-0.5 flex justify-end">{getRoleBadge(user.role)}</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-sm">
                <UserIcon className="w-4 h-4" />
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <button
              onClick={logout}
              title="Logout"
              className="flex items-center space-x-1.5 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
