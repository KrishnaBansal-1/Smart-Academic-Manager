import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, AuthResponse } from '../types';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  getDashboardRoute: (role?: UserRole) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('sam_access_token');
    const storedUser = localStorage.getItem('sam_user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('sam_access_token');
        localStorage.removeItem('sam_user');
      }
    }
    setIsLoading(false);
  }, []);

  const getDashboardRoute = (role?: UserRole): string => {
    const targetRole = role || user?.role;
    switch (targetRole) {
      case 'ADMIN':
        return '/admin';
      case 'PROFESSOR':
        return '/professor';
      case 'STUDENT':
        return '/student';
      default:
        return '/login';
    }
  };

  const login = async (email: string, password: string): Promise<User> => {
    const response = await apiClient.post<{ success: boolean; data: AuthResponse }>(
      '/auth/login',
      { email, password }
    );

    const { user: loggedInUser, accessToken } = response.data.data;

    setUser(loggedInUser);
    setToken(accessToken);
    localStorage.setItem('sam_access_token', accessToken);
    localStorage.setItem('sam_user', JSON.stringify(loggedInUser));

    return loggedInUser;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('sam_access_token');
    localStorage.removeItem('sam_user');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        getDashboardRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
