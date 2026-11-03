import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, ApiError } from '../utils/response';
import { Notification } from '../models/Notification';

/**
 * GET /api/v1/notifications?cursor=&unread=
 * Returns notifications for the authenticated user, cursor-paginated.
 */
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { cursor, unread, limit } = req.query;
  const pageSize = Math.min(Math.max(parseInt(String(limit || '20'), 10) || 20, 1), 50);

  const query: Record<string, unknown> = {
    recipientId: userId,
  };

  if (unread === 'true') {
    query.readAt = null;
  }

  if (cursor && typeof cursor === 'string' && Types.ObjectId.isValid(cursor)) {
    query._id = { $lt: new Types.ObjectId(cursor) };
  }

  const notifications = await Notification.find(query)
    .sort({ _id: -1 })
    .limit(pageSize + 1);

  const hasMore = notifications.length > pageSize;
  const items = hasMore ? notifications.slice(0, pageSize) : notifications;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]._id.toString() : null;

  sendSuccess(
    res,
    {
      items,
      hasMore,
      nextCursor,
    },
    'Notifications fetched successfully'
  );
});

/**
 * GET /api/v1/notifications/unread-count
 * Returns total number of unread notifications for the authenticated user.
 */
export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const count = await Notification.countDocuments({
    recipientId: userId,
    readAt: null,
  });

  sendSuccess(res, { count }, 'Unread count fetched');
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Marks a specific notification as read.
 */
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;

  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid notification ID');
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: new Types.ObjectId(id), recipientId: userId },
    { readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(404, 'Notification not found or access denied');
  }

  sendSuccess(res, notification, 'Notification marked as read');
});

/**
 * POST /api/v1/notifications/read-all
 * Marks all notifications for the authenticated user as read.
 */
export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const now = new Date();
  const result = await Notification.updateMany(
    { recipientId: userId, readAt: null },
    { readAt: now }
  );

  sendSuccess(
    res,
    { modifiedCount: result.modifiedCount },
    'All notifications marked as read'
  );
});
