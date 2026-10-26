import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/common/Navbar';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { Login } from './pages/auth/Login';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ProfessorDashboard } from './pages/professor/ProfessorDashboard';
import { StudentDashboard } from './pages/student/StudentDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RootRedirect: React.FC = () => {
  const { isAuthenticated, user, getDashboardRoute } = useAuth();
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={getDashboardRoute(user.role)} replace />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
            <Navbar />
            <main className="flex-1">
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<RootRedirect />} />

                {/* Role Protected: ADMIN */}
                <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                </Route>

                {/* Role Protected: PROFESSOR */}
                <Route element={<ProtectedRoute allowedRoles={['PROFESSOR']} />}>
                  <Route path="/professor" element={<ProfessorDashboard />} />
                </Route>

                {/* Role Protected: STUDENT */}
                <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
                  <Route path="/student" element={<StudentDashboard />} />
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
