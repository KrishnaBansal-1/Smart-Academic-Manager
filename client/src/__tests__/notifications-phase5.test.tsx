import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { NotificationsPage } from '../pages/shared/Notifications';
import { notificationsApi } from '../api/notification';
import { NotificationItem } from '../types/notification';

vi.mock('../api/notification', () => ({
  notificationsApi: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', firstName: 'John', lastName: 'Doe', role: 'STUDENT' },
    token: 'fake-token',
    isAuthenticated: true,
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Phase 5 Client: Notifications Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('NotificationBell', () => {
    it('displays unread badge count when unreadCount > 0', async () => {
      vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(4);
      vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: null,
      });

      render(<NotificationBell />, { wrapper: createWrapper() });

      const badge = await screen.findByTestId('unread-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('4');
    });

    it('opens dropdown and displays latest notifications when clicked', async () => {
      vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(1);
      vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
        items: [
          {
            _id: 'n1',
            recipientId: 'u1',
            type: 'TIMETABLE_PUBLISHED',
            title: 'Timetable Published',
            body: 'Your timetable has been released',
            link: '/student/timetable',
            readAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        hasMore: false,
        nextCursor: null,
      });

      render(<NotificationBell />, { wrapper: createWrapper() });

      const bellBtn = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(bellBtn);

      const dropdown = await screen.findByTestId('notification-dropdown');
      expect(dropdown).toBeInTheDocument();
      expect(await screen.findByText('Timetable Published')).toBeInTheDocument();
      expect(screen.getByText('Your timetable has been released')).toBeInTheDocument();
    });
  });

  describe('NotificationsPage', () => {
    it('renders notification items and allows marking as read', async () => {
      const mockItems: NotificationItem[] = [
        {
          _id: 'n1',
          recipientId: 'u1',
          type: 'TIMETABLE_PUBLISHED',
          title: 'Timetable Published',
          body: 'Your timetable has been released',
          link: '/student/timetable',
          readAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
        items: mockItems,
        hasMore: false,
        nextCursor: null,
      });
      vi.mocked(notificationsApi.markAsRead).mockResolvedValue({
        ...mockItems[0],
        readAt: new Date().toISOString(),
      });

      render(<NotificationsPage />, { wrapper: createWrapper() });

      expect(await screen.findByText('Timetable Published')).toBeInTheDocument();
      expect(screen.getByText('Your timetable has been released')).toBeInTheDocument();

      const markBtn = screen.getByTitle('Mark as read');
      fireEvent.click(markBtn);

      await waitFor(() => {
        expect(notificationsApi.markAsRead).toHaveBeenCalledWith('n1');
      });
    });

    it('allows marking all notifications as read', async () => {
      vi.mocked(notificationsApi.getNotifications).mockResolvedValue({
        items: [
          {
            _id: 'n1',
            recipientId: 'u1',
            type: 'CLASS_CANCELLED',
            title: 'Class Cancelled',
            body: 'Physics class is cancelled',
            readAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        hasMore: false,
        nextCursor: null,
      });
      vi.mocked(notificationsApi.markAllAsRead).mockResolvedValue(1);

      render(<NotificationsPage />, { wrapper: createWrapper() });

      const markAllBtn = await screen.findByRole('button', { name: /mark all as read/i });
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(notificationsApi.markAllAsRead).toHaveBeenCalled();
      });
    });
  });
});
