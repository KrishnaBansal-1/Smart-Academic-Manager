export type NotificationType =
  | 'TIMETABLE_PUBLISHED'
  | 'CLASS_CANCELLED'
  | 'CLASS_RESCHEDULED'
  | 'CLASS_RESTORED'
  | 'MINOR_SCHEDULED'
  | 'MINOR_CHANGED'
  | 'MINOR_CANCELLED'
  | 'MINOR_REMINDER'
  | 'ATTENDANCE_MISSED'
  | 'ATTENDANCE_LOW';

export interface NotificationItem {
  _id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  payload?: Record<string, unknown>;
  readAt?: string | null;
  dedupeKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  hasMore: boolean;
  nextCursor: string | null;
}
