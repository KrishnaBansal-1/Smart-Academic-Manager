import { Schema, model, Document, Types } from 'mongoose';

export type OverrideStatus = 'CANCELLED' | 'RESCHEDULED';

export interface IScheduleOverride extends Document {
  _id: Types.ObjectId;
  originalSlotId: Types.ObjectId;
  overrideDate: Date; // Specific calendar date (YYYY-MM-DD)
  status: OverrideStatus;
  rescheduledDate?: Date;
  newSlotIndex?: number;
  newClassroomId?: Types.ObjectId;
  reason: string;
  requestedBy: Types.ObjectId; // Professor ID
}

const ScheduleOverrideSchema = new Schema<IScheduleOverride>(
  {
    originalSlotId: { type: Schema.Types.ObjectId, ref: 'ScheduleSlot', required: true, index: true },
    overrideDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ['CANCELLED', 'RESCHEDULED'], required: true },
    rescheduledDate: { type: Date },
    newSlotIndex: { type: Number },
    newClassroomId: { type: Schema.Types.ObjectId, ref: 'Classroom' },
    reason: { type: String, required: true, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Index to quickly look up overrides for a given slot on a specific date
ScheduleOverrideSchema.index({ originalSlotId: 1, overrideDate: 1 }, { unique: true });

export const ScheduleOverride = model<IScheduleOverride>('ScheduleOverride', ScheduleOverrideSchema);
