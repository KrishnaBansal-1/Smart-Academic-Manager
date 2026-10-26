import { Schema, model, Document, Types } from 'mongoose';

export type SessionStatus = 'SCHEDULED' | 'SUBMITTED' | 'LOCKED';

export interface IAttendanceSession extends Document {
  _id: Types.ObjectId;
  scheduleSlotId: Types.ObjectId;
  overrideId?: Types.ObjectId;
  courseId: Types.ObjectId;
  batchId: Types.ObjectId;
  professorId: Types.ObjectId;
  date: Date;
  status: SessionStatus;
  submittedAt?: Date;
  isLocked: boolean;
}

const AttendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    scheduleSlotId: { type: Schema.Types.ObjectId, ref: 'ScheduleSlot', required: true, index: true },
    overrideId: { type: Schema.Types.ObjectId, ref: 'ScheduleOverride' },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    professorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['SCHEDULED', 'SUBMITTED', 'LOCKED'],
      default: 'SCHEDULED',
      index: true,
    },
    submittedAt: { type: Date },
    isLocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent duplicate sessions for the same slot on the same date
AttendanceSessionSchema.index({ scheduleSlotId: 1, date: 1 }, { unique: true });

export const AttendanceSession = model<IAttendanceSession>('AttendanceSession', AttendanceSessionSchema);
