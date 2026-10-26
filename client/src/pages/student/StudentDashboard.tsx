import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Calendar, CheckCircle2, AlertTriangle, XCircle, BookOpen, Clock } from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();

  // Mock Student Subject Attendance with updated thresholds (>=80% Good, 70-79.99% Warning, <70% Critical)
  const attendanceData = [
    { code: 'CS301', title: 'Data Structures & Algorithms', conducted: 24, attended: 22, percentage: 91.6 },
    { code: 'CS302', title: 'Operating Systems', conducted: 22, attended: 18, percentage: 81.8 },
    { code: 'CS303', title: 'Database Management Systems', conducted: 20, attended: 15, percentage: 75.0 },
    { code: 'CS304', title: 'Computer Networks', conducted: 18, attended: 12, percentage: 66.7 },
  ];

  const getStatusBadge = (percentage: number) => {
    if (percentage >= 80.0) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Good Standing (≥80%)</span>
        </span>
      );
    } else if (percentage >= 70.0) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Warning Zone (70-79.99%)</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 animate-pulse">
          <XCircle className="w-3.5 h-3.5" />
          <span>Critical Defaulter (&lt;70%)</span>
        </span>
      );
    }
  };

  const overallAttended = attendanceData.reduce((acc, curr) => acc + curr.attended, 0);
  const overallConducted = attendanceData.reduce((acc, curr) => acc + curr.conducted, 0);
  const overallPercentage = ((overallAttended / overallConducted) * 100).toFixed(1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-700 to-emerald-800 rounded-2xl p-6 sm:p-8 text-white shadow-md mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">Welcome, {user?.firstName}!</h2>
          <p className="text-teal-100 mt-1 text-sm">
            Roll No: <span className="font-semibold text-white">{user?.rollNumber || 'CSE26001'}</span> • Batch: <span className="font-semibold text-white">CSE-2026-SecA</span>
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/20 text-right">
          <p className="text-xs text-teal-100 font-medium">Overall Attendance</p>
          <p className="text-2xl font-extrabold text-white">{overallPercentage}%</p>
        </div>
      </div>

      {/* Attendance Overview Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Module 2: My Attendance Status</h3>
            <p className="text-xs text-slate-500">
              Institutional threshold: 80% minimum recommended attendance. Warning below 80%, defaulter below 70%.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-600">≥80% Good</span>
            <span className="inline-block w-3 h-3 rounded-full bg-amber-500 ml-2" />
            <span className="text-slate-600">70-79.9% Warning</span>
            <span className="inline-block w-3 h-3 rounded-full bg-red-500 ml-2" />
            <span className="text-slate-600">&lt;70% Defaulter</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {attendanceData.map((item) => (
            <div key={item.code} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">{item.code}</span>
                  <h4 className="font-semibold text-sm text-slate-900 mt-1">{item.title}</h4>
                </div>
                {getStatusBadge(item.percentage)}
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Conducted: {item.attended} / {item.conducted} classes</span>
                  <span className="font-bold text-slate-900">{item.percentage}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${
                      item.percentage >= 80 ? 'bg-emerald-500' : item.percentage >= 70 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timetable View Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-sky-600" />
            <h3 className="text-lg font-bold text-slate-800">Module 1: Batch Timetable View</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">Read-Only View</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Displays published schedule for your assigned section. Any cancelled or rescheduled classes by faculty reflect here in real-time.
        </p>

        {/* Weekly matrix preview */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <th className="p-3 border-r">Time Slot</th>
                <th className="p-3 border-r">Monday</th>
                <th className="p-3 border-r">Tuesday</th>
                <th className="p-3 border-r">Wednesday</th>
                <th className="p-3 border-r">Thursday</th>
                <th className="p-3">Friday</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-3 font-medium text-slate-500 bg-slate-50 border-r">09:00 - 10:00</td>
                <td className="p-2 border-r bg-blue-50/50">
                  <span className="font-bold text-blue-700 block">CS301 Theory</span>
                  <span className="text-[11px] text-slate-500">LH-101 • Prof. Sharma</span>
                </td>
                <td className="p-2 border-r bg-purple-50/50">
                  <span className="font-bold text-purple-700 block">CS302 Theory</span>
                  <span className="text-[11px] text-slate-500">LH-102 • Prof. Patel</span>
                </td>
                <td className="p-2 border-r bg-emerald-50/50">
                  <span className="font-bold text-emerald-700 block">CS303 Theory</span>
                  <span className="text-[11px] text-slate-500">LH-101 • Prof. Rao</span>
                </td>
                <td className="p-2 border-r bg-blue-50/50">
                  <span className="font-bold text-blue-700 block">CS301 Theory</span>
                  <span className="text-[11px] text-slate-500">LH-101 • Prof. Sharma</span>
                </td>
                <td className="p-2 bg-indigo-50/50">
                  <span className="font-bold text-indigo-700 block">CS304 Theory</span>
                  <span className="text-[11px] text-slate-500">LH-102 • Prof. Mehta</span>
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-slate-500 bg-slate-50 border-r">10:00 - 11:00</td>
                <td className="p-2 border-r bg-purple-50/50">
                  <span className="font-bold text-purple-700 block">CS302 Theory</span>
                  <span className="text-[11px] text-slate-500">LH-102 • Prof. Patel</span>
                </td>
                <td className="p-2 border-r bg-blue-50/50">
                  <span className="font-bold text-blue-700 block">CS301 Theory</span>
                  <span className="text-[11px] text-slate-500">LH-101 • Prof. Sharma</span>
                </td>
                <td className="p-2 border-r bg-indigo-50/50">
                  <span className="font-bold text-indigo-700 block">CS304 Theory</span>
                  <span className="text-[11px] text-slate-500">LH-102 • Prof. Mehta</span>
                </td>
                <td className="p-2 border-r bg-emerald-50/50">
                  <span className="font-bold text-emerald-700 block">CS303 Theory</span>
                  <span className="text-[11px] text-slate-500">LH-101 • Prof. Rao</span>
                </td>
                <td className="p-2 bg-slate-50 text-slate-400 italic">Free Slot</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
