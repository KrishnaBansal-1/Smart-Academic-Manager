import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach JWT Bearer token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('sam_access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Single-flight refresh token handler
let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  try {
    const response = await axios.post<{
      success: boolean;
      data: { accessToken: string };
    }>(
      `${API_BASE_URL}/auth/refresh`,
      {},
      { withCredentials: true }
    );

    const newAccessToken = response.data.data.accessToken;
    localStorage.setItem('sam_access_token', newAccessToken);
    return newAccessToken;
  } catch (error) {
    localStorage.removeItem('sam_access_token');
    localStorage.removeItem('sam_user');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw error;
  } finally {
    refreshPromise = null;
  }
};

// Response interceptor: Handle 401 unauthenticated with single-flight refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (!originalRequest || !error.response) {
      return Promise.reject(error);
    }

    const isAuthRoute =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/logout');

    if (error.response.status === 401 && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken();
        }
        const newToken = await refreshPromise;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);
