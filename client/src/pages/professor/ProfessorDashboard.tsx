import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Calendar, Loader2, Sliders, Users } from 'lucide-react';
import { apiClient } from '../../api/client';
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
          <Link
            to="/professor/preferences"
            className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition"
          >
            <Sliders className="h-4 w-4" />
            Set Preferences
          </Link>
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-800">Teaching Schedule</h3>
            </div>
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
              <Calendar className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 font-semibold text-slate-800">No published schedule yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                Your weekly calendar and attendance tools will appear once the timetable for this term
                is published.
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
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
