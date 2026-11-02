import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Calendar, Loader2 } from 'lucide-react';
import { apiClient } from '../../api/client';

type AssignedCourse = { _id: string; code: string; title: string; credits: number; weeklyTheoryHours: number; weeklyLabHours: number };

export const ProfessorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<AssignedCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;
    apiClient.get<{ data: { items: AssignedCourse[] } }>('/professor/courses')
      .then(({ data }) => { if (isMounted) setCourses(data.data.items); })
      .catch(() => { if (isMounted) setLoadError('Course assignments could not be loaded. Please refresh and try again.'); })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-700 to-sky-800 p-6 text-white shadow-md sm:p-8">
        <h2 className="text-2xl font-bold sm:text-3xl">Welcome, {user?.firstName} {user?.lastName}!</h2>
        <p className="mt-2 max-w-2xl text-sm text-blue-100">Your assigned courses are listed below. Published teaching schedules and attendance tools will appear when those modules are configured.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2.5"><BookOpen className="h-5 w-5 text-sky-600" /><h3 className="text-lg font-bold text-slate-800">Assigned courses</h3></div>
            <p className="mt-1 text-sm text-slate-500">Courses assigned to your faculty account.</p>
          </div>
          {isLoading ? <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading courses...</div> : loadError ? <div role="alert" className="px-6 py-12 text-center text-sm text-red-700">{loadError}</div> : courses.length ? <div className="divide-y divide-slate-100">{courses.map((course) => <div key={course._id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"><div className="min-w-0"><span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{course.code}</span><h4 className="mt-1 font-semibold text-slate-900">{course.title}</h4><p className="mt-1 text-xs text-slate-500">{course.weeklyTheoryHours} theory · {course.weeklyLabHours} lab hours weekly</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{course.credits} credits</span></div>)}</div> : <div className="px-6 py-14 text-center"><p className="font-semibold text-slate-800">No courses assigned yet</p><p className="mt-1 text-sm text-slate-500">Ask an administrator to add your course assignments.</p></div>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5"><Calendar className="h-5 w-5 text-indigo-600" /><h3 className="text-lg font-bold text-slate-800">Teaching schedule</h3></div>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
            <Calendar className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 font-semibold text-slate-800">No published schedule yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Your class schedule and attendance actions will appear after a timetable is published.</p>
          </div>
        </section>
      </div>
    </div>
  );
};
