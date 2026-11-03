import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Filter,
  Calendar,
  AlertTriangle,
  GraduationCap,
  Clock,
  Info,
} from 'lucide-react';
import { notificationsApi } from '../../api/notification';
import { NotificationItem, NotificationType } from '../../types/notification';
import { Button } from '../../components/ui/Button';

export const NotificationsPage: React.FC = () => {
  const [filterUnread, setFilterUnread] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications', 'page', { unread: filterUnread }],
    queryFn: () => notificationsApi.getNotifications({ unread: filterUnread ? true : undefined, limit: 50 }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const rawItems = data?.items || [];
  const filteredItems = rawItems.filter((item) => {
    if (typeFilter === 'ALL') return true;
    if (typeFilter === 'SCHEDULE') {
      return [
        'TIMETABLE_PUBLISHED',
        'CLASS_CANCELLED',
        'CLASS_RESCHEDULED',
        'CLASS_RESTORED',
      ].includes(item.type);
    }
    if (typeFilter === 'EXAMS') {
      return [
        'MINOR_SCHEDULED',
        'MINOR_CHANGED',
        'MINOR_CANCELLED',
        'MINOR_REMINDER',
      ].includes(item.type);
    }
    if (typeFilter === 'ATTENDANCE') {
      return ['ATTENDANCE_MISSED', 'ATTENDANCE_LOW'].includes(item.type);
    }
    return item.type === typeFilter;
  });

  const unreadCount = rawItems.filter((i) => !i.readAt).length;

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'TIMETABLE_PUBLISHED':
      case 'CLASS_RESCHEDULED':
      case 'CLASS_RESTORED':
        return <Calendar className="w-4 h-4 text-sky-600" />;
      case 'CLASS_CANCELLED':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'MINOR_SCHEDULED':
      case 'MINOR_CHANGED':
      case 'MINOR_CANCELLED':
      case 'MINOR_REMINDER':
        return <GraduationCap className="w-4 h-4 text-indigo-600" />;
      case 'ATTENDANCE_MISSED':
      case 'ATTENDANCE_LOW':
        return <Clock className="w-4 h-4 text-rose-600" />;
      default:
        return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Bell className="w-7 h-7 text-sky-600" />
            <span>Notifications</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Stay updated with timetable changes, schedule updates, and minor exam notifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5"
            >
              <CheckCheck className="w-4 h-4 text-slate-600" />
              <span>Mark all as read</span>
            </Button>
          )}
          <Button variant="ghost" onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Category:
          </span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'SCHEDULE', label: 'Schedule & Timetable' },
            { id: 'EXAMS', label: 'Minor Exams' },
            { id: 'ATTENDANCE', label: 'Attendance' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setTypeFilter(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                typeFilter === cat.id
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
            <input
              type="checkbox"
              checked={filterUnread}
              onChange={(e) => setFilterUnread(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
            />
            <span>Unread only</span>
          </label>
        </div>
      </div>

      {/* Notifications List */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mx-auto" />
            <p className="text-sm text-slate-400 mt-3">Loading notifications...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Bell className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
            <p className="mt-3 text-slate-600 font-medium">No notifications found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {filterUnread
                ? 'You have caught up with all your notifications!'
                : 'Any updates regarding your classes and schedule will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item: NotificationItem) => {
              const isUnread = !item.readAt;
              return (
                <div
                  key={item._id}
                  className={`p-5 transition hover:bg-slate-50 flex items-start gap-4 ${
                    isUnread ? 'bg-sky-50/30' : ''
                  }`}
                >
                  <div className="p-2.5 rounded-xl bg-slate-100 flex-shrink-0 mt-0.5">
                    {getTypeIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm ${
                          isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
                        }`}
                      >
                        {item.title}
                      </h3>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
                      )}
                    </div>

                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.body}</p>

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-400">
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                      {item.link && (
                        <Link
                          to={item.link}
                          onClick={() => {
                            if (isUnread) markReadMutation.mutate(item._id);
                          }}
                          className="inline-flex items-center gap-1 font-medium text-sky-600 hover:text-sky-800"
                        >
                          <span>Go to schedule</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => markReadMutation.mutate(item._id)}
                      title="Mark as read"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
