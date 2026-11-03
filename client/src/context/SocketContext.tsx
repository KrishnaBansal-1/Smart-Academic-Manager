import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { NotificationItem } from '../types/notification';
import { showToast } from '../store/toastStore';

interface GenerationUpdatePayload {
  jobId: string;
  status: 'RUNNING' | 'DONE' | 'FAILED';
  progress: number;
  message?: string;
  timetableId?: string;
  error?: string;
  metrics?: Record<string, unknown>;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

    const newSocket = io(socketUrl, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', () => {
      // Re-read token if refreshed
      const currentToken = localStorage.getItem('sam_access_token');
      if (currentToken && newSocket.auth) {
        newSocket.auth = { token: currentToken };
      }
    });

    // Listen to notification:new
    newSocket.on('notification:new', (notification: NotificationItem) => {
      // Invalidate notifications queries
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });

      // Invalidate domain caches according to implementation-plan.md:
      // "A new notification invalidates React Query keys by type (schedule, exams, attendance) and shows a toast."
      if (
        notification.type === 'TIMETABLE_PUBLISHED' ||
        notification.type === 'CLASS_CANCELLED' ||
        notification.type === 'CLASS_RESCHEDULED' ||
        notification.type === 'CLASS_RESTORED'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['schedule'] });
        void queryClient.invalidateQueries({ queryKey: ['timetable'] });
      } else if (
        notification.type === 'MINOR_SCHEDULED' ||
        notification.type === 'MINOR_CHANGED' ||
        notification.type === 'MINOR_CANCELLED' ||
        notification.type === 'MINOR_REMINDER'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['exams'] });
        void queryClient.invalidateQueries({ queryKey: ['schedule'] });
      } else if (
        notification.type === 'ATTENDANCE_MISSED' ||
        notification.type === 'ATTENDANCE_LOW'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      }

      // Show toast
      showToast(`${notification.title}: ${notification.body}`, 'info');
    });

    // Listen to generation:update
    newSocket.on('generation:update', (data: GenerationUpdatePayload) => {
      void queryClient.invalidateQueries({ queryKey: ['generation-job', data.jobId] });
      void queryClient.invalidateQueries({ queryKey: ['generation-jobs'] });
      if (data.status === 'DONE') {
        void queryClient.invalidateQueries({ queryKey: ['timetables'] });
        showToast('Timetable generation complete!', 'success');
      } else if (data.status === 'FAILED') {
        showToast(`Timetable generation failed: ${data.error || 'Unknown error'}`, 'error');
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.removeAllListeners();
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, token, user?.id, queryClient]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = (): SocketContextType => {
  return useContext(SocketContext);
};
