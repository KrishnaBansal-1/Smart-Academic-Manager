import { apiClient } from './client';
import { NotificationItem, NotificationsResponse } from '../types/notification';

export interface GetNotificationsParams {
  cursor?: string | null;
  unread?: boolean;
  limit?: number;
}

export const notificationsApi = {
  getNotifications: async (params?: GetNotificationsParams): Promise<NotificationsResponse> => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.unread !== undefined) query.set('unread', String(params.unread));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const url = `/notifications${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<{ success: boolean; data: NotificationsResponse }>(url);
    return res.data.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const res = await apiClient.get<{ success: boolean; data: { count: number } }>(
      '/notifications/unread-count'
    );
    return res.data.data.count;
  },

  markAsRead: async (id: string): Promise<NotificationItem> => {
    const res = await apiClient.patch<{ success: boolean; data: NotificationItem }>(
      `/notifications/${id}/read`
    );
    return res.data.data;
  },

  markAllAsRead: async (): Promise<number> => {
    const res = await apiClient.post<{ success: boolean; data: { modifiedCount: number } }>(
      '/notifications/read-all'
    );
    return res.data.data.modifiedCount;
  },
};
