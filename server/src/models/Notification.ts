import { Schema, model, Document, Types } from 'mongoose';

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

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  payload?: Record<string, unknown>;
  readAt?: Date | null;
  dedupeKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        'TIMETABLE_PUBLISHED',
        'CLASS_CANCELLED',
        'CLASS_RESCHEDULED',
        'CLASS_RESTORED',
        'MINOR_SCHEDULED',
        'MINOR_CHANGED',
        'MINOR_CANCELLED',
        'MINOR_REMINDER',
        'ATTENDANCE_MISSED',
        'ATTENDANCE_LOW',
      ],
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    link: { type: String, trim: true },
    payload: { type: Schema.Types.Mixed },
    readAt: { type: Date, default: null },
    dedupeKey: { type: String, trim: true },
  },
  { timestamps: true }
);

NotificationSchema.index(
  { recipientId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }
);
NotificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', NotificationSchema);
