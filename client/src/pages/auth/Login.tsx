import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../lib/errors';
import { Calendar, Lock, Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { login, isAuthenticated, user, getDashboardRoute } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If already logged in, redirect to destination or dashboard
  if (isAuthenticated && user) {
    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
    return <Navigate to={from || getDashboardRoute(user.role)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const loggedInUser = await login(email, password);
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      navigate(from || getDashboardRoute(loggedInUser.role), { replace: true });
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err, 'Failed to login. Please check your credentials.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-sky-600 text-white p-3 rounded-2xl shadow-lg flex items-center justify-center">
            <Calendar className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Smart Academic Manager
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Sign in to access your timetable and attendance portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {errorMessage && (
            <div
              role="alert"
              className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start space-x-2"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email Address
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                  placeholder="name@nitw.ac.in"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials Quick Picker (only in DEV mode) */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5 text-center">
                Quick Fill Demo Accounts (Dev Only)
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoFill('admin@sam.edu', 'Admin@123')}
                  className="py-1.5 px-2 text-xs font-medium rounded border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoFill('prof.rimjhim@sam.edu', 'Password@123')}
                  className="py-1.5 px-2 text-xs font-medium rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  Professor
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoFill('student.csea01@sam.edu', 'Password@123')}
                  className="py-1.5 px-2 text-xs font-medium rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  Student
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
