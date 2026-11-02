import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })));
const AdminDashboard = lazy(() =>
  import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const AdminManagement = lazy(() =>
  import('./pages/admin/AdminManagement').then((m) => ({ default: m.AdminManagement }))
);
const AcademicSetup = lazy(() =>
  import('./pages/admin/AcademicSetup').then((m) => ({ default: m.AcademicSetup }))
);
const TimetableManager = lazy(() =>
  import('./pages/admin/TimetableManager').then((m) => ({ default: m.TimetableManager }))
);
const ProfessorDashboard = lazy(() =>
  import('./pages/professor/ProfessorDashboard').then((m) => ({ default: m.ProfessorDashboard }))
);
const ProfessorPreferences = lazy(() =>
  import('./pages/professor/ProfessorPreferences').then((m) => ({ default: m.ProfessorPreferences }))
);
const StudentDashboard = lazy(() =>
  import('./pages/student/StudentDashboard').then((m) => ({ default: m.StudentDashboard }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RootRedirect: React.FC = () => {
  const { isAuthenticated, user, isLoading, getDashboardRoute } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDashboardRoute(user.role)} replace />;
};

const PageLoader: React.FC = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
  </div>
);

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AppShell>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<RootRedirect />} />

                  {/* Role Protected: ADMIN */}
                  <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/manage" element={<AdminManagement />} />
                    <Route path="/admin/academics" element={<AcademicSetup />} />
                    <Route path="/admin/timetable" element={<TimetableManager />} />
                  </Route>

                  {/* Role Protected: PROFESSOR */}
                  <Route element={<ProtectedRoute allowedRoles={['PROFESSOR']} />}>
                    <Route path="/professor" element={<ProfessorDashboard />} />
                    <Route path="/professor/preferences" element={<ProfessorPreferences />} />
                  </Route>

                  {/* Role Protected: STUDENT */}
                  <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
                    <Route path="/student" element={<StudentDashboard />} />
                  </Route>

                  {/* Catch-all */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </AppShell>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
