import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { User, UserRole, AuthResponse } from '../types/auth';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  getDashboardRoute: (role?: UserRole) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeUser = (user: User | (Record<string, unknown> & { id?: string; _id?: string })): User => {
  const id = String(user.id || user._id);
  return {
    ...(user as User),
    id,
    _id: id,
  };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate session with /auth/me at boot
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      const storedToken = localStorage.getItem('sam_access_token');

      if (!storedToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const response = await apiClient.get<{ success: boolean; data: { user: User } }>('/auth/me');
        if (isMounted && response.data?.data?.user) {
          const verifiedUser = normalizeUser(response.data.data.user);
          setUser(verifiedUser);
          setToken(storedToken);
          localStorage.setItem('sam_user', JSON.stringify(verifiedUser));
        }
      } catch {
        if (isMounted) {
          localStorage.removeItem('sam_access_token');
          localStorage.removeItem('sam_user');
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const getDashboardRoute = useCallback((role?: UserRole): string => {
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
  }, [user?.role]);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const response = await apiClient.post<{ success: boolean; data: AuthResponse }>(
      '/auth/login',
      { email, password }
    );

    const { user: rawUser, accessToken } = response.data.data;
    const normalized = normalizeUser(rawUser);

    setUser(normalized);
    setToken(accessToken);
    localStorage.setItem('sam_access_token', accessToken);
    localStorage.setItem('sam_user', JSON.stringify(normalized));

    return normalized;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('sam_access_token');
      localStorage.removeItem('sam_user');
      window.location.href = '/login';
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!user && !!token,
      isLoading,
      login,
      logout,
      getDashboardRoute,
    }),
    [user, token, isLoading, login, logout, getDashboardRoute]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
