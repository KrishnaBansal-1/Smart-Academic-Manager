import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { notificationsApi } from '../../api/notification';
import { NotificationItem } from '../../types/notification';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Query unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 30000,
  });

  // Query latest 5 items for the dropdown
  const { data: latestData } = useQuery({
    queryKey: ['notifications', 'latest'],
    queryFn: () => notificationsApi.getNotifications({ limit: 5 }),
    enabled: isOpen,
  });

  // Mark single notification as read mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const items = latestData?.items || [];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            data-testid="unread-badge"
            className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-bold text-white bg-rose-500 rounded-full leading-none"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          data-testid="notification-dropdown"
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-1"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-sky-100 text-sky-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs text-sky-600 hover:text-sky-800 font-medium disabled:opacity-50 flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {items.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No notifications right now
              </div>
            ) : (
              items.map((item: NotificationItem) => {
                const isUnread = !item.readAt;
                return (
                  <div
                    key={item._id}
                    className={`px-4 py-3 hover:bg-slate-50 transition-colors ${
                      isUnread ? 'bg-sky-50/40' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm ${isUnread ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                            {item.title}
                          </p>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.body}</p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                          {item.link && (
                            <Link
                              to={item.link}
                              onClick={() => {
                                if (isUnread) markReadMutation.mutate(item._id);
                                setIsOpen(false);
                              }}
                              className="text-sky-600 hover:text-sky-800 inline-flex items-center gap-0.5"
                            >
                              <span>View</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>

                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => markReadMutation.mutate(item._id)}
                          title="Mark as read"
                          className="p-1 text-slate-400 hover:text-sky-600 rounded"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-100 px-4 py-2 text-center bg-slate-50/50">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-sky-600 hover:text-sky-800"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
