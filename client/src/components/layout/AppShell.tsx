import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { ToastContainer } from '../ui/Toast';
import {
  Calendar,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  LayoutDashboard,
  Database,
  GraduationCap,
  Sliders,
  TableProperties,
} from 'lucide-react';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <main>{children}</main>
        <ToastContainer />
      </div>
    );
  }

  const roleBadge = () => {
    switch (user?.role) {
      case 'ADMIN':
        return <Badge variant="purple">Admin</Badge>;
      case 'PROFESSOR':
        return <Badge variant="info">Faculty</Badge>;
      case 'STUDENT':
        return <Badge variant="success">Student</Badge>;
      default:
        return null;
    }
  };

  const navLinks = () => {
    switch (user?.role) {
      case 'ADMIN':
        return [
          { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/admin/timetable', label: 'Timetable Editor', icon: TableProperties },
          { to: '/admin/manage', label: 'Academic Records', icon: Database },
          { to: '/admin/academics', label: 'Academic Setup', icon: Calendar },
        ];
      case 'PROFESSOR':
        return [
          { to: '/professor', label: 'Faculty Portal', icon: LayoutDashboard },
          { to: '/professor/schedule', label: 'My Schedule', icon: Calendar },
          { to: '/professor/preferences', label: 'Teaching Preferences', icon: Sliders },
        ];
      case 'STUDENT':
        return [
          { to: '/student', label: 'Student Portal', icon: GraduationCap },
          { to: '/student/timetable', label: 'My Timetable', icon: Calendar },
        ];
      default:
        return [];
    }
  };

  const links = navLinks();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="bg-sky-600 text-white p-2 rounded-lg shadow-sm group-hover:bg-sky-700 transition">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 leading-none">Smart Academic Manager</h1>
                <p className="text-xs text-slate-500 mt-0.5">Scheduler & Attendance Records</p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            {user && (
              <nav className="hidden md:flex items-center space-x-1">
                {links.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? 'bg-sky-50 text-sky-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          {/* User profile & actions */}
          {user && (
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center space-x-3 text-right">
                <div>
                  <p className="text-sm font-semibold text-slate-800 leading-tight">
                    {user.firstName} {user.lastName}
                  </p>
                  <div className="mt-0.5 flex justify-end">{roleBadge()}</div>
                </div>
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-sm border border-slate-200">
                  <UserIcon className="w-4 h-4" />
                </div>
              </div>

              <div className="hidden sm:block h-6 w-px bg-slate-200" />

              <button
                onClick={() => void logout()}
                title="Logout"
                className="hidden sm:inline-flex items-center space-x-1.5 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>

              {/* Mobile Drawer Toggle */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && user && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-sm">
                <UserIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">
                  {user.firstName} {user.lastName}
                </p>
                <div className="mt-0.5">{roleBadge()}</div>
              </div>
            </div>

            <nav className="space-y-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-sky-50 text-sky-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  void logout();
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>
      <ToastContainer />
    </div>
  );
};
