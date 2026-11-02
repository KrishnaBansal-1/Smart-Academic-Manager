import { Schema, model, Document, Types } from 'mongoose';

export type OverrideStatus = 'CANCELLED' | 'RESCHEDULED' | 'REVERTED' | 'ORPHANED';
export type OverrideSource = 'MANUAL' | 'EXAM' | 'HOLIDAY';

export interface IScheduleOverrideTarget {
  dateKey: string;
  period: number;
  classroomId?: Types.ObjectId;
}

export interface IScheduleOverride extends Document {
  _id: Types.ObjectId;
  lineageId: string;
  originalDateKey: string;
  originalSlotId?: Types.ObjectId;
  status: OverrideStatus;
  source: OverrideSource;
  target?: IScheduleOverrideTarget;
  examId?: Types.ObjectId;
  reason?: string;
  requestedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduleOverrideTargetSchema = new Schema<IScheduleOverrideTarget>(
  {
    dateKey: { type: String, required: true },
    period: { type: Number, required: true },
    classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom' },
  },
  { _id: false }
);

const ScheduleOverrideSchema = new Schema<IScheduleOverride>(
  {
    lineageId: { type: String, required: true, index: true },
    originalDateKey: { type: String, required: true, index: true },
    originalSlotId: { type: Schema.Types.ObjectId, ref: 'ScheduleSlot' },
    status: {
      type: String,
      enum: ['CANCELLED', 'RESCHEDULED', 'REVERTED', 'ORPHANED'],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['MANUAL', 'EXAM', 'HOLIDAY'],
      default: 'MANUAL',
      required: true,
    },
    target: { type: ScheduleOverrideTargetSchema },
    examId: { type: Schema.Types.ObjectId, ref: 'MinorExam' },
    reason: { type: String, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Compound unique index on (lineageId, originalDateKey)
ScheduleOverrideSchema.index({ lineageId: 1, originalDateKey: 1 }, { unique: true });
ScheduleOverrideSchema.index({ status: 1, 'target.dateKey': 1 });

export const ScheduleOverride = model<IScheduleOverride>('ScheduleOverride', ScheduleOverrideSchema);
